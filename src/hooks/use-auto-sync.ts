"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api-errors";

interface UseAutoSyncOptions {
    /**
     * Sync interval in milliseconds
     * @default 300000 (5 minutes)
     */
    interval?: number;
    /**
     * Minimum time between syncs in milliseconds
     * @default 60000 (1 minute)
     */
    minInterval?: number;
    /**
     * Whether to sync on mount
     * @default true
     */
    syncOnMount?: boolean;
    /**
     * Whether to sync when tab becomes visible
     * @default true
     */
    syncOnVisibilityChange?: boolean;
    /**
     * Whether auto-sync is enabled
     * @default true
     */
    enabled?: boolean;
    /**
     * Callback when sync completes successfully
     */
    onSuccess?: (newRecordings: number) => void;
    /**
     * Callback when sync fails
     */
    onError?: (error: string) => void;
}

interface SyncStatus {
    isAutoSyncing: boolean;
    lastSyncTime: Date | null;
    nextSyncTime: Date | null;
    lastSyncResult: {
        success: boolean;
        newRecordings?: number;
        error?: string;
    } | null;
}

const STORAGE_KEY = "openplaud_last_sync";
/**
 * Cross-tab in-flight stamp. Multiple browser tabs running this hook will
 * each try to sync on mount / visibility-change; without coordination they
 * fan out into N concurrent server calls, each of which on hosted is one
 * round-trip through the Webshare datacenter proxy. The first tab to start
 * a sync writes a token here; sibling tabs see a recent stamp and skip
 * their own call. Self-expiring after IN_FLIGHT_TTL_MS so a crashed tab
 * can't permanently block sync for the rest.
 *
 * Stamp format: `${startedAtMs}:${token}` where token is a unique per-call
 * random string. The clearing side checks the current stored value still
 * matches its own token before deleting -- otherwise a TOCTOU race between
 * two tabs that both passed the read-then-write check could see the first
 * tab to finish wipe a stamp that another tab is still relying on.
 */
const IN_FLIGHT_KEY = "openplaud_sync_in_progress";
const IN_FLIGHT_TTL_MS = 90_000;
/** Floor between manual button taps. Stops rage-clicking before it hits the API. */
const MANUAL_MIN_INTERVAL_MS = 5_000;

function parseStamp(
    raw: string | null,
): { startedAt: number; token: string } | null {
    if (!raw) return null;
    const sep = raw.indexOf(":");
    // Back-compat with the previous bare-timestamp format: treat a numeric
    // body as a stamp with an empty token. The mismatch-on-clear check
    // below will then refuse to delete it (empty token never matches a
    // real one), and TTL will expire it instead. Safer than racing.
    const startedAtStr = sep === -1 ? raw : raw.slice(0, sep);
    const token = sep === -1 ? "" : raw.slice(sep + 1);
    const startedAt = Number.parseInt(startedAtStr, 10);
    if (!Number.isFinite(startedAt)) return null;
    return { startedAt, token };
}

function readInFlightStamp(): number | null {
    try {
        const parsed = parseStamp(localStorage.getItem(IN_FLIGHT_KEY));
        if (!parsed) return null;
        if (Date.now() - parsed.startedAt > IN_FLIGHT_TTL_MS) return null;
        return parsed.startedAt;
    } catch {
        // SSR / private mode / storage quota — fall through to no-stamp.
        return null;
    }
}

function writeInFlightStamp(token: string): void {
    try {
        localStorage.setItem(IN_FLIGHT_KEY, `${Date.now()}:${token}`);
    } catch {
        // Ignore — best-effort cross-tab signal.
    }
}

/**
 * Remove the stamp ONLY if it still carries our token. Prevents one tab
 * from wiping another tab's active lock if both raced past the read check
 * (TOCTOU). A stamp written by a sibling tab is left alone so its own TTL
 * (or its own clear-on-finish) decides when to drop it.
 */
function clearInFlightStampIfOwned(token: string): void {
    try {
        const parsed = parseStamp(localStorage.getItem(IN_FLIGHT_KEY));
        if (parsed && parsed.token === token) {
            localStorage.removeItem(IN_FLIGHT_KEY);
        }
    } catch {
        // Ignore.
    }
}

function newSyncToken(): string {
    // Math.random is plenty here -- this is a non-security collision tag.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useAutoSync(options: UseAutoSyncOptions = {}) {
    const {
        interval = 5 * 60 * 1000, // 5 minutes default
        minInterval = 60 * 1000, // 1 minute minimum
        syncOnMount = true,
        syncOnVisibilityChange = true,
        enabled = true,
        onSuccess,
        onError,
    } = options;

    const router = useRouter();
    const [status, setStatus] = useState<SyncStatus>({
        isAutoSyncing: false,
        lastSyncTime: null,
        nextSyncTime: null,
        lastSyncResult: null,
    });

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isSyncingRef = useRef(false);
    const lastSyncTimeRef = useRef<number>(0);
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);

    // Update callback refs
    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
    }, [onSuccess, onError]);

    // Load last sync time from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const lastSync = new Date(stored);
            setStatus((prev) => ({ ...prev, lastSyncTime: lastSync }));
            lastSyncTimeRef.current = lastSync.getTime();
        }
    }, []);

    const performSync = useCallback(
        async (silent = true) => {
            if (isSyncingRef.current) {
                return;
            }

            const now = Date.now();

            if (silent) {
                const timeSinceLastSync = now - lastSyncTimeRef.current;
                if (timeSinceLastSync < minInterval) {
                    return;
                }
            } else {
                // Manual taps also honor a small floor so a rage-click
                // can't shovel duplicate jobs at the proxy. The server
                // rate limit (PLAUD_SYNC_RATE_LIMIT_PER_MINUTE) is the
                // hard cap; this is the friendly client-side gate.
                const timeSinceLastSync = now - lastSyncTimeRef.current;
                if (timeSinceLastSync < MANUAL_MIN_INTERVAL_MS) {
                    const waitSeconds = Math.ceil(
                        (MANUAL_MIN_INTERVAL_MS - timeSinceLastSync) / 1000,
                    );
                    onErrorRef.current?.(
                        `Just synced. Try again in ${waitSeconds}s.`,
                    );
                    return;
                }
            }

            // Cross-tab coordination: if another tab in this browser is
            // mid-sync, skip. Stamp self-expires after IN_FLIGHT_TTL_MS.
            if (readInFlightStamp() !== null) {
                return;
            }

            const token = newSyncToken();
            isSyncingRef.current = true;
            writeInFlightStamp(token);
            setStatus((prev) => ({ ...prev, isAutoSyncing: true }));

            try {
                const response = await fetch("/api/plaud/sync", {
                    method: "POST",
                });

                if (response.ok) {
                    const result = await response.json();
                    const syncTime = new Date();
                    lastSyncTimeRef.current = syncTime.getTime();
                    localStorage.setItem(STORAGE_KEY, syncTime.toISOString());

                    // Server coalesced this into a same-process in-flight
                    // run. No new data was fetched on our behalf; render
                    // as a quiet no-op so we don't double-toast or refresh.
                    if (result.inProgress) {
                        setStatus((prev) => ({
                            ...prev,
                            lastSyncTime: syncTime,
                            lastSyncResult: {
                                success: true,
                                newRecordings: 0,
                            },
                        }));
                        return;
                    }

                    setStatus((prev) => ({
                        ...prev,
                        lastSyncTime: syncTime,
                        lastSyncResult: {
                            success: true,
                            newRecordings: result.newRecordings || 0,
                        },
                    }));

                    if (!silent || result.newRecordings > 0) {
                        router.refresh();
                    }

                    if (result.newRecordings > 0) {
                        onSuccessRef.current?.(result.newRecordings);
                    } else if (!silent) {
                        onSuccessRef.current?.(0);
                    }
                } else {
                    const errorMessage = await getApiErrorMessage(
                        response,
                        "Sync failed",
                    );

                    setStatus((prev) => ({
                        ...prev,
                        lastSyncResult: {
                            success: false,
                            error: errorMessage,
                        },
                    }));

                    if (!silent) {
                        onErrorRef.current?.(errorMessage);
                    }
                }
            } catch {
                const errorMessage = "Failed to sync with Plaud device";
                setStatus((prev) => ({
                    ...prev,
                    lastSyncResult: {
                        success: false,
                        error: errorMessage,
                    },
                }));

                if (!silent) {
                    onErrorRef.current?.(errorMessage);
                }
            } finally {
                isSyncingRef.current = false;
                clearInFlightStampIfOwned(token);
                setStatus((prev) => ({
                    ...prev,
                    isAutoSyncing: false,
                    nextSyncTime: new Date(Date.now() + interval),
                }));
            }
        },
        [router, minInterval, interval],
    );

    useEffect(() => {
        if (!enabled) {
            return;
        }

        if (syncOnMount) {
            performSync(true);
        }

        intervalRef.current = setInterval(() => {
            performSync(true);
        }, interval);

        setStatus((prev) => ({
            ...prev,
            nextSyncTime: new Date(Date.now() + interval),
        }));

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, interval, syncOnMount, performSync]);

    useEffect(() => {
        if (!enabled || !syncOnVisibilityChange) {
            return;
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
                if (timeSinceLastSync > interval / 2) {
                    performSync(true);
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
        };
    }, [enabled, syncOnVisibilityChange, interval, performSync]);

    const manualSync = useCallback(() => {
        return performSync(false);
    }, [performSync]);

    return {
        ...status,
        manualSync,
    };
}

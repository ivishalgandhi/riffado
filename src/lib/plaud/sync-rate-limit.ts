/**
 * Per-user rate limit for POST /api/plaud/sync.
 *
 * Why: every sync request that reaches `syncRecordingsForUser` paginates
 * Plaud and downloads any new/changed recordings, all of which go through
 * the Webshare datacenter proxy on hosted (see `src/lib/plaud/proxy.ts`).
 * A user spam-clicking the sync button, or N tabs auto-syncing in parallel,
 * fans out into N concurrent proxy-bound runs. Backstop here: cap at
 * `PLAUD_SYNC_RATE_LIMIT_PER_MINUTE` (default 10) per user per minute,
 * 429 once exceeded, no Plaud or Webshare call issued.
 *
 * Multi-process safe: backed by the existing `apiRateLimitBuckets` Postgres
 * table via `consumeRateLimitBucket`, so it works correctly across the
 * hosted load-balanced Next.js workers.
 *
 * Complements two other layers:
 *   1. Client-side dedup in `use-auto-sync.ts` (localStorage stamp +
 *      manual-sync 5s floor) — keeps the common case off the wire entirely.
 *   2. In-process promise dedup in `syncRecordingsForUser` — coalesces
 *      same-process concurrent calls into one Plaud round-trip.
 */

import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ErrorCode } from "@/lib/errors";
import { consumeRateLimitBucket } from "@/lib/rate-limit";

const WINDOW_MS = 60_000;

/**
 * Consume one token from the per-user sync bucket. Returns null when the
 * request is allowed; returns a 429 response when the bucket is exhausted.
 *
 * Caller pattern:
 *
 *     const limited = await enforcePlaudSyncRateLimit(userId);
 *     if (limited) return limited;
 *     // ...proceed with sync...
 */
export async function enforcePlaudSyncRateLimit(
    userId: string,
): Promise<NextResponse | null> {
    const limit = env.PLAUD_SYNC_RATE_LIMIT_PER_MINUTE;
    const result = await consumeRateLimitBucket(`plaud-sync:user:${userId}`, {
        limit,
        windowMs: WINDOW_MS,
    });

    if (result.allowed) return null;

    const retryAfter = Math.max(
        1,
        Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
    );
    const resetAt = Math.ceil(result.resetAt.getTime() / 1000);

    return NextResponse.json(
        {
            error: "You are syncing too often. Please wait a moment and try again.",
            code: ErrorCode.RATE_LIMITED,
            details: {
                retryAfter,
                limit: result.limit,
                remaining: result.remaining,
                resetAt,
            },
        },
        {
            status: 429,
            headers: {
                "Retry-After": retryAfter.toString(),
                "X-RateLimit-Limit": result.limit.toString(),
                "X-RateLimit-Remaining": result.remaining.toString(),
                "X-RateLimit-Reset": resetAt.toString(),
            },
        },
    );
}

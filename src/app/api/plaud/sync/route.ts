import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-server";
import { apiHandler } from "@/lib/errors";
import { enforcePlaudSyncRateLimit } from "@/lib/plaud/sync-rate-limit";
import { syncRecordingsForUser } from "@/lib/sync/sync-recordings";

export const POST = apiHandler(async (request: Request) => {
    const session = await requireApiSession(request);

    // Backstop against spam-click + multi-tab fan-out. Defaults to 10/min
    // per user; configurable via PLAUD_SYNC_RATE_LIMIT_PER_MINUTE. Returns
    // before any Plaud/Webshare call is issued.
    const limited = await enforcePlaudSyncRateLimit(session.user.id);
    if (limited) return limited;

    const result = await syncRecordingsForUser(session.user.id);

    return NextResponse.json({
        success: true,
        newRecordings: result.newRecordings,
        updatedRecordings: result.updatedRecordings,
        errors: result.errors,
        // `true` when this call coalesced into an already-running sync
        // in the same process. Clients should treat as a no-op success
        // (no router.refresh(), no "synced N" toast).
        inProgress: result.inProgress,
    });
});

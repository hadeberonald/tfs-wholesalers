/**
 * instrumentation.ts  (project root — same level as app/)
 *
 * Boots a self-healing scheduler on server start.
 * Calls /api/sync/pos every hour with no file attached —
 * the route will attempt FTP pull (once MTN opens port 21).
 *
 * The HTTPS push from the POS batch file is the primary method
 * and runs independently of this scheduler. This scheduler is
 * the safety net — ensures a sync happens even if the POS
 * machine's batch file misses a run for any reason.
 */

// Tells Next.js to never bundle this file for browser or edge runtime
export const runtime = 'nodejs';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Wait 30s after boot before first check
  setTimeout(() => {
    bootSyncScheduler();
  }, 30_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const SYNC_INTERVAL_MS  = 60 * 60 * 1000; // check every 60 min
const MIN_GAP_MS        = 55 * 60 * 1000; // only sync if 55+ min since last run
const MAX_RETRIES       = 3;
const RETRY_BASE_DELAY  = 30_000;          // 30s, 60s, 120s
const WATCHDOG_INTERVAL = 5 * 60 * 1000;  // watchdog every 5 min

let schedulerAlive             = false;
let lastAttemptAt: Date | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────
function bootSyncScheduler() {
  if (schedulerAlive) return;
  schedulerAlive = true;

  console.log('[Sync Scheduler] Booting...');

  runSyncIfDue();

  const mainInterval = setInterval(() => {
    runSyncIfDue();
  }, SYNC_INTERVAL_MS);

  const watchdog = setInterval(() => {
    const msSinceAttempt = lastAttemptAt
      ? Date.now() - lastAttemptAt.getTime()
      : Infinity;

    if (msSinceAttempt > 70 * 60 * 1000) {
      console.warn('[Sync Watchdog] No attempt in 70 min — triggering check');
      runSyncIfDue();
    }
  }, WATCHDOG_INTERVAL);

  mainInterval.unref?.();
  watchdog.unref?.();

  console.log('[Sync Scheduler] Running — interval: 60 min, watchdog: 5 min');
}

// ─────────────────────────────────────────────────────────────────────────────
// SHOULD WE SYNC?
// ─────────────────────────────────────────────────────────────────────────────
async function shouldSync(): Promise<{ run: boolean; reason: string }> {
  try {
    const { default: clientPromise } = await import('@/lib/mongodb');
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const lastSuccess = await db.collection('syncLog').findOne(
      {
        type:    'pos_ftp_sync',
        success: true,
        ...(process.env.BRANCH_ID ? { branchId: process.env.BRANCH_ID } : {}),
      },
      { sort: { createdAt: -1 } }
    );

    if (!lastSuccess) {
      return { run: true, reason: 'No previous successful sync found' };
    }

    const msSinceLast = Date.now() - new Date(lastSuccess.createdAt).getTime();

    if (msSinceLast >= MIN_GAP_MS) {
      return { run: true, reason: `Last sync was ${Math.round(msSinceLast / 60_000)} min ago` };
    }

    const minRemaining = Math.round((MIN_GAP_MS - msSinceLast) / 60_000);
    return {
      run:    false,
      reason: `Last sync ${Math.round(msSinceLast / 60_000)} min ago — next in ~${minRemaining} min`,
    };
  } catch (err: any) {
    console.error('[Sync Scheduler] Could not check syncLog:', err.message);
    return { run: true, reason: 'Could not verify last sync time — running to be safe' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────────────────────────────────────
async function runSyncIfDue() {
  lastAttemptAt = new Date();

  try {
    const { run, reason } = await shouldSync();
    if (!run) {
      console.log(`[Sync Scheduler] Skipping — ${reason}`);
      return;
    }

    console.log(`[Sync Scheduler] Triggering — ${reason}`);
    await runWithRetry();
  } catch (err: any) {
    console.error('[Sync Scheduler] Unexpected error:', err.message);
  }
}

async function runWithRetry(attempt = 1): Promise<void> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      || `http://localhost:${process.env.PORT || 3000}`;
    const secret = process.env.SYNC_SECRET;

    if (!secret) {
      console.error('[Sync Scheduler] SYNC_SECRET not set — aborting');
      return;
    }

    // No file body — route will attempt FTP pull
    const res = await fetch(`${appUrl}/api/sync/pos`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'X-Internal':    'scheduler',
      },
      signal: AbortSignal.timeout(4 * 60 * 1000),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      console.log(
        `[Sync Scheduler] ✅ Complete via ${data.method} — ` +
        `updated:${data.updated} created:${data.created} ` +
        `specials:${data.specialsApplied} errors:${data.errors?.length ?? 0} ` +
        `(${data.durationMs}ms)`
      );
    } else {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
  } catch (err: any) {
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
      console.warn(
        `[Sync Scheduler] Attempt ${attempt} failed: ${err.message} — ` +
        `retrying in ${delay / 1000}s`
      );
      await sleep(delay);
      return runWithRetry(attempt + 1);
    }

    console.error(`[Sync Scheduler] ❌ All ${MAX_RETRIES} attempts failed: ${err.message}`);

    try {
      const { default: clientPromise } = await import('@/lib/mongodb');
      const client = await clientPromise;
      await client.db('tfs-wholesalers').collection('syncLog').insertOne({
        type:      'pos_ftp_sync',
        success:   false,
        branchId:  process.env.BRANCH_ID,
        error:     err.message,
        attempts:  MAX_RETRIES,
        createdAt: new Date(),
      });
    } catch {
      console.error('[Sync Scheduler] Could not write failure to syncLog');
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
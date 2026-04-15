// lib/sendWebPush.ts
// Server-side utility for sending Web Push notifications to browser subscribers.
// Uses the `web-push` npm package (run: npm install web-push @types/web-push).
//
// Required env vars:
//   VAPID_PUBLIC_KEY   — from `npx web-push generate-vapid-keys`
//   VAPID_PRIVATE_KEY  — from same command
//   VAPID_SUBJECT      — e.g. mailto:admin@tfswholesalers.com
//
// How to generate VAPID keys:
//   npx web-push generate-vapid-keys
// Then add to your Render environment variables.

import webpush from 'web-push';
import clientPromise from './mongodb';
import type { PushPayload } from './sendPushNotification';

// Lazy-configure webpush — only runs once, throws if env vars missing
let _configured = false;

function configureWebPush() {
  if (_configured) return;

  const publicKey  = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject    = process.env.VAPID_SUBJECT ?? 'mailto:admin@tfswholesalers.com';

  if (!publicKey || !privateKey) {
    throw new Error(
      '[WebPush] Missing VAPID keys. Run: npx web-push generate-vapid-keys\n' +
      'Then add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY to your env'
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  _configured = true;
}

// ── Send to one subscription ──────────────────────────────────────────────────

export async function sendWebPush(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<void> {
  try {
    configureWebPush();
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log(`[WebPush] Sent to …${subscription.endpoint.slice(-20)}`);
  } catch (err: any) {
    // 410 Gone = subscription expired/revoked — clean it up
    if (err.statusCode === 410) {
      console.warn(`[WebPush] Subscription expired (410), removing: …${subscription.endpoint.slice(-20)}`);
      await removeExpiredSubscription(subscription.endpoint);
    } else {
      console.error('[WebPush] sendWebPush error:', err.message ?? err);
    }
  }
}

async function removeExpiredSubscription(endpoint: string): Promise<void> {
  try {
    const client = await clientPromise;
    await client.db('tfs-wholesalers').collection('web_push_subscriptions').deleteOne({
      'subscription.endpoint': endpoint,
    });
  } catch { /* non-critical */ }
}

// ── Notify a specific user's browser subscriptions ───────────────────────────

export async function notifyUserWeb(
  userId: string,
  payload: PushPayload
): Promise<void> {
  try {
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const subs = await db.collection('web_push_subscriptions').find({ userId }).toArray();
    if (!subs.length) {
      console.log(`[WebPush] No browser subscriptions for userId ${userId}`);
      return;
    }

    await Promise.allSettled(subs.map(doc => sendWebPush(doc.subscription, payload)));
    console.log(`[WebPush] Notified ${subs.length} browser subscription(s) for user ${userId}`);
  } catch (err) {
    console.error('[WebPush] notifyUserWeb failed:', err);
  }
}

// ── Notify all browser subscribers at a branch (admin/picker web users) ───────

export async function notifyBranchWeb(
  branchId: string,
  payload: PushPayload
): Promise<void> {
  try {
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    // Get all staff userIds for this branch
    const staff = await db.collection('users').find(
      { activeBranchId: branchId, role: { $in: ['picker', 'delivery', 'admin'] } },
      { projection: { _id: 1 } }
    ).toArray();

    if (!staff.length) return;

    const userIds = staff.map(s => s._id.toString());
    const subs    = await db.collection('web_push_subscriptions').find({
      userId: { $in: userIds },
    }).toArray();

    if (!subs.length) {
      console.log(`[WebPush] No browser subscriptions for branch ${branchId} staff`);
      return;
    }

    await Promise.allSettled(subs.map(doc => sendWebPush(doc.subscription, payload)));
    console.log(`[WebPush] Notified ${subs.length} browser subscription(s) for branch ${branchId}`);
  } catch (err) {
    console.error('[WebPush] notifyBranchWeb failed:', err);
  }
}
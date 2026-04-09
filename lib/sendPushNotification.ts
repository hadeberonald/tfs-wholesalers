// lib/sendPushNotification.ts
import clientPromise from '@/lib/mongodb';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

// Send to a single token
export async function sendPushNotification(
  expoPushToken: string,
  payload: PushPayload
): Promise<void> {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify({
      to:    expoPushToken,
      title: payload.title,
      body:  payload.body,
      data:  payload.data  || {},
      sound: 'default',
      priority: 'high',
    }),
  });
}

// Send to all pickers registered at a specific branch
export async function notifyBranchPickers(
  branchId: string,
  payload: PushPayload
): Promise<void> {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // Get all picker/delivery user IDs for this branch
    const branchUsers = await db.collection('users').find(
      {
        activeBranchId: branchId,
        role: { $in: ['picker', 'delivery', 'admin'] },
      },
      { projection: { _id: 1 } }
    ).toArray();

    if (!branchUsers.length) return;

    const userIds = branchUsers.map(u => u._id.toString());

    // Get their push tokens
    const tokenDocs = await db.collection('push_tokens').find(
      { userId: { $in: userIds } }
    ).toArray();

    if (!tokenDocs.length) return;

    // Send to all in parallel
    await Promise.allSettled(
      tokenDocs.map(doc => sendPushNotification(doc.pushToken, payload))
    );

    console.log(`[Push] Notified ${tokenDocs.length} picker(s) at branch ${branchId}`);
  } catch (err) {
    console.error('[Push] notifyBranchPickers failed:', err);
  }
}

// Send to a specific user by their userId
export async function notifyUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const tokenDoc = await db.collection('push_tokens').findOne({ userId });
    if (!tokenDoc?.pushToken) return;

    await sendPushNotification(tokenDoc.pushToken, payload);
    console.log(`[Push] Notified user ${userId}`);
  } catch (err) {
    console.error('[Push] notifyUser failed:', err);
  }
}
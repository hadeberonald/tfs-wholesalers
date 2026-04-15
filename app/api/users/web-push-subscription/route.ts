// app/api/users/web-push-subscription/route.ts
// Stores and removes browser Web Push subscriptions.
// These are DIFFERENT from Expo push tokens (which are for the mobile app).
// Web subscriptions go into the `web_push_subscriptions` collection.

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── POST: save or update a web push subscription ──────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, userId } = body;

    if (!subscription?.endpoint) {
      return NextResponse.json(
        { success: false, error: 'Valid Web Push subscription object is required' },
        { status: 400, headers: CORS }
      );
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    await db.collection('web_push_subscriptions').updateOne(
      { 'subscription.endpoint': subscription.endpoint },
      {
        $set: {
          subscription,
          userId:    userId ?? null,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    console.log(`[WebPush] Subscription saved — userId: ${userId ?? 'guest'} | endpoint: …${subscription.endpoint.slice(-20)}`);
    return NextResponse.json({ success: true }, { headers: CORS });
  } catch (err) {
    console.error('[WebPush] POST subscription failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to save subscription' },
      { status: 500, headers: CORS }
    );
  }
}

// ── DELETE: remove a web push subscription ────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'endpoint is required' },
        { status: 400, headers: CORS }
      );
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    await db.collection('web_push_subscriptions').deleteOne({
      'subscription.endpoint': endpoint,
    });

    console.log(`[WebPush] Subscription removed: …${endpoint.slice(-20)}`);
    return NextResponse.json({ success: true }, { headers: CORS });
  } catch (err) {
    console.error('[WebPush] DELETE subscription failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to remove subscription' },
      { status: 500, headers: CORS }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}
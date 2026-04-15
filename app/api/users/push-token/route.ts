// app/api/push-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { verifyMobileToken } from '@/lib/verify-mobile-token';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pushToken, platform, userId: bodyUserId } = body;

    if (!pushToken || typeof pushToken !== 'string' || !pushToken.startsWith('ExponentPushToken')) {
      return NextResponse.json(
        { success: false, error: 'Valid Expo pushToken is required' },
        { status: 400, headers: CORS }
      );
    }

    // Resolve userId: Bearer token wins (verified identity), then body userId, then null (guest)
    let resolvedUserId: string | null = bodyUserId ?? null;

    const authHeader = request.headers.get('authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) {
      const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
      if (mobileUser?.id) {
        resolvedUserId = mobileUser.id; // always override with verified identity
      }
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    if (resolvedUserId) {
      // ── Authenticated path ─────────────────────────────────────────────────
      // Always write userId into $set so:
      //   (a) A newly inserted token gets the userId immediately.
      //   (b) A previously-guest token gets re-linked to the real user.
      // We also delete any OTHER guest-tagged document for this same token
      // to avoid duplicates from pre-login registration.
      await db.collection('push_tokens').updateOne(
        { pushToken },
        {
          $set: {
            pushToken,
            userId:    resolvedUserId,
            platform:  platform ?? 'unknown',
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      console.log(
        `[PushToken] Saved (authenticated) — userId: ${resolvedUserId} | platform: ${platform} | token: …${pushToken.slice(-8)}`
      );
    } else {
      // ── Guest path ─────────────────────────────────────────────────────────
      // Store the token but only set userId on first insert (setOnInsert).
      // If the document already exists (i.e. the user previously registered
      // while authenticated), do NOT overwrite the real userId with null.
      await db.collection('push_tokens').updateOne(
        { pushToken },
        {
          $set: {
            platform:  platform ?? 'unknown',
            updatedAt: new Date(),
          },
          $setOnInsert: {
            pushToken,
            userId:    null,           // only written on first-ever insert
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      console.log(
        `[PushToken] Saved (guest) — platform: ${platform} | token: …${pushToken.slice(-8)}`
      );
    }

    return NextResponse.json({ success: true }, { headers: CORS });
  } catch (err) {
    console.error('[PushToken] POST failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to save push token' },
      { status: 500, headers: CORS }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: CORS }
      );
    }

    const mobileUser = await verifyMobileToken(authHeader.replace('Bearer ', ''));
    if (!mobileUser?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: CORS }
      );
    }

    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    // Try to get the specific device token from body —
    // so logout only removes this device, not all devices for the user
    let pushToken: string | null = null;
    try {
      const b = await request.json();
      pushToken = b?.pushToken ?? null;
    } catch { /* body is optional */ }

    if (pushToken) {
      await db.collection('push_tokens').deleteOne({ pushToken, userId: mobileUser.id });
      console.log(`[PushToken] Removed device token for user ${mobileUser.id}`);
    } else {
      await db.collection('push_tokens').deleteMany({ userId: mobileUser.id });
      console.log(`[PushToken] Removed ALL tokens for user ${mobileUser.id}`);
    }

    return NextResponse.json({ success: true }, { headers: CORS });
  } catch (err) {
    console.error('[PushToken] DELETE failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to remove push token' },
      { status: 500, headers: CORS }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}
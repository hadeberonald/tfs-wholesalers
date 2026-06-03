import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyMobileToken } from '@/lib/verify-mobile-token';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET!;

export type HandlingEventType =
  | 'item_picked_barcode'
  | 'item_picked_manual'
  | 'item_oos'
  | 'package_sealed'
  | 'package_collected'
  | 'delivery_started'
  | 'delivery_completed';

export interface HandlingEvent {
  eventType:   HandlingEventType;
  actorId:     string;
  actorName:   string;
  actorRole:   'picker' | 'driver' | 'admin';
  itemSku?:    string;
  itemName?:   string;
  scanKey?:    string;
  packageQr?:  string;
  packageNum?: number;
  timestamp:   string;
  meta?:       Record<string, unknown>;
}

type AuthResult = {
  actorId:   string;
  actorName: string;
  actorRole: 'picker' | 'driver' | 'admin';
} | null;

async function authenticate(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization') ?? '';

  if (authHeader.startsWith('Bearer ')) {
    const user = await verifyMobileToken(authHeader.replace('Bearer ', ''));
    if (!user) return null;
    return {
      actorId:   user.id,
      actorName: user.name ?? 'Staff',
      actorRole: user.role === 'driver' ? 'driver' : 'picker',
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      name?:  string;
    };
    return {
      actorId:   decoded.userId,
      actorName: decoded.name ?? 'Admin',
      actorRole: 'admin',
    };
  } catch {
    return null;
  }
}

// ── POST /api/orders/:orderId/handling-log ──────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const actor = await authenticate(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Partial<HandlingEvent>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.eventType) {
    return NextResponse.json({ error: 'eventType is required' }, { status: 400 });
  }

  const event: HandlingEvent = {
    eventType: body.eventType,
    actorId:   actor.actorId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    timestamp: new Date().toISOString(),
    ...(body.itemSku    && { itemSku:    body.itemSku    }),
    ...(body.itemName   && { itemName:   body.itemName   }),
    ...(body.scanKey    && { scanKey:    body.scanKey    }),
    ...(body.packageQr  && { packageQr:  body.packageQr  }),
    ...(body.packageNum && { packageNum: body.packageNum }),
    ...(body.meta       && { meta:       body.meta       }),
  };

  try {
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const filter = ObjectId.isValid(params.orderId)
      ? { _id: new ObjectId(params.orderId) }
      : { orderNumber: params.orderId };

    const result = await db.collection('orders').updateOne(
      filter,
      {
        $push: { handlingLog: event } as any,
        $set: {
          updatedAt:       new Date(),
          lastHandledBy:   actor.actorName,
          lastHandledById: actor.actorId,
          lastHandledAt:   event.timestamp,
          lastHandledRole: actor.actorRole,
        },
      },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, event });
  } catch (err) {
    console.error('[handling-log] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET /api/orders/:orderId/handling-log ───────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const actor = await authenticate(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const filter = ObjectId.isValid(params.orderId)
      ? { _id: new ObjectId(params.orderId) }
      : { orderNumber: params.orderId };

    const order = await db.collection('orders').findOne(filter, {
      projection: {
        handlingLog:     1,
        lastHandledBy:   1,
        lastHandledAt:   1,
        lastHandledRole: 1,
      },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    return NextResponse.json({
      handlingLog:     order.handlingLog     ?? [],
      lastHandledBy:   order.lastHandledBy   ?? null,
      lastHandledAt:   order.lastHandledAt   ?? null,
      lastHandledRole: order.lastHandledRole ?? null,
    });
  } catch (err) {
    console.error('[handling-log] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
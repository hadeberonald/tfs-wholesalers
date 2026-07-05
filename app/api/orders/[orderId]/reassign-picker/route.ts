// app/api/orders/[orderId]/reassign-picker/route.ts
//
// Reassigns (or clears) the *person* picking an order — distinct from the
// branch-reassignment route, which moves the whole order to a different
// store. This is the "actually give it to a different picker" flow.
//
// POST body: { pickerId: string | null, pickerName?: string }
//   - pickerId set        -> assigns that person as the picker
//   - pickerId null/''    -> unassigns (order goes back to the open pool;
//                            the next picker who opens it in the app will
//                            claim it automatically — see the matching
//                            PickingScreen.tsx change)
//
// ASSUMPTIONS (verify these):
//   1. Permission string 'orders:write' — swap if your app uses a
//      different key for order-management actions.
//   2. notifyBranchPickers(branchId, order, status) — reused from wherever
//      your existing branch-reassign route calls it. If the real signature
//      differs, adjust the call below; this is the one part I couldn't see
//      directly.

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission, isPermissionError } from '@/lib/with-permission';
import { notifyBranchPickers } from '@/lib/socket';

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const auth = await requirePermission('orders:write');
  if (isPermissionError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { pickerId?: string | null; pickerName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const pickerId   = body.pickerId ? String(body.pickerId) : null;
  const pickerName = pickerId ? (body.pickerName ?? null) : null;

  try {
    const client = await clientPromise;
    const db     = client.db('tfs-wholesalers');

    const filter = ObjectId.isValid(params.orderId)
      ? { _id: new ObjectId(params.orderId) }
      : { orderNumber: params.orderId };

    const existing = await db.collection('orders').findOne(filter);
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (['delivered', 'cancelled'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Order is ${existing.status} and can't be reassigned` },
        { status: 400 },
      );
    }

    // Sanity check: if a specific picker is being assigned, make sure they
    // actually belong to this order's branch — the admin dropdown filters
    // client-side, but a stale dropdown or a direct API call shouldn't be
    // able to hand an order to someone from a different branch.
    if (pickerId) {
      const pickerUser = await db.collection('users').findOne({
        _id: ObjectId.isValid(pickerId) ? new ObjectId(pickerId) : pickerId,
      });
      const pickerBranchId = pickerUser?.activeBranchId ?? pickerUser?.branchId ?? null;
      if (!pickerUser || (existing.branchId && String(pickerBranchId) !== String(existing.branchId))) {
        return NextResponse.json(
          { error: 'That picker is not assigned to this order\u2019s branch' },
          { status: 400 },
        );
      }
    }

    const previousPickerId   = existing.assignedPickerId   ?? existing.pickerId   ?? null;
    const previousPickerName = existing.assignedPickerName ?? existing.pickerName ?? null;

    const updateResult = await db.collection('orders').findOneAndUpdate(
      filter,
      {
        $set: {
          assignedPickerId:   pickerId,
          assignedPickerName: pickerName,
          pickerReassignedAt: new Date(),
          updatedAt:          new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    // Mongo driver v4 vs v5 return shape differs (`.value` vs the doc itself)
    const updatedOrder: any = (updateResult as any)?.value ?? updateResult;
    if (!updatedOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // ── Accountability log ──────────────────────────────────────────────
    const reassignEvent = {
      eventType: 'order_reassigned' as const,
      // Same open item as the branch-reassign route: real admin identity
      // needs lib/get-admin-branch.ts confirmed before this is accurate.
      actorId:   'admin',
      actorName: 'Admin',
      actorRole: 'admin' as const,
      timestamp: new Date().toISOString(),
      meta: {
        reassignType:   'picker',
        fromPickerId:   previousPickerId,
        fromPickerName: previousPickerName,
        toPickerId:     pickerId,
        toPickerName:   pickerName,
      },
    };

    await db.collection('orders').updateOne(filter, {
      $push: { handlingLog: reassignEvent } as any,
    });

    // ── Live push to the picker app ──────────────────────────────────────
    try {
      if (updatedOrder.branchId) {
        await notifyBranchPickers(String(updatedOrder.branchId), updatedOrder, updatedOrder.status);
      }
    } catch (err) {
      console.warn('[reassign-picker] socket notify failed (non-fatal):', err);
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error('[reassign-picker] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
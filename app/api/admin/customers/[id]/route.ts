/**
 * app/api/admin/customers/[id]/route.ts
 *
 * PUT    — update a customer record (including tillAccountNumber)
 * DELETE — delete a customer record
 *
 * Permission: online-customers:write
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission('online-customers:write');
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { name, email, phone, tillAccountNumber, notes } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const filter = { _id: new ObjectId(params.id) };

    // Non-super-admins can only update records in their branch
    if (!auth.isSuperAdmin && auth.branchId) {
      Object.assign(filter, {
        $or: [
          { branchId: auth.branchId },
          { branchId: auth.branchId.toString() },
        ],
      });
    }

    const result = await db.collection('online_customers').updateOne(filter, {
      $set: {
        name,
        email: email.toLowerCase(),
        phone: phone || null,
        tillAccountNumber: tillAccountNumber?.trim() || null,
        notes: notes || null,
        updatedAt: new Date(),
      },
    });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Customer record not found or not authorised' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update online customer:', error);
    return NextResponse.json({ error: 'Failed to update customer record' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission('online-customers:write');
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const filter: any = { _id: new ObjectId(params.id) };

    if (!auth.isSuperAdmin && auth.branchId) {
      filter.$or = [
        { branchId: auth.branchId },
        { branchId: auth.branchId.toString() },
      ];
    }

    const result = await db.collection('online_customers').deleteOne(filter);

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Customer record not found or not authorised' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete online customer:', error);
    return NextResponse.json({ error: 'Failed to delete customer record' }, { status: 500 });
  }
}
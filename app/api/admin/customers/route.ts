/**
 * app/api/admin/customers/route.ts
 *
 * Manages the `online_customers` collection — a bridge between
 * e-commerce users and their in-store till account numbers.
 *
 * GET  — list all customer account records (branch-scoped)
 * POST — create a new customer account record
 *
 * Permission: online-customers:read / online-customers:write
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('online-customers:read');
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query: any = {};

    // Scope non-super-admins to their branch
    if (!auth.isSuperAdmin && auth.branchId) {
      query.$or = [
        { branchId: auth.branchId },
        { branchId: auth.branchId.toString() },
      ];
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    if (search) {
      const re = { $regex: search, $options: 'i' };
      const searchClause = { $or: [{ name: re }, { email: re }, { tillAccountNumber: re }, { phone: re }] };
      // Merge with existing query
      if (query.$or) {
        query.$and = [{ $or: query.$or }, searchClause];
        delete query.$or;
      } else {
        Object.assign(query, searchClause);
      }
    }

    const customers = await db
      .collection('online_customers')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const serialized = customers.map((c) => ({
      ...c,
      _id: c._id.toString(),
      branchId: c.branchId?.toString() ?? null,
    }));

    return NextResponse.json({ customers: serialized });
  } catch (error) {
    console.error('Failed to fetch online customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    // Resolve which branchId to store
    const branchId = auth.isSuperAdmin
      ? body.branchId
        ? new ObjectId(body.branchId)
        : null
      : auth.branchId;

    // Prevent duplicate email within branch
    const existing = await db.collection('online_customers').findOne({
      email: email.toLowerCase(),
      branchId,
    });
    if (existing) {
      return NextResponse.json(
        { error: 'A customer record with this email already exists for this branch' },
        { status: 400 }
      );
    }

    const now = new Date();
    const result = await db.collection('online_customers').insertOne({
      name,
      email: email.toLowerCase(),
      phone: phone || null,
      tillAccountNumber: tillAccountNumber?.trim() || null,
      notes: notes || null,
      branchId,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      { success: true, id: result.insertedId.toString() },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create online customer:', error);
    return NextResponse.json({ error: 'Failed to create customer record' }, { status: 500 });
  }
}
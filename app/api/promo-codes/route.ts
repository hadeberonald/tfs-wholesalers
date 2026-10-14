import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export interface PromoCode {
  _id?: ObjectId;
  branchId: ObjectId;
  code: string;
  type: 'free_delivery' | 'percentage' | 'fixed_amount';
  value: number;               // ignored for free_delivery; % for percentage; R amount for fixed_amount
  includesFreeDelivery?: boolean; // percentage / fixed_amount only: also waive the delivery fee
  minOrderValue?: number;      // subtotal must be >= this to qualify
  maxDiscount?: number;        // cap on discount amount (percentage type only)
  usageLimit?: number;         // total redemptions allowed, undefined = unlimited
  usageLimitPerCustomer?: number;
  usedCount: number;
  startDate?: Date | null;
  expiryDate?: Date | null;
  active: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('promo-codes:read');
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const searchParams = request.nextUrl.searchParams;
    const branchIdParam = searchParams.get('branchId');

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    const query: any = {};
    if (!auth.isSuperAdmin && auth.branchId) {
      query.branchId = auth.branchId;
    } else if (branchIdParam && ObjectId.isValid(branchIdParam)) {
      query.branchId = new ObjectId(branchIdParam);
    }

    const promoCodes = await db
      .collection('promoCodes')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      promoCodes: promoCodes.map((p) => ({ ...p, _id: p._id.toString(), branchId: p.branchId.toString() })),
    });
  } catch (error) {
    console.error('[Promo Codes] Failed to fetch:', error);
    return NextResponse.json({ error: 'Failed to fetch promo codes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('promo-codes:write');
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const {
      branchId,
      code,
      type,
      value,
      includesFreeDelivery,
      minOrderValue,
      maxDiscount,
      usageLimit,
      usageLimitPerCustomer,
      startDate,
      expiryDate,
      active,
      description,
    } = body;

    if (!branchId || !ObjectId.isValid(branchId)) {
      return NextResponse.json({ error: 'Valid branchId is required' }, { status: 400 });
    }
    if (!auth.isSuperAdmin && auth.branchId && auth.branchId.toString() !== branchId) {
      return NextResponse.json({ error: 'Not authorized for this branch' }, { status: 403 });
    }
    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }
    if (!['free_delivery', 'percentage', 'fixed_amount'].includes(type)) {
      return NextResponse.json({ error: 'Invalid promo code type' }, { status: 400 });
    }
    if (type !== 'free_delivery') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return NextResponse.json({ error: 'A positive value is required for this promo type' }, { status: 400 });
      }
      if (type === 'percentage' && value > 100) {
        return NextResponse.json({ error: 'Percentage discount cannot exceed 100%' }, { status: 400 });
      }
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const branchOid = new ObjectId(branchId);
    const normalizedCode = code.trim().toUpperCase();

    const existing = await db.collection('promoCodes').findOne({ branchId: branchOid, code: normalizedCode });
    if (existing) {
      return NextResponse.json({ error: 'A promo code with this code already exists for this branch' }, { status: 409 });
    }

    const pos = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined);

    const now = new Date();
    const doc: PromoCode = {
      branchId: branchOid,
      code: normalizedCode,
      type,
      value: type === 'free_delivery' ? 0 : value,
      includesFreeDelivery: type !== 'free_delivery' && includesFreeDelivery === true ? true : undefined,
      minOrderValue: pos(minOrderValue),
      maxDiscount: type === 'percentage' ? pos(maxDiscount) : undefined,
      usageLimit: pos(usageLimit),
      usageLimitPerCustomer: pos(usageLimitPerCustomer),
      usedCount: 0,
      startDate: startDate ? new Date(startDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      active: active !== false,
      description: typeof description === 'string' && description.trim() ? description.trim() : undefined,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('promoCodes').insertOne(doc);
    console.log(
      '✅ Promo code created:', normalizedCode,
      '| branch:', branchId,
      '| type:', type,
      doc.includesFreeDelivery ? '| + free delivery' : ''
    );

    return NextResponse.json(
      { success: true, promoCode: { ...doc, _id: result.insertedId.toString(), branchId } },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Promo Codes] Failed to create:', error);
    return NextResponse.json({ error: 'Failed to create promo code' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requirePermission('promo-codes:write');
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid promo code id' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const existing = await db.collection('promoCodes').findOne({ _id: new ObjectId(params.id) });
    if (!existing) return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });

    if (!auth.isSuperAdmin && auth.branchId && existing.branchId?.toString() !== auth.branchId.toString()) {
      return NextResponse.json({ error: 'Not authorized to edit this promo code' }, { status: 403 });
    }

    const body = await request.json();
    const {
      code,
      type,
      value,
      minOrderValue,
      maxDiscount,
      usageLimit,
      usageLimitPerCustomer,
      startDate,
      expiryDate,
      active,
      description,
    } = body;

    if (type && !['free_delivery', 'percentage', 'fixed_amount'].includes(type)) {
      return NextResponse.json({ error: 'Invalid promo code type' }, { status: 400 });
    }
    const finalType = type || existing.type;
    if (finalType === 'percentage' && typeof value === 'number' && value > 100) {
      return NextResponse.json({ error: 'Percentage discount cannot exceed 100%' }, { status: 400 });
    }

    const update: any = { updatedAt: new Date() };

    if (code) {
      const normalizedCode = code.trim().toUpperCase();
      if (normalizedCode !== existing.code) {
        const clash = await db.collection('promoCodes').findOne({
          branchId: existing.branchId,
          code: normalizedCode,
          _id: { $ne: existing._id },
        });
        if (clash) {
          return NextResponse.json({ error: 'A promo code with this code already exists for this branch' }, { status: 409 });
        }
      }
      update.code = normalizedCode;
    }

    if (type) update.type = type;
    if (typeof value === 'number') update.value = finalType === 'free_delivery' ? 0 : value;
    update.minOrderValue = typeof minOrderValue === 'number' && minOrderValue > 0 ? minOrderValue : undefined;
    update.maxDiscount = finalType === 'percentage' && typeof maxDiscount === 'number' && maxDiscount > 0 ? maxDiscount : undefined;
    update.usageLimit = typeof usageLimit === 'number' && usageLimit > 0 ? usageLimit : undefined;
    update.usageLimitPerCustomer = typeof usageLimitPerCustomer === 'number' && usageLimitPerCustomer > 0 ? usageLimitPerCustomer : undefined;
    if (startDate !== undefined) update.startDate = startDate ? new Date(startDate) : null;
    if (expiryDate !== undefined) update.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (typeof active === 'boolean') update.active = active;
    if (description !== undefined) update.description = description || undefined;

    const result = await db.collection('promoCodes').findOneAndUpdate(
      { _id: new ObjectId(params.id) },
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result) return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });

    console.log('✅ Promo code updated:', result.code);
    return NextResponse.json({
      success: true,
      promoCode: { ...result, _id: result._id.toString(), branchId: result.branchId.toString() },
    });
  } catch (error) {
    console.error('[Promo Codes] Failed to update:', error);
    return NextResponse.json({ error: 'Failed to update promo code' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requirePermission('promo-codes:write');
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid promo code id' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const existing = await db.collection('promoCodes').findOne({ _id: new ObjectId(params.id) });
    if (!existing) return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });

    if (!auth.isSuperAdmin && auth.branchId && existing.branchId?.toString() !== auth.branchId.toString()) {
      return NextResponse.json({ error: 'Not authorized to delete this promo code' }, { status: 403 });
    }

    await db.collection('promoCodes').deleteOne({ _id: new ObjectId(params.id) });
    console.log('🗑️ Promo code deleted:', existing.code);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Promo Codes] Failed to delete:', error);
    return NextResponse.json({ error: 'Failed to delete promo code' }, { status: 500 });
  }
}
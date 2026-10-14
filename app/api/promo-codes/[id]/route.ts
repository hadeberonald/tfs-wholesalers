import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/with-permission';

const VALID_TYPES = ['free_delivery', 'percentage', 'fixed_amount'] as const;

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

    // PUT is a *partial* update: a field is only touched when it is present in
    // the body. (The old handler reset minOrderValue / maxDiscount / usage limits
    // on EVERY call, so the table's active toggle silently wiped them.)
    // Send `null` for a field to clear it.
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
    const pos = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined);

    if (has('type') && !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid promo code type' }, { status: 400 });
    }
    const finalType: (typeof VALID_TYPES)[number] = has('type') ? type : existing.type;
    const finalValue: number = typeof value === 'number' ? value : existing.value;

    if (has('type') || has('value')) {
      if (finalType !== 'free_delivery') {
        if (!Number.isFinite(finalValue) || finalValue <= 0) {
          return NextResponse.json({ error: 'A positive value is required for this promo type' }, { status: 400 });
        }
        if (finalType === 'percentage' && finalValue > 100) {
          return NextResponse.json({ error: 'Percentage discount cannot exceed 100%' }, { status: 400 });
        }
      }
    }

    const $set: Record<string, any> = { updatedAt: new Date() };
    const $unset: Record<string, ''> = {};
    const setOrUnset = (field: string, v: unknown) => {
      if (v === undefined) $unset[field] = '';
      else $set[field] = v;
    };

    if (has('code') && typeof code === 'string' && code.trim()) {
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
      $set.code = normalizedCode;
    }

    if (has('type')) $set.type = finalType;
    if (has('type') || has('value')) $set.value = finalType === 'free_delivery' ? 0 : finalValue;

    if (has('minOrderValue')) setOrUnset('minOrderValue', pos(minOrderValue));
    if (has('usageLimit')) setOrUnset('usageLimit', pos(usageLimit));
    if (has('usageLimitPerCustomer')) setOrUnset('usageLimitPerCustomer', pos(usageLimitPerCustomer));

    // maxDiscount only makes sense for percentage codes
    if (finalType !== 'percentage') {
      if (existing.maxDiscount != null) $unset.maxDiscount = '';
    } else if (has('maxDiscount')) {
      setOrUnset('maxDiscount', pos(maxDiscount));
    }

    // includesFreeDelivery only makes sense for percentage / fixed_amount codes
    if (finalType === 'free_delivery') {
      if (existing.includesFreeDelivery != null) $unset.includesFreeDelivery = '';
    } else if (has('includesFreeDelivery')) {
      setOrUnset('includesFreeDelivery', includesFreeDelivery === true ? true : undefined);
    }

    if (has('startDate')) $set.startDate = startDate ? new Date(startDate) : null;
    if (has('expiryDate')) $set.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (typeof active === 'boolean') $set.active = active;
    if (has('description')) {
      setOrUnset('description', typeof description === 'string' && description.trim() ? description.trim() : undefined);
    }

    const updateOp: Record<string, any> = { $set };
    if (Object.keys($unset).length > 0) updateOp.$unset = $unset;

    const result = await db.collection('promoCodes').findOneAndUpdate(
      { _id: new ObjectId(params.id) },
      updateOp,
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

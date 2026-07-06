/**
 * POST /api/promo-codes/validate
 * Body: { branchId: string, code: string, subtotal: number, email?: string }
 *
 * Public endpoint — called from the checkout page when the customer applies
 * a code. Does NOT increment usedCount (that happens when the order is
 * actually placed, via the /api/orders POST handler, to avoid burning uses
 * on abandoned carts).
 */
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId, code, subtotal, email } = body as {
      branchId: string; code: string; subtotal: number; email?: string;
    };

    if (!branchId || !ObjectId.isValid(branchId)) {
      return NextResponse.json({ valid: false, error: 'Invalid branch' }, { status: 400 });
    }
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'Please enter a promo code' }, { status: 400 });
    }
    if (typeof subtotal !== 'number' || subtotal < 0) {
      return NextResponse.json({ valid: false, error: 'Invalid cart total' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');
    const normalizedCode = code.trim().toUpperCase();
    const now = new Date();

    const promo = await db.collection('promoCodes').findOne({
      branchId: new ObjectId(branchId),
      code: normalizedCode,
    });

    if (!promo) {
      return NextResponse.json({ valid: false, error: 'Promo code not found' }, { status: 404 });
    }
    if (!promo.active) {
      return NextResponse.json({ valid: false, error: 'This promo code is no longer active' }, { status: 400 });
    }
    if (promo.startDate && new Date(promo.startDate) > now) {
      return NextResponse.json({ valid: false, error: 'This promo code is not active yet' }, { status: 400 });
    }
    if (promo.expiryDate && new Date(promo.expiryDate) < now) {
      return NextResponse.json({ valid: false, error: 'This promo code has expired' }, { status: 400 });
    }
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
      return NextResponse.json({ valid: false, error: 'This promo code has reached its usage limit' }, { status: 400 });
    }
    if (promo.minOrderValue && subtotal < promo.minOrderValue) {
      return NextResponse.json({
        valid: false,
        error: `This code requires a minimum order of R${promo.minOrderValue.toFixed(2)}`,
      }, { status: 400 });
    }

    // ── Per-customer usage limit ──────────────────────────────────────────
    if (promo.usageLimitPerCustomer && email) {
      const customerUses = await db.collection('promoCodeUsages').countDocuments({
        promoCodeId: promo._id,
        email: email.toLowerCase(),
      });
      if (customerUses >= promo.usageLimitPerCustomer) {
        return NextResponse.json({
          valid: false,
          error: 'You have already used this promo code the maximum number of times',
        }, { status: 400 });
      }
    }

    // ── Compute discount ──────────────────────────────────────────────────
    let discountAmount = 0;
    let discountAppliesTo: 'delivery' | 'subtotal' = 'subtotal';

    if (promo.type === 'free_delivery') {
      discountAppliesTo = 'delivery';
      // The actual delivery fee is applied client-side against the real fee;
      // we just confirm the code is valid and let the client zero it out.
      discountAmount = 0;
    } else if (promo.type === 'percentage') {
      discountAmount = subtotal * (promo.value / 100);
      if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    } else if (promo.type === 'fixed_amount') {
      discountAmount = Math.min(promo.value, subtotal);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;

    return NextResponse.json({
      valid: true,
      promoCode: {
        id: promo._id.toString(),
        code: promo.code,
        type: promo.type,
        value: promo.value,
        description: promo.description || null,
      },
      discountAppliesTo,
      discountAmount,
    });
  } catch (error) {
    console.error('[Promo Validate] Error:', error);
    return NextResponse.json({ valid: false, error: 'Failed to validate promo code' }, { status: 500 });
  }
}
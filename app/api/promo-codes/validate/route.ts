/**
 * POST /api/promo-codes/validate
 * Body: { branchId: string, code: string, subtotal: number, email?: string, deliveryFee?: number }
 *
 * Public endpoint — called from checkout when the customer applies a code.
 * Does NOT increment usedCount (that happens in POST /api/orders, so abandoned
 * carts don't burn uses).
 *
 * The response keeps the exact legacy fields the shipped mobile app reads
 * (promoCode.{id,code,type}, discountAppliesTo, discountAmount) and adds
 * `benefits` / `promoCode.actualType` for newer clients. See lib/promo-engine.ts
 * for how combined "discount + free delivery" codes are translated for old apps.
 */
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { LEGACY_APP_DELIVERY_FEE, toLegacyClientShape } from '@/lib/promo-engine';
import { checkPromo } from '@/lib/promo-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId, code, subtotal, email, deliveryFee } = body as {
      branchId: string; code: string; subtotal: number; email?: string; deliveryFee?: number;
    };

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'Please enter a promo code' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('tfs-wholesalers');

    // The shipped app never sends deliveryFee and always charges R35.
    const fee = typeof deliveryFee === 'number' && deliveryFee >= 0 ? deliveryFee : LEGACY_APP_DELIVERY_FEE;

    const result = await checkPromo(db, { branchId, code, subtotal, email, deliveryFee: fee });
    if (!result.ok) {
      return NextResponse.json({ valid: false, error: result.error }, { status: result.status });
    }

    const { promo, benefits } = result;
    const legacy = toLegacyClientShape(promo, benefits);

    return NextResponse.json({
      valid: true,
      promoCode: {
        id: promo._id.toString(),
        code: promo.code,
        type: legacy.type,          // what the shipped app expects
        actualType: promo.type,     // the real type, for newer clients
        value: promo.value,
        includesFreeDelivery: promo.includesFreeDelivery === true,
        description: promo.description || null,
      },
      discountAppliesTo: legacy.discountAppliesTo,
      discountAmount: legacy.discountAmount,
      benefits,                     // { itemDiscount, deliveryDiscount, freeDelivery, total }
    });
  } catch (error) {
    console.error('[Promo Validate] Error:', error);
    return NextResponse.json({ valid: false, error: 'Failed to validate promo code' }, { status: 500 });
  }
}

/**
 * lib/promo-service.ts
 *
 * DB-aware promo helpers shared by /api/promo-codes/validate (preview) and
 * /api/orders (authoritative re-check + redemption), so both apply exactly the
 * same rules.
 */
import { ObjectId, type Db } from 'mongodb';
import { computeBenefits, type PromoBenefits, type PromoLike } from './promo-engine';

export interface CheckPromoInput {
  branchId: string;
  /** Look up by code (checkout "Apply" button)... */
  code?: string;
  /** ...or by id (order creation). */
  promoId?: string;
  subtotal: number;
  email?: string | null;
  deliveryFee: number;
}

export type CheckPromoResult =
  | { ok: true; promo: any; benefits: PromoBenefits }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): CheckPromoResult => ({ ok: false, status, error });

export async function checkPromo(db: Db, input: CheckPromoInput): Promise<CheckPromoResult> {
  const { branchId, code, promoId, subtotal, deliveryFee } = input;
  const email = input.email ? input.email.trim().toLowerCase() : null;

  if (!branchId || !ObjectId.isValid(branchId)) return fail(400, 'Invalid branch');
  if (typeof subtotal !== 'number' || !Number.isFinite(subtotal) || subtotal < 0) {
    return fail(400, 'Invalid cart total');
  }

  const filter: Record<string, any> = { branchId: new ObjectId(branchId) };
  if (promoId) {
    if (!ObjectId.isValid(promoId)) return fail(400, 'Invalid promo code');
    filter._id = new ObjectId(promoId);
  } else if (typeof code === 'string' && code.trim()) {
    filter.code = code.trim().toUpperCase();
  } else {
    return fail(400, 'Please enter a promo code');
  }

  const promo = await db.collection('promoCodes').findOne(filter);
  if (!promo) return fail(404, 'Promo code not found');

  const now = new Date();
  if (!promo.active) return fail(400, 'This promo code is no longer active');
  if (promo.startDate && new Date(promo.startDate) > now) return fail(400, 'This promo code is not active yet');
  if (promo.expiryDate && new Date(promo.expiryDate) < now) return fail(400, 'This promo code has expired');
  if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
    return fail(400, 'This promo code has reached its usage limit');
  }
  if (promo.minOrderValue && subtotal < promo.minOrderValue) {
    return fail(400, `This code requires a minimum order of R${promo.minOrderValue.toFixed(2)}`);
  }

  if (promo.usageLimitPerCustomer) {
    if (!email) return fail(400, 'Please sign in to use this promo code');
    const uses = await db.collection('promoCodeUsages').countDocuments({ promoCodeId: promo._id, email });
    if (uses >= promo.usageLimitPerCustomer) {
      return fail(400, 'You have already used this promo code the maximum number of times');
    }
  }

  const benefits = computeBenefits(promo as unknown as PromoLike, subtotal, deliveryFee);
  return { ok: true, promo, benefits };
}

/**
 * Atomically take one redemption. Returns false if the usage limit was hit by a
 * concurrent order between check and redeem.
 */
export async function redeemPromo(db: Db, promoId: ObjectId): Promise<boolean> {
  const res = await db.collection('promoCodes').updateOne(
    {
      _id: promoId,
      $or: [
        { usageLimit: { $exists: false } },
        { usageLimit: null },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
      ],
    },
    { $inc: { usedCount: 1 } },
  );
  return res.modifiedCount === 1;
}

/** Give a redemption back (used when order insertion fails after redeeming). */
export async function releasePromo(db: Db, promoId: ObjectId): Promise<void> {
  await db.collection('promoCodes').updateOne(
    { _id: promoId, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
  );
}

export async function recordPromoUsage(
  db: Db,
  usage: {
    promoCodeId: ObjectId;
    email: string | null;
    orderId: string;
    orderNumber: string;
    code: string;
    itemDiscount: number;
    deliveryDiscount: number;
  },
): Promise<void> {
  await db.collection('promoCodeUsages').insertOne({
    ...usage,
    email: usage.email ? usage.email.trim().toLowerCase() : null,
    createdAt: new Date(),
  });
}

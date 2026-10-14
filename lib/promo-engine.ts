/**
 * lib/promo-engine.ts
 *
 * Single source of truth for what a promo code is worth. Pure functions, no I/O.
 *
 * Data model (no DB migration needed):
 *   type                 'free_delivery' | 'percentage' | 'fixed_amount'   (unchanged)
 *   includesFreeDelivery boolean, optional (new). Only meaningful for
 *                        percentage / fixed_amount. undefined === false, so every
 *                        existing document keeps working untouched.
 *
 *   "100% off + free delivery" = { type: 'percentage', value: 100, includesFreeDelivery: true }
 *
 * Back-compat with the already-shipped mobile app
 * ------------------------------------------------
 * The shipped app only understands two shapes from /api/promo-codes/validate:
 *   - type === 'free_delivery'  -> it zeroes its delivery fee
 *   - anything else             -> it subtracts `discountAmount` and still ADDS its
 *                                  hard-coded R35 delivery fee:
 *                                    total = max(0, subtotal - discountAmount + 35)
 *
 * For a combined promo we therefore tell old clients:
 *   type = 'fixed_amount', discountAmount = itemDiscount + 35
 * and their own formula gives:
 *   subtotal - (itemDiscount + 35) + 35  =  subtotal - itemDiscount
 * which is exactly what the customer should pay (items discounted, delivery free).
 */

export type PromoType = 'free_delivery' | 'percentage' | 'fixed_amount';

export interface PromoLike {
  type: PromoType;
  value: number;
  maxDiscount?: number | null;
  includesFreeDelivery?: boolean | null;
}

/** The delivery fee hard-coded in the shipped mobile app (checkout.tsx). Must match it. */
export const LEGACY_APP_DELIVERY_FEE = 35;

/**
 * Prefix of the payment reference given to orders whose total is R0.00 after a
 * promo. Such orders never touch Paystack; /api/payment/verify recognises the prefix.
 */
export const FREE_ORDER_REF_PREFIX = 'FREE-';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PromoBenefits {
  /** Money taken off the items subtotal. */
  itemDiscount: number;
  /** Money taken off the delivery fee. */
  deliveryDiscount: number;
  freeDelivery: boolean;
  /** What the customer pays: subtotal - itemDiscount + deliveryFee - deliveryDiscount. */
  total: number;
}

export function hasFreeDelivery(promo: PromoLike): boolean {
  return promo.type === 'free_delivery' || promo.includesFreeDelivery === true;
}

export function computeBenefits(
  promo: PromoLike,
  subtotal: number,
  deliveryFee: number = LEGACY_APP_DELIVERY_FEE,
): PromoBenefits {
  const safeSubtotal = Number.isFinite(subtotal) && subtotal > 0 ? subtotal : 0;
  const safeFee = Number.isFinite(deliveryFee) && deliveryFee > 0 ? deliveryFee : 0;

  let itemDiscount = 0;
  if (promo.type === 'percentage') {
    itemDiscount = safeSubtotal * (promo.value / 100);
    if (promo.maxDiscount && itemDiscount > promo.maxDiscount) itemDiscount = promo.maxDiscount;
  } else if (promo.type === 'fixed_amount') {
    itemDiscount = promo.value;
  }
  itemDiscount = round2(Math.min(Math.max(itemDiscount, 0), safeSubtotal));

  const freeDelivery = hasFreeDelivery(promo);
  const deliveryDiscount = freeDelivery ? round2(safeFee) : 0;
  const total = round2(Math.max(0, safeSubtotal - itemDiscount + safeFee - deliveryDiscount));

  return { itemDiscount, deliveryDiscount, freeDelivery, total };
}

/**
 * The shape the SHIPPED mobile app understands. Keep these field names/values stable.
 */
export function toLegacyClientShape(promo: PromoLike, b: PromoBenefits) {
  // Pure free delivery: the app handles this natively.
  if (promo.type === 'free_delivery') {
    return { type: 'free_delivery' as const, discountAppliesTo: 'delivery' as const, discountAmount: 0 };
  }

  // Discount only: native as well.
  if (!b.freeDelivery) {
    return { type: promo.type, discountAppliesTo: 'subtotal' as const, discountAmount: b.itemDiscount };
  }

  // Combined: fold the delivery saving into the "subtotal" discount, because the
  // old app always adds its own delivery fee back on.
  return {
    type: 'fixed_amount' as const,
    discountAppliesTo: 'subtotal' as const,
    discountAmount: round2(b.itemDiscount + b.deliveryDiscount),
  };
}

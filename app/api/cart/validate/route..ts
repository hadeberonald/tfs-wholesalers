/**
 * /app/api/cart/validate/route.ts
 *
 * Validates that cart item prices and stock levels are still current.
 * Called on cart page load (both web and mobile) to prevent customers from
 * holding stale special prices or out-of-stock items through to checkout.
 *
 * POST /api/cart/validate
 * Body: { branchId: string, items: IncomingItem[] }
 *
 * Returns:
 *   { valid: true, corrections: [] }
 *     — all prices are current, nothing to do
 *
 *   { valid: false, corrections: Correction[] }
 *     — one or more items need updating or removing
 *
 * Correction shape:
 *   {
 *     id: string
 *     variantId?: string
 *     action: 'update' | 'remove'
 *     currentPrice?: number          // present when action === 'update'
 *     currentOriginalPrice?: number  // present when action === 'update'
 *     reason: string
 *   }
 *
 * The client decides what to do with each correction — it calls removeItem()
 * for 'remove' corrections and patches the price fields for 'update'
 * corrections, then re-runs recalculateSpecials().
 *
 * Auto-added bonus/free items (autoAdded, isFreeItem, isMultibuyBonus) are
 * ALWAYS told to 'remove' when any other correction exists — they get re-added
 * cleanly by recalculateSpecials() after the correction is applied.  If
 * nothing else changed they are left alone to avoid unnecessary cart churn.
 *
 * Combo items (isCombo: true) are skipped — their pricing is baked in and
 * validated by the combo API.  Only regular and special-priced items are
 * checked here.
 *
 * Special types handled for price resolution:
 *   fixed_price      — conditions.newPrice
 *   percentage_off   — conditions.discountPercentage applied to base price
 *   amount_off       — conditions.discountAmount subtracted from base price
 *   bundle           — conditions.bundlePrice
 *   multibuy /
 *   buy_x_get_y      — base price only; quantity-dependent discount is
 *                      re-applied client-side by recalculateSpecials()
 *
 * Stock visibility rule (mirrors the products API $expr):
 *   visible = stockLevel > (lowStockThreshold ?? 0)
 *   Variants inherit the parent product's lowStockThreshold.
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface IncomingItem {
  id: string;
  variantId?: string;
  price: number;
  originalPrice?: number;
  autoAdded?: boolean;
  isFreeItem?: boolean;
  isMultibuyBonus?: boolean;
  isCombo?: boolean;
  appliedSpecialId?: string;
}

interface Correction {
  id: string;
  variantId?: string;
  action: 'update' | 'remove';
  currentPrice?: number;
  currentOriginalPrice?: number;
  reason: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId, items } = body as { branchId: string; items: IncomingItem[] };

    // ── Guard: missing / empty payload ──────────────────────────────────────
    if (!branchId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ valid: true, corrections: [] });
    }

    if (!ObjectId.isValid(branchId)) {
      return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 });
    }

    const client    = await clientPromise;
    const db        = client.db('tfs-wholesalers');
    const branchOid = new ObjectId(branchId);
    const now       = new Date();

    // ── 1. Separate item categories ──────────────────────────────────────────
    // Auto-added items (free gifts, multibuy bonuses) are not looked up
    // individually — they are removed wholesale if any other correction exists.
    // Combo items have their own pricing source and are skipped entirely.
    const autoAddedItems = items.filter(
      (i) => i.autoAdded || i.isFreeItem || i.isMultibuyBonus
    );
    const lookupItems = items.filter(
      (i) => !i.autoAdded && !i.isFreeItem && !i.isMultibuyBonus && !i.isCombo
    );

    if (lookupItems.length === 0) {
      return NextResponse.json({ valid: true, corrections: [] });
    }

    // ── 2. Deduplicate product IDs ───────────────────────────────────────────
    const productIds = [
      ...new Set(lookupItems.map((i) => i.id).filter(ObjectId.isValid)),
    ];

    // ── 3. Fetch products + active specials in parallel ──────────────────────
    const [products, activeSpecials] = await Promise.all([
      db
        .collection('products')
        .find({
          _id:      { $in: productIds.map((id) => new ObjectId(id)) },
          branchId: branchOid,
        })
        .project({
          _id:               1,
          price:             1,
          specialPrice:      1,
          onSpecial:         1,
          specialId:         1,
          variants:          1,
          active:            1,
          stockLevel:        1,
          lowStockThreshold: 1,
        })
        .toArray(),

      db
        .collection('specials')
        .find({
          branchId: branchOid,
          active:   true,
          // Special must have started (or have no startDate)
          $or: [
            { startDate: { $exists: false } },
            { startDate: null },
            { startDate: { $lte: now } },
          ],
          // Special must not have ended
          $and: [
            {
              $or: [
                { endDate: { $exists: false } },
                { endDate: null },
                { endDate: { $gt: now } },
              ],
            },
          ],
        })
        .project({ _id: 1, productId: 1, productIds: 1, type: 1, conditions: 1 })
        .toArray(),
    ]);

    // ── 4. Build lookup structures ───────────────────────────────────────────
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    // Map productId → the first active special that covers it.
    // For specials that list multiple products (productIds array) each product
    // gets its own entry pointing at the same special document.
    const activeSpecialByProduct = new Map<string, any>();
    for (const s of activeSpecials) {
      if (s.productId) {
        activeSpecialByProduct.set(s.productId, s);
      }
      if (Array.isArray(s.productIds)) {
        for (const pid of s.productIds) {
          activeSpecialByProduct.set(pid, s);
        }
      }
    }

    // ── 5. Check each item ───────────────────────────────────────────────────
    const corrections: Correction[] = [];

    for (const item of lookupItems) {
      const product = productMap.get(item.id);

      // Product no longer exists or was deactivated.
      if (!product || product.active === false) {
        corrections.push({
          id:        item.id,
          variantId: item.variantId,
          action:    'remove',
          reason:    'Product is no longer available',
        });
        continue;
      }

      // ── Stock check — mirrors the products API $expr ─────────────────────
      // A product is storefront-visible only when stockLevel > threshold.
      // Variants inherit the parent's lowStockThreshold (they carry none of
      // their own).
      const threshold = product.lowStockThreshold ?? 0;

      if (!item.variantId) {
        // Simple (non-variant) product
        if ((product.stockLevel ?? 0) <= threshold) {
          corrections.push({
            id:        item.id,
            variantId: item.variantId,
            action:    'remove',
            reason:    'Item is currently out of stock',
          });
          continue;
        }
      }

      // ── Variant resolution ───────────────────────────────────────────────
      let currentBasePrice: number = product.price;

      if (item.variantId && Array.isArray(product.variants)) {
        const variant = product.variants.find(
          (v: any) =>
            v._id === item.variantId || v._id?.toString() === item.variantId
        );

        if (!variant || variant.active === false) {
          corrections.push({
            id:        item.id,
            variantId: item.variantId,
            action:    'remove',
            reason:    'Product variant is no longer available',
          });
          continue;
        }

        // Variant stock check — uses parent threshold.
        if ((variant.stockLevel ?? 0) <= threshold) {
          corrections.push({
            id:        item.id,
            variantId: item.variantId,
            action:    'remove',
            reason:    'Item variant is currently out of stock',
          });
          continue;
        }

        if (typeof variant.price === 'number') {
          currentBasePrice = variant.price;
        }
      }

      // ── Effective price resolution ───────────────────────────────────────
      // For multibuy / buy_x_get_y we return the base price and let the client
      // re-apply the quantity-based discount via recalculateSpecials().
      const activeSpecial = activeSpecialByProduct.get(item.id);
      let currentEffectivePrice = currentBasePrice;

      if (activeSpecial) {
        switch (activeSpecial.type) {
          case 'fixed_price': {
            const sp = activeSpecial.conditions?.newPrice;
            if (typeof sp === 'number') currentEffectivePrice = sp;
            break;
          }
          case 'percentage_off': {
            const pct = activeSpecial.conditions?.discountPercentage;
            if (typeof pct === 'number') {
              currentEffectivePrice = currentBasePrice * (1 - pct / 100);
            }
            break;
          }
          case 'amount_off': {
            const amt = activeSpecial.conditions?.discountAmount;
            if (typeof amt === 'number') {
              currentEffectivePrice = Math.max(0, currentBasePrice - amt);
            }
            break;
          }
          case 'bundle': {
            const bp = activeSpecial.conditions?.bundlePrice;
            if (typeof bp === 'number') currentEffectivePrice = bp;
            break;
          }
          // multibuy / buy_x_get_y — quantity-dependent, handled client-side.
          default:
            currentEffectivePrice = currentBasePrice;
        }
      }

      // ── Compare stored vs current (2 dp to avoid floating-point noise) ───
      const roundedCurrent    = Math.round(currentEffectivePrice * 100) / 100;
      const roundedStored     = Math.round(item.price * 100) / 100;

      // The stored originalPrice should match the product's base price.
      const roundedBaseStored =
        typeof item.originalPrice === 'number'
          ? Math.round(item.originalPrice * 100) / 100
          : roundedStored; // fall back if client never set originalPrice
      const roundedBase = Math.round(currentBasePrice * 100) / 100;

      const priceChanged     = roundedStored     !== roundedCurrent;
      const origPriceChanged = roundedBaseStored !== roundedBase;

      if (priceChanged || origPriceChanged) {
        const hadSpecial    = !!item.appliedSpecialId;
        const hasSpecialNow = !!activeSpecial;

        let reason: string;
        if (hadSpecial && !hasSpecialNow) {
          reason = 'Special has expired — price updated to current price';
        } else if (!hadSpecial && hasSpecialNow) {
          reason = 'Special now applies — price updated';
        } else if (hadSpecial && hasSpecialNow) {
          reason = 'Special price has changed';
        } else {
          reason = 'Product price has changed';
        }

        corrections.push({
          id:                  item.id,
          variantId:           item.variantId,
          action:              'update',
          currentPrice:        roundedCurrent,
          currentOriginalPrice: roundedBase,
          reason,
        });
      }
    }

    // ── 6. Auto-added items: mark for removal only when other corrections
    //       exist — recalculateSpecials() re-adds them with fresh
    //       quantities/prices after the parent items are corrected. ──────────
    if (corrections.length > 0) {
      for (const item of autoAddedItems) {
        corrections.push({
          id:        item.id,
          variantId: item.variantId,
          action:    'remove',
          reason:    'Auto-managed item — will be re-added automatically',
        });
      }
    }

    return NextResponse.json({
      valid:       corrections.length === 0,
      corrections,
    });

  } catch (error) {
    console.error('[Cart Validate] Error:', error);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}
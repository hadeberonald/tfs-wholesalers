/**
 * /hooks/useCartValidation.ts
 *
 * Web version of the cart validation hook.
 * Called once on CartPage mount (after branch is known) to verify that every
 * item in the Zustand cart still has a current price and is still in stock.
 *
 * Usage:
 *   const { validating } = useCartValidation(branch?.id);
 *
 * The hook calls POST /api/cart/validate, reads the correction list, and
 * applies each correction directly to the Zustand cart store:
 *   - action: 'remove'  → removeItem()
 *   - action: 'update'  → patches price/originalPrice inline via setState and
 *                         clears stale special metadata, then triggers
 *                         recalculateSpecials() so the client re-applies any
 *                         specials that are still active.
 *
 * A single toast is shown after all corrections are applied.
 * Validation errors are swallowed — they must never break the cart UI.
 *
 * hasRun is stored in a ref so navigating back to the cart in the same browser
 * session does not re-fire the check.  The dependency array uses branchId so
 * the effect re-fires only if the user switches branch.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/lib/store';

interface Correction {
  id: string;
  variantId?: string;
  action: 'update' | 'remove';
  currentPrice?: number;
  currentOriginalPrice?: number;
  reason: string;
}

export function useCartValidation(branchId: string | undefined) {
  const [validating, setValidating] = useState(false);
  const hasRun = useRef(false);

  const items               = useCartStore((s) => s.items);
  const removeItem          = useCartStore((s) => s.removeItem);
  const recalculateSpecials = useCartStore((s) => s.recalculateSpecials);

  useEffect(() => {
    if (!branchId || items.length === 0 || hasRun.current) return;
    hasRun.current = true;

    (async () => {
      setValidating(true);
      try {
        const res = await fetch('/api/cart/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branchId,
            items: items.map((i) => ({
              id:               i.id,
              variantId:        i.variantId,
              price:            i.price,
              originalPrice:    i.originalPrice,
              autoAdded:        i.autoAdded,
              isFreeItem:       i.isFreeItem,
              isMultibuyBonus:  i.isMultibuyBonus,
              isCombo:          i.isCombo,
              appliedSpecialId: i.appliedSpecialId,
            })),
          }),
        });

        if (!res.ok) {
          console.error('[Cart Validate Web] HTTP', res.status);
          return;
        }

        const data = await res.json();
        if (data.valid || !data.corrections?.length) return;

        const corrections: Correction[] = data.corrections;
        let removedCount = 0;
        let updatedCount = 0;

        // ── Apply removes first so recalculateSpecials sees the final item list ──
        for (const c of corrections) {
          if (c.action === 'remove') {
            removeItem(c.id, c.variantId);
            removedCount++;
          }
        }

        // ── Apply price updates via direct setState so we can batch them in one
        //    pass without triggering intermediate recalculations ──────────────────
        const updates = corrections.filter(
          (c): c is Correction & { action: 'update'; currentPrice: number } =>
            c.action === 'update' && typeof c.currentPrice === 'number'
        );

        if (updates.length > 0) {
          useCartStore.setState((state) => ({
            items: state.items.map((item) => {
              const correction = updates.find((c) =>
                c.variantId
                  ? item.id === c.id && item.variantId === c.variantId
                  : item.id === c.id && !item.variantId
              );
              if (!correction) return item;

              return {
                ...item,
                price:                   correction.currentPrice,
                originalPrice:           correction.currentOriginalPrice ?? correction.currentPrice,
                // Clear stale special metadata — recalculateSpecials() below will
                // re-attach any specials that are still valid at the new base price.
                appliedSpecialId:        undefined,
                specialDiscount:         undefined,
                specialDescription:      undefined,
                meetsSpecialRequirement: undefined,
              };
            }),
          }));
          updatedCount = updates.length;

          // Re-run specials so quantity-based discounts (multibuy, buy_x_get_y)
          // are evaluated against the corrected prices.
          recalculateSpecials();
        }

        // ── Single consolidated toast ────────────────────────────────────────────
        if (removedCount > 0 && updatedCount > 0) {
          toast(
            `${updatedCount} item price${updatedCount > 1 ? 's have' : ' has'} changed and ` +
            `${removedCount} item${removedCount > 1 ? 's are' : ' is'} no longer available. ` +
            `Your cart has been updated.`,
            { icon: '🛒' }
          );
        } else if (updatedCount > 0) {
          toast(
            `${updatedCount} item price${updatedCount > 1 ? 's have' : ' has'} been updated ` +
            `to reflect current pricing.`,
            { icon: '💰' }
          );
        } else if (removedCount > 0) {
          toast.error(
            `${removedCount} item${removedCount > 1 ? 's were' : ' was'} removed from your cart ` +
            `because ${removedCount > 1 ? 'they are' : 'it is'} no longer available.`
          );
        }

      } catch (err) {
        // Validation errors must never break the cart UI.
        console.error('[Cart Validate Web]', err);
      } finally {
        setValidating(false);
      }
    })();
  }, [branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { validating };
}
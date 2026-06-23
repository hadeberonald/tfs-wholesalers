/**
 * /mobile-apps/tfs-mobile-app/hooks/useCartValidationMobile.ts
 *
 * Mobile version of the cart validation hook.
 * Drop this in mobile-apps/tfs-mobile-app/hooks/ and import it in
 * mobile-apps/tfs-mobile-app/app/(tabs)/cart.tsx
 *
 * Usage:
 *   const { validating } = useCartValidationMobile();
 *
 * The hook calls POST /api/cart/validate on the Next.js backend, reads the
 * correction list, and applies each correction directly to the mobile Zustand
 * store (useStore from @/lib/store):
 *   - action: 'remove'  → removeItem()
 *   - action: 'update'  → patches price/originalPrice via setState and clears
 *                         stale special metadata.  The mobile store has no
 *                         recalculateSpecials — pricing is server-side only —
 *                         so we just reset the fields and let the server
 *                         re-price at checkout.
 *
 * A single consolidated Alert is shown after all corrections are applied.
 * Validation errors are swallowed — they must never break the cart UI.
 *
 * hasRun is stored in a ref so navigating back to the cart in the same app
 * session does not re-fire the check.  The dependency array uses the resolved
 * branchId string so the effect re-fires if the user switches branch.
 */

import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useStore } from '@/lib/store';
import api from '@/lib/api';

interface Correction {
  id: string;
  variantId?: string;
  action: 'update' | 'remove';
  currentPrice?: number;
  currentOriginalPrice?: number;
  reason: string;
}

export function useCartValidationMobile() {
  const [validating, setValidating] = useState(false);
  const hasRun = useRef(false);

  const items      = useStore((s) => s.items);
  const branch     = useStore((s) => s.branch);
  const removeItem = useStore((s) => s.removeItem);

  // Support both _id (MongoDB shape) and id (serialised shape).
  const branchId = branch?._id ?? branch?.id;

  useEffect(() => {
    if (!branchId || items.length === 0 || hasRun.current) return;
    hasRun.current = true;

    (async () => {
      setValidating(true);
      try {
        const res = await api.post('/api/cart/validate', {
          branchId,
          items: items.map((i) => ({
            id:               i.id,
            variantId:        i.variantId,
            price:            i.price,
            originalPrice:    i.originalPrice,
            autoAdded:        i.autoAdded,
            isFreeItem:       i.isFreeItem,
            isMultibuyBonus:  i.isMultibuyBonus,
            // Mobile store uses isComboItem; API field is isCombo — map it here.
            isCombo:          i.isComboItem,
            appliedSpecialId: i.appliedSpecialId,
          })),
        });

        const data = res.data;
        if (data.valid || !data.corrections?.length) return;

        const corrections: Correction[] = data.corrections;
        let removedCount = 0;
        let updatedCount = 0;

        // ── Apply removes first ──────────────────────────────────────────────
        for (const c of corrections) {
          if (c.action === 'remove') {
            removeItem(c.id, c.variantId);
            removedCount++;
          }
        }

        // ── Apply price updates in a single setState pass ────────────────────
        const updates = corrections.filter(
          (c): c is Correction & { action: 'update'; currentPrice: number } =>
            c.action === 'update' && typeof c.currentPrice === 'number'
        );

        if (updates.length > 0) {
          useStore.setState((state) => ({
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
                // Clear stale special metadata.  The server re-prices at checkout.
                appliedSpecialId:        undefined,
                specialDiscount:         undefined,
                specialDescription:      undefined,
                meetsSpecialRequirement: undefined,
              };
            }),
          }));
          updatedCount = updates.length;
        }

        // ── Single consolidated Alert ────────────────────────────────────────
        if (removedCount > 0 && updatedCount > 0) {
          Alert.alert(
            'Cart Updated',
            `${updatedCount} item price${updatedCount > 1 ? 's have' : ' has'} changed and ` +
            `${removedCount} item${removedCount > 1 ? 's are' : ' is'} no longer available. ` +
            `Your cart has been updated.`
          );
        } else if (updatedCount > 0) {
          Alert.alert(
            'Prices Updated',
            `${updatedCount} item price${updatedCount > 1 ? 's have' : ' has'} been updated ` +
            `to reflect current pricing.`
          );
        } else if (removedCount > 0) {
          Alert.alert(
            'Items Removed',
            `${removedCount} item${removedCount > 1 ? 's were' : ' was'} removed from your cart ` +
            `because ${removedCount > 1 ? 'they are' : 'it is'} no longer available.`
          );
        }

      } catch (err) {
        // Validation errors must never break the cart UI.
        console.error('[Cart Validate Mobile]', err);
      } finally {
        setValidating(false);
      }
    })();
  }, [branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { validating };
}
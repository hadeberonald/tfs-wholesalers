import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Special } from '@/types';

interface CartItem {
  id: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  image: string;
  quantity: number;
  sku: string;

  // Special pricing info
  appliedSpecialId?: string;
  originalPrice?: number;
  specialDiscount?: number;
  specialDescription?: string;
  meetsSpecialRequirement?: boolean;

  // Buy X Get Y / Multibuy bonus tracking
  isFreeItem?: boolean;
  isMultibuyBonus?: boolean;
  linkedToItemId?: string;
  autoAdded?: boolean;

  // ── Combo tracking ──────────────────────────────────────────────────────
  isCombo?: boolean;
  comboItemCount?: number;
}

interface CartStore {
  items: CartItem[];
  specials: Special[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string, variantId?: string) => void;
  updateQuantity: (id: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getSubtotal: () => number;
  getTotalSavings: () => number;
  // ── Returns the count of REAL items only (excludes auto-added bonus rows) ──
  getItemCount: () => number;
  setSpecials: (specials: Special[]) => void;
  recalculateSpecials: () => void;
}

function calculateItemPrice(
  item: CartItem,
  special: Special | undefined,
  allItems?: CartItem[]
): { price: number; discount: number; description: string; meetsRequirement: boolean } {
  const basePrice = item.originalPrice ?? item.price;

  if (!special) {
    return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
  }

  const now = new Date();
  if (special.startDate && new Date(special.startDate) > now) {
    return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
  }
  if (special.endDate && new Date(special.endDate) < now) {
    return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
  }

  const qty = item.quantity;

  switch (special.type) {
    case 'percentage_off': {
      const pct = special.conditions.discountPercentage;
      if (!pct) return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
      const totalBefore = basePrice * qty;
      let discount = (totalBefore * pct) / 100;
      if (special.conditions.maximumDiscount) discount = Math.min(discount, special.conditions.maximumDiscount);
      return { price: (totalBefore - discount) / qty, discount, description: `${pct}% off applied`, meetsRequirement: true };
    }

    case 'amount_off': {
      const amt = special.conditions.discountAmount;
      if (!amt) return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
      const totalBefore = basePrice * qty;
      let discount = amt;
      if (special.conditions.maximumDiscount) discount = Math.min(discount, special.conditions.maximumDiscount);
      const finalTotal = Math.max(0, totalBefore - discount);
      return { price: finalTotal / qty, discount: totalBefore - finalTotal, description: `R${amt} discount applied`, meetsRequirement: true };
    }

    case 'fixed_price': {
      const newPrice = special.conditions.newPrice;
      if (!newPrice) return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
      return { price: newPrice, discount: Math.max(0, (basePrice - newPrice) * qty), description: `Special price: R${newPrice} each`, meetsRequirement: true };
    }

    case 'multibuy': {
      const { requiredQuantity, specialPrice } = special.conditions;
      if (!requiredQuantity || !specialPrice) return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
      if (qty < requiredQuantity) {
        return { price: basePrice, discount: 0, description: `Add ${requiredQuantity - qty} more for ${requiredQuantity} for R${specialPrice}`, meetsRequirement: false };
      }
      const sets = Math.floor(qty / requiredQuantity);
      const remainder = qty % requiredQuantity;
      const totalCost = sets * specialPrice + remainder * basePrice;
      const discount = basePrice * qty - totalCost;
      return { price: totalCost / qty, discount, description: sets > 1 ? `${sets} × ${requiredQuantity} for R${specialPrice}` : `${requiredQuantity} for R${specialPrice}`, meetsRequirement: true };
    }

    case 'buy_x_get_y': {
      const { buyQuantity, getQuantity, getDiscount = 100 } = special.conditions;
      if (!buyQuantity || !getQuantity) return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
      if (qty < buyQuantity) {
        return { price: basePrice, discount: 0, description: `Add ${buyQuantity - qty} more to get ${getQuantity} ${getDiscount === 100 ? 'free' : `at ${getDiscount}% off`}`, meetsRequirement: false };
      }
      return { price: basePrice, discount: 0, description: `Buy ${buyQuantity} Get ${getQuantity} ${getDiscount === 100 ? 'FREE' : `${getDiscount}% off`}`, meetsRequirement: true };
    }

    case 'bundle': {
      const { bundlePrice } = special.conditions;
      if (!bundlePrice) return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
      return { price: bundlePrice, discount: Math.max(0, (basePrice - bundlePrice) * qty), description: `Bundle price: R${bundlePrice}`, meetsRequirement: true };
    }

    case 'conditional_add_on_price': {
      const { triggerProductId, triggerQuantity = 1, triggerPrice, targetProductId, overridePrice } = special.conditions;

      // ── This item is the TRIGGER product ────────────────────────────────
      if (item.id === triggerProductId) {
        if (triggerPrice == null) return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
        const discount = Math.max(0, (basePrice - triggerPrice) * qty);
        return {
          price: triggerPrice,
          discount,
          description: `Special price — unlocks add-on offer`,
          meetsRequirement: true,
        };
      }

      // ── This item is the ADD-ON (target) product ─────────────────────────
      if (item.id === targetProductId) {
        if (overridePrice == null) return { price: basePrice, discount: 0, description: '', meetsRequirement: false };

        // Check that the trigger product is actually in the cart at the required quantity
        const triggerInCart = (allItems ?? []).find(
          (i) => i.id === triggerProductId && !i.autoAdded && i.quantity >= triggerQuantity
        );

        if (!triggerInCart) {
          // Trigger not present — revert to original price and warn
          return {
            price: basePrice,
            discount: 0,
            description: `Add ${special.conditions.triggerQuantity ?? 1}× trigger product to unlock this special price`,
            meetsRequirement: false,
          };
        }

        const discount = Math.max(0, (basePrice - overridePrice) * qty);
        return {
          price: overridePrice,
          discount,
          description: `Special add-on price with ${special.name}`,
          meetsRequirement: true,
        };
      }

      return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
    }

    default:
      return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
  }
}

async function processBuyXGetYSpecials(items: CartItem[], specials: Special[]): Promise<CartItem[]> {
  const updatedItems = [...items];
  const eligible = specials.filter((s) => s.type === 'buy_x_get_y' && s.active);

  for (const special of eligible) {
    const { buyProductId, buyQuantity, getProductId, getQuantity, getDiscount = 100 } = special.conditions;
    if (!buyProductId || !buyQuantity || !getProductId || !getQuantity) continue;

    const buyItem = updatedItems.find((i) => i.id === buyProductId && !i.isFreeItem);

    if (!buyItem || buyItem.quantity < buyQuantity) {
      const idx = updatedItems.findIndex((i) => i.id === getProductId && i.linkedToItemId === buyProductId && i.autoAdded);
      if (idx !== -1) updatedItems.splice(idx, 1);
      continue;
    }

    const setsEarned = Math.floor(buyItem.quantity / buyQuantity);
    const getFreeQty = setsEarned * getQuantity;
    if (getFreeQty <= 0) continue;

    try {
      const res = await fetch(`/api/products/${getProductId}`);
      if (!res.ok) continue;
      const data = await res.json();
      const getProduct = data.product;
      if (!getProduct) continue;

      const discountedPrice = getDiscount === 100 ? 0 : getProduct.price * (1 - getDiscount / 100);

      const getItemData: CartItem = {
        id: getProduct._id,
        name: getProduct.name,
        price: discountedPrice,
        originalPrice: getProduct.price,
        image: getProduct.images?.[0] ?? '/placeholder.png',
        quantity: getFreeQty,
        sku: getProduct.sku ?? `SKU-${getProduct._id}`,
        appliedSpecialId: special._id?.toString(),
        specialDiscount: (getProduct.price - discountedPrice) * getFreeQty,
        specialDescription: getDiscount === 100 ? `FREE with ${special.name}` : `${getDiscount}% off with ${special.name}`,
        meetsSpecialRequirement: true,
        isFreeItem: true,
        linkedToItemId: buyProductId,
        autoAdded: true,
      };

      const existingIdx = updatedItems.findIndex((i) => i.id === getProductId && i.linkedToItemId === buyProductId && i.autoAdded);
      if (existingIdx !== -1) updatedItems[existingIdx] = getItemData;
      else updatedItems.push(getItemData);
    } catch (err) {
      console.error('Failed to fetch BuyXGetY GET product:', err);
    }
  }

  return updatedItems;
}

async function processMultibuySpecials(items: CartItem[], specials: Special[]): Promise<CartItem[]> {
  const updatedItems = [...items];
  const eligible = specials.filter((s) => s.type === 'multibuy' && s.active);

  for (const special of eligible) {
    const { requiredQuantity, specialPrice } = special.conditions;
    const productId = special.productId ?? special.productIds?.[0];
    if (!productId || !requiredQuantity || !specialPrice) continue;

    const mainItem = updatedItems.find((i) => i.id === productId && !i.isMultibuyBonus && !i.autoAdded);
    const bonusId = `${productId}__multibuy_bonus__${special._id}`;

    if (!mainItem || mainItem.quantity < requiredQuantity) {
      const idx = updatedItems.findIndex((i) => i.id === bonusId && i.autoAdded);
      if (idx !== -1) updatedItems.splice(idx, 1);
      continue;
    }

    const setsEarned = Math.floor(mainItem.quantity / requiredQuantity);
    const basePrice = mainItem.originalPrice ?? mainItem.price;
    const totalDiscount = (basePrice * requiredQuantity - specialPrice) * setsEarned;

    const bonusItemData: CartItem = {
      id: bonusId,
      name: mainItem.name,
      price: 0,
      originalPrice: basePrice,
      image: mainItem.image,
      quantity: setsEarned * requiredQuantity,
      sku: mainItem.sku,
      appliedSpecialId: special._id?.toString(),
      specialDiscount: totalDiscount,
      specialDescription: setsEarned > 1 ? `${setsEarned} × ${requiredQuantity} for R${specialPrice} bundle deal` : `${requiredQuantity} for R${specialPrice} bundle deal`,
      meetsSpecialRequirement: true,
      isMultibuyBonus: true,
      linkedToItemId: productId,
      autoAdded: true,
    };

    const existingIdx = updatedItems.findIndex((i) => i.id === bonusId && i.autoAdded);
    if (existingIdx !== -1) updatedItems[existingIdx] = bonusItemData;
    else updatedItems.push(bonusItemData);
  }

  return updatedItems;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      specials: [],

      addItem: (item) => {
        set((state) => {
          if (item.autoAdded) return state;

          const existingItem = state.items.find((i) => {
            if (item.variantId) return i.id === item.id && i.variantId === item.variantId && !i.autoAdded;
            return i.id === item.id && !i.variantId && !i.autoAdded;
          });

          if (existingItem) {
            return {
              items: state.items.map((i) => {
                if (item.variantId) return i.id === item.id && i.variantId === item.variantId && !i.autoAdded ? { ...i, quantity: i.quantity + item.quantity } : i;
                return i.id === item.id && !i.variantId && !i.autoAdded ? { ...i, quantity: i.quantity + item.quantity } : i;
              }),
            };
          }

          return { items: [...state.items, { ...item, originalPrice: item.originalPrice ?? item.price, autoAdded: false }] };
        });

        setTimeout(() => get().recalculateSpecials(), 0);
      },

      removeItem: (id, variantId) => {
        set((state) => {
          const itemToRemove = state.items.find((i) => {
            if (variantId) return i.id === id && i.variantId === variantId;
            return i.id === id && !i.variantId;
          });

          let filtered = state.items.filter((i) => {
            if (variantId) return !(i.id === id && i.variantId === variantId);
            return !(i.id === id && !i.variantId);
          });

          if (itemToRemove && !itemToRemove.isFreeItem && !itemToRemove.isMultibuyBonus) {
            filtered = filtered.filter((i) => !(i.linkedToItemId === id && i.autoAdded));
          }

          return { items: filtered };
        });

        setTimeout(() => get().recalculateSpecials(), 0);
      },

      updateQuantity: (id, quantity, variantId) => {
        if (quantity < 1) { get().removeItem(id, variantId); return; }
        set((state) => ({
          items: state.items.map((item) => {
            if (item.autoAdded) return item;
            if (variantId) return item.id === id && item.variantId === variantId ? { ...item, quantity } : item;
            return item.id === id && !item.variantId ? { ...item, quantity } : item;
          }),
        }));
        setTimeout(() => get().recalculateSpecials(), 0);
      },

      clearCart: () => set({ items: [] }),

      getTotal: () => get().items.reduce((sum, item) => sum + (parseFloat(item.price as any) || 0) * item.quantity, 0),

      // ── Returns post-special subtotal (excludes auto-added bonus rows) ──
      getSubtotal: () =>
        get().items.reduce((sum, item) => {
          if (item.autoAdded) return sum;
          const p = parseFloat(item.price as any) || 0;
          return sum + p * item.quantity;
        }, 0),

      getTotalSavings: () => get().items.reduce((sum, item) => sum + (parseFloat(item.specialDiscount as any) || 0), 0),

      // ── Sum of real item quantities (excludes auto-added bonus rows) ────────────
      getItemCount: () => get().items.reduce((sum, item) => item.autoAdded ? sum : sum + item.quantity, 0),

      setSpecials: (specials) => { set({ specials }); get().recalculateSpecials(); },

      recalculateSpecials: async () => {
        const state = get();
        let updatedItems = await processBuyXGetYSpecials(state.items, state.specials);
        updatedItems = await processMultibuySpecials(updatedItems, state.specials);

        // Pass the full item list into calculateItemPrice so conditional_add_on_price
        // can check whether the trigger product is present in cart.
        updatedItems = updatedItems.map((item) => {
          if (item.autoAdded) return item;
          if (item.isCombo) return item;

          // ── Find which special applies to this item ─────────────────────
          // For conditional_add_on_price the item can be either the trigger
          // product or the target (add-on) product, so we search both roles.
          const special = state.specials.find((s: Special) => {
            if (!s.active) return false;

            if (s.type === 'conditional_add_on_price') {
              return (
                s.conditions.triggerProductId === item.id ||
                s.conditions.targetProductId === item.id
              );
            }

            return s.productId === item.id || s.productIds?.includes(item.id);
          });

          if (!special) {
            return {
              ...item,
              price: item.originalPrice ?? item.price,
              appliedSpecialId: undefined,
              specialDiscount: undefined,
              specialDescription: undefined,
              meetsSpecialRequirement: undefined,
            };
          }

          const result = calculateItemPrice(item, special, updatedItems);
          return {
            ...item,
            price: result.price,
            appliedSpecialId: result.meetsRequirement ? special._id?.toString() : undefined,
            specialDiscount: result.discount,
            specialDescription: result.description,
            meetsSpecialRequirement: result.meetsRequirement,
          };
        });

        set({ items: updatedItems });
      },
    }),
    { name: 'cart-storage' }
  )
);
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface Branch {
  _id: string;
  name: string;
  slug: string;
  displayName: string;
  status: string;
  settings?: {
    storeLocation: { lat: number; lng: number; address: string };
    contactEmail: string;
    contactPhone: string;
  };
}

interface CartItem {
  id: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  image: string;
  quantity: number;
  sku: string;

  appliedSpecialId?: string;
  originalPrice?: number;
  specialDiscount?: number;
  specialDescription?: string;
  meetsSpecialRequirement?: boolean;

  isFreeItem?: boolean;
  isMultibuyBonus?: boolean;
  linkedToItemId?: string;
  autoAdded?: boolean;

  isCombo?: boolean;
  comboItemCount?: number;
}

interface WishlistItem {
  id: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  image: string;
  sku: string;
  slug: string;
}

interface Special {
  _id?: string;
  name: string;
  type: 'percentage_off' | 'amount_off' | 'buy_x_get_y' | 'multibuy' | 'bundle' | 'fixed_price';
  active: boolean;
  productId?: string;
  productIds?: string[];
  categoryId?: string;
  conditions: {
    buyProductId?: string;
    buyQuantity?: number;
    getProductId?: string;
    getQuantity?: number;
    getDiscount?: number;
    requiredQuantity?: number;
    specialPrice?: number;
    discountPercentage?: number;
    discountAmount?: number;
    newPrice?: number;
    maximumDiscount?: number;
    bundlePrice?: number;
  };
  startDate?: Date;
  endDate?: Date;
}

interface AppState {
  user: User | null;
  branch: Branch | null;
  cart: CartItem[];
  wishlist: WishlistItem[];
  specials: Special[];
  isAuthenticated: boolean;

  setUser: (user: User | null) => void;
  setBranch: (branch: Branch | null) => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string, variantId?: string) => void;
  updateQuantity: (id: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (id: string, variantId?: string) => void;
  clearWishlist: () => void;
  logout: () => void;

  setSpecials: (specials: Special[]) => void;
  recalculateSpecials: () => void;

  getTotal: () => number;
  getSubtotal: () => number;
  getTotalSavings: () => number;
  getItemCount: () => number;
}

function calculateItemPrice(
  item: CartItem,
  special: Special | undefined
): { price: number; discount: number; description: string; meetsRequirement: boolean } {
  const basePrice = item.originalPrice ?? item.price;

  if (!special) return { price: basePrice, discount: 0, description: '', meetsRequirement: false };

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
      return {
        price: (totalBefore - discount) / qty,
        discount,
        description: `${pct}% off applied`,
        meetsRequirement: true,
      };
    }

    case 'amount_off': {
      const amt = special.conditions.discountAmount;
      if (!amt) return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
      const totalBefore = basePrice * qty;
      let discount = amt;
      if (special.conditions.maximumDiscount) discount = Math.min(discount, special.conditions.maximumDiscount);
      const finalTotal = Math.max(0, totalBefore - discount);
      return {
        price: finalTotal / qty,
        discount: totalBefore - finalTotal,
        description: `R${amt} discount applied`,
        meetsRequirement: true,
      };
    }

    case 'fixed_price': {
      const newPrice = special.conditions.newPrice;
      if (!newPrice) return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
      return {
        price: newPrice,
        discount: Math.max(0, (basePrice - newPrice) * qty),
        description: `Special price: R${newPrice} each`,
        meetsRequirement: true,
      };
    }

    case 'multibuy': {
      const { requiredQuantity, specialPrice } = special.conditions;
      if (!requiredQuantity || !specialPrice) {
        return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
      }
      if (qty < requiredQuantity) {
        return {
          price: basePrice,
          discount: 0,
          description: `Add ${requiredQuantity - qty} more for ${requiredQuantity} for R${specialPrice}`,
          meetsRequirement: false,
        };
      }
      const sets = Math.floor(qty / requiredQuantity);
      const remainder = qty % requiredQuantity;
      const totalCost = sets * specialPrice + remainder * basePrice;
      const originalCost = basePrice * qty;
      const discount = originalCost - totalCost;
      return {
        price: totalCost / qty,
        discount,
        description: sets > 1 ? `${sets} × ${requiredQuantity} for R${specialPrice}` : `${requiredQuantity} for R${specialPrice}`,
        meetsRequirement: true,
      };
    }

    case 'buy_x_get_y': {
      const { buyQuantity, getQuantity, getDiscount = 100 } = special.conditions;
      if (!buyQuantity || !getQuantity) {
        return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
      }
      if (qty < buyQuantity) {
        return {
          price: basePrice,
          discount: 0,
          description: `Add ${buyQuantity - qty} more to get ${getQuantity} ${getDiscount === 100 ? 'free' : `at ${getDiscount}% off`}`,
          meetsRequirement: false,
        };
      }
      return {
        price: basePrice,
        discount: 0,
        description: `Buy ${buyQuantity} Get ${getQuantity} ${getDiscount === 100 ? 'FREE' : `${getDiscount}% off`}`,
        meetsRequirement: true,
      };
    }

    case 'bundle': {
      const { bundlePrice } = special.conditions;
      if (!bundlePrice) return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
      return {
        price: bundlePrice,
        discount: Math.max(0, (basePrice - bundlePrice) * qty),
        description: `Bundle price: R${bundlePrice}`,
        meetsRequirement: true,
      };
    }

    default:
      return { price: basePrice, discount: 0, description: '', meetsRequirement: false };
  }
}

async function processBuyXGetYSpecials(
  items: CartItem[],
  specials: Special[],
): Promise<CartItem[]> {
  const updatedItems = [...items];
  const eligible = specials.filter((s) => s.type === 'buy_x_get_y' && s.active);

  for (const special of eligible) {
    const { buyProductId, buyQuantity, getProductId, getQuantity, getDiscount = 100 } = special.conditions;
    if (!buyProductId || !buyQuantity || !getProductId || !getQuantity) continue;

    const buyItem = updatedItems.find((i) => i.id === buyProductId && !i.isFreeItem);

    if (!buyItem || buyItem.quantity < buyQuantity) {
      const idx = updatedItems.findIndex(
        (i) => i.id === getProductId && i.linkedToItemId === buyProductId && i.autoAdded
      );
      if (idx !== -1) updatedItems.splice(idx, 1);
      continue;
    }

    const setsEarned = Math.floor(buyItem.quantity / buyQuantity);
    const getFreeQty = setsEarned * getQuantity;
    if (getFreeQty <= 0) continue;

    try {
      const response = await api.get(`/api/products/${getProductId}`);
      const getProduct = response.data.product;
      if (!getProduct) continue;

      const discountedPrice = getDiscount === 100 ? 0 : getProduct.price * (1 - getDiscount / 100);

      const getItemData: CartItem = {
        id: getProduct._id,
        name: getProduct.name,
        price: discountedPrice,
        originalPrice: getProduct.price,
        image: getProduct.images?.[0] ?? '',
        quantity: getFreeQty,
        sku: getProduct.sku ?? `SKU-${getProduct._id}`,
        appliedSpecialId: special._id?.toString(),
        specialDiscount: (getProduct.price - discountedPrice) * getFreeQty,
        specialDescription:
          getDiscount === 100
            ? `FREE with ${special.name}`
            : `${getDiscount}% off with ${special.name}`,
        meetsSpecialRequirement: true,
        isFreeItem: true,
        linkedToItemId: buyProductId,
        autoAdded: true,
      };

      const existingIdx = updatedItems.findIndex(
        (i) => i.id === getProductId && i.linkedToItemId === buyProductId && i.autoAdded
      );
      if (existingIdx !== -1) {
        updatedItems[existingIdx] = getItemData;
      } else {
        updatedItems.push(getItemData);
      }
    } catch (err) {
      console.error('Failed to fetch BuyXGetY GET product:', err);
    }
  }

  return updatedItems;
}

async function processMultibuySpecials(
  items: CartItem[],
  specials: Special[]
): Promise<CartItem[]> {
  const updatedItems = [...items];
  const eligible = specials.filter((s) => s.type === 'multibuy' && s.active);

  for (const special of eligible) {
    const { requiredQuantity, specialPrice } = special.conditions;
    const productId = special.productId ?? special.productIds?.[0];
    if (!productId || !requiredQuantity || !specialPrice) continue;

    const mainItem = updatedItems.find(
      (i) => i.id === productId && !i.isMultibuyBonus && !i.autoAdded
    );

    const bonusId = `${productId}__multibuy_bonus__${special._id}`;

    if (!mainItem || mainItem.quantity < requiredQuantity) {
      const idx = updatedItems.findIndex((i) => i.id === bonusId && i.autoAdded);
      if (idx !== -1) updatedItems.splice(idx, 1);
      continue;
    }

    const setsEarned = Math.floor(mainItem.quantity / requiredQuantity);
    const basePrice = mainItem.originalPrice ?? mainItem.price;
    const originalBundleTotal = basePrice * requiredQuantity;
    const discountPerSet = originalBundleTotal - specialPrice;
    const totalDiscount = discountPerSet * setsEarned;

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
      specialDescription:
        setsEarned > 1
          ? `${setsEarned} × ${requiredQuantity} for R${specialPrice} bundle deal`
          : `${requiredQuantity} for R${specialPrice} bundle deal`,
      meetsSpecialRequirement: true,
      isMultibuyBonus: true,
      linkedToItemId: productId,
      autoAdded: true,
    };

    const existingIdx = updatedItems.findIndex((i) => i.id === bonusId && i.autoAdded);
    if (existingIdx !== -1) {
      updatedItems[existingIdx] = bonusItemData;
    } else {
      updatedItems.push(bonusItemData);
    }
  }

  return updatedItems;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      branch: null,
      cart: [],
      wishlist: [],
      specials: [],
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setBranch: async (branch) => {
        set({ branch });
        if (branch) await AsyncStorage.setItem('selectedBranch', branch.slug);
      },

      addToCart: (item) => {
        const { cart } = get();
        if (item.autoAdded) return;

        const existingIndex = cart.findIndex((i) => {
          if (item.variantId) return i.id === item.id && i.variantId === item.variantId && !i.autoAdded;
          return i.id === item.id && !i.variantId && !i.autoAdded;
        });

        if (existingIndex >= 0) {
          const newCart = [...cart];
          newCart[existingIndex].quantity += item.quantity;
          set({ cart: newCart });
        } else {
          set({ cart: [...cart, { ...item, originalPrice: item.originalPrice ?? item.price, autoAdded: false }] });
        }

        setTimeout(() => get().recalculateSpecials(), 0);
      },

      removeFromCart: (id, variantId) => {
        const { cart } = get();
        const itemToRemove = cart.find((i) => {
          if (variantId) return i.id === id && i.variantId === variantId;
          return i.id === id && !i.variantId;
        });

        let newCart = cart.filter((i) => {
          if (variantId) return !(i.id === id && i.variantId === variantId);
          return !(i.id === id && !i.variantId);
        });

        if (itemToRemove && !itemToRemove.isFreeItem && !itemToRemove.isMultibuyBonus) {
          newCart = newCart.filter((i) => !(i.linkedToItemId === id && i.autoAdded));
        }

        set({ cart: newCart });
        setTimeout(() => get().recalculateSpecials(), 0);
      },

      updateQuantity: (id, quantity, variantId) => {
        if (quantity < 1) { get().removeFromCart(id, variantId); return; }
        const { cart } = get();
        const newCart = cart.map((item) => {
          if (item.autoAdded) return item;
          if (variantId) return item.id === id && item.variantId === variantId ? { ...item, quantity } : item;
          return item.id === id && !item.variantId ? { ...item, quantity } : item;
        });
        set({ cart: newCart });
        setTimeout(() => get().recalculateSpecials(), 0);
      },

      clearCart: () => set({ cart: [] }),

      addToWishlist: (item) => {
        const { wishlist } = get();
        const exists = wishlist.some((i) => {
          if (item.variantId) return i.id === item.id && i.variantId === item.variantId;
          return i.id === item.id && !i.variantId;
        });
        if (!exists) set({ wishlist: [...wishlist, item] });
      },

      removeFromWishlist: (id, variantId) => {
        set({
          wishlist: get().wishlist.filter((i) => {
            if (variantId) return !(i.id === id && i.variantId === variantId);
            return !(i.id === id && !i.variantId);
          }),
        });
      },

      clearWishlist: () => set({ wishlist: [] }),

      logout: async () => {
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('user');
        set({ user: null, isAuthenticated: false, cart: [], wishlist: [], specials: [] });
      },

      setSpecials: (specials) => {
        set({ specials });
        get().recalculateSpecials();
      },

      recalculateSpecials: async () => {
        const state = get();

        let updatedCart = await processBuyXGetYSpecials(state.cart, state.specials);
        updatedCart = await processMultibuySpecials(updatedCart, state.specials);

        updatedCart = updatedCart.map((item) => {
          if (item.autoAdded) return item;
          if (item.isCombo) return item;

          const special = state.specials.find(
            (s: Special) => s.active && (s.productId === item.id || s.productIds?.includes(item.id))
          );

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

          const result = calculateItemPrice(item, special);
          return {
            ...item,
            price: result.price,
            appliedSpecialId: result.meetsRequirement ? special._id?.toString() : undefined,
            specialDiscount: result.discount,
            specialDescription: result.description,
            meetsSpecialRequirement: result.meetsRequirement,
          };
        });

        set({ cart: updatedCart });
      },

      getTotal: () =>
        get().cart.reduce((sum, item) => {
          const p = parseFloat(item.price as any) || 0;
          return sum + p * item.quantity;
        }, 0),

      // ── Returns post-special subtotal (excludes auto-added bonus rows) ──
      getSubtotal: () =>
        get().cart.reduce((sum, item) => {
          if (item.autoAdded) return sum;
          const p = parseFloat(item.price as any) || 0;
          return sum + p * item.quantity;
        }, 0),

      getTotalSavings: () =>
        get().cart.reduce((sum, item) => {
          const d = parseFloat(item.specialDiscount as any) || 0;
          return sum + d;
        }, 0),

      getItemCount: () => get().cart.reduce((sum, item) => item.autoAdded ? sum : sum + item.quantity, 0),
    }),
    {
      name: 'tfs-mobile-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
// lib/store.ts  (customer app — Expo Router)
//
// ─── Changes ─────────────────────────────────────────────────────────────────
// DeliveryAddress now carries deliveryFee, distance, outsideZone
// so checkout can use them directly without recalculating.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface DeliveryAddress {
  name:             string;
  street:           string;
  city:             string;
  province:         string;
  postalCode:       string;
  country:          string;
  lat:              number;
  lng:              number;
  formattedAddress: string;
  // ✅ Delivery calculation result (set by address-picker)
  deliveryFee:  number;
  distance:     number;    // km from store
  outsideZone:  boolean;   // true = cannot deliver
}

export interface Branch {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
  displayName: string;
  status: 'active' | 'paused' | 'inactive';
  settings?: {
    storeLocation?: { lat: number; lng: number; address: string };
    contactEmail?: string;
    contactPhone?: string;
    // ✅ Delivery pricing tiers (populated from /api/settings)
    deliveryPricing?: {
      local:        number;
      localRadius:  number;
      medium:       number;
      mediumRadius: number;
      far:          number;
      farRadius:    number;
    };
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
}

export interface CartItem {
  id: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  originalPrice?: number;
  image: string;
  quantity: number;
  sku?: string;

  // Special / promotion fields
  appliedSpecialId?: string;
  specialDiscount?: number;
  specialDescription?: string;
  specialType?: string;
  specialConditions?: Record<string, any>;

  // Bonus / free item flags
  isFreeItem?: boolean;
  isMultibuyBonus?: boolean;
  isBonusItem?: boolean;
  autoAdded?: boolean;
  linkedToItemId?: string;
  meetsSpecialRequirement?: boolean;

  // Combo flags
  isComboItem?: boolean;
  comboId?: string;
  comboName?: string;
  comboItems?: { productName: string; quantity: number }[];
}

export interface WishlistItem {
  id: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  image: string;
  sku?: string;
  slug: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store shape
// ─────────────────────────────────────────────────────────────────────────────
interface StoreState {
  // Auth
  user: User | null;
  setUser: (user: User | null) => void;

  // Branch
  branch: Branch | null;
  setBranch: (branch: Branch | null) => void;

  // Cart
  items: CartItem[];
  addItem: (item: CartItem) => void;
  addToCart: (item: CartItem) => void;
  removeItem: (id: string, variantId?: string) => void;
  updateQuantity: (id: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;

  // Wishlist
  wishlist: WishlistItem[];
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (id: string, variantId?: string) => void;
  isInWishlist: (id: string, variantId?: string) => boolean;

  // Address handoff (address-picker → checkout)
  // ✅ Uses the enriched DeliveryAddress with fee/distance/outsideZone
  pendingDeliveryAddress: DeliveryAddress | null;
  setPendingDeliveryAddress: (address: DeliveryAddress | null) => void;

  // Auth helpers
  logout: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────
export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // ── Auth ───────────────────────────────────────────────────────────────
      user: null,
      setUser: (user) => set({ user }),

      // ── Branch ─────────────────────────────────────────────────────────────
      branch: null,
      setBranch: (branch) => set({ branch }),

      // ── Cart ───────────────────────────────────────────────────────────────
      items: [],

      addItem: (item) => {
        set((state) => {
          const existing = state.items.find((i) => {
            if (item.variantId) return i.id === item.id && i.variantId === item.variantId;
            return i.id === item.id && !i.variantId;
          });
          if (existing) {
            return {
              items: state.items.map((i) => {
                if (item.variantId) {
                  return i.id === item.id && i.variantId === item.variantId
                    ? { ...i, quantity: i.quantity + item.quantity }
                    : i;
                }
                return i.id === item.id && !i.variantId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i;
              }),
            };
          }
          return { items: [...state.items, item] };
        });
      },

      addToCart: (item) => get().addItem(item),

      removeItem: (id, variantId) => {
        set((state) => ({
          items: state.items.filter((item) => {
            if (variantId) return !(item.id === id && item.variantId === variantId);
            return !(item.id === id && !item.variantId);
          }),
        }));
      },

      updateQuantity: (id, quantity, variantId) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (variantId) {
              return item.id === id && item.variantId === variantId ? { ...item, quantity } : item;
            }
            return item.id === id && !item.variantId ? { ...item, quantity } : item;
          }),
        }));
      },

      clearCart: () => set({ items: [] }),

      getTotal: () =>
        get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),

      getItemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      // ── Wishlist ───────────────────────────────────────────────────────────
      wishlist: [],

      addToWishlist: (item) => {
        set((state) => {
          const exists = state.wishlist.some((w) =>
            item.variantId
              ? w.id === item.id && w.variantId === item.variantId
              : w.id === item.id && !w.variantId
          );
          if (exists) return state;
          return { wishlist: [...state.wishlist, item] };
        });
      },

      removeFromWishlist: (id, variantId) => {
        set((state) => ({
          wishlist: state.wishlist.filter((w) => {
            if (variantId) return !(w.id === id && w.variantId === variantId);
            return !(w.id === id && !w.variantId);
          }),
        }));
      },

      isInWishlist: (id, variantId) =>
        get().wishlist.some((w) =>
          variantId
            ? w.id === id && w.variantId === variantId
            : w.id === id && !w.variantId
        ),

      // ── Address handoff ────────────────────────────────────────────────────
      pendingDeliveryAddress: null,
      setPendingDeliveryAddress: (address) => set({ pendingDeliveryAddress: address }),

      // ── Logout ─────────────────────────────────────────────────────────────
      logout: async () => {
        await AsyncStorage.multiRemove(['user', 'selectedBranch']);
        set({ user: null, branch: null, items: [], wishlist: [], pendingDeliveryAddress: null });
      },
    }),
    {
      name: 'tfs-customer-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user:     state.user,
        branch:   state.branch,
        items:    state.items,
        wishlist: state.wishlist,
        // pendingDeliveryAddress intentionally excluded (transient)
      }),
    }
  )
);
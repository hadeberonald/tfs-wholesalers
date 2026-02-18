import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  id: string; // Product ID
  variantId?: string; // Optional variant ID
  name: string;
  variantName?: string; // Optional variant name for display
  price: number;
  image: string;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string, variantId?: string) => void;
  updateQuantity: (id: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (item) => {
        set((state) => {
          // Find existing item by product ID and variant ID (if applicable)
          const existingItem = state.items.find((i) => {
            if (item.variantId) {
              return i.id === item.id && i.variantId === item.variantId;
            }
            return i.id === item.id && !i.variantId;
          });
          
          if (existingItem) {
            // Update quantity if item already exists
            return {
              items: state.items.map((i) => {
                if (item.variantId) {
                  return (i.id === item.id && i.variantId === item.variantId)
                    ? { ...i, quantity: i.quantity + item.quantity }
                    : i;
                }
                return (i.id === item.id && !i.variantId)
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i;
              }),
            };
          }
          
          // Add new item
          return { items: [...state.items, item] };
        });
      },
      
      removeItem: (id, variantId) => {
        set((state) => ({
          items: state.items.filter((item) => {
            if (variantId) {
              return !(item.id === id && item.variantId === variantId);
            }
            return !(item.id === id && !item.variantId);
          }),
        }));
      },
      
      updateQuantity: (id, quantity, variantId) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (variantId) {
              return (item.id === id && item.variantId === variantId)
                ? { ...item, quantity }
                : item;
            }
            return (item.id === id && !item.variantId)
              ? { ...item, quantity }
              : item;
          }),
        }));
      },
      
      clearCart: () => {
        set({ items: [] });
      },
      
      getTotal: () => {
        return get().items.reduce(
          (sum, item) => sum + (item.price * item.quantity),
          0
        );
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
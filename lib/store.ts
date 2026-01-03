import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, Cart } from '@/types';

interface CartState extends Cart {
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setDeliveryFee: (fee: number) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      subtotal: 0,
      deliveryFee: 0,
      total: 0,

      addItem: (item: CartItem) => {
        const items = get().items;
        const existingItem = items.find(i => i.productId === item.productId);

        let newItems: CartItem[];
        if (existingItem) {
          newItems = items.map(i =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          );
        } else {
          newItems = [...items, item];
        }

        const subtotal = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const deliveryFee = get().deliveryFee;
        const total = subtotal + deliveryFee;

        set({ items: newItems, subtotal, total });
      },

      removeItem: (productId: string) => {
        const newItems = get().items.filter(i => i.productId !== productId);
        const subtotal = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const deliveryFee = get().deliveryFee;
        const total = subtotal + deliveryFee;

        set({ items: newItems, subtotal, total });
      },

      updateQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        const newItems = get().items.map(i =>
          i.productId === productId ? { ...i, quantity } : i
        );
        const subtotal = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const deliveryFee = get().deliveryFee;
        const total = subtotal + deliveryFee;

        set({ items: newItems, subtotal, total });
      },

      clearCart: () => {
        set({ items: [], subtotal: 0, deliveryFee: 0, total: 0 });
      },

      setDeliveryFee: (fee: number) => {
        const subtotal = get().subtotal;
        const total = subtotal + fee;
        set({ deliveryFee: fee, total });
      },
    }),
    {
      name: 'tfs-cart-storage',
    }
  )
);

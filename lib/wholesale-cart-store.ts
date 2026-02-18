import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WholesaleCartItem {
  id: string; // Product ID
  variantId?: string;
  name: string;
  variantName?: string;
  sku: string;
  image: string;
  
  // Wholesale specific
  moq: number;
  moqUnit: string;
  unitsPerBox?: number;
  
  // Quantity in MOQ units
  quantity: number; // e.g., 5 boxes
  totalUnits: number; // e.g., 120 individual units
  
  // Pricing
  unitPrice: number; // Wholesale price per unit
  totalPrice: number;
}

interface WholesaleCartStore {
  items: WholesaleCartItem[];
  addItem: (item: WholesaleCartItem) => void;
  removeItem: (id: string, variantId?: string) => void;
  updateQuantity: (id: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getSubtotal: () => number;
  getTotalUnits: () => number;
  getItemCount: () => number;
}

export const useWholesaleCartStore = create<WholesaleCartStore>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (item) => {
        set((state) => {
          const existingItem = state.items.find((i) => {
            if (item.variantId) {
              return i.id === item.id && i.variantId === item.variantId;
            }
            return i.id === item.id && !i.variantId;
          });
          
          if (existingItem) {
            // Update quantity
            return {
              items: state.items.map((i) => {
                if (item.variantId) {
                  if (i.id === item.id && i.variantId === item.variantId) {
                    const newQuantity = i.quantity + item.quantity;
                    const newTotalUnits = i.unitsPerBox 
                      ? newQuantity * i.unitsPerBox
                      : newQuantity;
                    return { 
                      ...i, 
                      quantity: newQuantity,
                      totalUnits: newTotalUnits,
                      totalPrice: i.unitPrice * newTotalUnits
                    };
                  }
                  return i;
                }
                if (i.id === item.id && !i.variantId) {
                  const newQuantity = i.quantity + item.quantity;
                  const newTotalUnits = i.unitsPerBox 
                    ? newQuantity * i.unitsPerBox
                    : newQuantity;
                  return { 
                    ...i, 
                    quantity: newQuantity,
                    totalUnits: newTotalUnits,
                    totalPrice: i.unitPrice * newTotalUnits
                  };
                }
                return i;
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
            const match = variantId
              ? (item.id === id && item.variantId === variantId)
              : (item.id === id && !item.variantId);
            
            if (match) {
              const newTotalUnits = item.unitsPerBox 
                ? quantity * item.unitsPerBox
                : quantity;
              return {
                ...item,
                quantity,
                totalUnits: newTotalUnits,
                totalPrice: item.unitPrice * newTotalUnits
              };
            }
            return item;
          }),
        }));
      },
      
      clearCart: () => {
        set({ items: [] });
      },
      
      getTotal: () => {
        return get().items.reduce(
          (sum, item) => sum + item.totalPrice,
          0
        );
      },

      getSubtotal: () => {
        return get().getTotal();
      },

      getTotalUnits: () => {
        return get().items.reduce(
          (sum, item) => sum + item.totalUnits,
          0
        );
      },

      getItemCount: () => {
        return get().items.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
      }
    }),
    {
      name: 'wholesale-cart-storage',
    }
  )
);
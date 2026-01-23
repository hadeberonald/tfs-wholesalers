import { create } from 'zustand';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://tfs-wholesalers.onrender.com';

interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  image: string;
  scanned?: boolean;
}

interface Order {
  _id: string;
  orderNumber: string;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  items: OrderItem[];
  total: number;
  status: string;
  pickingStatus?: 'pending' | 'assigned' | 'picking' | 'packed' | 'ready';
  assignedPicker?: string;
  packages?: Package[];
  createdAt: string;
}

interface Package {
  qrCode: string;
  items: string[]; // Product IDs
  packageNumber: number;
  totalPackages: number;
  scannedAt?: Date;
}

interface OrdersState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  fetchOrders: () => Promise<void>;
  assignOrder: (orderId: string, pickerId: string) => Promise<void>;
  scanProduct: (orderId: string, sku: string) => Promise<boolean>;
  createPackage: (orderId: string, qrCode: string, itemIds: string[], packageNum: number, total: number) => Promise<void>;
  completeOrder: (orderId: string) => Promise<void>;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  currentOrder: null,
  loading: false,

  fetchOrders: async () => {
    try {
      set({ loading: true });
      const token = await AsyncStorage.getItem('auth_token');
      
      const response = await axios.get(`${API_URL}/api/orders?picking=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      set({ orders: response.data.orders, loading: false });
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      set({ loading: false });
    }
  },

  assignOrder: async (orderId: string, pickerId: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        {
          pickingStatus: 'assigned',
          assignedPicker: pickerId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Refresh orders
      await get().fetchOrders();
    } catch (error) {
      console.error('Failed to assign order:', error);
      throw error;
    }
  },

  scanProduct: async (orderId: string, sku: string) => {
    try {
      const { currentOrder } = get();
      if (!currentOrder || currentOrder._id !== orderId) {
        throw new Error('Order not found');
      }

      // Find product by SKU
      const itemIndex = currentOrder.items.findIndex(
        (item) => item.sku === sku && !item.scanned
      );

      if (itemIndex === -1) {
        return false; // Product not found or already scanned
      }

      // Mark as scanned locally
      const updatedItems = [...currentOrder.items];
      updatedItems[itemIndex].scanned = true;

      set({
        currentOrder: {
          ...currentOrder,
          items: updatedItems,
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to scan product:', error);
      return false;
    }
  },

  createPackage: async (
    orderId: string,
    qrCode: string,
    itemIds: string[],
    packageNum: number,
    total: number
  ) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      
      await axios.post(
        `${API_URL}/api/packages`,
        {
          orderId,
          qrCode,
          items: itemIds,
          packageNumber: packageNum,
          totalPackages: total,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (error) {
      console.error('Failed to create package:', error);
      throw error;
    }
  },

  completeOrder: async (orderId: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        {
          pickingStatus: 'ready',
          status: 'ready_for_delivery',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      set({ currentOrder: null });
      await get().fetchOrders();
    } catch (error) {
      console.error('Failed to complete order:', error);
      throw error;
    }
  },
}));

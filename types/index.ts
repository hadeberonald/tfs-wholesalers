import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  email: string;
  password: string;
  name: string;
  role: 'customer' | 'admin' | 'picker';
  phone?: string;
  addresses?: Address[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  _id?: string;
  name: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
}

export interface Category {
  _id?: ObjectId;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  banner?: string; // For featured carousel
  parentId?: ObjectId | string | null; // For nested categories
  level: number; // 0 = top level, 1 = subcategory, 2 = sub-subcategory
  order: number;
  active: boolean;
  featured: boolean; // Show in carousel
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  _id?: ObjectId;
  name: string;
  slug: string;
  description: string;
  category: ObjectId | string;
  categoryPath?: string[]; // Array of category IDs from root to leaf
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  sku: string;
  stockLevel: number;
  lowStockThreshold: number;
  images: string[];
  onSpecial: boolean;
  specialPrice?: number;
  specialStartDate?: Date;
  specialEndDate?: Date;
  active: boolean;
  featured: boolean;
  unit?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  sku: string;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

export interface Order {
  _id?: ObjectId;
  orderNumber: string;
  userId: ObjectId | string;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  items: OrderItem[];
  deliveryAddress: Address;
  deliveryFee: number;
  subtotal: number;
  total: number;
  paymentMethod: 'paystack' | 'ozow' | 'cash';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentReference?: string;
  orderStatus: 'pending' | 'confirmed' | 'picking' | 'ready' | 'out-for-delivery' | 'delivered' | 'cancelled';
  pickerId?: ObjectId | string;
  pickedAt?: Date;
  deliveryNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  image: string;
}

export interface HeroBanner {
  _id?: ObjectId;
  title: string;
  subtitle?: string;
  image: string;
  link?: string;
  buttonText?: string;
  active: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryPricing {
  _id?: ObjectId;
  local: number;
  localRadius: number;
  medium: number;
  mediumRadius: number;
  far: number;
  farRadius: number;
  updatedAt: Date;
}

export interface SiteSettings {
  _id?: ObjectId;
  storeName: string;
  storeLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  contactEmail: string;
  contactPhone: string;
  deliveryPricing: DeliveryPricing;
  minimumOrderValue?: number;
  updatedAt: Date;
}
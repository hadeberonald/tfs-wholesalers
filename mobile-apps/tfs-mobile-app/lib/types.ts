// types.ts - Updated with special tracking properties

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  specialPrice?: number;
  compareAtPrice?: number;
  images: string[];
  stockLevel: number;
  onSpecial?: boolean;
  active: boolean;
  hasVariants?: boolean;
  variants?: ProductVariant[];
  categories?: string[];
  sku?: string;
  unit?: string;
  unitQuantity?: number;
}

export interface ProductVariant {
  _id: string;
  name: string;
  sku: string;
  barcode?: string;
  price?: number;
  compareAtPrice?: number;
  specialPrice?: number;
  stockLevel: number;
  images: string[];
  active: boolean;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  banner?: string;
  parentId?: string | null;
  level: number;
  order: number;
  active: boolean;
  featured: boolean;
  children?: Category[];
}

export interface Special {
  _id: string;
  name: string;
  slug: string;
  description: string;
  type: 'percentage_off' | 'amount_off' | 'fixed_price' | 'multibuy' | 'buy_x_get_y';
  badgeText?: string;
  images?: string[];
  conditions: {
    // Percentage off
    discountPercentage?: number;
    maximumDiscount?: number;
    
    // Amount off
    discountAmount?: number;
    
    // Fixed price
    newPrice?: number;
    
    // Multibuy
    requiredQuantity?: number;
    specialPrice?: number;
    
    // Buy X Get Y
    buyProductId?: string;
    buyQuantity?: number;
    getProductId?: string;
    getQuantity?: number;
    getDiscount?: number; // 100 = free, 50 = 50% off
    
    // Bundle
    bundlePrice?: number;
  };
  active: boolean;
  featured: boolean;
  productId?: string;
  productIds?: string[];
  startDate?: string;
  endDate?: string;
}

export interface Combo {
  _id: string;
  name: string;
  slug: string;
  description: string;
  images?: string[];
  items: ComboItem[];
  comboPrice: number;
  regularPrice: number;
  stockLevel: number;
  active: boolean;
  branchId: string;
}

export interface ComboItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Branch {
  _id: string;
  name: string;
  slug: string;
  displayName: string;
  status: string;
  settings?: {
    storeLocation: {
      lat: number;
      lng: number;
      address: string;
    };
    contactEmail: string;
    contactPhone: string;
  };
}

// ✅ UPDATED: CartItem with special tracking
export interface CartItem {
  id: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  image: string;
  quantity: number;
  sku: string;
  
  // ✅ NEW: Special pricing info
  appliedSpecialId?: string;
  originalPrice?: number;
  specialDiscount?: number;
  specialDescription?: string;
  meetsSpecialRequirement?: boolean;
  
  // ✅ NEW: Buy X Get Y tracking
  isFreeItem?: boolean;
  linkedToItemId?: string;
  autoAdded?: boolean;
}

export interface WishlistItem {
  id: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  image: string;
  sku: string;
  slug: string;
}

// ✅ NEW: Order types
export interface Order {
  _id: string;
  orderNumber: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  totalSavings?: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  quantity: number;
  image: string;
  sku: string;
  appliedSpecialId?: string;
  originalPrice?: number;
  specialDiscount?: number;
}

export interface Address {
  _id?: string;
  name: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
}
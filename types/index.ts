import { ObjectId } from 'mongodb';

// NEW: Branch interface for multi-tenant system
export interface Branch {
  _id?: ObjectId;
  name: string; // 'Vryheid', 'Ladysmith', etc.
  slug: string; // 'vryheid', 'ladysmith', etc.
  displayName: string; // 'TFS Vryheid', 'TFS Ladysmith'
  status: 'active' | 'paused' | 'inactive';
  settings: {
    storeLocation: {
      lat: number;
      lng: number;
      address: string;
    };
    contactEmail: string;
    contactPhone: string;
    deliveryPricing: DeliveryPricing;
    minimumOrderValue?: number;
  };
  paymentConfig?: {
    paystackPublicKey?: string;
    paystackSecretKey?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: ObjectId | string; // Super admin who created it
}

// UPDATED: User with super-admin role and branchId
export interface User {
  _id?: ObjectId;
  email: string;
  password: string;
  name: string;
  role: 'customer' | 'admin' | 'picker' | 'super-admin'; // ADDED super-admin
  branchId?: ObjectId | string; // Which branch this user belongs to (null for super-admin and customers)
  phone?: string;
  addresses?: Address[];
  active?: boolean;
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

// UPDATED: Category with branchId
export interface Category {
  _id?: ObjectId;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  banner?: string;
  parentId?: ObjectId | string | null;
  level: number;
  order: number;
  active: boolean;
  featured: boolean;
  branchId: ObjectId | string; // ADDED: Which branch owns this category
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariant {
  _id?: string;
  name: string;
  sku: string;
  barcode?: string;
  price?: number;
  compareAtPrice?: number;
  specialPrice?: number;
  stockLevel: number;
  images: string[];
  active: boolean;
  attributes?: { [key: string]: string };
}

export type SpecialType =
  | 'percentage_off'
  | 'amount_off'
  | 'buy_x_get_y'
  | 'multibuy'
  | 'bundle'
  | 'fixed_price'
  | 'conditional_add_on_price';

export interface SpecialCondition {
  // buy_x_get_y
  buyProductId?: string;
  buyProductVariantId?: string;
  buyQuantity?: number;
  getProductId?: string;
  getProductVariantId?: string;
  getQuantity?: number;
  getDiscount?: number;

  // multibuy
  requiredQuantity?: number;
  specialPrice?: number;

  // bundle
  bundleProducts?: {
    productId: string;
    variantId?: string;
    quantity: number;
  }[];
  bundlePrice?: number;

  // percentage_off / amount_off
  discountPercentage?: number;
  discountAmount?: number;
  maximumDiscount?: number;

  // fixed_price
  newPrice?: number;

  // conditional_add_on_price
  triggerProductId?: string;
  triggerQuantity?: number;
  triggerPrice?: number;
  targetProductId?: string;
  targetQuantity?: number;
  overridePrice?: number;

  // shared / misc
  minimumPurchase?: number;
  limitPerCustomer?: number;
  applyToAll?: boolean;
}

// UPDATED: Special with branchId
export interface Special {
  _id?: ObjectId;
  name: string;
  slug: string;
  description: string;
  type: SpecialType;
  productId?: string;
  productIds?: string[];
  categoryId?: string;
  conditions: SpecialCondition;
  badgeText?: string;
  images?: string[];
  active: boolean;
  featured: boolean;
  startDate?: Date;
  endDate?: Date;
  stockLimit?: number;
  stockUsed?: number;
  branchId: ObjectId | string; // ADDED: Which branch owns this special
  createdAt: Date;
  updatedAt: Date;
}

// UPDATED: Product with branchId
export interface Product {
  _id?: ObjectId;
  name: string;
  slug: string;
  description: string;
  categories: (ObjectId | string)[];
  categoryPaths?: string[][];
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  sku: string;
  barcode?: string;
  stockLevel: number;
  lowStockThreshold: number;
  images: string[];
  hasVariants: boolean;
  variants?: ProductVariant[];
  onSpecial: boolean;
  specialId?: ObjectId | string;
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
  branchId: ObjectId | string; // ADDED: Which branch owns this product
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  id: string;
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

export interface Cart {
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  totalSavings?: number;
}

export interface ComboItem {
  productId: string;
  variantId?: string;
  productName: string;
  quantity: number;
}

// UPDATED: Combo with branchId
export interface Combo {
  _id?: ObjectId;
  name: string;
  slug: string;
  description: string;
  items: ComboItem[];
  comboPrice: number;
  regularPrice: number;
  images: string[];
  active: boolean;
  featured: boolean;
  stockLevel: number;
  branchId: ObjectId | string; // ADDED: Which branch owns this combo
  createdAt: Date;
  updatedAt: Date;
}

// UPDATED: Order with branchId
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
  totalSavings?: number;
  paymentMethod: 'paystack' | 'ozow' | 'cash';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentReference?: string;
  orderStatus: 'pending' | 'confirmed' | 'picking' | 'ready' | 'out-for-delivery' | 'delivered' | 'cancelled';
  pickerId?: ObjectId | string;
  pickedAt?: Date;
  deliveryNotes?: string;
  branchId: ObjectId | string; // ADDED: Which branch this order belongs to
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  sku: string;
  price: number;
  quantity: number;
  image: string;
  barcode?: string;
  description?: string;
  appliedSpecialId?: string;
  originalPrice?: number;
  specialDiscount?: number;
}

// UPDATED: HeroBanner with branchId
export interface HeroBanner {
  _id?: ObjectId;
  title: string;
  subtitle?: string;
  image: string;
  link?: string;
  buttonText?: string;
  active: boolean;
  order: number;
  branchId: ObjectId | string; // ADDED: Which branch owns this banner
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

// SiteSettings remains mostly the same but will be stored per branch
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
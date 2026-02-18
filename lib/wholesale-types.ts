import { ObjectId } from 'mongodb';

// Wholesale Customer Account
export interface WholesaleCustomer {
  _id?: ObjectId;
  userId: ObjectId | string; // Links to User collection
  businessName: string;
  businessType: 'tuckshop' | 'spaza' | 'retailer' | 'restaurant' | 'other';
  registrationNumber?: string;
  vatNumber?: string;
  taxClearanceCertificate?: string; // URL to uploaded document
  
  // Contact Information
  contactPerson: string;
  email: string;
  phone: string;
  alternativePhone?: string;
  
  // Business Address
  businessAddress: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    lat?: number;
    lng?: number;
  };
  
  // Billing Address (can be different from business)
  billingAddress?: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
  
  // Account Status
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  verificationNotes?: string;
  verifiedBy?: ObjectId | string; // Admin who verified
  verifiedAt?: Date;
  
  // Credit Terms
  creditLimit?: number;
  creditTerms?: 'cash' | '7days' | '14days' | '30days';
  currentBalance: number; // Outstanding amount
  
  // Branch Assignment
  branchId: ObjectId | string;
  
  // Standing Orders
  hasStandingOrders: boolean;
  
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Wholesale Product Configuration
export interface WholesaleProductConfig {
  _id?: ObjectId;
  productId: ObjectId | string;
  variantId?: string;
  branchId: ObjectId | string;
  
  // MOQ (Minimum Order Quantity)
  moq: number; // e.g., 12 (must buy 12 boxes)
  moqUnit: 'units' | 'boxes' | 'cartons' | 'pallets';
  
  // Pricing
  wholesalePrice: number; // Price per unit
  bulkTiers?: {
    quantity: number; // e.g., buy 100+
    price: number; // get this price
  }[];
  
  // Packaging
  unitsPerBox?: number; // e.g., 24 Oreos per box
  boxesPerCarton?: number;
  
  // Stock
  wholesaleStockLevel: number;
  
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Wholesale Purchase Order
export interface WholesalePurchaseOrder {
  _id?: ObjectId;
  poNumber: string; // e.g., "PO-2024-001234"
  
  // Customer Info
  customerId: ObjectId | string;
  customerBusinessName: string;
  
  // Branch
  branchId: ObjectId | string;
  
  // Items
  items: WholesaleOrderItem[];
  
  // Delivery
  deliveryAddress: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    lat?: number;
    lng?: number;
  };
  
  deliveryDate?: Date; // Scheduled delivery
  leadTimeDays: number; // e.g., 3-5 days
  deliveryFee: number;
  deliveryNotes?: string;
  
  // Pricing
  subtotal: number;
  vatAmount: number;
  total: number;
  totalSavings?: number;
  
  // Payment
  paymentMethod: 'account' | 'eft' | 'cash' | 'card';
  paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue';
  paymentDueDate?: Date;
  paymentReference?: string;
  
  // Order Status
  orderStatus: 
    | 'pending' // Awaiting approval
    | 'approved' // Approved by admin
    | 'processing' // Being prepared
    | 'ready' // Ready for pickup/delivery
    | 'dispatched' // Out for delivery
    | 'delivered' // Completed
    | 'cancelled';
  
  // Processing
  approvedBy?: ObjectId | string;
  approvedAt?: Date;
  processedBy?: ObjectId | string; // Picker
  processedAt?: Date;
  
  // Standing Order Reference
  standingOrderId?: ObjectId | string;
  isRecurring: boolean;
  
  // Notes
  customerNotes?: string;
  internalNotes?: string; // Admin-only notes
  
  createdAt: Date;
  updatedAt: Date;
}

export interface WholesaleOrderItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  sku: string;
  
  // Wholesale specific
  moq: number;
  moqUnit: string;
  unitsPerBox?: number;
  
  // Quantity ordered
  quantity: number; // In MOQ units (e.g., 12 boxes)
  totalUnits: number; // Actual units (e.g., 12 boxes × 24 units = 288)
  
  // Pricing
  unitPrice: number; // Wholesale price per unit
  totalPrice: number;
  
  image: string;
  barcode?: string;
}

// Standing Order (Recurring Orders)
export interface WholesaleStandingOrder {
  _id?: ObjectId;
  customerId: ObjectId | string;
  customerBusinessName: string;
  branchId: ObjectId | string;
  
  standingOrderNumber: string; // e.g., "SO-001234"
  
  // Items (what they order regularly)
  items: WholesaleOrderItem[];
  
  // Recurrence
  frequency: 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  
  nextOrderDate: Date;
  lastOrderDate?: Date;
  
  // Delivery preferences
  deliveryAddress: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
  deliveryNotes?: string;
  
  active: boolean;
  pausedUntil?: Date; // Temporary pause
  
  createdAt: Date;
  updatedAt: Date;
}

// Wholesale Cart (separate from retail cart)
export interface WholesaleCartItem {
  id: string; // Product ID
  variantId?: string;
  name: string;
  variantName?: string;
  sku: string;
  
  // Wholesale specific
  moq: number;
  moqUnit: string;
  unitsPerBox?: number;
  
  // Quantity in MOQ units
  quantity: number; // e.g., 5 (boxes)
  totalUnits: number; // e.g., 120 (individual items)
  
  unitPrice: number;
  totalPrice: number;
  
  image: string;
}

// Delivery Settings per Branch
export interface WholesaleDeliverySettings {
  _id?: ObjectId;
  branchId: ObjectId | string;
  
  // Lead Times
  standardLeadTimeDays: number; // e.g., 3-5 days
  expressLeadTimeDays?: number; // e.g., 1-2 days (if offered)
  
  // Delivery Zones
  deliveryZones: {
    name: string; // e.g., "Local", "Regional", "National"
    radiusKm?: number;
    fee: number;
    leadTimeDays: number;
  }[];
  
  // Minimum Order
  minimumOrderValue: number; // e.g., R5000
  
  // Delivery Days
  deliveryDays: number[]; // 0-6 (days of week)
  
  cutoffTime: string; // e.g., "14:00" - orders before this time processed same day
  
  updatedAt: Date;
}
import { ObjectId } from 'mongodb';

// Supplier interface
export interface Supplier {
  _id?: ObjectId;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  branchId: ObjectId | string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Purchase Order Item
export interface PurchaseOrderItem {
  productId: ObjectId | string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  total: number;
}

// Purchase Order
export interface PurchaseOrder {
  _id?: ObjectId;
  orderNumber: string;
  branchId: ObjectId | string;
  supplierId: ObjectId | string;
  supplierName: string;
  supplierEmail: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'pending_approval' | 'confirmed' | 'sent' | 'partially_received' | 'received' | 'cancelled';
  notes?: string;
  expectedDeliveryDate?: Date;
  createdBy: ObjectId | string;
  approvedBy?: ObjectId | string;
  approvedAt?: Date;
  sentAt?: Date;
  receivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// PO Receiving
export interface POReceiving {
  _id?: ObjectId;
  purchaseOrderId: ObjectId | string;
  orderNumber: string;
  branchId: ObjectId | string;
  receivedBy: ObjectId | string;
  receivedAt: Date;
  items: {
    productId: ObjectId | string;
    variantId?: string;
    quantityExpected: number;
    quantityReceived: number;
    quantityDamaged: number;
    notes?: string;
  }[];
  hasIssues: boolean;
  notes?: string;
}

// Order Resolution
export interface OrderResolution {
  _id?: ObjectId;
  purchaseOrderId: ObjectId | string;
  orderNumber: string;
  branchId: ObjectId | string;
  type: 'damaged' | 'missing' | 'wrong_item' | 'quality_issue';
  description: string;
  affectedItems: {
    productId: ObjectId | string;
    variantId?: string;
    productName: string;
    quantity: number;
  }[];
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  createdBy: ObjectId | string;
  resolvedBy?: ObjectId | string;
  resolvedAt?: Date;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Stock Take
export interface StockTake {
  _id?: ObjectId;
  branchId: ObjectId | string;
  productId: ObjectId | string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  expectedStock: number;
  countedStock: number;
  variance: number;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  scheduledDate: Date;
  completedDate?: Date;
  completedBy?: ObjectId | string;
  notes?: string;
  autoScheduleInterval?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'never';
  nextScheduledDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Product Stock Settings
export interface ProductStockSettings {
  productId: ObjectId | string;
  variantId?: string;
  stockTakeInterval: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'never';
  lastStockTake?: Date;
  nextStockTake?: Date;
  autoGeneratePO: boolean;
  preferredSupplierId?: ObjectId | string;
  reorderQuantity?: number;
}
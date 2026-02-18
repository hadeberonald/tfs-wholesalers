import { Product, ProductVariant } from '@/types';
import { 
  getStockLevel, 
  getSKU, 
  getBarcode,
  getEffectivePrice,
  getFullProductName 
} from '@/lib/product-utils';

/**
 * Check if a product or variant needs reordering based on low stock threshold
 */
export function needsReordering(
  product: Product,
  variant?: ProductVariant
): boolean {
  const stockLevel = getStockLevel(product, variant);
  return stockLevel <= product.lowStockThreshold;
}

/**
 * Get stock status for display
 */
export function getStockStatus(
  product: Product,
  variant?: ProductVariant
): {
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'reorder_needed';
  color: string;
  message: string;
} {
  const stockLevel = getStockLevel(product, variant);
  
  if (stockLevel === 0) {
    return {
      status: 'out_of_stock',
      color: 'red',
      message: 'Out of Stock'
    };
  }
  
  if (stockLevel <= product.lowStockThreshold) {
    return {
      status: needsReordering(product, variant) ? 'reorder_needed' : 'low_stock',
      color: 'orange',
      message: `Low Stock (${stockLevel} left)`
    };
  }
  
  return {
    status: 'in_stock',
    color: 'green',
    message: `${stockLevel} in stock`
  };
}

/**
 * Calculate suggested reorder quantity
 */
export function calculateReorderQuantity(
  product: Product,
  variant?: ProductVariant,
  minimumOrderQuantity: number = 10
): number {
  const currentStock = getStockLevel(product, variant);
  const threshold = product.lowStockThreshold;
  
  const targetStock = threshold * 3;
  const reorderQty = Math.max(
    targetStock - currentStock,
    minimumOrderQuantity
  );
  
  return Math.ceil(reorderQty / 10) * 10;
}

/**
 * Format PO item from product and variant
 */
export function createPOItemFromProduct(
  product: Product,
  variant: ProductVariant | undefined,
  quantity: number,
  unitPrice?: number
): {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  total: number;
} {
  const price = unitPrice || (product.costPrice || getEffectivePrice(product, variant));
  
  return {
    productId: product._id?.toString() || '',
    variantId: variant?._id,
    productName: product.name,
    variantName: variant?.name,
    sku: getSKU(product, variant),
    quantityOrdered: quantity,
    quantityReceived: 0,
    unitPrice: price,
    total: price * quantity
  };
}

/**
 * Calculate next stock take date
 */
export function calculateNextStockTake(
  interval: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'never',
  fromDate?: Date
): Date | undefined {
  if (interval === 'never') return undefined;
  
  const now = fromDate || new Date();
  const next = new Date(now);
  
  switch (interval) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
  }
  
  return next;
}

/**
 * Check if a stock take is overdue
 */
export function isStockTakeOverdue(
  scheduledDate: Date,
  status: string
): boolean {
  return status === 'pending' && new Date(scheduledDate) < new Date();
}

/**
 * Format currency for ZAR
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount);
}

/**
 * Format date
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-ZA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format datetime
 */
export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-ZA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get products that need reordering
 */
export function getProductsNeedingReorder(
  products: Product[]
): Array<{
  product: Product;
  variant?: ProductVariant;
  currentStock: number;
  threshold: number;
  suggestedQuantity: number;
}> {
  const needsReorder: Array<any> = [];
  
  products.forEach(product => {
    if (product.hasVariants && product.variants) {
      product.variants.forEach(variant => {
        if (needsReordering(product, variant)) {
          needsReorder.push({
            product,
            variant,
            currentStock: variant.stockLevel,
            threshold: product.lowStockThreshold,
            suggestedQuantity: calculateReorderQuantity(product, variant)
          });
        }
      });
    } else {
      if (needsReordering(product)) {
        needsReorder.push({
          product,
          currentStock: product.stockLevel,
          threshold: product.lowStockThreshold,
          suggestedQuantity: calculateReorderQuantity(product)
        });
      }
    }
  });
  
  return needsReorder;
}
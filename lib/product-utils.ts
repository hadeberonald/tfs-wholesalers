import { Product, ProductVariant } from '../types';

/**
 * Get the effective price for a product or variant
 * Takes into account special pricing
 */
export function getEffectivePrice(
  product: Product,
  variant?: ProductVariant
): number {
  if (variant) {
    // Variant pricing priority: variant.specialPrice > variant.price > product.specialPrice > product.price
    if (variant.specialPrice) return variant.specialPrice;
    if (variant.price) return variant.price;
  }
  
  // Base product pricing
  if (product.specialPrice) return product.specialPrice;
  return product.price;
}

/**
 * Get the compare at price for a product or variant
 */
export function getCompareAtPrice(
  product: Product,
  variant?: ProductVariant
): number | undefined {
  if (variant?.compareAtPrice) return variant.compareAtPrice;
  return product.compareAtPrice;
}

/**
 * Get the SKU for a product or variant
 */
export function getSKU(
  product: Product,
  variant?: ProductVariant
): string {
  return variant?.sku || product.sku;
}

/**
 * Get the barcode for a product or variant
 */
export function getBarcode(
  product: Product,
  variant?: ProductVariant
): string | undefined {
  return variant?.barcode || product.barcode;
}

/**
 * Get the stock level for a product or variant
 */
export function getStockLevel(
  product: Product,
  variant?: ProductVariant
): number {
  return variant?.stockLevel ?? product.stockLevel;
}

/**
 * Get the images for a product or variant
 */
export function getImages(
  product: Product,
  variant?: ProductVariant
): string[] {
  if (variant?.images && variant.images.length > 0) {
    return variant.images;
  }
  return product.images;
}

/**
 * Get the primary image for a product or variant
 */
export function getPrimaryImage(
  product: Product,
  variant?: ProductVariant
): string {
  const images = getImages(product, variant);
  return images[0] || '/placeholder.png';
}

/**
 * Get full display name for a product with variant
 */
export function getFullProductName(
  product: Product,
  variant?: ProductVariant
): string {
  if (variant) {
    return `${product.name} - ${variant.name}`;
  }
  return product.name;
}

/**
 * Check if a product or variant is in stock
 */
export function isInStock(
  product: Product,
  variant?: ProductVariant
): boolean {
  const stock = getStockLevel(product, variant);
  return stock > 0;
}

/**
 * Check if a product or variant is low stock
 */
export function isLowStock(
  product: Product,
  variant?: ProductVariant
): boolean {
  const stock = getStockLevel(product, variant);
  return stock > 0 && stock <= product.lowStockThreshold;
}

/**
 * Calculate discount percentage
 */
export function getDiscountPercentage(
  product: Product,
  variant?: ProductVariant
): number {
  const effectivePrice = getEffectivePrice(product, variant);
  const comparePrice = getCompareAtPrice(product, variant);
  
  if (!comparePrice || comparePrice <= effectivePrice) {
    return 0;
  }
  
  return Math.round(((comparePrice - effectivePrice) / comparePrice) * 100);
}

/**
 * Find variant by ID
 */
export function findVariantById(
  product: Product,
  variantId: string
): ProductVariant | undefined {
  if (!product.hasVariants || !product.variants) {
    return undefined;
  }
  
  return product.variants.find(v => v._id === variantId);
}

/**
 * Generate cart item key (unique identifier for cart items)
 * This allows the same product with different variants to be separate cart items
 */
export function getCartItemKey(productId: string, variantId?: string): string {
  return variantId ? `${productId}-${variantId}` : productId;
}

/**
 * Format product for order item
 */
export function formatOrderItem(
  product: Product,
  variant: ProductVariant | undefined,
  quantity: number
): {
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
} {
  return {
    productId: product._id?.toString() || '',
    variantId: variant?._id,
    name: product.name,
    variantName: variant?.name,
    sku: getSKU(product, variant),
    price: getEffectivePrice(product, variant),
    quantity,
    image: getPrimaryImage(product, variant),
    barcode: getBarcode(product, variant),
    description: variant 
      ? `${product.description} - ${variant.name}`
      : product.description,
  };
}

/**
 * Get all category slugs for a product (including parent categories)
 * This is useful for breadcrumbs and multi-category display
 */
export function getAllCategorySlugs(product: Product): string[] {
  if (!product.categories || product.categories.length === 0) {
    return [];
  }
  
  // Convert ObjectId to string if needed
  return product.categories.map(cat => 
    typeof cat === 'string' ? cat : cat.toString()
  );
}
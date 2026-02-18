import { Special, Product, ProductVariant, CartItem } from '@/types';

/**
 * Calculate the effective price for a product considering active specials
 */
export function calculateSpecialPrice(
  product: Product,
  variant: ProductVariant | undefined,
  special: Special | null,
  quantity: number = 1
): {
  finalPrice: number;
  originalPrice: number;
  discount: number;
  freeItems: number;
  appliedSpecial: Special | null;
} {
  const basePrice = variant?.price || product.price;
  const originalPrice = basePrice;
  
  // No special
  if (!special || !special.active) {
    return {
      finalPrice: basePrice * quantity,
      originalPrice: basePrice * quantity,
      discount: 0,
      freeItems: 0,
      appliedSpecial: null
    };
  }

  // Check date validity
  const now = new Date();
  if (special.startDate && new Date(special.startDate) > now) {
    return {
      finalPrice: basePrice * quantity,
      originalPrice: basePrice * quantity,
      discount: 0,
      freeItems: 0,
      appliedSpecial: null
    };
  }
  if (special.endDate && new Date(special.endDate) < now) {
    return {
      finalPrice: basePrice * quantity,
      originalPrice: basePrice * quantity,
      discount: 0,
      freeItems: 0,
      appliedSpecial: null
    };
  }

  let finalPrice = basePrice * quantity;
  let discount = 0;
  let freeItems = 0;

  switch (special.type) {
    case 'percentage_off':
      if (special.conditions.discountPercentage) {
        discount = (basePrice * quantity * special.conditions.discountPercentage) / 100;
        if (special.conditions.maximumDiscount) {
          discount = Math.min(discount, special.conditions.maximumDiscount);
        }
        finalPrice = (basePrice * quantity) - discount;
      }
      break;

    case 'amount_off':
      if (special.conditions.discountAmount) {
        discount = special.conditions.discountAmount;
        if (special.conditions.maximumDiscount) {
          discount = Math.min(discount, special.conditions.maximumDiscount);
        }
        finalPrice = Math.max(0, (basePrice * quantity) - discount);
      }
      break;

    case 'fixed_price':
      if (special.conditions.newPrice) {
        finalPrice = special.conditions.newPrice * quantity;
        discount = (basePrice * quantity) - finalPrice;
      }
      break;

    case 'multibuy':
      if (special.conditions.requiredQuantity && special.conditions.specialPrice) {
        const sets = Math.floor(quantity / special.conditions.requiredQuantity);
        const remainder = quantity % special.conditions.requiredQuantity;
        
        finalPrice = (sets * special.conditions.specialPrice) + (remainder * basePrice);
        discount = (basePrice * quantity) - finalPrice;
      }
      break;

    case 'buy_x_get_y':
      // This is handled differently - often in cart context
      // For now, just show if they qualify
      if (special.conditions.buyQuantity && special.conditions.getQuantity) {
        const sets = Math.floor(quantity / special.conditions.buyQuantity);
        freeItems = sets * special.conditions.getQuantity;
        
        if (special.conditions.getDiscount === 100) {
          // Free items
          discount = freeItems * basePrice;
        } else if (special.conditions.getDiscount) {
          discount = (freeItems * basePrice * special.conditions.getDiscount) / 100;
        }
        
        finalPrice = (basePrice * quantity) - discount;
      }
      break;

    default:
      break;
  }

  return {
    finalPrice: Math.max(0, finalPrice),
    originalPrice: basePrice * quantity,
    discount,
    freeItems,
    appliedSpecial: special
  };
}

/**
 * Apply specials to cart items
 * Returns updated cart with special pricing
 */
export function applySpecialsToCart(
  cartItems: CartItem[],
  specials: Special[]
): {
  items: CartItem[];
  totalSavings: number;
  specialsApplied: string[];
} {
  let totalSavings = 0;
  const specialsApplied: string[] = [];
  
  const updatedItems = cartItems.map(item => {
    // Find applicable special
    const applicable = specials.find(special => 
      special.active && 
      (special.productId === item.id || special.productIds?.includes(item.id))
    );

    if (!applicable) {
      return item;
    }

    // Calculate special price (simplified - you'd fetch product data in real implementation)
    const result = calculateSpecialPrice(
      { price: item.price } as Product,
      undefined,
      applicable,
      item.quantity
    );

    if (result.discount > 0) {
      totalSavings += result.discount;
      if (!specialsApplied.includes(applicable._id!.toString())) {
        specialsApplied.push(applicable._id!.toString());
      }

      return {
        ...item,
        appliedSpecialId: applicable._id?.toString(),
        originalPrice: result.originalPrice / item.quantity,
        specialDiscount: result.discount,
        price: result.finalPrice / item.quantity
      };
    }

    return item;
  });

  return {
    items: updatedItems,
    totalSavings,
    specialsApplied
  };
}

/**
 * Get special badge text based on type
 */
export function getSpecialBadgeText(special: Special): string {
  if (special.badgeText) return special.badgeText;

  switch (special.type) {
    case 'percentage_off':
      return `${special.conditions.discountPercentage}% OFF`;
    
    case 'amount_off':
      return `R${special.conditions.discountAmount} OFF`;
    
    case 'fixed_price':
      return `NOW R${special.conditions.newPrice}`;
    
    case 'multibuy':
      return `${special.conditions.requiredQuantity} FOR R${special.conditions.specialPrice}`;
    
    case 'buy_x_get_y':
      if (special.conditions.getDiscount === 100) {
        return `BUY ${special.conditions.buyQuantity} GET ${special.conditions.getQuantity} FREE`;
      }
      return `BUY ${special.conditions.buyQuantity} GET ${special.conditions.getQuantity}`;
    
    case 'bundle':
      return `BUNDLE DEAL`;
    
    default:
      return 'SPECIAL';
  }
}

/**
 * Check if special is currently valid
 */
export function isSpecialValid(special: Special): boolean {
  if (!special.active) return false;

  const now = new Date();
  
  if (special.startDate && new Date(special.startDate) > now) {
    return false;
  }
  
  if (special.endDate && new Date(special.endDate) < now) {
    return false;
  }

  if (special.stockLimit && special.stockUsed && special.stockUsed >= special.stockLimit) {
    return false;
  }

  return true;
}

/**
 * Format special description for display
 */
export function formatSpecialDescription(special: Special): string {
  switch (special.type) {
    case 'percentage_off':
      return `Get ${special.conditions.discountPercentage}% off`;
    
    case 'amount_off':
      return `Save R${special.conditions.discountAmount}`;
    
    case 'fixed_price':
      return `Special price: R${special.conditions.newPrice}`;
    
    case 'multibuy':
      return `Buy ${special.conditions.requiredQuantity} for only R${special.conditions.specialPrice}`;
    
    case 'buy_x_get_y':
      if (special.conditions.getDiscount === 100) {
        return `Buy ${special.conditions.buyQuantity}, get ${special.conditions.getQuantity} absolutely free!`;
      }
      return `Buy ${special.conditions.buyQuantity}, get ${special.conditions.getQuantity} at ${special.conditions.getDiscount}% off`;
    
    case 'bundle':
      return `Bundle deal - save when you buy together`;
    
    default:
      return special.description || 'Special offer available';
  }
}
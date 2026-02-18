'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, Plus, Minus, Package, Check, Tag } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useBranch } from '@/lib/branch-context';
import {
  getEffectivePrice,
  getCompareAtPrice,
  getDiscountPercentage,
  getPrimaryImage,
  getStockLevel,
  isInStock,
  isLowStock,
} from '@/lib/product-utils';
import { Product } from '@/types';

interface ProductVariant {
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
}

interface Special {
  _id: string;
  name: string;
  type: string;
  badgeText?: string;
  conditions: any;
  active: boolean;
}

// Use Pick to take only what we need from the canonical Product type,
// then make the fields that aren't always available optional.
type ProductCardProduct = Pick<
  Product,
  'name' | 'slug' | 'price' | 'images' | 'stockLevel' | 'active' | 'hasVariants' | 'lowStockThreshold'
> & {
  _id: string;
  description?: string;
  specialPrice?: number;
  compareAtPrice?: number;
  onSpecial?: boolean;
  variants?: ProductVariant[];
  categories?: string[];
  specialId?: string;
  unit?: string;
  unitQuantity?: number;
  sku?: string;
  featured?: boolean;
  branchId?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

interface ProductCardProps {
  product: ProductCardProduct;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { branch } = useBranch();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(
    product.hasVariants && product.variants && product.variants.length > 0 
      ? product.variants.find(v => v.active) || product.variants[0]
      : undefined
  );
  const [special, setSpecial] = useState<Special | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (product.specialId) {
      fetchSpecial(product.specialId);
    }
  }, [product.specialId]);

  const fetchSpecial = async (specialId: string) => {
    try {
      const res = await fetch(`/api/specials/${specialId}`);
      if (res.ok) {
        const data = await res.json();
        setSpecial(data.special);
      }
    } catch (error) {
      console.error('Failed to fetch special');
    }
  };

  const displayPrice = getEffectivePrice(product as unknown as Product, selectedVariant);
  const comparePrice = getCompareAtPrice(product as unknown as Product, selectedVariant);
  const hasDiscount = comparePrice && comparePrice > displayPrice;
  const discountPercent = getDiscountPercentage(product as unknown as Product, selectedVariant);
  const primaryImage = getPrimaryImage(product as unknown as Product, selectedVariant);
  const stock = getStockLevel(product as unknown as Product, selectedVariant);
  const inStock = isInStock(product as unknown as Product, selectedVariant);
  const lowStock = isLowStock(product as unknown as Product, selectedVariant);

  const getSpecialBadge = () => {
    if (!special || !special.active) return null;

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
        return `BUY ${special.conditions.buyQuantity} GET ${special.conditions.getQuantity}`;
      case 'bundle':
        return 'BUNDLE DEAL';
      default:
        return 'SPECIAL';
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      id: product._id,
      variantId: selectedVariant?._id,
      name: product.name,
      variantName: selectedVariant?.name,
      price: displayPrice,
      image: primaryImage,
      quantity: quantity,
      sku: selectedVariant?.sku || product.sku || product.slug,
      appliedSpecialId: special?._id,
      originalPrice: comparePrice,
    });
    
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      setQuantity(1);
    }, 1500);
  };

  const incrementQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    if (quantity < stock) {
      setQuantity(q => q + 1);
    }
  };

  const decrementQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  };

  const handleVariantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    const variantId = e.target.value;
    const variant = product.variants?.find(v => v._id === variantId);
    setSelectedVariant(variant);
    setQuantity(1);
  };

  const specialBadge = getSpecialBadge();

  const productUrl = branch ? `/${branch.slug}/shop/${product.slug}` : `/shop/${product.slug}`;

  const displaySize = product.unitQuantity && product.unit 
    ? `${product.unitQuantity}${product.unit}` 
    : '';

  const truncatedDescription = product.description 
    ? product.description.length > 60 
      ? product.description.substring(0, 60) + '...' 
      : product.description
    : null;

  return (
    <Link
      href={productUrl}
      className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 relative flex flex-col h-full"
    >
      {justAdded && (
        <div className="absolute inset-0 bg-green-500/90 z-20 flex items-center justify-center animate-fade-in">
          <div className="text-center">
            <Check className="w-12 h-12 text-white mx-auto mb-2" />
            <p className="text-white font-semibold">Added!</p>
          </div>
        </div>
      )}

      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 flex-shrink-0">
        {primaryImage && !imgError ? (
          <img
            src={primaryImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-2" />
              <p className="text-xs">No Image</p>
            </div>
          </div>
        )}
        
        <div className="absolute top-2 left-2 flex flex-col space-y-1">
          {specialBadge && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center space-x-1">
              <Tag className="w-3 h-3" />
              <span>{specialBadge}</span>
            </span>
          )}
          
          {!specialBadge && product.onSpecial && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              SPECIAL
            </span>
          )}
          
          {hasDiscount && (
            <span className="bg-brand-orange text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {discountPercent}% OFF
            </span>
          )}

          {product.hasVariants && product.variants && product.variants.length > 1 && (
            <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {product.variants.length} OPTIONS
            </span>
          )}
        </div>

        {lowStock && inStock && (
          <div className="absolute top-2 right-2">
            <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {stock} left
            </span>
          </div>
        )}
      </div>

      <div className="p-3 md:p-4 flex flex-col flex-grow">
        <div className="mb-2">
          <h3 className="text-sm md:text-base font-semibold text-brand-black line-clamp-2 group-hover:text-brand-orange transition-colors">
            {product.name}
            {selectedVariant && (
              <span className="text-gray-500 font-normal"> - {selectedVariant.name}</span>
            )}
          </h3>
          {displaySize && (
            <p className="text-xs text-gray-500 mt-0.5">{displaySize}</p>
          )}
        </div>

        {truncatedDescription && (
          <p className="text-xs text-gray-600 mb-2 line-clamp-2">
            {truncatedDescription}
          </p>
        )}

        {product.hasVariants && product.variants && product.variants.length > 0 && (
          <div className="mb-2" onClick={(e) => e.preventDefault()}>
            <select
              value={selectedVariant?._id || ''}
              onChange={handleVariantChange}
              className="w-full text-xs md:text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-brand-orange focus:border-transparent bg-white"
            >
              {product.variants.filter(v => v.active).map((variant) => (
                <option key={variant._id} value={variant._id}>
                  {variant.name}
                  {variant.price && ` - R${variant.price.toFixed(2)}`}
                  {variant.stockLevel === 0 && ' (Out of stock)'}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-2">
          <div className="flex items-baseline space-x-2">
            <span className="text-lg md:text-xl font-bold text-brand-orange">
              R{displayPrice.toFixed(2)}
            </span>
            {comparePrice && comparePrice > displayPrice && (
              <span className="text-xs text-gray-500 line-through">
                R{comparePrice.toFixed(2)}
              </span>
            )}
          </div>
          {hasDiscount && (
            <p className="text-xs text-green-600 font-semibold">
              Save R{(comparePrice! - displayPrice).toFixed(2)}
            </p>
          )}
        </div>

        {special && special.type === 'buy_x_get_y' && (
          <div className="mb-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
            <p className="text-xs text-blue-900 font-semibold">
              Buy {special.conditions.buyQuantity}, Get {special.conditions.getQuantity} 
              {special.conditions.getDiscount === 100 ? ' FREE!' : ` at ${special.conditions.getDiscount}% off`}
            </p>
          </div>
        )}

        {special && special.type === 'multibuy' && (
          <div className="mb-2 bg-purple-50 border border-purple-200 rounded-lg p-2">
            <p className="text-xs text-purple-900 font-semibold">
              Buy {special.conditions.requiredQuantity} for only R{special.conditions.specialPrice}
            </p>
          </div>
        )}

        <div className="flex-grow" />

        {inStock ? (
          <div className="flex items-center space-x-2 mt-auto" onClick={(e) => e.preventDefault()}>
            <div className="flex items-center border border-gray-300 rounded-lg">
              <button
                onClick={decrementQuantity}
                className="p-1.5 hover:bg-gray-100 transition-colors"
                disabled={quantity <= 1}
              >
                <Minus className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
              </button>
              <span className="px-2 md:px-3 font-semibold text-brand-black text-sm">{quantity}</span>
              <button
                onClick={incrementQuantity}
                className="p-1.5 hover:bg-gray-100 transition-colors"
                disabled={quantity >= stock}
              >
                <Plus className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              className="flex-1 flex items-center justify-center space-x-1 bg-brand-orange hover:bg-orange-600 text-white py-2 px-2 md:px-3 rounded-lg transition-colors"
            >
              <ShoppingCart className="w-3 h-3 md:w-4 md:h-4" />
              <span className="font-semibold text-xs md:text-sm">Add</span>
            </button>
          </div>
        ) : (
          <button
            disabled
            className="w-full py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed text-xs md:text-sm mt-auto"
          >
            Out of Stock
          </button>
        )}
      </div>
    </Link>
  );
}
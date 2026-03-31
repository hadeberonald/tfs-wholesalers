'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, Plus, Minus, Package, Check, Tag } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useBranch } from '@/lib/branch-context';

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
  description?: string;
  unit?: string;
  weight?: number;
}

interface Special {
  _id: string;
  name: string;
  slug: string;
  type: string;
  badgeText?: string;
  conditions: any;
  active: boolean;
}

export interface ProductCardProduct {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  specialPrice?: number;
  compareAtPrice?: number;
  images: string[];
  stockLevel: number;
  active: boolean;
  onSpecial?: boolean;
  hasVariants?: boolean;
  variants?: ProductVariant[];
  categories?: string[];
  specialId?: string;
  unit?: string;
  unitQuantity?: number;
  sku?: string;
  lowStockThreshold?: number;
  featured?: boolean;
  branchId?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

interface ProductCardProps {
  product: ProductCardProduct;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { branch } = useBranch();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
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
        if (data.special?.active) setSpecial(data.special);
      }
    } catch (error) {
      console.error('Failed to fetch special');
    }
  };

  // ── Special price calculation ──────────────────────────────────────────────
  const getSpecialPrice = (basePrice: number): number | null => {
    if (!special) return null;
    switch (special.type) {
      case 'percentage_off': {
        const off = (basePrice * (special.conditions.discountPercentage || 0)) / 100;
        const cap = special.conditions.maximumDiscount || Infinity;
        return Math.max(0, basePrice - Math.min(off, cap));
      }
      case 'amount_off':
        return Math.max(0, basePrice - (special.conditions.discountAmount || 0));
      case 'fixed_price':
        return special.conditions.newPrice ?? null;
      case 'multibuy':
        // Show per-item price
        return special.conditions.specialPrice
          ? (special.conditions.specialPrice / (special.conditions.requiredQuantity || 1))
          : null;
      case 'conditional_add_on_price':
        return special.conditions.triggerPrice ?? null;
      default:
        return null;
    }
  };

  // ── Derived display values ──────────────────────────────────────────────────
  const displayName = selectedVariant ? selectedVariant.name : product.name;

  const displayDescription = selectedVariant?.description
    ? selectedVariant.description
    : product.description;

  const basePrice = selectedVariant
    ? (selectedVariant.price || product.price)
    : product.price;

  const specialComputedPrice = getSpecialPrice(basePrice);

  // Final display price: special computed > variant specialPrice > product specialPrice > base
  const displayPrice = specialComputedPrice !== null
    ? specialComputedPrice
    : selectedVariant
      ? (selectedVariant.specialPrice || selectedVariant.price || product.price)
      : (product.specialPrice || product.price);

  // Compare-at: use base price as strikethrough when special is active
  const comparePrice = special && specialComputedPrice !== null
    ? basePrice
    : selectedVariant
      ? (selectedVariant.compareAtPrice || product.compareAtPrice)
      : product.compareAtPrice;

  const hasDiscount = !!(comparePrice && comparePrice > displayPrice);
  const discountPercent = hasDiscount
    ? Math.round(((comparePrice! - displayPrice) / comparePrice!) * 100)
    : 0;

  const primaryImage = selectedVariant?.images?.length
    ? selectedVariant.images[0]
    : (product.images?.[0] || '');

  const stock = selectedVariant ? selectedVariant.stockLevel : product.stockLevel;
  const inStock = stock > 0;
  const lowStock = stock > 0 && stock <= 10;

  const displayUnit = selectedVariant?.unit || product.unit;
  const displayWeight = selectedVariant?.weight;
  const displaySize = displayWeight && displayUnit
    ? `${displayWeight}${displayUnit}`
    : (product.unitQuantity && product.unit ? `${product.unitQuantity}${product.unit}` : '');

  // ── Special badge ──────────────────────────────────────────────────────────
  const getSpecialBadge = (): string | null => {
    if (!special || !special.active) return null;
    if (special.badgeText) return special.badgeText;
    switch (special.type) {
      case 'percentage_off': return `${special.conditions.discountPercentage}% OFF`;
      case 'amount_off': return `R${special.conditions.discountAmount} OFF`;
      case 'fixed_price': return `NOW R${special.conditions.newPrice}`;
      case 'multibuy': return `${special.conditions.requiredQuantity} FOR R${special.conditions.specialPrice}`;
      case 'buy_x_get_y': return `BUY ${special.conditions.buyQuantity} GET ${special.conditions.getQuantity}`;
      case 'bundle': return 'BUNDLE DEAL';
      case 'conditional_add_on_price': return `UNLOCK @ R${special.conditions.overridePrice}`;
      default: return 'SPECIAL';
    }
  };

  // ── Cart unit price (for multibuy: per-item price so qty still makes sense) ─
  const getCartUnitPrice = (): number => {
    if (!special) return displayPrice;
    switch (special.type) {
      case 'multibuy':
        return special.conditions.specialPrice
          ? (special.conditions.specialPrice / (special.conditions.requiredQuantity || 1))
          : basePrice;
      default:
        return displayPrice;
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      id: product._id,
      variantId: selectedVariant?._id,
      name: displayName,
      variantName: selectedVariant?.name,
      price: getCartUnitPrice(),
      image: primaryImage,
      quantity,
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
    if (quantity < stock) setQuantity(q => q + 1);
  };

  const decrementQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    if (quantity > 1) setQuantity(q => q - 1);
  };

  const handleVariantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    const variantId = e.target.value;
    setSelectedVariant(variantId ? product.variants?.find(v => v._id === variantId) : undefined);
    setImgError(false);
    setQuantity(1);
  };

  const specialBadge = getSpecialBadge();
  const productUrl = branch ? `/${branch.slug}/shop/${product.slug}` : `/shop/${product.slug}`;

  const truncatedDescription = displayDescription
    ? displayDescription.length > 60
      ? displayDescription.substring(0, 60) + '...'
      : displayDescription
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

      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 flex-shrink-0">
        {primaryImage && !imgError ? (
          <img
            src={primaryImage}
            alt={displayName}
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

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col space-y-1">
          {specialBadge && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center space-x-1">
              <Tag className="w-3 h-3" />
              <span>{specialBadge}</span>
            </span>
          )}
          {!specialBadge && product.onSpecial && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">SPECIAL</span>
          )}
          {hasDiscount && (
            <span className="bg-brand-orange text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {discountPercent}% OFF
            </span>
          )}
          {product.hasVariants && product.variants && product.variants.length > 1 && (
            <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {product.variants.length + 1} OPTIONS
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

      {/* Content */}
      <div className="p-3 md:p-4 flex flex-col flex-grow">
        <div className="mb-2">
          <h3 className="text-sm md:text-base font-semibold text-brand-black line-clamp-2 group-hover:text-brand-orange transition-colors">
            {displayName}
          </h3>
          {displaySize && <p className="text-xs text-gray-500 mt-0.5">{displaySize}</p>}
        </div>

        <p className="text-xs text-gray-600 mb-2 line-clamp-2 min-h-[2rem]">
          {truncatedDescription || ''}
        </p>

        {/* Variant selector */}
        {product.hasVariants && product.variants && product.variants.length > 0 && (
          <div className="mb-2" onClick={(e) => e.preventDefault()}>
            <select
              value={selectedVariant?._id || ''}
              onChange={handleVariantChange}
              className="w-full text-xs md:text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-brand-orange focus:border-transparent bg-white"
            >
              <option value="">
                {product.name} — R{product.price.toFixed(2)}
              </option>
              {product.variants.filter(v => v.active).map((variant) => (
                <option key={variant._id} value={variant._id}>
                  {variant.name}
                  {variant.price ? ` — R${(variant.specialPrice || variant.price).toFixed(2)}` : ''}
                  {variant.stockLevel === 0 ? ' (Out of stock)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-grow" />

        {/* Price */}
        <div className="mb-2">
          <div className="flex items-baseline space-x-2 flex-wrap">
            <span className="text-lg md:text-xl font-bold text-brand-orange whitespace-nowrap">
              R{displayPrice.toFixed(2)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-gray-500 line-through whitespace-nowrap">
                R{comparePrice!.toFixed(2)}
              </span>
            )}
            {hasDiscount && (
              <span className="text-xs text-green-600 font-semibold whitespace-nowrap">
                Save R{(comparePrice! - displayPrice).toFixed(2)}
              </span>
            )}
          </div>
          {/* Multibuy hint */}
          {special?.type === 'multibuy' && (
            <p className="text-xs text-purple-600 font-semibold mt-0.5">
              {special.conditions.requiredQuantity} for R{special.conditions.specialPrice}
            </p>
          )}
        </div>

        {/* Special info banners */}
        {special?.type === 'buy_x_get_y' && (
          <div className="mb-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
            <p className="text-xs text-blue-900 font-semibold">
              Buy {special.conditions.buyQuantity}, Get {special.conditions.getQuantity}
              {special.conditions.getDiscount === 100 ? ' FREE!' : ` at ${special.conditions.getDiscount}% off`}
            </p>
          </div>
        )}

        {special?.type === 'conditional_add_on_price' && (
          <div className="mb-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
            <p className="text-xs text-amber-800 font-semibold">
              🔓 Unlocks add-on @ R{special.conditions.overridePrice}
            </p>
          </div>
        )}

        {/* Add to cart */}
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
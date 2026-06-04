'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ShoppingCart, Plus, Minus, Package, Check, Tag, ChevronDown } from 'lucide-react';
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

interface VariantOption {
  value: string;
  label: string;
  sublabel?: string;
  outOfStock: boolean;
}

function VariantPicker({
  options,
  value,
  onChange,
}: {
  options: VariantOption[];
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const positionDropdown = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownH = Math.min(280, options.length * 52);
    if (spaceBelow < dropdownH && spaceAbove > spaceBelow) {
      setDropdownStyle({
        position: 'fixed', left: rect.left, width: rect.width,
        bottom: window.innerHeight - rect.top, zIndex: 9999,
        maxHeight: Math.min(spaceAbove - 8, 280),
      });
    } else {
      setDropdownStyle({
        position: 'fixed', left: rect.left, width: rect.width,
        top: rect.bottom + 4, zIndex: 9999,
        maxHeight: Math.min(spaceBelow - 8, 280),
      });
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    positionDropdown();
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const reposition = () => positionDropdown();
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const selected = options.find(o => o.value === value) ?? options[0];

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-y-auto"
      onClick={e => e.stopPropagation()}
    >
      {options.map(opt => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.outOfStock}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              if (!opt.outOfStock) { onChange(opt.value); setOpen(false); }
            }}
            className={`
              w-full flex items-center justify-between gap-2
              px-3 py-2.5 text-left text-xs transition-colors border-b border-gray-50 last:border-0
              ${isSelected
                ? 'bg-orange-50 text-orange-700'
                : opt.outOfStock
                  ? 'text-gray-300 cursor-not-allowed bg-white'
                  : 'text-gray-700 hover:bg-orange-50/60 bg-white'
              }
            `}
          >
            <div className="flex flex-col min-w-0">
              <span className="font-semibold truncate">{opt.label}</span>
              {opt.sublabel && (
                <span className={`text-[10px] truncate ${isSelected ? 'text-orange-400' : 'text-gray-400'}`}>
                  {opt.sublabel}
                </span>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-1">
              {opt.outOfStock && (
                <span className="text-[9px] font-bold uppercase text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  Out of stock
                </span>
              )}
              {isSelected && !opt.outOfStock && (
                <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`
          w-full flex items-center justify-between gap-1.5
          px-2.5 py-1.5 rounded-lg border text-left text-xs
          bg-white transition-all duration-150
          ${open ? 'border-orange-400 ring-1 ring-orange-200' : 'border-gray-200 hover:border-orange-300'}
        `}
      >
        <span className={`truncate font-medium ${selected.outOfStock ? 'text-gray-400' : 'text-gray-700'}`}>
          {selected.label}
        </span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {typeof document !== 'undefined' && dropdown ? createPortal(dropdown, document.body) : null}
    </>
  );
}

export default function ProductCard({ product }: ProductCardProps) {
  const { branch } = useBranch();

  const threshold = product.lowStockThreshold ?? 0;

  const getDefaultVariant = (): ProductVariant | undefined => {
    if (!product.hasVariants || !product.variants?.length) return undefined;
    if (product.stockLevel > threshold) return undefined;
    return product.variants.find(v => v.active && v.stockLevel > threshold) ?? undefined;
  };

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(getDefaultVariant);
  const [special, setSpecial] = useState<Special | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (product.specialId) fetchSpecial(product.specialId);
  }, [product.specialId]);

  const fetchSpecial = async (specialId: string) => {
    try {
      const res = await fetch(`/api/specials/${specialId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.special?.active) setSpecial(data.special);
      }
    } catch { console.error('Failed to fetch special'); }
  };

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
        return special.conditions.specialPrice
          ? (special.conditions.specialPrice / (special.conditions.requiredQuantity || 1))
          : null;
      case 'conditional_add_on_price':
        return special.conditions.triggerPrice ?? null;
      default:
        return null;
    }
  };

  const hasVariantPicker = !!(product.hasVariants && product.variants?.filter(v => v.active).length);

  const displayName        = selectedVariant ? selectedVariant.name : product.name;
  const displayDescription = selectedVariant?.description ?? product.description;
  const basePrice          = selectedVariant ? (selectedVariant.price || product.price) : product.price;
  const specialComputedPrice = getSpecialPrice(basePrice);

  const displayPrice = specialComputedPrice !== null
    ? specialComputedPrice
    : selectedVariant
      ? (selectedVariant.specialPrice || selectedVariant.price || product.price)
      : (product.specialPrice || product.price);

  const comparePrice = special && specialComputedPrice !== null
    ? basePrice
    : selectedVariant
      ? (selectedVariant.compareAtPrice || product.compareAtPrice)
      : product.compareAtPrice;

  const hasDiscount     = !!(comparePrice && comparePrice > displayPrice);
  const discountPercent = hasDiscount ? Math.round(((comparePrice! - displayPrice) / comparePrice!) * 100) : 0;

  const primaryImage = selectedVariant?.images?.length
    ? selectedVariant.images[0]
    : (product.images?.[0] || '');

  const stock    = selectedVariant ? selectedVariant.stockLevel : product.stockLevel;
  // inStock and lowStock both respect the threshold
  const inStock  = stock > threshold;
  const lowStock = stock > threshold && stock <= (threshold + 10);

  const displayUnit   = selectedVariant?.unit || product.unit;
  const displayWeight = selectedVariant?.weight;
  const displaySize   = displayWeight && displayUnit
    ? `${displayWeight}${displayUnit}`
    : (product.unitQuantity && product.unit ? `${product.unitQuantity}${product.unit}` : '');

  const getSpecialBadge = (): string | null => {
    if (!special?.active) return null;
    if (special.badgeText) return special.badgeText;
    switch (special.type) {
      case 'percentage_off': return `${special.conditions.discountPercentage}% OFF`;
      case 'amount_off':     return `R${special.conditions.discountAmount} OFF`;
      case 'fixed_price':    return `NOW R${special.conditions.newPrice}`;
      case 'multibuy':       return `${special.conditions.requiredQuantity} FOR R${special.conditions.specialPrice}`;
      case 'buy_x_get_y':    return `BUY ${special.conditions.buyQuantity} GET ${special.conditions.getQuantity}`;
      case 'bundle':         return 'BUNDLE DEAL';
      case 'conditional_add_on_price': return `UNLOCK @ R${special.conditions.overridePrice}`;
      default: return 'SPECIAL';
    }
  };

  const getCartUnitPrice = (): number => {
    if (!special) return displayPrice;
    if (special.type === 'multibuy') {
      return special.conditions.specialPrice
        ? (special.conditions.specialPrice / (special.conditions.requiredQuantity || 1))
        : basePrice;
    }
    return displayPrice;
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
    setTimeout(() => { setJustAdded(false); setQuantity(1); }, 1500);
  };

  const incrementQuantity = (e: React.MouseEvent) => { e.preventDefault(); if (quantity < stock) setQuantity(q => q + 1); };
  const decrementQuantity = (e: React.MouseEvent) => { e.preventDefault(); if (quantity > 1) setQuantity(q => q - 1); };

  const activeVariants = product.variants?.filter(v => v.active) ?? [];

  const variantOptions: VariantOption[] = [
    {
      value: '',
      label: product.name,
      sublabel: `R${product.price.toFixed(2)}${product.stockLevel <= threshold ? ' · Out of stock' : ''}`,
      outOfStock: product.stockLevel <= threshold,
    },
    ...activeVariants.map(v => ({
      value: v._id ?? v.sku,
      label: v.name,
      sublabel: v.price ? `R${(v.specialPrice || v.price).toFixed(2)}` : undefined,
      outOfStock: v.stockLevel <= threshold,
    })),
  ];

  const handleVariantChange = (val: string) => {
    setSelectedVariant(val ? activeVariants.find(v => (v._id ?? v.sku) === val) : undefined);
    setImgError(false);
    setQuantity(1);
  };

  const specialBadge = getSpecialBadge();
  const productUrl   = branch ? `/${branch.slug}/shop/${product.slug}` : `/shop/${product.slug}`;

  const descMaxChars  = hasVariantPicker ? 55 : 100;
  const truncatedDesc = displayDescription
    ? displayDescription.length > descMaxChars
      ? displayDescription.substring(0, descMaxChars) + '…'
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

        <div className="absolute top-2 left-2 flex flex-col space-y-1">
          {specialBadge && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center space-x-1">
              <Tag className="w-3 h-3" /><span>{specialBadge}</span>
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
          {hasVariantPicker && (
            <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {activeVariants.length + 1} OPTIONS
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
        <h3 className="text-sm md:text-base font-semibold text-brand-black line-clamp-2 group-hover:text-brand-orange transition-colors mb-0.5">
          {displayName}
        </h3>
        {displaySize && <p className="text-xs text-gray-400 mb-1">{displaySize}</p>}

        {truncatedDesc && (
          <p className="text-xs text-gray-500 mb-2 leading-relaxed">
            {truncatedDesc}
          </p>
        )}

        {hasVariantPicker && (
          <div className="mb-2" onClick={e => e.preventDefault()}>
            <VariantPicker
              options={variantOptions}
              value={selectedVariant ? (selectedVariant._id ?? selectedVariant.sku) : ''}
              onChange={handleVariantChange}
            />
          </div>
        )}

        <div className="flex-grow" />

        <div className="mb-2">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-lg md:text-xl font-bold text-brand-orange whitespace-nowrap">
              R{displayPrice.toFixed(2)}
            </span>
            {hasDiscount && (
              <>
                <span className="text-xs text-gray-400 line-through whitespace-nowrap">
                  R{comparePrice!.toFixed(2)}
                </span>
                <span className="text-xs text-green-600 font-semibold whitespace-nowrap">
                  Save R{(comparePrice! - displayPrice).toFixed(2)}
                </span>
              </>
            )}
          </div>
          {special?.type === 'multibuy' && (
            <p className="text-xs text-purple-600 font-semibold mt-0.5">
              {special.conditions.requiredQuantity} for R{special.conditions.specialPrice}
            </p>
          )}
        </div>

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

        {inStock ? (
          <div className="flex items-center gap-2 mt-auto" onClick={e => e.preventDefault()}>
            <div className="flex items-center border border-gray-200 rounded-lg">
              <button onClick={decrementQuantity} disabled={quantity <= 1} className="p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-40">
                <Minus className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
              </button>
              <span className="px-2 md:px-3 font-semibold text-brand-black text-sm">{quantity}</span>
              <button onClick={incrementQuantity} disabled={quantity >= stock} className="p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-40">
                <Plus className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              className="flex-1 flex items-center justify-center gap-1 bg-brand-orange hover:bg-orange-600 text-white py-2 px-2 md:px-3 rounded-lg transition-colors"
            >
              <ShoppingCart className="w-3 h-3 md:w-4 md:h-4" />
              <span className="font-semibold text-xs md:text-sm">Add</span>
            </button>
          </div>
        ) : (
          <button disabled className="w-full py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed text-xs md:text-sm mt-auto font-medium">
            Out of Stock
          </button>
        )}
      </div>
    </Link>
  );
}
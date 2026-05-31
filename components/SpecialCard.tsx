'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  ShoppingCart, Plus, Minus, Tag, Star, Check,
  CheckCircle, XCircle, ChevronDown,
} from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useBranch } from '@/lib/branch-context';

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface Product {
  _id: string;
  name: string;
  slug: string;
  price: number;
  specialPrice?: number;
  images: string[];
  stockLevel: number;
  sku: string;
  active: boolean;
  description?: string;
  hasVariants?: boolean;
  variants?: ProductVariant[];
}

interface Special {
  _id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  source?: string;
  badgeText?: string;
  images?: string[];
  conditions: any;
  active: boolean;
  featured: boolean;
  productId?: string;
  productIds?: string[];
  // variantId on the special itself (some specials target a specific variant)
  variantId?: string;
}

interface SpecialCardProps {
  special: Special;
}

// ── VariantPicker (copied from ProductCard — same portal pattern) ─────────────

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
  const triggerRef  = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const positionDropdown = () => {
    if (!triggerRef.current) return;
    const rect       = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownH  = Math.min(280, options.length * 52);

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
    e.preventDefault(); e.stopPropagation();
    positionDropdown();
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current  && !triggerRef.current.contains(e.target as Node)
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
        const isSel = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.outOfStock}
            onClick={e => {
              e.preventDefault(); e.stopPropagation();
              if (!opt.outOfStock) { onChange(opt.value); setOpen(false); }
            }}
            className={`
              w-full flex items-center justify-between gap-2
              px-3 py-2.5 text-left text-xs transition-colors border-b border-gray-50 last:border-0
              ${isSel
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
                <span className={`text-[10px] truncate ${isSel ? 'text-orange-400' : 'text-gray-400'}`}>
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
              {isSel && !opt.outOfStock && (
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
      {typeof document !== 'undefined' && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </>
  );
}

// ── SpecialCard ───────────────────────────────────────────────────────────────

export default function SpecialCard({ special }: SpecialCardProps) {
  const { branch }  = useBranch();
  const addItem     = useCartStore((state) => state.addItem);

  const [product,      setProduct]      = useState<Product | null>(null);
  const [addonProduct, setAddonProduct] = useState<Product | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [imgError,     setImgError]     = useState(false);
  const [justAdded,    setJustAdded]    = useState(false);
  const [showAddonModal, setShowAddonModal] = useState(false);

  // Variant state — mirrors ProductCard exactly
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [quantity,         setQuantity]        = useState(1);
  const [bundleQty,        setBundleQty]       = useState(1);

  // ── Fetch product (and optional add-on) ──────────────────────────────────
  useEffect(() => {
    if (!special._id) return;
    let cancelled = false;

    const fetchProduct = async () => {
      setLoading(true);
      try {
        let productId = special.productId || special.productIds?.[0];

        // Some special types point at a different field for their trigger product
        if (special.type === 'buy_x_get_y' && special.conditions.buyProductId) {
          productId = special.conditions.buyProductId;
        } else if (special.type === 'conditional_add_on_price' && special.conditions.triggerProductId) {
          productId = special.conditions.triggerProductId;
        }

        if (!productId) { setLoading(false); return; }

        const res = await fetch(`/api/products/${productId}`);
        if (!res.ok || cancelled) return;

        const data = await res.json();
        const fetched: Product = data.product;

        // ── HIDDEN CHECK: skip inactive products entirely ──────────────────
        if (!fetched?.active) {
          if (!cancelled) setLoading(false);
          return;
        }

        if (!cancelled) {
          setProduct(fetched);

          // ── VARIANT LINKING ───────────────────────────────────────────────
          // Priority order:
          //   1. special.variantId            (special explicitly targets a variant)
          //   2. special.conditions.variantId (some special types embed it here)
          //   3. Auto-select: if base product OOS but a variant has stock, pick that
          const targetVariantId =
            special.variantId ||
            special.conditions?.variantId ||
            null;

          if (fetched.hasVariants && fetched.variants?.length) {
            const activeVariants = fetched.variants.filter(v => v.active);

            if (targetVariantId) {
              // Linked variant — select it by ID or fall back to SKU match
              const linked =
                activeVariants.find(v => v._id === targetVariantId) ||
                activeVariants.find(v => v.sku  === targetVariantId);
              if (linked) setSelectedVariant(linked);
            } else if (fetched.stockLevel === 0) {
              // Base OOS — auto-pick first in-stock active variant (same as ProductCard)
              const fallback = activeVariants.find(v => v.stockLevel > 0);
              if (fallback) setSelectedVariant(fallback);
            }
          }

          setBundleQty(1);
          setQuantity(1);
        }

        // Fetch add-on product for conditional_add_on_price specials
        if (!cancelled && special.type === 'conditional_add_on_price' && special.conditions.targetProductId) {
          fetch(`/api/products/${special.conditions.targetProductId}`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (d?.product?.active && !cancelled) setAddonProduct(d.product); })
            .catch(() => null);
        }
      } catch (err) {
        console.error('Failed to fetch product for special', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProduct();
    return () => { cancelled = true; };
  }, [special._id]);

  // ── Derived display values (mirrors ProductCard logic) ───────────────────

  const activeVariants = product?.variants?.filter(v => v.active) ?? [];
  const hasVariantPicker = !!(product?.hasVariants && activeVariants.length > 0);

  const basePrice = selectedVariant
    ? (selectedVariant.price ?? product?.price ?? 0)
    : (product?.price ?? 0);

  const stock   = selectedVariant ? selectedVariant.stockLevel : (product?.stockLevel ?? 0);
  const inStock = stock > 0;
  const lowStock = stock > 0 && stock <= 10;

  const primaryImage = selectedVariant?.images?.length
    ? selectedVariant.images[0]
    : (special.images?.[0] || product?.images?.[0]);

  // ── Price logic ───────────────────────────────────────────────────────────

  const getDisplayPrice = (): number => {
    if (!product) return 0;
    switch (special.type) {
      case 'percentage_off': {
        const off = (basePrice * (special.conditions.discountPercentage || 0)) / 100;
        return basePrice - Math.min(off, special.conditions.maximumDiscount || Infinity);
      }
      case 'amount_off':               return Math.max(0, basePrice - (special.conditions.discountAmount || 0));
      case 'fixed_price':              return special.conditions.newPrice || basePrice;
      case 'multibuy':                 return special.conditions.specialPrice || basePrice;
      case 'buy_x_get_y':              return basePrice;
      case 'bundle':                   return special.conditions.bundlePrice || basePrice;
      case 'conditional_add_on_price': return special.conditions.triggerPrice ?? basePrice;
      default:
        return selectedVariant
          ? (selectedVariant.specialPrice || selectedVariant.price || basePrice)
          : (product.specialPrice || basePrice);
    }
  };

  const getCartUnitPrice = (): number => {
    const dp = getDisplayPrice();
    if (special.type === 'multibuy') {
      return special.conditions.specialPrice
        ? (special.conditions.specialPrice / (special.conditions.requiredQuantity || 1))
        : basePrice;
    }
    return dp;
  };

  const displayPrice = getDisplayPrice();
  const savings = (() => {
    if (!product) return 0;
    if (special.type === 'multibuy') {
      const reqQty = special.conditions.requiredQuantity || 1;
      return Math.max(0, basePrice * reqQty - (special.conditions.specialPrice || basePrice));
    }
    if (special.type === 'buy_x_get_y') return 0;
    if (special.type === 'conditional_add_on_price') {
      return special.conditions.triggerPrice != null
        ? Math.max(0, basePrice - special.conditions.triggerPrice)
        : 0;
    }
    return Math.max(0, basePrice - displayPrice);
  })();

  // ── Badge ─────────────────────────────────────────────────────────────────

  const getSpecialBadge = (): string => {
    if (special.badgeText) return special.badgeText;
    switch (special.type) {
      case 'percentage_off':           return `${special.conditions.discountPercentage}% OFF`;
      case 'amount_off':               return `R${special.conditions.discountAmount} OFF`;
      case 'fixed_price':              return `NOW R${special.conditions.newPrice}`;
      case 'multibuy':                 return `${special.conditions.requiredQuantity} FOR R${special.conditions.specialPrice}`;
      case 'buy_x_get_y':              return `BUY ${special.conditions.buyQuantity} GET ${special.conditions.getQuantity}`;
      case 'bundle':                   return 'BUNDLE DEAL';
      case 'conditional_add_on_price': return `UNLOCK @ R${special.conditions.overridePrice}`;
      default:                         return 'SPECIAL';
    }
  };

  // ── Cart actions ──────────────────────────────────────────────────────────

  const isMultibuy  = special.type === 'multibuy';
  const isAddonDeal = special.type === 'conditional_add_on_price';
  const bundleSize  = isMultibuy ? (special.conditions.requiredQuantity || 1) : 1;
  const actualQuantity = isMultibuy ? bundleQty * bundleSize : quantity;

  const incrementQuantity = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!product) return;
    if (isMultibuy) {
      if ((bundleQty + 1) * bundleSize <= stock) setBundleQty(q => q + 1);
    } else {
      if (quantity < stock) setQuantity(q => q + 1);
    }
  };

  const decrementQuantity = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (isMultibuy) { if (bundleQty > 1) setBundleQty(q => q - 1); }
    else            { if (quantity  > 1) setQuantity(q => q - 1); }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!product) return;

    addItem({
      id:        product._id,
      variantId: selectedVariant?._id,
      name:      selectedVariant ? selectedVariant.name : product.name,
      variantName: selectedVariant?.name,
      price:     getCartUnitPrice(),
      image:     primaryImage || '/placeholder.png',
      quantity:  actualQuantity,
      sku:       selectedVariant?.sku || product.sku,
      appliedSpecialId: special._id,
      originalPrice:    basePrice,
    });

    if (isAddonDeal) {
      setShowAddonModal(true);
    } else {
      setJustAdded(true);
      setTimeout(() => {
        setJustAdded(false);
        isMultibuy ? setBundleQty(1) : setQuantity(1);
      }, 1500);
    }
  };

  const handleAcceptAddon = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!addonProduct) return;
    addItem({
      id:       addonProduct._id,
      name:     addonProduct.name,
      price:    special.conditions.overridePrice,
      image:    addonProduct.images[0] || '/placeholder.png',
      quantity: special.conditions.targetQuantity || 1,
      sku:      addonProduct.sku,
      appliedSpecialId: special._id,
      originalPrice:    addonProduct.price,
    });
    setJustAdded(true);
    setShowAddonModal(false);
    setTimeout(() => { setJustAdded(false); setQuantity(1); }, 1500);
  };

  const handleDeclineAddon = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setJustAdded(true);
    setShowAddonModal(false);
    setTimeout(() => { setJustAdded(false); setQuantity(1); }, 1500);
  };

  const handleVariantChange = (val: string) => {
    setSelectedVariant(val ? activeVariants.find(v => (v._id ?? v.sku) === val) : undefined);
    setImgError(false);
    setQuantity(1);
    setBundleQty(1);
  };

  // ── Variant picker options ────────────────────────────────────────────────

  const variantOptions: VariantOption[] = product ? [
    {
      value:      '',
      label:      product.name,
      sublabel:   `R${product.price.toFixed(2)}${product.stockLevel === 0 ? ' · Out of stock' : ''}`,
      outOfStock: product.stockLevel === 0,
    },
    ...activeVariants.map(v => ({
      value:      v._id ?? v.sku,
      label:      v.name,
      sublabel:   v.price ? `R${(v.specialPrice || v.price).toFixed(2)}` : undefined,
      outOfStock: v.stockLevel === 0,
    })),
  ] : [];

  // ── POS special description fallback ─────────────────────────────────────

  const isPosSpecial = special.source === 'pos_ftp_sync';
  const displayDescription =
    special.description?.trim()
      ? special.description
      : isPosSpecial
        ? (product?.description?.trim() || '')
        : '';

  // ── Don't render only when a product was expected but came back inactive ──
  // Specials with no productId (category/bundle specials) should still render.
  const expectedProduct = !!(
    special.productId ||
    special.productIds?.[0] ||
    (special.type === 'buy_x_get_y'              && special.conditions?.buyProductId) ||
    (special.type === 'conditional_add_on_price' && special.conditions?.triggerProductId)
  );
  if (!loading && expectedProduct && !product) return null;

  const badge      = getSpecialBadge();
  const specialUrl = branch ? `/${branch.slug}/specials/${special.slug}` : `/specials/${special.slug}`;

  const hasBanner =
    special.type === 'buy_x_get_y' ||
    special.type === 'multibuy' ||
    special.type === 'conditional_add_on_price' ||
    (special.type === 'bundle' && savings > 0);

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 relative flex flex-col h-full">

      {/* ── Added flash overlay — matches ProductCard ── */}
      {justAdded && (
        <div className="absolute inset-0 bg-green-500/90 z-20 flex items-center justify-center animate-fade-in pointer-events-none">
          <div className="text-center">
            <Check className="w-12 h-12 text-white mx-auto mb-2" />
            <p className="text-white font-semibold">Added!</p>
          </div>
        </div>
      )}

      <Link href={specialUrl} className="block">
        {/* Image */}
        <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-100">
          {primaryImage && !imgError ? (
            <img
              src={primaryImage}
              alt={special.name}
              className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-orange-50">
              <Tag className="w-10 h-10 text-brand-orange" />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
              <Tag className="w-2.5 h-2.5" />{badge}
            </span>
            {special.featured && (
              <span className="inline-flex items-center gap-1 bg-yellow-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                <Star className="w-2.5 h-2.5 fill-white" />FEATURED
              </span>
            )}
            {hasVariantPicker && (
              <span className="bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                {activeVariants.length + 1} OPTIONS
              </span>
            )}
          </div>

          {/* Low-stock warning */}
          {lowStock && (
            <div className="absolute bottom-2 right-2">
              <span className="bg-yellow-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                {stock} left
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-3 flex flex-col flex-grow">
        <Link href={specialUrl}>
          <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 mb-1 min-h-[2.375rem] hover:text-brand-orange transition-colors">
            {special.name}
          </h3>
          {displayDescription ? (
            <p className="text-[11px] text-gray-500 line-clamp-2 mb-2 min-h-[1.75rem]">
              {displayDescription}
            </p>
          ) : (
            <div className="mb-2 min-h-[1.75rem]" />
          )}
        </Link>

        {/* Loading spinner */}
        {loading && (
          <div className="h-20 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && product && (
          <>
            {/* Variant picker — only shown when product has active variants */}
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

            {/* Price */}
            <div className="mb-2">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-brand-orange">
                  R{displayPrice.toFixed(2)}
                </span>
                {savings > 0 && (
                  <>
                    <span className="text-xs text-gray-400 line-through">
                      R{basePrice.toFixed(2)}
                    </span>
                    <span className="text-xs text-green-600 font-semibold">
                      Save R{savings.toFixed(2)}
                    </span>
                  </>
                )}
              </div>

              {/* Special type banners */}
              {special.type === 'buy_x_get_y' && (
                <div className="mt-1.5 bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5">
                  <p className="text-[10px] text-blue-900 font-semibold truncate">
                    Buy {special.conditions.buyQuantity}, Get {special.conditions.getQuantity}
                    {special.conditions.getDiscount === 100 ? ' FREE!' : ` at ${special.conditions.getDiscount}% off`}
                  </p>
                </div>
              )}
              {special.type === 'multibuy' && (
                <div className="mt-1.5 bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5">
                  <p className="text-[10px] text-blue-900 font-semibold truncate">
                    Buy {special.conditions.requiredQuantity} for R{special.conditions.specialPrice}
                  </p>
                </div>
              )}
              {special.type === 'bundle' && savings > 0 && (
                <div className="mt-1.5 bg-purple-50 border border-purple-200 rounded-md px-2 py-1.5">
                  <p className="text-[10px] text-purple-700 font-semibold truncate">
                    Bundle Deal — Save R{savings.toFixed(2)}!
                  </p>
                </div>
              )}
              {special.type === 'conditional_add_on_price' && (
                <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                  <p className="text-[10px] text-amber-800 font-semibold truncate">
                    🔓 Unlocks add-on @ R{special.conditions.overridePrice}
                  </p>
                </div>
              )}
              {!hasBanner && <div className="h-[1.625rem]" />}
            </div>

            {/* Cart actions */}
            {inStock ? (
              <div className="flex items-center gap-2" onClick={e => e.preventDefault()}>
                <div className="flex items-center border border-gray-200 rounded-lg">
                  <button
                    onClick={decrementQuantity}
                    disabled={isMultibuy ? bundleQty <= 1 : quantity <= 1}
                    className="p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-40"
                  >
                    <Minus className="w-4 h-4 text-gray-600" />
                  </button>
                  <div className="px-3 text-center min-w-[2rem]">
                    <span className="text-sm font-semibold text-gray-800 block">
                      {isMultibuy ? bundleQty : quantity}
                    </span>
                    {isMultibuy && (
                      <span className="text-[9px] text-purple-600 font-medium leading-none">
                        {bundleQty === 1 ? 'bundle' : 'bundles'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={incrementQuantity}
                    disabled={isMultibuy ? (bundleQty + 1) * bundleSize > stock : quantity >= stock}
                    className="p-1.5 hover:bg-gray-100 transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  className="flex-1 flex items-center justify-center gap-1 bg-brand-orange hover:bg-orange-600 text-white py-2 rounded-lg transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="font-semibold text-xs md:text-sm">Add</span>
                </button>
              </div>
            ) : (
              <div className="bg-gray-100 py-2 rounded-lg text-center">
                <span className="text-gray-400 text-xs font-semibold">Out of Stock</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Add-On Modal ──────────────────────────────────────────────────── */}
      {showAddonModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-0.5">🔓 Special Unlocked!</p>
                <h2 className="text-lg font-bold text-brand-black leading-tight">Would you like to add this?</h2>
              </div>
              <button
                onClick={handleDeclineAddon}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors ml-3 flex-shrink-0"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              <div className="flex items-start gap-3 mb-5">
                {addonProduct?.images[0] ? (
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 border-amber-200">
                    <img src={addonProduct.images[0]} alt={addonProduct.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 border-2 border-amber-200">
                    <Tag className="w-6 h-6 text-amber-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-0.5">Add-On Product</p>
                  <h3 className="font-bold text-base text-brand-black leading-tight mb-1">
                    {addonProduct?.name ?? 'Unlocked Add-On'}
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-brand-orange">
                      R{Number(special.conditions.overridePrice).toFixed(2)}
                    </span>
                    {addonProduct && addonProduct.price > special.conditions.overridePrice && (
                      <span className="text-sm text-gray-400 line-through">R{addonProduct.price.toFixed(2)}</span>
                    )}
                  </div>
                  {addonProduct && addonProduct.price > special.conditions.overridePrice && (
                    <p className="text-xs text-green-600 font-semibold mt-0.5">
                      Save R{(addonProduct.price - special.conditions.overridePrice).toFixed(2)}!
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleAcceptAddon}
                  className="w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Yes, add for R{Number(special.conditions.overridePrice).toFixed(2)}!
                </button>
                <button
                  onClick={handleDeclineAddon}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
                >
                  No thanks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
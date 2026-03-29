'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, Plus, Minus, Tag, Star, CheckCircle, XCircle } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useBranch } from '@/lib/branch-context';
import toast from 'react-hot-toast';

interface Special {
  _id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  badgeText?: string;
  images?: string[];
  conditions: any;
  active: boolean;
  featured: boolean;
  productId?: string;
  productIds?: string[];
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
}

interface SpecialCardProps {
  special: Special;
}

export default function SpecialCard({ special }: SpecialCardProps) {
  const { branch } = useBranch();
  const [product, setProduct] = useState<Product | null>(null);
  const [addonProduct, setAddonProduct] = useState<Product | null>(null);
  const [bundleQty, setBundleQty] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(true);
  // Modal shown after trigger product is added to cart
  const [showAddonModal, setShowAddonModal] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (!special._id) return;

    let cancelled = false;

    const fetchProduct = async () => {
      setLoading(true);
      try {
        let productId = special.productId || special.productIds?.[0];

        if (special.type === 'buy_x_get_y' && special.conditions.buyProductId) {
          productId = special.conditions.buyProductId;
        } else if (special.type === 'conditional_add_on_price' && special.conditions.triggerProductId) {
          productId = special.conditions.triggerProductId;
        }

        if (!productId) return;

        const res = await fetch(`/api/products/${productId}`);
        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (!cancelled) {
          setProduct(data.product);
          setBundleQty(1);
        }

        // For conditional_add_on_price: also fetch the add-on product for the prompt
        if (!cancelled && special.type === 'conditional_add_on_price' && special.conditions.targetProductId) {
          fetch(`/api/products/${special.conditions.targetProductId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d?.product && !cancelled) setAddonProduct(d.product); })
            .catch(() => null);
        }
      } catch (error) {
        console.error('Failed to fetch product for special');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProduct();

    return () => { cancelled = true; };
  }, [special._id]);

  const getSpecialBadge = () => {
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

  const getDisplayPrice = () => {
    if (!product) return 0;
    switch (special.type) {
      case 'percentage_off': {
        const off = (product.price * (special.conditions.discountPercentage || 0)) / 100;
        return product.price - Math.min(off, special.conditions.maximumDiscount || Infinity);
      }
      case 'amount_off':               return Math.max(0, product.price - (special.conditions.discountAmount || 0));
      case 'fixed_price':              return special.conditions.newPrice || product.price;
      case 'multibuy':                 return special.conditions.specialPrice || product.price;
      case 'buy_x_get_y':              return product.price;
      case 'bundle':                   return special.conditions.bundlePrice || product.price;
      case 'conditional_add_on_price': return special.conditions.triggerPrice ?? product.price;
      default:                         return product.specialPrice || product.price;
    }
  };

  const getCartUnitPrice = () => {
    if (!product) return 0;
    switch (special.type) {
      case 'percentage_off': {
        const off = (product.price * (special.conditions.discountPercentage || 0)) / 100;
        return product.price - Math.min(off, special.conditions.maximumDiscount || Infinity);
      }
      case 'amount_off':               return Math.max(0, product.price - (special.conditions.discountAmount || 0));
      case 'fixed_price':              return special.conditions.newPrice || product.price;
      case 'multibuy':                 return (special.conditions.specialPrice || product.price) / (special.conditions.requiredQuantity || 1);
      case 'buy_x_get_y':              return product.price;
      case 'bundle':                   return special.conditions.bundlePrice || product.price;
      case 'conditional_add_on_price': return special.conditions.triggerPrice ?? product.price;
      default:                         return product.specialPrice || product.price;
    }
  };

  const isMultibuy  = special.type === 'multibuy';
  const isAddonDeal = special.type === 'conditional_add_on_price';
  const bundleSize  = isMultibuy ? (special.conditions.requiredQuantity || 1) : 1;
  const actualQuantity = isMultibuy ? bundleQty * bundleSize : bundleQty;

  const incrementQuantity = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!product) return;
    const nextActualQty = (bundleQty + 1) * bundleSize;
    if (nextActualQty <= product.stockLevel) setBundleQty(q => q + 1);
  };

  const decrementQuantity = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (bundleQty > 1) setBundleQty(q => q - 1);
  };

  // Step 1: add the trigger product to cart, then open the add-on modal
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!product) { toast.error('Product not available'); return; }

    addItem({
      id: product._id,
      name: product.name,
      price: getCartUnitPrice(),
      image: special.images?.[0] || product.images[0] || '/placeholder.png',
      quantity: actualQuantity,
      sku: product.sku,
      appliedSpecialId: special._id,
      originalPrice: product.price,
    });

    if (isMultibuy) {
      toast.success(`Added ${bundleQty} bundle${bundleQty > 1 ? 's' : ''} (${actualQuantity} items) to cart!`);
      setBundleQty(1);
    } else if (isAddonDeal) {
      setShowAddonModal(true);
    } else {
      toast.success(`${actualQuantity} ${product.name} added to your cart`);
      setBundleQty(1);
    }
  };

  // Step 2a: customer says yes — add the add-on at the override price
  const handleAcceptAddon = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!addonProduct) return;

    addItem({
      id: addonProduct._id,
      name: addonProduct.name,
      price: special.conditions.overridePrice,
      image: addonProduct.images[0] || '/placeholder.png',
      quantity: special.conditions.targetQuantity || 1,
      sku: addonProduct.sku,
      appliedSpecialId: special._id,
      originalPrice: addonProduct.price,
    });

    toast.success(`${addonProduct.name} added at R${special.conditions.overridePrice}! 🎉`);
    setShowAddonModal(false);
  };

  // Step 2b: customer says no — just confirm the trigger was added
  const handleDeclineAddon = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    toast.success(`${product?.name} added to cart!`);
    setShowAddonModal(false);
  };

  const badge        = getSpecialBadge();
  const displayImage = special.images?.[0] || product?.images[0];
  const inStock      = product && product.stockLevel > 0;
  const displayPrice = getDisplayPrice();
  const lowStock     = product && product.stockLevel < 10 && product.stockLevel > 0;

  const savings = (() => {
    if (!product) return 0;
    if (special.type === 'multibuy') {
      const reqQty = special.conditions.requiredQuantity || 1;
      return Math.max(0, product.price * reqQty - (special.conditions.specialPrice || product.price));
    }
    if (special.type === 'buy_x_get_y') return 0;
    if (special.type === 'conditional_add_on_price') {
      return special.conditions.triggerPrice != null
        ? Math.max(0, product.price - special.conditions.triggerPrice)
        : 0;
    }
    return Math.max(0, product.price - displayPrice);
  })();

  const hasBanner =
    special.type === 'buy_x_get_y' ||
    special.type === 'multibuy' ||
    special.type === 'conditional_add_on_price' ||
    (special.type === 'bundle' && savings > 0);

  const specialUrl = branch
    ? `/${branch.slug}/specials/${special.slug}`
    : `/specials/${special.slug}`;

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100">
      <Link href={specialUrl} className="block">
        {/* Image */}
        <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-100">
          {displayImage && !imgError ? (
            <img
              src={displayImage}
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

          {/* Badges — top left */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
              <Tag className="w-2.5 h-2.5" />
              {badge}
            </span>
            {special.featured && (
              <span className="inline-flex items-center gap-1 bg-yellow-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                <Star className="w-2.5 h-2.5 fill-white" />
                FEATURED
              </span>
            )}
          </div>

          {/* Low-stock warning */}
          {lowStock && (
            <div className="absolute bottom-2 right-2">
              <span className="bg-yellow-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                {product.stockLevel} left
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-3">
        <Link href={specialUrl}>
          <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 mb-1 min-h-[2.375rem] hover:text-brand-orange transition-colors">
            {special.name}
          </h3>
          <p className="text-[11px] text-gray-500 line-clamp-2 mb-2 min-h-[1.75rem]">
            {special.description}
          </p>
        </Link>

        {/* Loading spinner */}
        {loading && (
          <div className="h-20 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && product && (
          <>
            <div className="min-h-[5rem] flex flex-col justify-start mb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-lg font-bold text-brand-orange">
                  R{displayPrice.toFixed(2)}
                </span>
                {savings > 0 && (
                  <span className="text-xs text-gray-400 line-through">R{product.price.toFixed(2)}</span>
                )}
              </div>

              {special.type === 'buy_x_get_y' && (
                <div className="bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5">
                  <p className="text-[10px] text-blue-900 font-semibold truncate">
                    Buy {special.conditions.buyQuantity}, Get {special.conditions.getQuantity}
                    {special.conditions.getDiscount === 100
                      ? ' FREE!'
                      : ` ${special.conditions.getDiscount}% off`}
                  </p>
                </div>
              )}

              {special.type === 'multibuy' && (
                <div className="bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5">
                  <p className="text-[10px] text-blue-900 font-semibold truncate">
                    Buy {special.conditions.requiredQuantity} for R{special.conditions.specialPrice}
                  </p>
                </div>
              )}

              {special.type === 'bundle' && savings > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-md px-2 py-1.5">
                  <p className="text-[10px] text-purple-700 font-semibold truncate">
                    Bundle Deal — Save R{savings.toFixed(2)}!
                  </p>
                </div>
              )}

              {special.type === 'conditional_add_on_price' && (
                <div className="bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                  <p className="text-[10px] text-amber-800 font-semibold truncate">
                    🔓 Unlocks add-on @ R{special.conditions.overridePrice}
                  </p>
                </div>
              )}

              {!hasBanner && <div className="h-[1.625rem]" />}
            </div>

            {/* ── Cart actions — identical UI for all special types ──────── */}
            {inStock ? (
              <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                <div className="flex items-center border border-gray-200 rounded-lg">
                  <button
                    onClick={decrementQuantity}
                    disabled={bundleQty <= 1}
                    className="p-2 hover:bg-gray-100 transition-colors disabled:opacity-40"
                  >
                    <Minus className="w-4 h-4 text-gray-600" />
                  </button>
                  <div className="px-3 text-center min-w-[2rem]">
                    <span className="text-sm font-semibold text-gray-800 block">{bundleQty}</span>
                    {isMultibuy && (
                      <span className="text-[9px] text-purple-600 font-medium leading-none">
                        {bundleQty === 1 ? 'bundle' : 'bundles'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={incrementQuantity}
                    disabled={(bundleQty + 1) * bundleSize > product.stockLevel}
                    className="p-2 hover:bg-gray-100 transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  className="flex-1 flex items-center justify-center bg-brand-orange hover:bg-orange-600 text-white py-2 rounded-lg transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="bg-gray-200 py-2 rounded-lg text-center">
                <span className="text-gray-600 text-xs font-semibold">Out of Stock</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Add-On Modal ─────────────────────────────────────────────────── */}
      {showAddonModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
            {/* Header */}
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

            {/* Add-on product details */}
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
                      <span className="text-sm text-gray-400 line-through">
                        R{addonProduct.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {addonProduct && addonProduct.price > special.conditions.overridePrice && (
                    <p className="text-xs text-green-600 font-semibold mt-0.5">
                      Save R{(addonProduct.price - special.conditions.overridePrice).toFixed(2)}!
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
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
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, Home, ShoppingCart, Minus, Plus, Package, Check, Tag, X, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';
import { useCartStore } from '@/lib/store';

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

interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  specialPrice?: number;
  images: string[];
  stockLevel: number;
  lowStockThreshold?: number;
  sku: string;
  barcode?: string;
  categories?: string[];
  hasVariants?: boolean;
  variants?: ProductVariant[];
  onSpecial?: boolean;
  active: boolean;
  featured?: boolean;
  unit?: string;
  unitQuantity?: number;
  specialId?: string;
}

interface Special {
  _id: string;
  name: string;
  slug: string;
  type: string;
  badgeText?: string;
  images?: string[];
  conditions: any;
  active: boolean;
  productId?: string;
  productIds?: string[];
  // For conditional_add_on_price
  addonProduct?: AddonProduct;
}

interface AddonProduct {
  _id: string;
  name: string;
  price: number;
  images: string[];
  sku: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const { branch } = useBranch();
  const addItem = useCartStore((state) => state.addItem);
  const productSlug = params.productSlug as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [special, setSpecial] = useState<Special | null>(null);
  const [addonProduct, setAddonProduct] = useState<AddonProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showAddonModal, setShowAddonModal] = useState(false);

  useEffect(() => {
    if (!branch?.id || !productSlug) return;

    setProduct(null);
    setSpecial(null);
    setAddonProduct(null);
    setSelectedVariant(undefined);
    setQuantity(1);
    setSelectedImage(0);
    setLoading(true);

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/products?slug=${productSlug}&branchId=${branch.id}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const found: Product | undefined = data.products?.[0];
        if (!found || cancelled) return;
        setProduct(found);

        // Fetch special if product has one
        if (found.specialId) {
          const specialRes = await fetch(`/api/specials/${found.specialId}`);
          if (specialRes.ok && !cancelled) {
            const specialData = await specialRes.json();
            const s: Special = specialData.special;
            if (s?.active) {
              setSpecial(s);

              // For conditional_add_on_price, also fetch the add-on product
              if (s.type === 'conditional_add_on_price' && s.conditions.targetProductId) {
                const addonRes = await fetch(`/api/products/${s.conditions.targetProductId}`);
                if (addonRes.ok && !cancelled) {
                  const addonData = await addonRes.json();
                  if (addonData.product) setAddonProduct(addonData.product);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load product:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [branch?.id, productSlug]);

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
  const displayName = selectedVariant ? selectedVariant.name : (product?.name || '');

  const displayDescription = selectedVariant?.description
    ? selectedVariant.description
    : product?.description;

  const basePrice = selectedVariant
    ? (selectedVariant.price || product?.price || 0)
    : (product?.price || 0);

  const specialComputedPrice = getSpecialPrice(basePrice);

  const displayPrice = specialComputedPrice !== null
    ? specialComputedPrice
    : selectedVariant
      ? (selectedVariant.specialPrice || selectedVariant.price || product?.price || 0)
      : (product?.specialPrice || product?.price || 0);

  // Use base price as strikethrough when special is active
  const comparePrice = special && specialComputedPrice !== null
    ? basePrice
    : selectedVariant
      ? (selectedVariant.compareAtPrice || product?.compareAtPrice)
      : product?.compareAtPrice;

  const hasDiscount = !!(comparePrice && comparePrice > displayPrice);
  const discountPercent = hasDiscount
    ? Math.round(((comparePrice! - displayPrice) / comparePrice!) * 100)
    : 0;
  const savingsAmount = hasDiscount ? comparePrice! - displayPrice : 0;

  const images = selectedVariant?.images?.length
    ? selectedVariant.images
    : (product?.images || []);

  const stock = selectedVariant ? selectedVariant.stockLevel : (product?.stockLevel ?? 0);
  const inStock = stock > 0;
  const lowStock = stock > 0 && stock <= 10;

  const displayUnit = selectedVariant?.unit || product?.unit;
  const displayWeight = selectedVariant?.weight;
  const displaySize = displayWeight && displayUnit
    ? `${displayWeight}${displayUnit}`
    : (product?.unitQuantity && product?.unit ? `${product.unitQuantity}${product.unit}` : '');

  const displaySku = selectedVariant?.sku || product?.sku || '';
  const displayBarcode = selectedVariant?.barcode || product?.barcode;

  // ── Special badge ──────────────────────────────────────────────────────────
  const getSpecialBadge = (): string | null => {
    if (!special) return null;
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

  // ── Multibuy step logic ────────────────────────────────────────────────────
  const bundleStep = special?.type === 'multibuy' ? (special.conditions.requiredQuantity || 1) : 1;
  const minQty = bundleStep;

  const multibuyTotalForQty = (() => {
    if (!product || special?.type !== 'multibuy') return null;
    const { requiredQuantity, specialPrice } = special.conditions;
    if (!requiredQuantity || !specialPrice) return null;
    const sets = Math.floor(quantity / requiredQuantity);
    const remainder = quantity % requiredQuantity;
    return sets * specialPrice + remainder * basePrice;
  })();

  const bundleCount = special?.type === 'multibuy'
    ? Math.floor(quantity / bundleStep)
    : null;

  // ── Cart unit price ────────────────────────────────────────────────────────
  const getCartUnitPrice = (): number => {
    if (!special) return displayPrice;
    if (special.type === 'multibuy') {
      return special.conditions.specialPrice
        ? (special.conditions.specialPrice / (special.conditions.requiredQuantity || 1))
        : basePrice;
    }
    return displayPrice;
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleVariantSelect = (variantId: string) => {
    setSelectedVariant(variantId ? product?.variants?.find(v => v._id === variantId) : undefined);
    setQuantity(minQty);
    setSelectedImage(0);
    setImgError(false);
  };

  const increment = () => {
    const next = quantity + bundleStep;
    if (next <= stock) setQuantity(next);
  };

  const decrement = () => {
    const prev = quantity - bundleStep;
    if (prev >= minQty) setQuantity(prev);
  };

  const handleAddToCart = () => {
    if (!product || !inStock) return;

    addItem({
      id: product._id,
      variantId: selectedVariant?._id,
      name: displayName,
      variantName: selectedVariant?.name,
      price: getCartUnitPrice(),
      image: images[0] || '',
      quantity,
      sku: displaySku,
      appliedSpecialId: special?._id,
      originalPrice: comparePrice,
    });

    if (special?.type === 'multibuy') {
      const bundles = Math.floor(quantity / bundleStep);
      toast.success(`Added ${bundles} bundle${bundles > 1 ? 's' : ''} (${quantity} items) to cart!`);
    } else if (special?.type === 'conditional_add_on_price') {
      setShowAddonModal(true);
    } else {
      setJustAdded(true);
      toast.success(`Added ${quantity}× ${displayName} to cart!`);
      setTimeout(() => setJustAdded(false), 1500);
    }
  };

  const handleAcceptAddon = () => {
    if (!addonProduct || !special) return;
    addItem({
      id: addonProduct._id,
      name: addonProduct.name,
      price: special.conditions.overridePrice,
      image: addonProduct.images[0] || '',
      quantity: special.conditions.targetQuantity || 1,
      sku: addonProduct.sku,
      appliedSpecialId: special._id,
      originalPrice: addonProduct.price,
    });
    toast.success(`${addonProduct.name} added at R${special.conditions.overridePrice}! 🎉`);
    setShowAddonModal(false);
  };

  const handleDeclineAddon = () => {
    toast.success(`${displayName} added to cart!`);
    setShowAddonModal(false);
  };

  const addonSaving = addonProduct && special
    ? Math.max(0, addonProduct.price - (special.conditions.overridePrice || 0))
    : 0;

  const specialBadge = getSpecialBadge();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="h-6 bg-gray-200 rounded w-64 mb-8 animate-pulse" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-200 rounded-2xl h-96 animate-pulse" />
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded w-3/4 animate-pulse" />
              <div className="h-6 bg-gray-200 rounded w-1/2 animate-pulse" />
              <div className="h-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-12 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 md:pt-28 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-brand-black mb-4">Product not found</h1>
          {branch && (
            <Link href={`/${branch.slug}/shop`} className="text-brand-orange hover:text-orange-600 font-semibold">
              Back to Shop
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-8">
          <Link href={`/${branch?.slug}`} className="hover:text-brand-orange">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/${branch?.slug}/shop`} className="hover:text-brand-orange">Shop</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-brand-black font-medium line-clamp-1">{displayName}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">

          {/* Images */}
          <div>
            <div className="bg-white rounded-2xl overflow-hidden mb-4 relative">
              <div className="relative aspect-square">
                {images[selectedImage] && !imgError ? (
                  <Image
                    src={images[selectedImage]}
                    alt={displayName}
                    fill
                    className="object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <div className="text-center text-gray-400">
                      <Package className="w-16 h-16 mx-auto mb-4" />
                      <p className="text-sm">No Image</p>
                    </div>
                  </div>
                )}

                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col space-y-2">
                  {specialBadge && (
                    <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg flex items-center space-x-1">
                      <Tag className="w-4 h-4" />
                      <span>{specialBadge}</span>
                    </span>
                  )}
                  {!specialBadge && product.onSpecial && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">SPECIAL</span>
                  )}
                  {hasDiscount && (
                    <span className="bg-brand-orange text-white text-xs font-bold px-2 py-1 rounded-full">
                      {discountPercent}% OFF
                    </span>
                  )}
                </div>

                {lowStock && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      Only {stock} left
                    </span>
                  </div>
                )}

                {justAdded && (
                  <div className="absolute inset-0 bg-green-500/90 flex items-center justify-center">
                    <div className="text-center">
                      <Check className="w-16 h-16 text-white mx-auto mb-2" />
                      <p className="text-white font-semibold text-lg">Added to Cart!</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setSelectedImage(idx); setImgError(false); }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImage === idx ? 'border-brand-orange' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <Image src={img} alt={`${displayName} ${idx + 1}`} fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-brand-black mb-2">{displayName}</h1>

            {displaySize && <p className="text-gray-500 text-sm mb-4">{displaySize}</p>}

            {displayDescription && (
              <p className="text-gray-600 mb-6 whitespace-pre-line">{displayDescription}</p>
            )}

            {/* Special info banners */}
            {special?.type === 'buy_x_get_y' && (
              <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-900 mb-1">Special Offer</h3>
                <p className="text-blue-800">
                  Buy {special.conditions.buyQuantity}, Get {special.conditions.getQuantity}{' '}
                  {special.conditions.getDiscount === 100 ? 'FREE!' : `at ${special.conditions.getDiscount}% off`}
                </p>
              </div>
            )}

            {special?.type === 'multibuy' && (
              <div className="mb-6 bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                <h3 className="font-semibold text-purple-900 mb-1">Bundle Deal</h3>
                <p className="text-purple-800">
                  Buy {special.conditions.requiredQuantity} for only R{special.conditions.specialPrice}
                </p>
                <p className="text-purple-600 text-sm mt-1">
                  R{((special.conditions.specialPrice || basePrice) / (special.conditions.requiredQuantity || 1)).toFixed(2)} per item
                  {savingsAmount > 0 && ` — save R${(basePrice * (special.conditions.requiredQuantity || 1) - special.conditions.specialPrice).toFixed(2)} per bundle`}
                </p>
              </div>
            )}

            {special?.type === 'bundle' && (
              <div className="mb-6 bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                <h3 className="font-semibold text-purple-900 mb-1">Bundle Deal</h3>
                <p className="text-purple-800">Get all items for only R{special.conditions.bundlePrice}</p>
              </div>
            )}

            {special?.type === 'percentage_off' && special.conditions.maximumDiscount && (
              <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <h3 className="font-semibold text-green-900 mb-1">Limited Discount</h3>
                <p className="text-green-800">
                  {special.conditions.discountPercentage}% off (max R{special.conditions.maximumDiscount} discount)
                </p>
              </div>
            )}

            {special?.type === 'conditional_add_on_price' && (
              <div className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                <h3 className="font-semibold text-amber-900 mb-2">🔓 Upsell Unlock Deal</h3>
                <p className="text-amber-800 mb-3 text-sm">
                  Add this product to your cart and unlock an optional add-on at a special discounted price!
                </p>
                {addonProduct && (
                  <div className="bg-white border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-0.5">Unlocked Add-On</p>
                      <p className="font-semibold text-gray-900 text-sm">{addonProduct.name}</p>
                      <p className="text-xs text-gray-400 line-through">R{addonProduct.price.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-brand-orange">R{Number(special.conditions.overridePrice).toFixed(2)}</p>
                      {addonSaving > 0 && (
                        <p className="text-xs text-green-600 font-semibold">Save R{addonSaving.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Link to special page if exists */}
            {special && (
              <Link
                href={`/${branch?.slug}/specials/${special.slug}`}
                className="inline-flex items-center space-x-1 text-sm text-brand-orange hover:text-orange-600 font-semibold mb-6"
              >
                <Tag className="w-4 h-4" />
                <span>View full special: {special.name}</span>
              </Link>
            )}

            {/* Variant selector */}
            {product.hasVariants && product.variants && product.variants.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-brand-black mb-2">Select Option</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleVariantSelect('')}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      !selectedVariant ? 'border-brand-orange bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                    } ${product.stockLevel === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={product.stockLevel === 0}
                  >
                    <div className="font-semibold text-brand-black text-sm">{product.name}</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      R{(product.specialPrice || product.price).toFixed(2)}
                    </div>
                    {product.stockLevel === 0 && <div className="text-xs text-red-500 mt-0.5">Out of stock</div>}
                  </button>

                  {product.variants.filter(v => v.active).map((variant) => (
                    <button
                      key={variant._id}
                      onClick={() => handleVariantSelect(variant._id!)}
                      disabled={variant.stockLevel === 0}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        selectedVariant?._id === variant._id
                          ? 'border-brand-orange bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${variant.stockLevel === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="font-semibold text-brand-black text-sm">{variant.name}</div>
                      {variant.price && (
                        <div className="text-xs text-gray-600 mt-0.5">
                          R{(variant.specialPrice || variant.price).toFixed(2)}
                        </div>
                      )}
                      {variant.stockLevel === 0 && <div className="text-xs text-red-500 mt-0.5">Out of stock</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            <div className="mb-6">
              {special?.type === 'multibuy' ? (
                <div>
                  <div className="flex items-baseline space-x-3">
                    <span className="text-3xl font-bold text-brand-orange">
                      R{(special.conditions.specialPrice || basePrice).toFixed(2)}
                    </span>
                    <span className="text-xl text-gray-400 line-through">
                      R{(basePrice * (special.conditions.requiredQuantity || 1)).toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-500">for {special.conditions.requiredQuantity}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    R{((special.conditions.specialPrice || basePrice) / (special.conditions.requiredQuantity || 1)).toFixed(2)} per item
                  </p>
                </div>
              ) : (
                <div className="flex items-baseline space-x-3">
                  <span className="text-3xl font-bold text-brand-orange">R{displayPrice.toFixed(2)}</span>
                  {hasDiscount && (
                    <span className="text-xl text-gray-400 line-through">R{comparePrice!.toFixed(2)}</span>
                  )}
                </div>
              )}
              {hasDiscount && special?.type !== 'multibuy' && (
                <p className="text-sm text-green-600 font-semibold mt-1">
                  Save R{savingsAmount.toFixed(2)} ({discountPercent}% OFF)
                </p>
              )}
            </div>

            {/* Stock status */}
            <div className="mb-6">
              {inStock ? (
                <p className="text-green-600 font-semibold flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-600 rounded-full inline-block" />
                  <span>{lowStock ? `Only ${stock} left` : 'In Stock'}</span>
                </p>
              ) : (
                <p className="text-red-600 font-semibold flex items-center space-x-2">
                  <span className="w-2 h-2 bg-red-600 rounded-full inline-block" />
                  <span>Out of Stock</span>
                </p>
              )}
            </div>

            {/* Qty + Add to cart */}
            {inStock ? (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-brand-black mb-2">
                  {special?.type === 'multibuy' ? `Quantity (bundles of ${bundleStep})` : 'Quantity'}
                </label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center border-2 border-gray-200 rounded-xl">
                    <button onClick={decrement} disabled={quantity <= minQty} className="p-3 hover:bg-gray-50 transition-colors disabled:opacity-40">
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="text-center px-2">
                      <span className="px-3 font-semibold text-brand-black block">{quantity}</span>
                      {bundleCount !== null && (
                        <p className="text-xs text-purple-600 font-semibold leading-none pb-1">
                          {bundleCount} bundle{bundleCount > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <button onClick={increment} disabled={quantity + bundleStep > stock} className="p-3 hover:bg-gray-50 transition-colors disabled:opacity-40">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 bg-brand-orange text-white px-8 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span>
                      {special?.type === 'multibuy'
                        ? 'Add Bundle'
                        : special?.type === 'conditional_add_on_price'
                        ? 'Add & Unlock'
                        : 'Add to Cart'}
                    </span>
                  </button>
                </div>

                {/* Multibuy total summary */}
                {special?.type === 'multibuy' && multibuyTotalForQty !== null && (
                  <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
                    <p className="text-sm text-purple-800 font-medium">
                      {quantity} items → <span className="font-bold">R{multibuyTotalForQty.toFixed(2)} total</span>
                      <span className="text-purple-600 ml-1">
                        (save R{(basePrice * quantity - multibuyTotalForQty).toFixed(2)})
                      </span>
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <button disabled className="w-full py-3 bg-gray-300 text-gray-600 rounded-xl cursor-not-allowed font-semibold mb-6">
                Out of Stock
              </button>
            )}

            {/* Product Details */}
            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-xl font-bold text-brand-black mb-3">Product Details</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex">
                  <dt className="text-gray-500 w-32">SKU:</dt>
                  <dd className="text-brand-black font-medium">{displaySku}</dd>
                </div>
                {displayBarcode && (
                  <div className="flex">
                    <dt className="text-gray-500 w-32">Barcode:</dt>
                    <dd className="text-brand-black font-medium">{displayBarcode}</dd>
                  </div>
                )}
                {displaySize && (
                  <div className="flex">
                    <dt className="text-gray-500 w-32">Size:</dt>
                    <dd className="text-brand-black font-medium">{displaySize}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Add-On Modal */}
      {showAddonModal && special && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">🔓 Special Unlocked!</p>
                <h2 className="text-xl font-bold text-brand-black">Would you like to add this?</h2>
              </div>
              <button onClick={handleDeclineAddon} className="p-1 text-gray-400 hover:text-gray-600 ml-4 flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                {addonProduct?.images[0] ? (
                  <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 border-amber-200">
                    <img src={addonProduct.images[0]} alt={addonProduct.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 border-2 border-amber-200">
                    <Tag className="w-8 h-8 text-amber-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-1">Add-On Product</p>
                  <h3 className="font-bold text-lg text-brand-black leading-tight mb-2">
                    {addonProduct?.name ?? 'Unlocked Add-On'}
                  </h3>
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-bold text-brand-orange">
                      R{Number(special.conditions.overridePrice).toFixed(2)}
                    </span>
                    {addonProduct && addonProduct.price > special.conditions.overridePrice && (
                      <span className="text-base text-gray-400 line-through">R{addonProduct.price.toFixed(2)}</span>
                    )}
                  </div>
                  {addonSaving > 0 && (
                    <p className="text-sm text-green-600 font-semibold mt-1">Save R{addonSaving.toFixed(2)}!</p>
                  )}
                  {special.conditions.targetQuantity > 1 && (
                    <p className="text-xs text-gray-500 mt-1">Quantity: {special.conditions.targetQuantity}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleAcceptAddon}
                  className="w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  Yes, add for R{Number(special.conditions.overridePrice).toFixed(2)}!
                </button>
                <button
                  onClick={handleDeclineAddon}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3.5 rounded-xl transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                  No thanks, continue without it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
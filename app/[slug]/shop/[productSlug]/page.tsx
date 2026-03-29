'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, Home, ShoppingCart, Minus, Plus, Package, Check } from 'lucide-react';
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
}

export default function ProductDetailPage() {
  const params = useParams();
  const { branch } = useBranch();
  const addItem = useCartStore((state) => state.addItem);
  const productSlug = params.productSlug as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!branch?.id || !productSlug) return;

    setProduct(null);
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
      } catch (error) {
        console.error('Failed to load product:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [branch?.id, productSlug]);

  // ── Derived display values ──────────────────────────────────────────────────
  const displayName = selectedVariant ? selectedVariant.name : (product?.name || '');

  const displayDescription = selectedVariant?.description
    ? selectedVariant.description
    : product?.description;

  const displayPrice = selectedVariant
    ? (selectedVariant.specialPrice || selectedVariant.price || product?.price || 0)
    : (product?.specialPrice || product?.price || 0);

  const comparePrice = selectedVariant
    ? (selectedVariant.compareAtPrice || product?.compareAtPrice)
    : product?.compareAtPrice;

  const hasDiscount = !!(comparePrice && comparePrice > displayPrice);
  const discountPercent = hasDiscount
    ? Math.round(((comparePrice! - displayPrice) / comparePrice!) * 100)
    : 0;

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
  // ───────────────────────────────────────────────────────────────────────────

  const handleVariantSelect = (variantId: string) => {
    setSelectedVariant(variantId ? product?.variants?.find(v => v._id === variantId) : undefined);
    setQuantity(1);
    setSelectedImage(0);
    setImgError(false);
  };

  const handleAddToCart = () => {
    if (!product || !inStock) return;
    addItem({
      id: product._id,
      variantId: selectedVariant?._id,
      name: displayName,
      variantName: selectedVariant?.name,
      price: displayPrice,
      image: images[0] || '',
      quantity,
      sku: displaySku,
      originalPrice: comparePrice,
    });
    setJustAdded(true);
    toast.success(`Added ${quantity}× ${displayName} to cart!`);
    setTimeout(() => setJustAdded(false), 1500);
  };

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
                <div className="absolute top-4 left-4 flex flex-col space-y-1">
                  {product.onSpecial && (
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
            <h1 className="text-3xl md:text-4xl font-bold text-brand-black mb-2">
              {displayName}
            </h1>

            {displaySize && <p className="text-gray-500 text-sm mb-4">{displaySize}</p>}

            {displayDescription && (
              <p className="text-gray-600 mb-6 whitespace-pre-line">{displayDescription}</p>
            )}

            {/* Variant selector */}
            {product.hasVariants && product.variants && product.variants.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-brand-black mb-2">Select Option</label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Base product button */}
                  <button
                    onClick={() => handleVariantSelect('')}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      !selectedVariant
                        ? 'border-brand-orange bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${product.stockLevel === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={product.stockLevel === 0}
                  >
                    <div className="font-semibold text-brand-black text-sm">{product.name}</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      R{(product.specialPrice || product.price).toFixed(2)}
                    </div>
                    {product.stockLevel === 0 && (
                      <div className="text-xs text-red-500 mt-0.5">Out of stock</div>
                    )}
                  </button>

                  {/* Variant buttons */}
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
                      {variant.stockLevel === 0 && (
                        <div className="text-xs text-red-500 mt-0.5">Out of stock</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-baseline space-x-3">
                <span className="text-3xl font-bold text-brand-orange">R{displayPrice.toFixed(2)}</span>
                {hasDiscount && (
                  <span className="text-xl text-gray-400 line-through">R{comparePrice!.toFixed(2)}</span>
                )}
              </div>
              {hasDiscount && (
                <p className="text-sm text-green-600 font-semibold mt-1">
                  Save R{(comparePrice! - displayPrice).toFixed(2)} ({discountPercent}% OFF)
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
                <label className="block text-sm font-semibold text-brand-black mb-2">Quantity</label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center border-2 border-gray-200 rounded-xl">
                    <button onClick={() => quantity > 1 && setQuantity(q => q - 1)} disabled={quantity <= 1} className="p-3 hover:bg-gray-50 transition-colors disabled:opacity-40">
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="px-5 font-semibold text-brand-black">{quantity}</span>
                    <button onClick={() => quantity < stock && setQuantity(q => q + 1)} disabled={quantity >= stock} className="p-3 hover:bg-gray-50 transition-colors disabled:opacity-40">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 bg-brand-orange text-white px-8 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </div>
            ) : (
              <button disabled className="w-full py-3 bg-gray-300 text-gray-600 rounded-xl cursor-not-allowed font-semibold mb-6">
                Out of Stock
              </button>
            )}

            {/* Details */}
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
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBranch } from '@/lib/branch-context';
import { useCartStore } from '@/lib/store';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronRight, Home, ShoppingCart, Minus, Plus, Tag, Package,
  CheckCircle, XCircle, X,
} from 'lucide-react';
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
  categoryId?: string;
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  specialPrice?: number;
  images: string[];
  stockLevel: number;
  sku: string;
  categories?: string[];
}

export default function SpecialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { branch } = useBranch();
  const addItem = useCartStore((state) => state.addItem);
  const specialSlug = params.specialSlug as string;

  const [special, setSpecial] = useState<Special | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [addonProduct, setAddonProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddonModal, setShowAddonModal] = useState(false);

  useEffect(() => {
    if (branch && specialSlug) fetchSpecial();
  }, [branch, specialSlug]);

  useEffect(() => {
    if (special) fetchProducts();
  }, [special]);

  useEffect(() => {
    if (!special || !selectedProduct) return;
    if (special.type === 'multibuy' && special.conditions.requiredQuantity) {
      setQuantity(special.conditions.requiredQuantity);
    } else {
      setQuantity(1);
    }
  }, [selectedProduct, special]);

  const fetchSpecial = async () => {
    if (!branch) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/specials?slug=${specialSlug}&branchId=${branch.id}`);
      if (res.ok) {
        const data = await res.json();
        const foundSpecial = data.specials?.[0];
        if (foundSpecial) setSpecial(foundSpecial);
      }
    } catch (error) {
      console.error('Failed to fetch special:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    if (!special) return;
    try {
      let productIds: string[] = [];

      if (special.type === 'buy_x_get_y') {
        if (special.conditions.buyProductId) productIds = [special.conditions.buyProductId];
      } else if (special.type === 'bundle') {
        if (special.conditions.bundleProducts) {
          productIds = special.conditions.bundleProducts.map((bp: any) => bp.productId);
        }
      } else if (special.type === 'conditional_add_on_price') {
        if (special.conditions.triggerProductId) productIds = [special.conditions.triggerProductId];
        if (special.conditions.targetProductId) {
          fetch(`/api/products/${special.conditions.targetProductId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d?.product) setAddonProduct(d.product); })
            .catch(() => null);
        }
      } else {
        productIds = special.productIds || (special.productId ? [special.productId] : []);
      }

      if (productIds.length > 0) {
        const results = await Promise.all(
          productIds.map((id) =>
            fetch(`/api/products/${id}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        );
        const fetched = results.filter(Boolean).map((d) => d.product).filter(Boolean);
        setProducts(fetched);
        if (fetched.length > 0 && !selectedProduct) setSelectedProduct(fetched[0]);
      }
    } catch (error) {
      console.error('Failed to fetch products for special');
    }
  };

  const getSpecialBadge = () => {
    if (!special) return 'SPECIAL';
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

  const getDisplayPrice = (product: Product) => {
    if (!special) return product.price;
    switch (special.type) {
      case 'percentage_off': {
        const off = (product.price * (special.conditions.discountPercentage || 0)) / 100;
        const cap = special.conditions.maximumDiscount || Infinity;
        return product.price - Math.min(off, cap);
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

  const getCartUnitPrice = (product: Product) => {
    if (!special) return product.price;
    switch (special.type) {
      case 'percentage_off': {
        const off = (product.price * (special.conditions.discountPercentage || 0)) / 100;
        const cap = special.conditions.maximumDiscount || Infinity;
        return product.price - Math.min(off, cap);
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

  const getDisplaySavings = (product: Product) => {
    if (!special) return 0;
    switch (special.type) {
      case 'multibuy': {
        const reqQty  = special.conditions.requiredQuantity || 1;
        const bundleP = special.conditions.specialPrice || product.price;
        return Math.max(0, product.price * reqQty - bundleP);
      }
      case 'buy_x_get_y':              return 0;
      case 'conditional_add_on_price':
        return special.conditions.triggerPrice != null
          ? Math.max(0, product.price - special.conditions.triggerPrice)
          : 0;
      default:                         return Math.max(0, product.price - getDisplayPrice(product));
    }
  };

  // ── Quantity stepper helpers ──────────────────────────────────────────────
  const bundleStep = special?.type === 'multibuy' ? (special.conditions.requiredQuantity || 1) : 1;
  const minQty     = bundleStep;

  const increment = () => {
    if (!selectedProduct) return;
    const next = quantity + bundleStep;
    if (next <= selectedProduct.stockLevel) setQuantity(next);
  };

  const decrement = () => {
    const prev = quantity - bundleStep;
    if (prev >= minQty) setQuantity(prev);
  };

  const handleQuantityInput = (val: string) => {
    if (!selectedProduct || !special) return;
    let n = parseInt(val) || minQty;
    if (special.type === 'multibuy') {
      n = Math.max(minQty, Math.round(n / bundleStep) * bundleStep);
    } else {
      n = Math.max(1, n);
    }
    setQuantity(Math.min(selectedProduct.stockLevel, n));
  };

  const handleAddToCart = () => {
    if (!selectedProduct || !special) {
      toast.error('Please select a product');
      return;
    }
    if (!isInStock) return;

    addItem({
      id: selectedProduct._id,
      name: selectedProduct.name,
      price: getCartUnitPrice(selectedProduct),
      image: special.images?.[0] || selectedProduct.images[0] || '/placeholder.png',
      quantity,
      sku: selectedProduct.sku,
      appliedSpecialId: special._id,
      originalPrice: selectedProduct.price,
    });

    if (special.type === 'multibuy') {
      const bundles = Math.floor(quantity / bundleStep);
      toast.success(`Added ${bundles} bundle${bundles > 1 ? 's' : ''} of ${selectedProduct.name} to cart!`);
    } else if (special.type === 'conditional_add_on_price') {
      setShowAddonModal(true);
    } else {
      toast.success(`Added ${quantity}× ${selectedProduct.name} to cart!`);
    }
  };

  const handleAcceptAddon = () => {
    if (!addonProduct || !special) return;
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

  const handleDeclineAddon = () => {
    toast.success(`${selectedProduct?.name} added to cart!`);
    setShowAddonModal(false);
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const isInStock     = (selectedProduct?.stockLevel ?? 0) > 0;
  const isLowStock    = (selectedProduct?.stockLevel ?? 0) > 0 && (selectedProduct?.stockLevel ?? 0) <= 10;
  const displayImages = (special?.images?.length ? special.images : selectedProduct?.images) ?? [];
  const displayPrice  = selectedProduct ? getDisplayPrice(selectedProduct) : 0;
  const savings       = selectedProduct ? getDisplaySavings(selectedProduct) : 0;
  const bundleCount   = special?.type === 'multibuy' ? Math.floor(quantity / bundleStep) : null;

  const multibuyTotalForQty = (() => {
    if (!selectedProduct || special?.type !== 'multibuy') return null;
    const { requiredQuantity, specialPrice } = special.conditions;
    if (!requiredQuantity || !specialPrice) return null;
    const sets      = Math.floor(quantity / requiredQuantity);
    const remainder = quantity % requiredQuantity;
    return sets * specialPrice + remainder * selectedProduct.price;
  })();

  const addonSaving = addonProduct && special
    ? Math.max(0, addonProduct.price - (special.conditions.overridePrice || 0))
    : 0;

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
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!special) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 md:pt-28 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand-black mb-4">Special not found</h1>
          {branch && (
            <Link href={`/${branch.slug}/specials`} className="text-brand-orange hover:text-orange-600 font-semibold">
              Back to Specials
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-8">
          <Link href={`/${branch?.slug}`} className="hover:text-brand-orange">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/${branch?.slug}/specials`} className="hover:text-brand-orange">Specials</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-brand-black font-medium">{special.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">

          {/* ── Images ─────────────────────────────────────────────────────── */}
          <div>
            <div className="bg-white rounded-2xl overflow-hidden mb-4">
              <div className="relative aspect-square">
                {displayImages[selectedImage] ? (
                  <Image src={displayImages[selectedImage]} alt={special.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <div className="text-center text-gray-400">
                      <Tag className="w-16 h-16 mx-auto mb-4" />
                      <p className="text-sm">Special Offer</p>
                    </div>
                  </div>
                )}
                <div className="absolute top-4 left-4">
                  <span className="bg-red-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center space-x-2">
                    <Tag className="w-4 h-4" />
                    <span>{getSpecialBadge()}</span>
                  </span>
                </div>
                {special.featured && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-yellow-500 text-white px-4 py-2 rounded-full text-sm font-bold">FEATURED</span>
                  </div>
                )}
              </div>
            </div>

            {displayImages.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {displayImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImage === idx ? 'border-brand-orange' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <Image src={img} alt={`${special.name} ${idx + 1}`} fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Info Panel ─────────────────────────────────────────────────── */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-brand-black mb-4">{special.name}</h1>

            {special.description && (
              <p className="text-gray-600 mb-6 whitespace-pre-line">{special.description}</p>
            )}

            {/* Type-specific info banners */}
            {special.type === 'buy_x_get_y' && (
              <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Special Offer</h3>
                <p className="text-blue-800">
                  Buy {special.conditions.buyQuantity}, Get {special.conditions.getQuantity}{' '}
                  {special.conditions.getDiscount === 100 ? 'FREE!' : `at ${special.conditions.getDiscount}% off`}
                </p>
              </div>
            )}

            {special.type === 'multibuy' && (
              <div className="mb-6 bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                <h3 className="font-semibold text-purple-900 mb-2">Bundle Deal</h3>
                <p className="text-purple-800">
                  Buy {special.conditions.requiredQuantity} for only R{special.conditions.specialPrice}
                </p>
                {selectedProduct && (
                  <p className="text-purple-600 text-sm mt-1">
                    (R{((special.conditions.specialPrice || selectedProduct.price) / (special.conditions.requiredQuantity || 1)).toFixed(2)} per item — save R{getDisplaySavings(selectedProduct).toFixed(2)} per bundle)
                  </p>
                )}
              </div>
            )}

            {special.type === 'bundle' && (
              <div className="mb-6 bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                <h3 className="font-semibold text-purple-900 mb-2">Bundle Deal</h3>
                <p className="text-purple-800">Get all items for only R{special.conditions.bundlePrice}</p>
              </div>
            )}

            {special.type === 'percentage_off' && special.conditions.maximumDiscount && (
              <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <h3 className="font-semibold text-green-900 mb-2">Limited Discount</h3>
                <p className="text-green-800">
                  {special.conditions.discountPercentage}% off (max R{special.conditions.maximumDiscount} discount)
                </p>
              </div>
            )}

            {special.type === 'conditional_add_on_price' && (
              <div className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                <h3 className="font-semibold text-amber-900 mb-2">🔓 Upsell Unlock Deal</h3>
                <p className="text-amber-800 mb-3">
                  Add this product to your cart and we'll ask if you'd like to add the special add-on below at a fixed discounted price — completely optional!
                </p>
                <div className="bg-white border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-0.5">Unlocked Add-On</p>
                      <p className="font-semibold text-gray-900">
                        {addonProduct?.name ?? `${special.conditions.targetQuantity ?? 1}× Add-On Product`}
                      </p>
                      {addonProduct && (
                        <p className="text-xs text-gray-500 mt-0.5 line-through">Regular: R{addonProduct.price.toFixed(2)}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-0.5">Special Price</p>
                      <p className="text-2xl font-bold text-brand-orange">
                        R{Number(special.conditions.overridePrice).toFixed(2)}
                      </p>
                      {addonSaving > 0 && (
                        <p className="text-xs text-green-600 font-semibold mt-0.5">Save R{addonSaving.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Product selector (when multiple products) */}
            {products.length > 1 && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-brand-black mb-2">Select Product</label>
                <div className="grid grid-cols-2 gap-2">
                  {products.map((product) => (
                    <button
                      key={product._id}
                      onClick={() => setSelectedProduct(product)}
                      disabled={product.stockLevel === 0}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        selectedProduct?._id === product._id
                          ? 'border-brand-orange bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${product.stockLevel === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="font-semibold text-brand-black text-sm">{product.name}</div>
                      {special.type === 'multibuy' ? (
                        <div className="text-xs text-purple-700 mt-1 font-medium">
                          R{(special.conditions.specialPrice || product.price).toFixed(2)} for {special.conditions.requiredQuantity}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600 mt-1">R{getDisplayPrice(product).toFixed(2)}</div>
                      )}
                      {product.stockLevel === 0 && <div className="text-xs text-red-600 mt-1">Out of stock</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price block */}
            {selectedProduct && (
              <div className="mb-6">
                {special.type === 'multibuy' ? (
                  <div>
                    <div className="flex items-baseline space-x-3">
                      <span className="text-3xl font-bold text-brand-orange">
                        R{(special.conditions.specialPrice || selectedProduct.price).toFixed(2)}
                      </span>
                      <span className="text-xl text-gray-400 line-through">
                        R{(selectedProduct.price * (special.conditions.requiredQuantity || 1)).toFixed(2)}
                      </span>
                      <span className="text-sm text-gray-500">for {special.conditions.requiredQuantity}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      R{((special.conditions.specialPrice || selectedProduct.price) / (special.conditions.requiredQuantity || 1)).toFixed(2)} per item
                    </p>
                    {savings > 0 && (
                      <p className="text-sm text-green-600 font-semibold mt-1">
                        Save R{savings.toFixed(2)} per bundle ({Math.round((savings / (selectedProduct.price * (special.conditions.requiredQuantity || 1))) * 100)}% OFF)
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline space-x-3">
                      <span className="text-3xl font-bold text-brand-orange">R{displayPrice.toFixed(2)}</span>
                      {savings > 0 && (
                        <span className="text-xl text-gray-400 line-through">R{selectedProduct.price.toFixed(2)}</span>
                      )}
                    </div>
                    {savings > 0 && (
                      <p className="text-sm text-green-600 font-semibold mt-1">
                        Save R{savings.toFixed(2)} ({Math.round((savings / selectedProduct.price) * 100)}% OFF)
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Stock status — only show count when 10 or less */}
            {selectedProduct && (
              <div className="mb-6">
                {isInStock ? (
                  <p className="text-green-600 font-semibold flex items-center space-x-2">
                    <span className="w-2 h-2 bg-green-600 rounded-full inline-block" />
                    <span>
                      {isLowStock
                        ? `Only ${selectedProduct.stockLevel} left`
                        : 'In Stock'}
                    </span>
                  </p>
                ) : (
                  <p className="text-red-600 font-semibold flex items-center space-x-2">
                    <span className="w-2 h-2 bg-red-600 rounded-full inline-block" />
                    <span>Out of Stock</span>
                  </p>
                )}
              </div>
            )}

            {/* Quantity + Add to Cart */}
            {selectedProduct && isInStock && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-brand-black mb-2">
                  {special.type === 'multibuy' ? `Bundles (${bundleStep} items each)` : 'Quantity'}
                </label>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center border-2 border-gray-200 rounded-xl">
                    <button onClick={decrement} disabled={quantity <= minQty} className="p-3 hover:bg-gray-50 transition-colors disabled:opacity-40">
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="text-center px-1">
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => handleQuantityInput(e.target.value)}
                        className="w-14 text-center font-semibold focus:outline-none text-brand-black"
                        min={minQty}
                        step={bundleStep}
                        max={selectedProduct.stockLevel}
                      />
                      {bundleCount !== null && (
                        <p className="text-xs text-purple-600 font-semibold leading-none pb-1">
                          {bundleCount} bundle{bundleCount > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <button onClick={increment} disabled={quantity + bundleStep > selectedProduct.stockLevel} className="p-3 hover:bg-gray-50 transition-colors disabled:opacity-40">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  <button
                    onClick={handleAddToCart}
                    className="flex-1 bg-brand-orange text-white px-8 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span>
                      {special.type === 'multibuy'
                        ? 'Add Bundle'
                        : special.type === 'conditional_add_on_price'
                        ? 'Add to Cart & Unlock'
                        : 'Add to Cart'}
                    </span>
                  </button>
                </div>

                {special.type === 'multibuy' && multibuyTotalForQty !== null && (
                  <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
                    <p className="text-sm text-purple-800 font-medium">
                      {quantity} items → <span className="font-bold">R{multibuyTotalForQty.toFixed(2)} total</span>
                      {selectedProduct && quantity > 0 && (
                        <span className="text-purple-600 ml-1">
                          (save R{(selectedProduct.price * quantity - multibuyTotalForQty).toFixed(2)})
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Product details */}
            {selectedProduct && (
              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-xl font-bold text-brand-black mb-3">Product Details</h2>
                {selectedProduct.description && (
                  <p className="text-gray-600 mb-4 whitespace-pre-line">{selectedProduct.description}</p>
                )}
                <dl className="space-y-2">
                  <div className="flex">
                    <dt className="text-gray-600 w-32">SKU:</dt>
                    <dd className="text-brand-black font-medium">{selectedProduct.sku}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add-On Modal ──────────────────────────────────────────────────── */}
      {showAddonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">

            <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">🔓 Special Unlocked!</p>
                <h2 className="text-xl font-bold text-brand-black">Would you like to add this?</h2>
              </div>
              <button onClick={handleDeclineAddon} className="p-1 text-gray-400 hover:text-gray-600 transition-colors ml-4 flex-shrink-0">
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
                      <span className="text-base text-gray-400 line-through">
                        R{addonProduct.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {addonSaving > 0 && (
                    <p className="text-sm text-green-600 font-semibold mt-1">
                      You save R{addonSaving.toFixed(2)} with this deal!
                    </p>
                  )}
                  {special.conditions.targetQuantity > 1 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Quantity: {special.conditions.targetQuantity}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleAcceptAddon}
                  className="w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition-colors text-base"
                >
                  <CheckCircle className="w-5 h-5" />
                  Yes, add it for R{Number(special.conditions.overridePrice).toFixed(2)}!
                </button>
                <button
                  onClick={handleDeclineAddon}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3.5 rounded-xl transition-colors text-base"
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
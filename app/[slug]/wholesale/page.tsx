'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Package, ShoppingCart, AlertCircle, Store, X, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface WholesaleProduct {
  _id: string;
  name: string;
  slug: string;
  images: string[];
  sku: string;
  wholesale: {
    moq: number;
    moqUnit: string;
    unitsPerBox: number;
    pricePerBox: number;
    active: boolean;
  } | null;
  variants?: Array<{
    _id: string;
    name: string;
    sku: string;
    wholesale: {
      moq: number;
      moqUnit: string;
      unitsPerBox: number;
      pricePerBox: number;
      active: boolean;
    } | null;
  }>;
}

interface CartItem {
  id: string;
  variantId?: string;
  name: string;
  variantName?: string;
  sku: string;
  moq: number;
  moqUnit: string;
  unitsPerBox: number;
  quantity: number;
  totalUnits: number;
  unitPrice: number;
  totalPrice: number;
  image: string;
}

type AuthState = 'loading' | 'unauthenticated' | 'pending' | 'rejected' | 'approved';

export default function WholesalePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [authState, setAuthState] = useState<AuthState>('loading');
  const [branch, setBranch] = useState<any>(null);
  const [products, setProducts] = useState<WholesaleProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // ── 1. Auth + approval gate ───────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;

    const init = async () => {
      try {
        // Fetch branch
        const branchRes = await fetch(`/api/branches/${slug}`);
        if (!branchRes.ok) { router.push('/'); return; }
        const branchData = await branchRes.json();
        setBranch(branchData.branch);

        // Check user session
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          setAuthState('unauthenticated');
          return;
        }
        const meData = await meRes.json();

        // Check wholesale customer profile
        const customerRes = await fetch(`/api/wholesale/customers?userId=${meData.user.id}`);
        if (!customerRes.ok) {
          setAuthState('unauthenticated');
          return;
        }
        const customerData = await customerRes.json();

        if (!customerData.customers || customerData.customers.length === 0) {
          setAuthState('unauthenticated');
          return;
        }

        const customer = customerData.customers[0];

        if (customer.verificationStatus === 'pending') {
          setAuthState('pending');
          return;
        }
        if (customer.verificationStatus === 'rejected') {
          setAuthState('rejected');
          return;
        }
        if (!customer.active || customer.verificationStatus !== 'approved') {
          setAuthState('pending');
          return;
        }

        setAuthState('approved');
        fetchProducts(branchData.branch._id);
      } catch (err) {
        console.error('Wholesale auth check failed:', err);
        setAuthState('unauthenticated');
      }
    };

    init();
  }, [slug]);

  // ── Redirect based on auth state ─────────────────────────────────────────
  useEffect(() => {
    if (authState === 'unauthenticated') {
      router.push(`/${slug}/wholesale/login`);
    } else if (authState === 'pending') {
      router.push(`/${slug}/wholesale/pending`);
    } else if (authState === 'rejected') {
      router.push(`/${slug}/wholesale/rejected`);
    }
  }, [authState, slug, router]);

  const fetchProducts = async (branchId: string) => {
    try {
      setProductsLoading(true);
      const res = await fetch(`/api/wholesale/products?branchId=${branchId}`);
      if (res.ok) {
        const data = await res.json();
        // Only show products with active wholesale config
        setProducts(
          (data.products || []).filter(
            (p: WholesaleProduct) => p.wholesale?.active || p.variants?.some(v => v.wholesale?.active)
          )
        );
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
      toast.error('Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  };

  const addToCart = (product: WholesaleProduct, variant?: any, quantity: number = 1) => {
    const config = variant?.wholesale || product.wholesale;
    if (!config) { toast.error('Wholesale pricing not available'); return; }
    if (quantity < config.moq) {
      toast.error(`Minimum order is ${config.moq} ${config.moqUnit}`);
      return;
    }

    const existing = cart.findIndex(
      item => item.id === product._id && item.variantId === variant?._id
    );

    const cartItem: CartItem = {
      id: product._id,
      variantId: variant?._id,
      name: product.name,
      variantName: variant?.name,
      sku: variant?.sku || product.sku,
      moq: config.moq,
      moqUnit: config.moqUnit,
      unitsPerBox: config.unitsPerBox,
      quantity,
      totalUnits: quantity * config.unitsPerBox,
      unitPrice: config.pricePerBox / config.unitsPerBox,
      totalPrice: quantity * config.pricePerBox,
      image: product.images[0] || '',
    };

    if (existing >= 0) {
      // Update quantity if same item added again
      const updated = [...cart];
      updated[existing] = cartItem;
      setCart(updated);
      toast.success('Cart updated');
    } else {
      setCart(prev => [...prev, cartItem]);
      toast.success(`Added ${quantity} ${config.moqUnit} to cart`);
    }
    setCartOpen(true);
  };

  const removeFromCart = (id: string, variantId?: string) => {
    setCart(prev => prev.filter(item => !(item.id === id && item.variantId === variantId)));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const cartUnits = cart.reduce((sum, item) => sum + item.totalUnits, 0);

  const handleCheckout = () => {
    localStorage.setItem('wholesale-cart', JSON.stringify(cart));
    router.push(`/${slug}/wholesale/checkout`);
  };

  // ── Loading / redirecting states ──────────────────────────────────────────
  if (authState === 'loading' || authState === 'unauthenticated' || authState === 'pending' || authState === 'rejected') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      {/* Sticky shop header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="w-5 h-5 text-brand-orange" />
            <div>
              <h1 className="text-lg font-bold text-brand-black leading-tight">Wholesale Shop</h1>
              <p className="text-xs text-gray-500">{branch?.name}</p>
            </div>
          </div>

          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Cart</span>
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Products grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {productsLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-white rounded-xl h-80 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No products available</h3>
            <p className="text-gray-400 text-sm">Wholesale products will appear here once configured.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map(product => (
              <WholesaleProductCard
                key={product._id}
                product={product}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/40"
            onClick={() => setCartOpen(false)}
          />
          {/* Drawer */}
          <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-black">Your Cart</h2>
              <button
                onClick={() => setCartOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <ShoppingCart className="w-14 h-14 text-gray-200 mb-4" />
                <p className="text-gray-500 font-medium mb-1">Your cart is empty</p>
                <p className="text-gray-400 text-sm">Add products from the shop to get started.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {cart.map((item, index) => (
                    <div key={index} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                      {item.image && (
                        <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-brand-black truncate">
                          {item.name}{item.variantName ? ` — ${item.variantName}` : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.quantity} {item.moqUnit} · {item.totalUnits} units
                        </p>
                        <p className="text-sm font-bold text-brand-orange mt-1">
                          R{item.totalPrice.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id, item.variantId)}
                        className="text-gray-300 hover:text-red-500 transition-colors self-start mt-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-gray-200 space-y-3">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Total Units:</span>
                    <span className="font-semibold">{cartUnits}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-brand-black">Subtotal:</span>
                    <span className="text-brand-orange">R{cartTotal.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-400">VAT and delivery calculated at checkout.</p>
                  <button
                    onClick={handleCheckout}
                    className="w-full bg-brand-orange hover:bg-orange-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    Proceed to Checkout
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function WholesaleProductCard({
  product,
  onAddToCart,
}: {
  product: WholesaleProduct;
  onAddToCart: (product: WholesaleProduct, variant?: any, quantity?: number) => void;
}) {
  const [quantity, setQuantity] = useState(product.wholesale?.moq || 1);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);

  const config = selectedVariant?.wholesale || product.wholesale;
  if (!config || !config.active) return null;

  const unitPrice = config.pricePerBox / config.unitsPerBox;
  const totalUnits = quantity * config.unitsPerBox;
  const totalPrice = quantity * config.pricePerBox;
  const hasVariants = product.variants && product.variants.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative aspect-square bg-gray-100">
        {product.images[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-300" />
          </div>
        )}
        <span className="absolute top-2 left-2 bg-brand-orange text-white text-xs font-bold px-2 py-0.5 rounded">
          WHOLESALE
        </span>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-brand-black text-sm mb-3 line-clamp-2 flex-1">
          {product.name}
        </h3>

        {/* Variant selector */}
        {hasVariants && (
          <div className="mb-3">
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
              value={selectedVariant?._id || ''}
              onChange={(e) => {
                const v = product.variants?.find(v => v._id === e.target.value);
                setSelectedVariant(v ?? null);
                setQuantity(v?.wholesale?.moq || 1);
              }}
            >
              <option value="">Select variant…</option>
              {product.variants!.map(v => (
                <option key={v._id} value={v._id}>{v.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Pricing */}
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <div className="flex items-baseline justify-between">
            <p className="text-xl font-bold text-brand-orange">
              R{config.pricePerBox.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">/{config.moqUnit}</p>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {config.unitsPerBox} units · R{unitPrice.toFixed(2)}/unit
          </p>
        </div>

        {/* MOQ notice */}
        {config.moq > 1 && (
          <div className="flex items-center gap-1.5 text-xs text-yellow-700 bg-yellow-50 border border-yellow-100 rounded-lg px-2.5 py-1.5 mb-3">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Min. {config.moq} {config.moqUnit}
          </div>
        )}

        {/* Quantity */}
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">
            Quantity ({config.moqUnit}s)
          </label>
          <input
            type="number"
            min={config.moq}
            step={1}
            value={quantity}
            onChange={e => setQuantity(Math.max(config.moq, parseInt(e.target.value) || config.moq))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
          <p className="text-xs text-gray-400 mt-1">= {totalUnits} units total</p>
        </div>

        {/* Add to cart */}
        <button
          onClick={() => onAddToCart(product, selectedVariant || undefined, quantity)}
          disabled={quantity < config.moq || (hasVariants && !selectedVariant)}
          className="w-full bg-brand-orange hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          Add · R{totalPrice.toFixed(2)}
        </button>
      </div>
    </div>
  );
}
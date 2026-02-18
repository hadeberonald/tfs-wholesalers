'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Package, ShoppingCart, AlertCircle, Store } from 'lucide-react';
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

export default function WholesalePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [branch, setBranch] = useState<any>(null);
  const [products, setProducts] = useState<WholesaleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchUser();
    fetchBranch();
  }, [slug]);

  useEffect(() => {
    if (branch) {
      fetchProducts();
    }
  }, [branch]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const fetchBranch = async () => {
    try {
      const res = await fetch(`/api/branches/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setBranch(data.branch);
      }
    } catch (error) {
      console.error('Failed to fetch branch:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/wholesale/products?branchId=${branch._id}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: WholesaleProduct, variant?: any, quantity: number = 1) => {
    const config = variant?.wholesale || product.wholesale;
    
    if (!config) {
      toast.error('Wholesale pricing not available for this product');
      return;
    }

    if (quantity < config.moq) {
      toast.error(`Minimum order quantity is ${config.moq} ${config.moqUnit}`);
      return;
    }

    const unitPrice = config.pricePerBox / config.unitsPerBox;
    const totalUnits = quantity * config.unitsPerBox;
    const totalPrice = quantity * config.pricePerBox;

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
      totalUnits,
      unitPrice,
      totalPrice,
      image: product.images[0] || '',
    };

    setCart([...cart, cartItem]);
    toast.success(`Added ${quantity} ${config.moqUnit} to cart`);
  };

  const removeFromCart = (id: string, variantId?: string) => {
    setCart(cart.filter(item => 
      !(item.id === id && item.variantId === variantId)
    ));
    toast.success('Removed from cart');
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const getCartTotalUnits = () => {
    return cart.reduce((sum, item) => sum + item.totalUnits, 0);
  };

  const handleCheckout = () => {
    if (!user) {
      router.push(`/${slug}/wholesale/login?redirect=wholesale/checkout`);
      return;
    }

    // Store cart in localStorage
    localStorage.setItem('wholesale-cart', JSON.stringify(cart));
    router.push(`/${slug}/wholesale/checkout`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-24 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Store className="w-6 h-6 text-brand-orange" />
              <div>
                <h1 className="text-2xl font-bold text-brand-black">Wholesale Shop</h1>
                <p className="text-sm text-gray-600">{branch?.name}</p>
              </div>
            </div>

            <button
              onClick={() => setShowCart(!showCart)}
              className="relative btn-primary flex items-center space-x-2"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Cart ({cart.length})</span>
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Products */}
          <div className="lg:col-span-3">
            {products.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No wholesale products available</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <WholesaleProductCard
                    key={product._id}
                    product={product}
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-40">
              <h2 className="text-xl font-bold text-brand-black mb-4">Cart Summary</h2>

              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-600 text-sm">Your cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                    {cart.map((item, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-semibold text-sm text-brand-black line-clamp-1">
                            {item.name}
                            {item.variantName && ` - ${item.variantName}`}
                          </p>
                          <button
                            onClick={() => removeFromCart(item.id, item.variantId)}
                            className="text-red-600 hover:text-red-700 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                        <p className="text-xs text-gray-600">
                          {item.quantity} {item.moqUnit} = {item.totalUnits} units
                        </p>
                        <p className="text-sm font-bold text-brand-orange mt-1">
                          R{item.totalPrice.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Units:</span>
                      <span className="font-semibold">{getCartTotalUnits()}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-brand-black">Total:</span>
                      <span className="text-brand-orange">R{getCartTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    className="w-full btn-primary mt-4"
                  >
                    Proceed to Checkout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Product Card Component
function WholesaleProductCard({ 
  product, 
  onAddToCart 
}: { 
  product: WholesaleProduct;
  onAddToCart: (product: WholesaleProduct, variant?: any, quantity?: number) => void;
}) {
  const [quantity, setQuantity] = useState(product.wholesale?.moq || 1);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);

  const config = selectedVariant?.wholesale || product.wholesale;

  if (!config || !config.active) {
    return null;
  }

  const unitPrice = config.pricePerBox / config.unitsPerBox;
  const totalUnits = quantity * config.unitsPerBox;
  const totalPrice = quantity * config.pricePerBox;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="relative aspect-square mb-3 rounded-lg overflow-hidden bg-gray-100">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package className="w-12 h-12 text-gray-400" />
          </div>
        )}
        <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold">
          WHOLESALE
        </div>
      </div>

      <h3 className="font-semibold text-brand-black mb-2 line-clamp-2">
        {product.name}
      </h3>

      {/* Variant Selector */}
      {product.variants && product.variants.length > 0 && (
        <div className="mb-3">
          <label className="block text-xs text-gray-600 mb-1">Variant:</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm"
            value={selectedVariant?._id || ''}
            onChange={(e) => {
              const variant = product.variants?.find(v => v._id === e.target.value);
              setSelectedVariant(variant);
              setQuantity(variant?.wholesale?.moq || 1);
            }}
          >
            <option value="">Select variant...</option>
            {product.variants.map((variant) => (
              <option key={variant._id} value={variant._id}>
                {variant.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-2 mb-3 text-sm">
        <p className="text-gray-600">
          <span className="font-semibold text-brand-black">
            {config.unitsPerBox} units
          </span>
          {' '}per {config.moqUnit}
        </p>
        <p className="text-brand-orange font-bold text-lg mt-1">
          R{config.pricePerBox.toFixed(2)}
          <span className="text-gray-500 text-xs font-normal">
            /{config.moqUnit}
          </span>
        </p>
        <p className="text-gray-500 text-xs">
          R{unitPrice.toFixed(2)}/unit
        </p>
      </div>

      {config.moq > 1 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-3 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-800">
            Min. order: {config.moq} {config.moqUnit}
          </p>
        </div>
      )}

      <div className="mb-3">
        <label className="block text-xs text-gray-600 mb-1">
          Quantity ({config.moqUnit}s)
        </label>
        <input
          type="number"
          min={config.moq}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(config.moq, parseInt(e.target.value) || 0))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          = {totalUnits} units total
        </p>
      </div>

      <button
        onClick={() => onAddToCart(product, selectedVariant, quantity)}
        disabled={quantity < config.moq || (product.variants && !selectedVariant)}
        className="w-full btn-primary py-2 text-sm flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ShoppingCart className="w-4 h-4" />
        <span>Add R{totalPrice.toFixed(2)}</span>
      </button>
    </div>
  );
}
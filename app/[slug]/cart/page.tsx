'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCartStore } from '@/lib/store';
import { useBranch } from '@/lib/branch-context';
import {
  ShoppingCart, Trash2, Plus, Minus, ArrowRight, Tag,
  AlertCircle, ShoppingBag, Loader2, Lock, Gift, Package,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CartPage() {
  const router = useRouter();
  const { branch, loading: branchLoading } = useBranch();
  const { items, removeItem, updateQuantity, clearCart, getTotal, getSubtotal, getTotalSavings, setSpecials, recalculateSpecials } = useCartStore();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (branch && !branchLoading) fetchSpecials();
  }, [branch, branchLoading]);

  const fetchSpecials = async () => {
    if (!branch) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/specials?branchId=${branch.id}&active=true`);
      if (res.ok) {
        const data = await res.json();
        setSpecials(data.specials || []);
      }
    } catch (error) {
      console.error('Failed to fetch specials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (id: string, newQuantity: number, variantId?: string) => {
    if (newQuantity < 1) { handleRemove(id, variantId); return; }
    updateQuantity(id, newQuantity, variantId);
  };

  const handleRemove = (id: string, variantId?: string) => {
    const itemToRemove = items.find((item) => {
      if (variantId) return item.id === id && item.variantId === variantId;
      return item.id === id && !item.variantId;
    });
    if (itemToRemove?.autoAdded) {
      toast.error('This item is automatically added by a special and cannot be manually removed');
      return;
    }
    removeItem(id, variantId);
    toast.success('Item removed from cart');
  };

  const handleClearCart = () => {
    if (confirm('Are you sure you want to clear your cart? This will remove all items including special offers.')) {
      clearCart();
      toast.success('Cart cleared');
    }
  };

  const handleCheckout = () => {
    if (!branch) { toast.error('Please select a branch'); return; }
    router.push(`/${branch.slug}/checkout`);
  };

  if (branchLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 md:pt-28 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-orange animate-spin" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-brand-black mb-2">Branch Not Found</h1>
          <p className="text-gray-600 mb-6">Please select a branch to continue shopping</p>
          <Link href="/" className="btn-primary inline-block">Go to Home</Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <ShoppingBag className="w-24 h-24 text-gray-300 mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-brand-black mb-4">Your Cart is Empty</h1>
          <p className="text-gray-600 mb-8 text-lg">Start adding some delicious items to your cart!</p>
          <Link href={`/${branch.slug}/shop`} className="btn-primary inline-block">Start Shopping</Link>
        </div>
      </div>
    );
  }

  const subtotal     = getSubtotal();
  const totalSavings = getTotalSavings();
  const total        = getTotal();

  // ── Split items into display groups ─────────────────────────────────────────
  const regularItems    = items.filter((i) => !i.autoAdded && !i.isCombo);
  const comboItems      = items.filter((i) => !i.autoAdded && i.isCombo);
  const freeItems       = items.filter((i) => i.autoAdded && i.isFreeItem);
  const multibuyBonuses = items.filter((i) => i.autoAdded && i.isMultibuyBonus);

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-brand-black mb-2">Shopping Cart</h1>
            <p className="text-gray-600">Shopping at <span className="font-semibold">{branch.displayName}</span></p>
          </div>
          {items.length > 0 && (
            <button onClick={handleClearCart} className="text-red-600 hover:text-red-700 font-medium flex items-center space-x-2 self-start sm:self-auto">
              <Trash2 className="w-4 h-4" />
              <span>Clear Cart</span>
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="bg-white rounded-2xl p-8 text-center">
                <Loader2 className="w-8 h-8 text-brand-orange animate-spin mx-auto mb-3" />
                <p className="text-gray-600">Loading specials...</p>
              </div>
            ) : (
              <>
                {/* ── Regular Items ──────────────────────────────────────── */}
                <div className="space-y-4">
                  {regularItems.map((item) => {
                    const itemPrice         = item.price || 0;
                    const itemOriginalPrice = item.originalPrice || itemPrice;
                    const itemTotal         = itemPrice * item.quantity;
                    const itemOriginalTotal = itemOriginalPrice * item.quantity;
                    const hasSpecial        = item.appliedSpecialId && item.meetsSpecialRequirement;
                    const hasSpecialNotMet  = item.appliedSpecialId && !item.meetsSpecialRequirement;

                    return (
                      <div key={`${item.id}-${item.variantId || ''}`} className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-brand-orange/30 transition-colors">
                        <div className="flex items-start space-x-4">
                          <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0 pr-4">
                                <h3 className="font-bold text-lg text-brand-black mb-1 line-clamp-2">{item.name}</h3>
                                {item.variantName && <p className="text-sm text-gray-600 mb-1">Variant: {item.variantName}</p>}
                                <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                              </div>
                              <button onClick={() => handleRemove(item.id, item.variantId)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>

                            <div className="mb-4">
                              {hasSpecial ? (
                                <>
                                  <div className="flex items-center space-x-3 mb-2">
                                    <span className="text-2xl font-bold text-brand-orange">R{itemTotal.toFixed(2)}</span>
                                    {itemOriginalTotal > itemTotal && <span className="text-base text-gray-500 line-through">R{itemOriginalTotal.toFixed(2)}</span>}
                                    <Tag className="w-5 h-5 text-green-600" />
                                  </div>
                                  <div className="bg-green-50 border-2 border-green-200 rounded-xl px-4 py-3">
                                    <div className="flex items-start space-x-2">
                                      <Tag className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-green-900 mb-1">Special Applied!</p>
                                        <p className="text-sm text-green-800">{item.specialDescription}</p>
                                        {item.specialDiscount && item.specialDiscount > 0 && (
                                          <p className="text-xs text-green-700 mt-1 font-medium">You save: R{item.specialDiscount.toFixed(2)}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : hasSpecialNotMet ? (
                                <>
                                  <div className="text-2xl font-bold text-brand-black mb-2">R{itemTotal.toFixed(2)}</div>
                                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-3">
                                    <div className="flex items-start space-x-2">
                                      <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-blue-900 mb-1">Special Available!</p>
                                        <p className="text-sm text-blue-800">{item.specialDescription}</p>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="text-2xl font-bold text-brand-black mb-1">R{itemTotal.toFixed(2)}</div>
                              )}
                              <p className="text-sm text-gray-600 mt-2">{item.quantity} × R{itemPrice.toFixed(2)} each</p>
                            </div>

                            <div className="flex items-center space-x-3">
                              <span className="text-sm font-medium text-gray-700">Quantity:</span>
                              <div className="flex items-center space-x-2">
                                <button onClick={() => handleQuantityChange(item.id, item.quantity - 1, item.variantId)} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-brand-orange hover:text-white transition-colors flex items-center justify-center">
                                  <Minus className="w-4 h-4" />
                                </button>
                                <input
                                  type="number" min="1" value={item.quantity}
                                  onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) handleQuantityChange(item.id, v, item.variantId); }}
                                  className="w-16 h-9 text-center border-2 border-gray-200 rounded-lg font-semibold text-brand-black focus:border-brand-orange focus:outline-none"
                                />
                                <button onClick={() => handleQuantityChange(item.id, item.quantity + 1, item.variantId)} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-brand-orange hover:text-white transition-colors flex items-center justify-center">
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Combo Deals ────────────────────────────────────────── */}
                {comboItems.length > 0 && (
                  <div className="space-y-4 mt-6">
                    <div className="flex items-center space-x-3 mb-2">
                      <Package className="w-6 h-6 text-purple-600" />
                      <h2 className="text-2xl font-bold text-brand-black">Combo Deals</h2>
                      <span className="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-semibold">
                        {comboItems.length} {comboItems.length === 1 ? 'combo' : 'combos'}
                      </span>
                    </div>

                    {comboItems.map((item) => {
                      const itemPrice         = item.price || 0;
                      const itemOriginalPrice = item.originalPrice || itemPrice;
                      const itemTotal         = itemPrice * item.quantity;
                      const itemOriginalTotal = itemOriginalPrice * item.quantity;
                      const savings           = itemOriginalTotal - itemTotal;
                      const discountPercent   = itemOriginalPrice > 0 ? Math.round((savings / itemOriginalTotal) * 100) : 0;

                      return (
                        <div key={`${item.id}-combo`} className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl p-6 border-2 border-purple-200">
                          <div className="flex items-start space-x-4">
                            {/* Image with COMBO badge */}
                            <div className="relative w-24 h-24 bg-white rounded-xl overflow-hidden flex-shrink-0 border-2 border-purple-300">
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                              <div className="absolute top-1 right-1">
                                <span className="bg-purple-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                                  COMBO
                                </span>
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0 pr-4">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <Package className="w-4 h-4 text-purple-600" />
                                    <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Combo Deal</span>
                                    {item.comboItemCount && (
                                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                                        {item.comboItemCount} items
                                      </span>
                                    )}
                                  </div>
                                  <h3 className="font-bold text-lg text-brand-black mb-1 line-clamp-2">{item.name}</h3>
                                </div>
                                <button onClick={() => handleRemove(item.id, item.variantId)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors">
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>

                              {/* Pricing */}
                              <div className="bg-white/60 border border-purple-300 rounded-xl px-4 py-3 mb-3">
                                <div className="flex items-center space-x-3 mb-1">
                                  <span className="text-2xl font-bold text-brand-orange">R{itemTotal.toFixed(2)}</span>
                                  {savings > 0 && (
                                    <span className="text-base text-gray-500 line-through">R{itemOriginalTotal.toFixed(2)}</span>
                                  )}
                                  {discountPercent > 0 && (
                                    <span className="text-sm font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                                      -{discountPercent}%
                                    </span>
                                  )}
                                </div>
                                {savings > 0 && (
                                  <p className="text-sm font-semibold text-purple-700">
                                    Bundle Deal — Save R{savings.toFixed(2)}!
                                  </p>
                                )}
                                <p className="text-sm text-gray-600 mt-1">{item.quantity} × R{itemPrice.toFixed(2)} each</p>
                              </div>

                              {/* Quantity */}
                              <div className="flex items-center space-x-3">
                                <span className="text-sm font-medium text-gray-700">Quantity:</span>
                                <div className="flex items-center space-x-2">
                                  <button onClick={() => handleQuantityChange(item.id, item.quantity - 1, item.variantId)} className="w-9 h-9 rounded-lg bg-white hover:bg-purple-100 border border-purple-200 transition-colors flex items-center justify-center">
                                    <Minus className="w-4 h-4 text-purple-600" />
                                  </button>
                                  <input
                                    type="number" min="1" value={item.quantity}
                                    onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) handleQuantityChange(item.id, v, item.variantId); }}
                                    className="w-16 h-9 text-center border-2 border-purple-200 rounded-lg font-semibold text-brand-black focus:border-purple-500 focus:outline-none"
                                  />
                                  <button onClick={() => handleQuantityChange(item.id, item.quantity + 1, item.variantId)} className="w-9 h-9 rounded-lg bg-white hover:bg-purple-100 border border-purple-200 transition-colors flex items-center justify-center">
                                    <Plus className="w-4 h-4 text-purple-600" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Multibuy Bonus Rows ───────────────────────────────── */}
                {multibuyBonuses.length > 0 && (
                  <div className="space-y-4 mt-6">
                    <div className="flex items-center space-x-3 mb-2">
                      <Package className="w-6 h-6 text-purple-600" />
                      <h2 className="text-2xl font-bold text-brand-black">Bundle Deals</h2>
                      <span className="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-semibold">
                        {multibuyBonuses.length} active
                      </span>
                    </div>

                    {multibuyBonuses.map((item) => {
                      const savings = item.specialDiscount || 0;
                      return (
                        <div key={item.id} className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl p-6 border-2 border-purple-200">
                          <div className="flex items-start space-x-4">
                            <div className="relative w-24 h-24 bg-white rounded-xl overflow-hidden flex-shrink-0 border-2 border-purple-300">
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                              <div className="absolute top-1 right-1">
                                <span className="bg-purple-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow-lg">DEAL</span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <Package className="w-4 h-4 text-purple-600" />
                                <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Bundle Deal Active</span>
                              </div>
                              <h3 className="font-bold text-lg text-brand-black mb-1 line-clamp-2">{item.name}</h3>
                              <div className="bg-white/60 border border-purple-300 rounded-xl px-4 py-3 mb-3">
                                <div className="flex items-start space-x-2">
                                  <Tag className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-purple-900 mb-1">{item.specialDescription}</p>
                                    <p className="text-xs text-purple-700">{item.quantity} items included in your bundle(s)</p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs text-gray-500 line-through">R{((item.originalPrice || 0) * item.quantity).toFixed(2)} original</p>
                                  <p className="text-sm font-bold text-purple-700">Discount applied to your item price above</p>
                                </div>
                                {savings > 0 && (
                                  <span className="text-sm font-bold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">Save R{savings.toFixed(2)}</span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 mt-3">
                                <Lock className="w-4 h-4 text-gray-400" />
                                <span className="text-xs text-gray-500">Auto-managed</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 text-sm text-blue-900">
                          <p className="font-semibold mb-1">About Bundle Deals</p>
                          <p>Bundle pricing is automatically applied. The discounted price is already reflected in your item above.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Buy X Get Y Free Items ────────────────────────────── */}
                {freeItems.length > 0 && (
                  <div className="space-y-4 mt-6">
                    <div className="flex items-center space-x-3 mb-2">
                      <Gift className="w-6 h-6 text-green-600" />
                      <h2 className="text-2xl font-bold text-brand-black">Bonus Items</h2>
                      <span className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
                        {freeItems.length} {freeItems.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    {freeItems.map((item) => {
                      const itemPrice         = item.price || 0;
                      const itemOriginalPrice = item.originalPrice || 0;
                      const itemTotal         = itemPrice * item.quantity;
                      const savings           = (itemOriginalPrice - itemPrice) * item.quantity;

                      return (
                        <div key={`${item.id}-${item.variantId || ''}-free`} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200">
                          <div className="flex items-start space-x-4">
                            <div className="relative w-24 h-24 bg-white rounded-xl overflow-hidden flex-shrink-0 border-2 border-green-300">
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                              <div className="absolute top-1 right-1">
                                <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">FREE</span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <Gift className="w-4 h-4 text-green-600" />
                                    <span className="text-xs font-bold text-green-700 uppercase">Auto-Added Bonus</span>
                                  </div>
                                  <h3 className="font-bold text-lg text-brand-black mb-1 line-clamp-2">{item.name}</h3>
                                  {item.variantName && <p className="text-sm text-gray-600 mb-1">Variant: {item.variantName}</p>}
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                  <Lock className="w-4 h-4 text-gray-400" />
                                  <span className="text-xs text-gray-500">Auto-managed</span>
                                </div>
                              </div>
                              <div className="bg-white/50 border border-green-300 rounded-xl px-4 py-3 mb-3">
                                <div className="flex items-start space-x-2">
                                  <Tag className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-green-900 mb-1">{item.specialDescription}</p>
                                    <p className="text-xs text-green-700">Quantity: {item.quantity} {item.quantity === 1 ? 'item' : 'items'}</p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  {itemPrice === 0 ? (
                                    <span className="text-2xl font-bold text-green-600">FREE</span>
                                  ) : (
                                    <div className="flex items-center space-x-2">
                                      <span className="text-2xl font-bold text-green-600">R{itemTotal.toFixed(2)}</span>
                                      <span className="text-base text-gray-500 line-through">R{(itemOriginalPrice * item.quantity).toFixed(2)}</span>
                                    </div>
                                  )}
                                </div>
                                {savings > 0 && (
                                  <span className="text-sm font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full">Save R{savings.toFixed(2)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 text-sm text-blue-900">
                          <p className="font-semibold mb-1">About Bonus Items</p>
                          <p>These items are automatically added based on your qualifying purchases. Their quantities adjust automatically.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 sticky top-24">
              <h2 className="text-2xl font-bold text-brand-black mb-6 flex items-center space-x-2">
                <ShoppingCart className="w-6 h-6 text-brand-orange" />
                <span>Order Summary</span>
              </h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-gray-700">
                  <span className="font-medium">Subtotal:</span>
                  <span className="font-semibold">R{subtotal.toFixed(2)}</span>
                </div>

                {totalSavings > 0 && (
                  <div className="flex justify-between text-green-600 py-3 px-4 bg-green-50 rounded-lg border-2 border-green-200">
                    <span className="font-semibold flex items-center space-x-2">
                      <Tag className="w-5 h-5" />
                      <span>Special Savings:</span>
                    </span>
                    <span className="font-bold text-lg">-R{totalSavings.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t-2 border-gray-200" />

                <div className="flex justify-between items-center pt-2">
                  <span className="text-xl font-bold text-brand-black">Total:</span>
                  <span className="text-3xl font-bold text-brand-orange">R{total.toFixed(2)}</span>
                </div>

                {totalSavings > 0 && (
                  <p className="text-sm text-green-700 text-center bg-green-50 py-2 px-3 rounded-lg font-medium">
                    🎉 You're saving R{totalSavings.toFixed(2)} with specials!
                  </p>
                )}
              </div>

              <button onClick={handleCheckout} className="btn-primary w-full text-lg py-4 flex items-center justify-center space-x-2 group">
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <Link href={`/${branch.slug}/shop`} className="block text-center text-brand-orange hover:text-brand-orange/80 font-medium mt-4 transition-colors">
                ← Continue Shopping
              </Link>

              <div className="mt-6 pt-6 border-t-2 border-gray-100">
                <div className="space-y-3 text-sm text-gray-600">
                  {['Delivery fees calculated at checkout', 'Specials are automatically applied', 'Bundle & bonus items adjust automatically', 'Prices include VAT where applicable'].map((note) => (
                    <div key={note} className="flex items-start space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-orange mt-1.5 flex-shrink-0" />
                      <p>{note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Checkout Button */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 shadow-lg z-40">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-600">Total:</p>
              <p className="text-2xl font-bold text-brand-orange">R{total.toFixed(2)}</p>
              {totalSavings > 0 && <p className="text-xs text-green-600 font-medium">Save R{totalSavings.toFixed(2)}</p>}
            </div>
            <button onClick={handleCheckout} className="btn-primary px-6 py-3 flex items-center space-x-2">
              <span>Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="lg:hidden h-24" />
      </div>
    </div>
  );
}
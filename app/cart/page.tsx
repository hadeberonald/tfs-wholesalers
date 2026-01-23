'use client';

import { useCartStore } from '@/lib/store';
import Link from 'next/link';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';

export default function CartPage() {
  const { items, getTotal, updateQuantity, removeItem } = useCartStore();
  const total = getTotal();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl p-8 md:p-12 text-center">
            <ShoppingBag className="w-16 h-16 md:w-20 md:h-20 text-gray-300 mx-auto mb-6" />
            <h1 className="text-2xl md:text-3xl font-bold text-brand-black mb-4">Your Cart is Empty</h1>
            <p className="text-gray-600 mb-8">Add some products to get started!</p>
            <Link href="/products" className="btn-primary inline-block">
              Browse Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        <h1 className="text-2xl md:text-4xl font-bold text-brand-black mb-6 md:mb-8">Shopping Cart</h1>

        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3 md:space-y-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Image */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${item.id}`}
                      className="font-semibold text-base md:text-lg text-brand-black hover:text-brand-orange transition-colors line-clamp-2"
                    >
                      {item.name}
                    </Link>
                    <p className="text-brand-orange font-bold text-lg md:text-xl mt-1 md:mt-2">
                      R{item.price.toFixed(2)}
                    </p>
                  </div>

                  {/* Quantity & Remove - Mobile */}
                  <div className="flex items-center justify-between sm:hidden">
                    <div className="flex items-center border-2 border-gray-200 rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                        className="p-2 hover:bg-gray-100 transition-colors"
                      >
                        <Minus className="w-4 h-4 text-gray-600" />
                      </button>
                      <span className="px-3 font-semibold text-brand-black">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-2 hover:bg-gray-100 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="font-bold text-lg text-brand-black">
                        R{(item.price * item.quantity).toFixed(2)}
                      </p>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Quantity & Remove - Desktop */}
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="flex items-center border-2 border-gray-200 rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                        className="p-2 hover:bg-gray-100 transition-colors"
                      >
                        <Minus className="w-4 h-4 text-gray-600" />
                      </button>
                      <span className="px-4 font-semibold text-brand-black">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-2 hover:bg-gray-100 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>

                    <div className="text-right min-w-[100px]">
                      <p className="text-sm text-gray-600 mb-1">Subtotal</p>
                      <p className="font-bold text-xl text-brand-black">
                        R{(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-6 shadow-sm sticky top-24">
              <h2 className="text-xl md:text-2xl font-bold text-brand-black mb-4 md:mb-6">Order Summary</h2>

              <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
                <div className="flex justify-between text-gray-600 text-sm md:text-base">
                  <span>Subtotal ({items.length} {items.length === 1 ? 'item' : 'items'})</span>
                  <span className="font-semibold">R{total.toFixed(2)}</span>
                </div>

                <div className="border-t pt-3 md:pt-4">
                  <p className="text-xs md:text-sm text-gray-600">
                    Delivery fee will be calculated at checkout based on your location
                  </p>
                </div>

                <div className="flex justify-between text-xl md:text-2xl font-bold text-brand-black border-t pt-3 md:pt-4">
                  <span>Total</span>
                  <span className="text-brand-orange">R{total.toFixed(2)}</span>
                </div>
              </div>

              <Link
                href="/checkout"
                className="btn-primary w-full flex items-center justify-center space-x-2 text-base md:text-lg py-3 md:py-4 mb-3"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <Link
                href="/products"
                className="btn-secondary w-full text-center text-sm md:text-base py-2.5 md:py-3"
              >
                Continue Shopping
              </Link>

              {/* Trust Badges */}
              <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t space-y-2 md:space-y-3">
                <div className="flex items-center space-x-3 text-xs md:text-sm text-gray-600">
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Secure Checkout</span>
                </div>
                <div className="flex items-center space-x-3 text-xs md:text-sm text-gray-600">
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Fast Delivery</span>
                </div>
                <div className="flex items-center space-x-3 text-xs md:text-sm text-gray-600">
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Quality Guaranteed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
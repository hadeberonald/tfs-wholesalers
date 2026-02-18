'use client';

import Link from 'next/link';
import { AlertCircle, ShoppingCart, Home } from 'lucide-react';

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
            <AlertCircle className="w-12 h-12 text-yellow-600" />
          </div>

          <h1 className="text-4xl font-bold text-brand-black mb-4">
            Payment Cancelled
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            You cancelled the payment. Your order has not been placed.
          </p>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
            <p className="text-blue-900">
              Your cart items are still saved. You can continue shopping or complete your purchase when you're ready.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/cart" className="btn-primary flex items-center justify-center space-x-2">
              <ShoppingCart className="w-5 h-5" />
              <span>Return to Cart</span>
            </Link>
            <Link href="/products" className="btn-secondary flex items-center justify-center space-x-2">
              <span>Continue Shopping</span>
            </Link>
          </div>

          <div className="mt-8 pt-8 border-t">
            <Link href="/" className="text-gray-600 hover:text-brand-orange transition-colors inline-flex items-center space-x-2">
              <Home className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
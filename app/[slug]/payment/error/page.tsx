'use client';

import Link from 'next/link';
import { XCircle, RefreshCw, Home } from 'lucide-react';

export default function PaymentErrorPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
            <XCircle className="w-12 h-12 text-red-600" />
          </div>

          <h1 className="text-4xl font-bold text-brand-black mb-4">
            Payment Error
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            We encountered an error processing your payment. Please try again.
          </p>

          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-8 text-left">
            <h3 className="font-semibold text-red-900 mb-2">Common Issues:</h3>
            <ul className="text-sm text-red-800 space-y-1">
              <li>• Insufficient funds</li>
              <li>• Incorrect card details</li>
              <li>• Card expired or blocked</li>
              <li>• Bank declined the transaction</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/cart" className="btn-primary flex items-center justify-center space-x-2">
              <RefreshCw className="w-5 h-5" />
              <span>Try Again</span>
            </Link>
            <Link href="/" className="btn-secondary flex items-center justify-center space-x-2">
              <Home className="w-5 h-5" />
              <span>Back to Home</span>
            </Link>
          </div>

          <div className="mt-8 pt-8 border-t">
            <p className="text-sm text-gray-600">
              Need help? Contact our support team at{' '}
              <a href="mailto:support@yourstore.com" className="text-brand-orange hover:underline">
                support@yourstore.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
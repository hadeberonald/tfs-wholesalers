'use client';

import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';

export default function AddressesPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/account" className="inline-flex items-center text-brand-orange hover:text-orange-600 mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Account
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-brand-black mb-2">Saved Addresses</h1>
          <p className="text-gray-600">Manage your delivery addresses</p>
        </div>

        <div className="bg-white rounded-2xl p-12 text-center">
          <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Coming Soon</h3>
          <p className="text-gray-600">Address management will be available soon</p>
        </div>
      </div>
    </div>
  );
}
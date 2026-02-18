'use client';

import { useState, useEffect } from 'react';
import { Package, ShoppingCart, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ComboItem {
  productId: string;
  productName: string;
  quantity: number;
}

interface Combo {
  _id: string;
  name: string;
  slug: string;
  description: string;
  items: ComboItem[];
  comboPrice: number;
  regularPrice: number;
  images: string[];
  active: boolean;
  featured: boolean;
  stockLevel: number;
}

export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCombos();
  }, []);

  const fetchCombos = async () => {
    try {
      const res = await fetch('/api/combos?active=true');
      if (res.ok) {
        const data = await res.json();
        const activeCombos = (data.combos || []).filter(
          (c: Combo) => c.active && c.stockLevel > 0
        );
        setCombos(activeCombos);
      }
    } catch (error) {
      console.error('Failed to fetch combos:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSavings = (combo: Combo) => {
    const savings = combo.regularPrice - combo.comboPrice;
    const percent = ((savings / combo.regularPrice) * 100).toFixed(0);
    return { savings, percent };
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-orange to-orange-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <Link
            href="/"
            className="inline-flex items-center text-white hover:text-orange-100 mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Link>
          <div className="flex items-center justify-center mb-4">
            <Package className="w-12 h-12 mr-3" />
            <h1 className="text-5xl font-bold">Value Combos</h1>
          </div>
          <p className="text-center text-xl text-orange-100">
            Save big with our specially curated product bundles
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Stats */}
        {!loading && combos.length > 0 && (
          <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-brand-orange">{combos.length}</p>
                <p className="text-gray-600 text-sm">Available Combos</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">
                  Up to {Math.max(...combos.map(c => {
                    const { percent } = calculateSavings(c);
                    return parseInt(percent);
                  }))}%
                </p>
                <p className="text-gray-600 text-sm">Maximum Savings</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {combos.filter(c => c.featured).length}
                </p>
                <p className="text-gray-600 text-sm">Featured Combos</p>
              </div>
            </div>
          </div>
        )}

        {/* Combos Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="bg-gray-200 h-48 rounded-xl mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : combos.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No combos available right now
            </h3>
            <p className="text-gray-600 mb-6">
              Check back soon for amazing bundle deals!
            </p>
            <Link href="/" className="btn-primary">
              Back to Home
            </Link>
          </div>
        ) : (
          <>
            {/* Featured Combos */}
            {combos.filter(c => c.featured).length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Combos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {combos.filter(c => c.featured).map((combo) => {
                    const { savings, percent } = calculateSavings(combo);
                    return (
                      <ComboCard
                        key={combo._id}
                        combo={combo}
                        savings={savings}
                        percent={percent}
                        featured
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Combos */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {combos.filter(c => c.featured).length > 0 ? 'More Combos' : 'All Combos'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {combos.filter(c => !c.featured).map((combo) => {
                  const { savings, percent } = calculateSavings(combo);
                  return (
                    <ComboCard
                      key={combo._id}
                      combo={combo}
                      savings={savings}
                      percent={percent}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ComboCard({
  combo,
  savings,
  percent,
  featured = false
}: {
  combo: Combo;
  savings: number;
  percent: string;
  featured?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group ${
      featured ? 'ring-2 ring-brand-orange' : ''
    }`}>
      {/* Combo Badge */}
      <div className="relative">
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
            Save {percent}%
          </div>
        </div>
        {featured && (
          <div className="absolute top-3 left-3 z-10">
            <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
              Featured
            </div>
          </div>
        )}
        
        {/* Placeholder for combo image */}
        <div className="h-48 bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
          <Package className="w-20 h-20 text-brand-orange opacity-50" />
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1">
          {combo.name}
        </h3>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {combo.description}
        </p>

        {/* Items List */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2 font-semibold">What's Included:</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {combo.items.map((item, idx) => (
              <div key={idx} className="flex items-center text-sm text-gray-700">
                <span className="w-5 h-5 flex items-center justify-center bg-orange-100 rounded-full text-xs text-brand-orange mr-2 flex-shrink-0">
                  {item.quantity}
                </span>
                <span className="line-clamp-1">{item.productName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="border-t pt-4 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-500 line-through">
              R{combo.regularPrice.toFixed(2)}
            </span>
            <span className="text-xs text-green-600 font-semibold">
              Save R{savings.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Combo Price:</span>
            <span className="text-2xl font-bold text-brand-orange">
              R{combo.comboPrice.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button className="w-full btn-primary flex items-center justify-center space-x-2 group-hover:bg-orange-600 transition-colors">
          <ShoppingCart className="w-5 h-5" />
          <span>Add to Cart</span>
        </button>
      </div>
    </div>
  );
}
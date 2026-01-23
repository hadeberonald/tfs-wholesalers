'use client';

import { useState, useEffect } from 'react';
import { Package, ShoppingCart, ArrowRight } from 'lucide-react';
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

export default function CombosSection() {
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
        const activeCombos = (data.combos || [])
          .filter((c: Combo) => c.active && c.stockLevel > 0)
          .slice(0, 4); // Show top 4 combos
        setCombos(activeCombos);
      }
    } catch (error) {
      console.error('Failed to fetch combos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!loading && combos.length === 0) {
    return null;
  }

  const calculateSavings = (combo: Combo) => {
    const savings = combo.regularPrice - combo.comboPrice;
    const percent = ((savings / combo.regularPrice) * 100).toFixed(0);
    return { savings, percent };
  };

  return (
    <section className="py-16 bg-gradient-to-b from-orange-50 to-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Package className="w-10 h-10 text-brand-orange mr-3" />
            <h2 className="text-4xl font-bold text-brand-black">Value Combos</h2>
          </div>
          <p className="text-xl text-gray-600">
            Save more with our specially curated product bundles
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="bg-gray-200 h-48 rounded-xl mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {combos.map((combo) => {
              const { savings, percent } = calculateSavings(combo);
              return (
                <div
                  key={combo._id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group"
                >
                  {/* Combo Badge */}
                  <div className="relative">
                    <div className="absolute top-3 right-3 z-10">
                      <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                        Save {percent}%
                      </div>
                    </div>
                    
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

                    {/* Items Preview */}
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2">Includes:</p>
                      <div className="space-y-1">
                        {combo.items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex items-center text-sm text-gray-700">
                            <span className="w-5 h-5 flex items-center justify-center bg-orange-100 rounded-full text-xs text-brand-orange mr-2">
                              {item.quantity}
                            </span>
                            <span className="line-clamp-1">{item.productName}</span>
                          </div>
                        ))}
                        {combo.items.length > 3 && (
                          <p className="text-xs text-gray-500 ml-7">
                            +{combo.items.length - 3} more items
                          </p>
                        )}
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
            })}
          </div>
        )}

        {/* View All Link */}
        {combos.length > 0 && (
          <div className="text-center mt-12">
            <Link
              href="/combos"
              className="inline-flex items-center space-x-2 text-brand-orange hover:text-orange-600 font-semibold text-lg group"
            >
              <span>View All Combos</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
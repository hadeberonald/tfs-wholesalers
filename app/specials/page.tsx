'use client';

import { useState, useEffect } from 'react';
import { Tag } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import ComboCard from '@/components/ComboCard';

interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  price: number;
  specialPrice?: number;
  compareAtPrice?: number;
  images: string[];
  stockLevel: number;
  onSpecial?: boolean;
  active: boolean;
  specialStartDate?: string;
  specialEndDate?: string;
}

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

export default function SpecialsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch specials
      const specialsRes = await fetch('/api/products?special=true');
      if (specialsRes.ok) {
        const data = await specialsRes.json();
        const activeSpecials = (data.products || []).filter(
          (p: Product) => p.active && p.stockLevel > 0
        );
        setProducts(activeSpecials);
      }

      // Fetch combos
      const combosRes = await fetch('/api/combos?active=true');
      if (combosRes.ok) {
        const data = await combosRes.json();
        const activeCombos = (data.combos || []).filter(
          (c: Combo) => c.active && c.stockLevel > 0
        );
        setCombos(activeCombos);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasContent = products.length > 0 || combos.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Simple Header */}
        <div className="mb-12">
          <div className="flex items-center justify-center mb-4">
            <Tag className="w-10 h-10 text-brand-orange mr-3" />
            <h1 className="text-4xl md:text-5xl font-bold text-brand-black">Specials</h1>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-96 animate-pulse" />
            ))}
          </div>
        ) : !hasContent ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No specials available right now
            </h3>
            <p className="text-gray-600">Check back soon for amazing deals!</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Combo Deals Section */}
            {combos.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-brand-black">
                    Combo Deals
                  </h2>
                  <span className="text-sm text-gray-600 bg-purple-100 px-3 py-1 rounded-full">
                    {combos.length} {combos.length === 1 ? 'combo' : 'combos'}
                  </span>
                </div>
                {/* 2 columns on mobile, 3 on tablet, 4 on desktop */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {combos.map((combo) => (
                    <ComboCard key={combo._id} combo={combo} />
                  ))}
                </div>
              </div>
            )}

            {/* Special Offers Section */}
            {products.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-brand-black">
                    Special Offers
                  </h2>
                  <span className="text-sm text-gray-600 bg-orange-100 px-3 py-1 rounded-full">
                    {products.length} {products.length === 1 ? 'product' : 'products'}
                  </span>
                </div>
                {/* 2 columns on mobile, 3 on tablet, 4 on desktop */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {products.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
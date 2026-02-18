'use client';

import { useState, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import ComboCard from '@/components/ComboCard';
import { Package, ArrowRight } from 'lucide-react';
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
  const { branch } = useBranch();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (branch) {
      fetchCombos();
    }
  }, [branch]);

  const fetchCombos = async () => {
    if (!branch) return;
    
    try {
      // ✅ FIX: Pass branchId to filter combos
      const res = await fetch(`/api/combos?active=true&branchId=${branch.id}`);
      if (res.ok) {
        const data = await res.json();
        const activeCombos = (data.combos || [])
          .filter((c: Combo) => c.active && c.stockLevel > 0)
          .slice(0, 4); // Show top 4 combos
        setCombos(activeCombos);
        console.log('✅ CombosSection: Loaded', activeCombos.length, 'combos for branch', branch.displayName);
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
            {combos.map((combo) => (
              <ComboCard key={combo._id} combo={combo} />
            ))}
          </div>
        )}

        {/* View All Link */}
        {combos.length > 0 && branch && (
          <div className="text-center mt-12">
            <Link
              href={`/${branch.slug}/specials`}
              className="inline-flex items-center space-x-2 text-brand-orange hover:text-orange-600 font-semibold text-lg group"
            >
              <span>View All Specials & Combos</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
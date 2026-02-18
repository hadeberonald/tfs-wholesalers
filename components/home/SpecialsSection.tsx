'use client';

import { useState, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import SpecialCard from '@/components/SpecialCard';
import ComboCard from '@/components/ComboCard';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Special {
  _id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  badgeText?: string;
  images?: string[];
  conditions: any;
  active: boolean;
  featured: boolean;
  startDate?: string;
  endDate?: string;
  productId?: string;
  productIds?: string[];
  categoryId?: string;
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
  stockLevel: number;
}

type FeedItem =
  | { kind: 'special'; data: Special }
  | { kind: 'combo';   data: Combo   };

export default function SpecialsSection() {
  const { branch } = useBranch();
  const [specials, setSpecials] = useState<Special[]>([]);
  const [combos, setCombos]     = useState<Combo[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (branch) fetchAll();
  }, [branch]);

  const fetchAll = async () => {
    if (!branch) return;
    try {
      const [specialsRes, combosRes] = await Promise.all([
        fetch(`/api/specials?active=true&branchId=${branch.id}`),
        fetch(`/api/combos?active=true&branchId=${branch.id}`),
      ]);

      if (specialsRes.ok) {
        const data = await specialsRes.json();
        const now = new Date();
        const active = (data.specials || [])
          .filter((s: Special) => {
            if (s.startDate && new Date(s.startDate) > now) return false;
            if (s.endDate   && new Date(s.endDate)   < now) return false;
            return s.active;
          })
          .slice(0, 8);
        setSpecials(active);
      }

      if (combosRes.ok) {
        const data = await combosRes.json();
        const active = (data.combos || [])
          .filter((c: Combo) => c.stockLevel > 0)
          .slice(0, 4);
        setCombos(active);
      }
    } catch (error) {
      console.error('Failed to fetch specials/combos:', error);
    } finally {
      setLoading(false);
    }
  };

  const feed: FeedItem[] = [
    ...specials.map((s): FeedItem => ({ kind: 'special', data: s })),
    ...combos.map((c):   FeedItem => ({ kind: 'combo',   data: c })),
  ];

  if (!loading && feed.length === 0) return null;

  return (
    <section className="py-16 bg-gradient-to-b from-white to-orange-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-brand-black mb-4">Special Offers</h2>
          <p className="text-xl text-gray-600">
            Don't miss out on our amazing deals and promotions
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="bg-gray-200 h-48 rounded-xl mb-4" />
                <div className="h-4 bg-gray-200 rounded mb-2" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {feed.map((item) =>
              item.kind === 'special' ? (
                <SpecialCard key={`special-${item.data._id}`} special={item.data} />
              ) : (
                <ComboCard key={`combo-${item.data._id}`} combo={item.data} />
              )
            )}
          </div>
        )}

        {/* Single "View All Specials" link only */}
        {feed.length > 0 && branch && (
          <div className="text-center mt-12">
            <Link
              href={`/${branch.slug}/specials`}
              className="inline-flex items-center gap-2 text-brand-orange hover:text-orange-600 font-semibold text-lg group"
            >
              <span>View All Specials</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
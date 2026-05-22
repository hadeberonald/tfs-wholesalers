'use client';

import { useState, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import ProductCard from '@/components/ProductCard';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Product {
  _id: string;
  name: string;
  slug: string;
  price: number;
  specialPrice?: number;
  compareAtPrice?: number;
  images: string[];
  stockLevel: number;
  active: boolean;
  onSpecial?: boolean;
  hasVariants?: boolean;
  variants?: any[];
}

export default function FeaturedProducts() {
  const { branch } = useBranch();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (branch) fetchFeaturedProducts();
  }, [branch]);

  const fetchFeaturedProducts = async () => {
    if (!branch) return;
    try {
      const res = await fetch(`/api/products?branchId=${branch.id}&featured=true&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch featured products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-8 w-52 bg-gray-200 rounded-xl animate-pulse mb-2" />
              <div className="h-4 w-64 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-gray-200 rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-brand-black">Featured Products</h2>
            <p className="text-gray-500 mt-1 text-sm md:text-base">Hand-picked top picks just for you</p>
          </div>
          {branch && (
            <Link
              href={`/${branch.slug}/shop`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-orange hover:text-orange-600 transition-colors whitespace-nowrap"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {products.map(product => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
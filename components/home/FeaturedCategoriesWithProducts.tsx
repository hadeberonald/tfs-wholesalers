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

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  banner?: string;
}

function RowSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-gray-200 rounded-2xl h-80 animate-pulse" />
      ))}
    </div>
  );
}

export default function FeaturedCategoriesWithProducts() {
  const { branch } = useBranch();

  const [categories, setCategories]             = useState<Category[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<Record<string, Product[]>>({});
  const [loadingCats, setLoadingCats]           = useState(true);
  const [loadingProds, setLoadingProds]         = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (branch) loadAll();
  }, [branch]);

  const loadAll = async () => {
    if (!branch) return;
    setLoadingCats(true);
    try {
      const res = await fetch(`/api/categories?branchId=${branch.id}&featured=true`);
      const cats: Category[] = res.ok ? (await res.json()).categories || [] : [];
      setCategories(cats);
      setLoadingCats(false);

      // Mark all as loading then fetch in parallel
      const loadingMap: Record<string, boolean> = {};
      cats.forEach(c => { loadingMap[c._id] = true; });
      setLoadingProds(loadingMap);

      await Promise.all(
        cats.map(async cat => {
          try {
            const r = await fetch(
              `/api/products?branchId=${branch.id}&category=${cat._id}&limit=4`
            );
            if (r.ok) {
              const data = await r.json();
              setCategoryProducts(prev => ({ ...prev, [cat._id]: data.products || [] }));
            }
          } catch (e) {
            console.error(`Failed products for ${cat.name}`, e);
          } finally {
            setLoadingProds(prev => ({ ...prev, [cat._id]: false }));
          }
        })
      );
    } catch (err) {
      console.error('Failed to load featured categories:', err);
      setLoadingCats(false);
    }
  };

  if (loadingCats) {
    return (
      <div className="bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 space-y-14">
          {[1, 2].map(i => (
            <div key={i}>
              <div className="flex items-center justify-between mb-5">
                <div className="h-7 w-44 bg-gray-200 rounded-xl animate-pulse" />
                <div className="h-5 w-20 bg-gray-200 rounded-xl animate-pulse" />
              </div>
              <RowSkeleton />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (categories.length === 0) return null;

  return (
    <div className="bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 space-y-14">
        {categories.map(category => {
          const products  = categoryProducts[category._id] || [];
          const isLoading = loadingProds[category._id];

          // Don't render categories that finished loading with 0 products
          if (!isLoading && products.length === 0) return null;

          return (
            <section key={category._id}>
              {/* Row header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  {(category.image || category.banner) && (
                    <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-orange-200 flex-shrink-0 hidden sm:block">
                      <img
                        src={(category.image || category.banner)!}
                        alt={category.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-brand-black">
                      {category.name}
                    </h2>
                    {category.description && (
                      <p className="text-sm text-gray-500 mt-0.5 hidden md:block">
                        {category.description}
                      </p>
                    )}
                  </div>
                </div>

                {branch && (
                  <Link
                    href={`/${branch.slug}/shop?category=${category._id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-brand-orange hover:text-orange-600 transition-colors whitespace-nowrap"
                  >
                    View All <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>

              {/* Product grid */}
              {isLoading ? (
                <RowSkeleton />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                  {products.map(product => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
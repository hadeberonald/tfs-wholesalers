'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, ChevronRight, Loader2 } from 'lucide-react';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  banner?: string;
  active: boolean;
  featured: boolean;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      // Fetch only top-level categories (no parent)
      const res = await fetch('/api/categories?parentId=null');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-brand-orange mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-brand-black mb-4">
            All Categories
          </h1>
          <p className="text-gray-600 text-lg">
            Browse our complete range of product categories
          </p>
        </div>

        {/* Categories Grid */}
        {categories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {categories.map((category) => (
              <Link
                key={category._id}
                href={`/categories/${category.slug}`}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
              >
                {/* Image */}
                <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-20 h-20 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Featured Badge */}
                  {category.featured && (
                    <span className="absolute top-3 right-3 bg-brand-orange text-white text-xs font-bold px-3 py-1 rounded-full">
                      FEATURED
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-brand-black group-hover:text-brand-orange transition-colors">
                      {category.name}
                    </h3>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-orange transition-colors" />
                  </div>
                  
                  {category.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {category.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Categories Available
            </h3>
            <p className="text-gray-600">
              Categories will appear here once they're added.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
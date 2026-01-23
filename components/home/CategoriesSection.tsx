'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, Package } from 'lucide-react';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  banner?: string;
  featured: boolean;
  active: boolean;
}

export default function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      // Fetch featured top-level categories only
      const res = await fetch('/api/categories?featured=true&parentId=null');
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
      <section className="w-full">
        <div className="text-center py-12 px-4">
          <h2 className="text-4xl md:text-5xl text-brand-black mb-4">
            Shop by Category
          </h2>
          <p className="text-gray-600 text-lg">
            Find exactly what you need for your business
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-96 bg-gray-200 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (categories.length === 0) {
    return (
      <section className="w-full py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Categories Yet</h2>
          <p className="text-gray-600">Categories will appear here once they're added.</p>
        </div>
      </section>
    );
  }

  // Responsive grid based on number of categories
  const gridCols = categories.length === 1 
    ? 'lg:grid-cols-1' 
    : categories.length === 2 
    ? 'lg:grid-cols-2' 
    : categories.length === 3 
    ? 'lg:grid-cols-3' 
    : 'lg:grid-cols-4';

  return (
    <section className="w-full">
      <div className="text-center py-12 px-4">
        <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-4">
          Shop by Category
        </h2>
        <p className="text-gray-600 text-lg">
          Find exactly what you need for your business
        </p>
      </div>

      <div className={`grid grid-cols-1 ${gridCols}`}>
        {categories.map((category) => (
          <Link
            key={category._id}
            href={`/shop?category=${category.slug}`}
            className="group relative overflow-hidden h-96 md:h-[500px] lg:h-96"
          >
            {/* Background Image */}
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
              style={{ 
                backgroundImage: `url(${category.banner || category.image || '/placeholder-category.jpg'})`,
              }}
            />
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20 group-hover:from-black/95 transition-all duration-300" />
            
            {/* Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 md:px-8 text-center">
              <h3 className="font-bold text-3xl md:text-4xl text-white z-10 mb-3 md:mb-4 transform group-hover:scale-105 transition-transform duration-300">
                {category.name}
              </h3>
              {category.description && (
                <p className="text-white text-base md:text-lg z-10 opacity-90 max-w-md mb-4 line-clamp-2">
                  {category.description}
                </p>
              )}
              <div className="flex items-center space-x-2 text-white font-semibold opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                <span>Shop Now</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
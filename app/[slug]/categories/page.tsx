'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useBranch } from '@/lib/branch-context';
import ProductCard from '@/components/ProductCard';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface Product {
  _id: string;
  name: string;
  slug: string;
  price: number;
  specialPrice?: number;
  compareAtPrice?: number;
  images: string[];
  stockLevel: number;
  onSpecial?: boolean;
  active: boolean;
  hasVariants?: boolean;
  variants?: any[];
}

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  children?: Category[];
}

export default function CategoryPage() {
  const params = useParams();
  const { branch } = useBranch();
  const categorySlug = params.categorySlug as string;
  
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc'>('name');

  useEffect(() => {
    if (branch && categorySlug) {
      fetchCategoryData();
    }
  }, [branch, categorySlug]);

  useEffect(() => {
    if (products.length > 0) {
      applySorting();
    }
  }, [sortBy]);

  const fetchCategoryData = async () => {
    if (!branch) return;

    setLoading(true);
    try {
      // Fetch category details
      const categoryRes = await fetch(
        `/api/categories?branchId=${branch.id}&slug=${categorySlug}`
      );
      
      if (categoryRes.ok) {
        const categoryData = await categoryRes.json();
        const foundCategory = categoryData.categories?.[0];
        
        if (foundCategory) {
          setCategory(foundCategory);
          
          // Fetch subcategories if any
          const subcatRes = await fetch(
            `/api/categories?branchId=${branch.id}&parentId=${foundCategory._id}`
          );
          if (subcatRes.ok) {
            const subcatData = await subcatRes.json();
            setSubcategories(subcatData.categories || []);
          }
          
          // Fetch products in this category
          const productsRes = await fetch(
            `/api/products?branchId=${branch.id}&category=${foundCategory._id}`
          );
          if (productsRes.ok) {
            const productsData = await productsRes.json();
            setProducts(productsData.products || []);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch category data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applySorting = () => {
    const sorted = [...products];
    
    if (sortBy === 'price-asc') {
      sorted.sort((a, b) => 
        (a.specialPrice || a.price) - (b.specialPrice || b.price)
      );
    } else if (sortBy === 'price-desc') {
      sorted.sort((a, b) => 
        (b.specialPrice || b.price) - (a.specialPrice || a.price)
      );
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    setProducts(sorted);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4 animate-pulse" />
          <div className="h-12 bg-gray-200 rounded w-96 mb-8 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-96 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand-black mb-4">
            Category not found
          </h1>
          {branch && (
            <Link
              href={`/${branch.slug}/shop`}
              className="text-brand-orange hover:text-orange-600 font-semibold"
            >
              Back to Shop
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
          <Link href={`/${branch?.slug}`} className="hover:text-brand-orange">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/${branch?.slug}/shop`} className="hover:text-brand-orange">
            Shop
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-brand-black font-medium">{category.name}</span>
        </nav>

        {/* Category Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-brand-black mb-2">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-gray-600 max-w-3xl">{category.description}</p>
          )}
        </div>

        {/* Subcategories */}
        {subcategories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-brand-black mb-4">
              Browse Subcategories
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {subcategories.map((subcat) => (
                <Link
                  key={subcat._id}
                  href={`/${branch?.slug}/categories/${subcat.slug}`}
                  className="bg-white rounded-xl p-4 text-center hover:shadow-lg transition-shadow"
                >
                  <h3 className="font-semibold text-brand-black hover:text-brand-orange">
                    {subcat.name}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Sort & Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            {products.length} {products.length === 1 ? 'product' : 'products'}
          </p>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent bg-white"
          >
            <option value="name">Sort: A-Z</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-gray-500">
              No products found in this category
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
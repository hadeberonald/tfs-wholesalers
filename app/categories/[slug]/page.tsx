'use client'
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, Package, Home, Loader2 } from 'lucide-react';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  banner?: string;
  active: boolean;
  featured: boolean;
  parentId?: string | null;
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  price: number;
  specialPrice?: number;
  compareAtPrice?: number;
  images: string[];
  onSpecial?: boolean;
  stockLevel: number;
  active: boolean;
  featured: boolean;
}

interface CategoryPageProps {
  slug: string;
}

export default function CategoryPage({ slug }: CategoryPageProps) {
  const [category, setCategory] = useState<Category | null>(null);
  const [parentCategory, setParentCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      fetchCategoryData();
    }
  }, [slug]);

  const fetchCategoryData = async () => {
    try {
      // Fetch category details
      const categoryRes = await fetch(`/api/categories?slug=${slug}`);
      if (categoryRes.ok) {
        const categoryData = await categoryRes.json();
        const cat = categoryData.categories?.[0];
        setCategory(cat);

        if (cat) {
          // Fetch parent category if exists
          if (cat.parentId) {
            const parentRes = await fetch(`/api/categories/${cat.parentId}`);
            if (parentRes.ok) {
              const parentData = await parentRes.json();
              setParentCategory(parentData.category);
            }
          }

          // Fetch subcategories
          const subRes = await fetch(`/api/categories?parentId=${cat._id}`);
          if (subRes.ok) {
            const subData = await subRes.json();
            setSubcategories(subData.categories || []);
          }

          // Fetch products
          const productsRes = await fetch(`/api/products?category=${cat.slug}&limit=12`);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-brand-orange mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading category...</p>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Category Not Found</h2>
          <p className="text-gray-600 mb-6">The category you're looking for doesn't exist.</p>
          <Link href="/" className="btn-primary inline-block">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      {/* Banner Section */}
      <div className="relative h-64 md:h-80 lg:h-96 overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800">
        {category.banner && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40"
            style={{ backgroundImage: `url(${category.banner})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        <div className="relative h-full max-w-7xl mx-auto px-4 flex flex-col justify-end pb-8 md:pb-12">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-white/80 text-sm mb-4">
            <Link href="/" className="hover:text-white transition-colors flex items-center">
              <Home className="w-4 h-4" />
            </Link>
            <ChevronRight className="w-4 h-4" />
            {parentCategory && (
              <>
                <Link href={`/categories/${parentCategory.slug}`} className="hover:text-white transition-colors">
                  {parentCategory.name}
                </Link>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
            <span className="text-white font-medium">{category.name}</span>
          </nav>

          {/* Category Info */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 md:mb-4">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-lg md:text-xl text-white/90 max-w-2xl">
              {category.description}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Subcategories */}
        {subcategories.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-brand-black mb-6">
              Browse Subcategories
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {subcategories.map((subcat) => (
                <Link
                  key={subcat._id}
                  href={`/categories/${subcat.slug}`}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  {subcat.image ? (
                    <div className="aspect-square relative overflow-hidden">
                      <img
                        src={subcat.image}
                        alt={subcat.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <Package className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-brand-black group-hover:text-brand-orange transition-colors">
                        {subcat.name}
                      </h3>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-orange transition-colors" />
                    </div>
                    {subcat.description && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {subcat.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Products */}
        {products.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-brand-black">
                {subcategories.length > 0 ? 'Featured Products' : 'Products'}
              </h2>
              <Link
                href={`/products?category=${category.slug}`}
                className="text-brand-orange hover:text-orange-600 font-semibold flex items-center text-sm md:text-base"
              >
                View All
                <ChevronRight className="w-5 h-5 ml-1" />
              </Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map((product) => (
                <Link
                  key={product._id}
                  href={`/products/${product.slug}`}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  <div className="aspect-square relative overflow-hidden bg-gray-100">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-16 h-16 text-gray-300" />
                      </div>
                    )}
                    {product.onSpecial && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 md:px-3 py-1 rounded-full">
                        SPECIAL
                      </span>
                    )}
                    {product.stockLevel <= 0 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="bg-white text-gray-900 text-sm font-bold px-4 py-2 rounded-lg">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3 md:p-4">
                    <h3 className="font-semibold text-sm md:text-base text-brand-black mb-2 line-clamp-2 group-hover:text-brand-orange transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-lg md:text-xl font-bold text-brand-orange">
                        R{(product.specialPrice || product.price).toFixed(2)}
                      </span>
                      {product.compareAtPrice && product.compareAtPrice > (product.specialPrice || product.price) && (
                        <span className="text-xs md:text-sm text-gray-500 line-through">
                          R{product.compareAtPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* No Content Message */}
        {products.length === 0 && subcategories.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Yet</h3>
            <p className="text-gray-600 mb-6">Check back soon for products in this category!</p>
            <Link href="/" className="btn-primary inline-block">
              Continue Shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
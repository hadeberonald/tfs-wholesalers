'use client'
import { useState, useEffect } from 'react';
import { ChevronRight, Package } from 'lucide-react';

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
          // Fetch subcategories
          const subRes = await fetch(`/api/categories?parentId=${cat._id}`);
          if (subRes.ok) {
            const subData = await subRes.json();
            setSubcategories(subData.categories || []);
          }

          // Fetch products (featured products only, limit to 4)
          const productsRes = await fetch(`/api/products?category=${cat.slug}&featured=true&limit=4`);
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
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4 animate-pulse" />
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
          <p className="text-gray-600">The category you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      {/* Banner Section */}
      {category.banner && (
        <div className="relative h-96 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${category.banner})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          
          <div className="relative h-full max-w-7xl mx-auto px-4 flex flex-col justify-end pb-12">
            <h1 className="text-6xl font-bold text-white mb-4">{category.name}</h1>
            {category.description && (
              <p className="text-xl text-white/90 max-w-2xl">{category.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Subcategories */}
        {subcategories.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-brand-black mb-6">Browse by Subcategory</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {subcategories.map((subcat) => (
                <a
                  key={subcat._id}
                  href={`/categories/${subcat.slug}`}
                  className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  {subcat.image && (
                    <img
                      src={subcat.image}
                      alt={subcat.name}
                      className="w-full h-32 object-cover rounded-lg mb-4"
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-brand-black group-hover:text-brand-orange transition-colors">
                      {subcat.name}
                    </h3>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-orange transition-colors" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Featured Products */}
        {products.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-brand-black">Featured Products</h2>
              <a
                href={`/products?category=${category.slug}`}
                className="text-brand-orange hover:text-orange-600 font-semibold flex items-center"
              >
                View All
                <ChevronRight className="w-5 h-5 ml-1" />
              </a>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map((product) => (
                <a
                  key={product._id}
                  href={`/products/${product.slug}`}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  <div className="aspect-square relative overflow-hidden">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <Package className="w-16 h-16 text-gray-300" />
                      </div>
                    )}
                    {product.onSpecial && (
                      <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                        SPECIAL
                      </span>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-semibold text-brand-black mb-2 line-clamp-2 group-hover:text-brand-orange transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-xl font-bold text-brand-orange">
                        R{(product.specialPrice || product.price).toFixed(2)}
                      </span>
                      {product.compareAtPrice && product.compareAtPrice > (product.specialPrice || product.price) && (
                        <span className="text-sm text-gray-500 line-through">
                          R{product.compareAtPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* No Products Message */}
        {products.length === 0 && subcategories.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Yet</h3>
            <p className="text-gray-600">Check back soon for products in this category!</p>
          </div>
        )}
      </div>
    </div>
  );
}
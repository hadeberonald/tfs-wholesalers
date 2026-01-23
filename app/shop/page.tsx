'use client'
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Filter, Package, ChevronDown, ChevronRight, SlidersHorizontal, Home } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { useCartStore } from '@/lib/store';
import toast from 'react-hot-toast';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  banner?: string;
  active: boolean;
  parentId?: string | null;
  children?: Category[];
}

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
  description?: string;
}

export default function ShopPage() {
  const searchParams = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [parentCategory, setParentCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryFromUrl || 'all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string>('featured');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { addItem } = useCartStore();

  // Update selected category when URL changes
  useEffect(() => {
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl);
    } else {
      setSelectedCategory('all');
    }
  }, [categoryFromUrl]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchCategoryDetails();
    fetchProducts();
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories?withChildren=true');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchCategoryDetails = async () => {
    if (selectedCategory === 'all') {
      setCurrentCategory(null);
      setParentCategory(null);
      setSubcategories([]);
      return;
    }

    try {
      // Fetch current category details
      const categoryRes = await fetch(`/api/categories?slug=${selectedCategory}`);
      if (categoryRes.ok) {
        const categoryData = await categoryRes.json();
        const cat = categoryData.categories?.[0];
        setCurrentCategory(cat);

        if (cat) {
          // Fetch parent category if exists
          if (cat.parentId) {
            const parentRes = await fetch(`/api/categories/${cat.parentId}`);
            if (parentRes.ok) {
              const parentData = await parentRes.json();
              setParentCategory(parentData.category);
            }
          } else {
            setParentCategory(null);
          }

          // Fetch subcategories
          const subRes = await fetch(`/api/categories?parentId=${cat._id}`);
          if (subRes.ok) {
            const subData = await subRes.json();
            setSubcategories(subData.categories || []);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch category details:', error);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const url = selectedCategory === 'all'
        ? '/api/products'
        : `/api/products?category=${selectedCategory}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const activeProducts = (data.products || []).filter(
          (p: Product) => p.active && p.stockLevel > 0
        );
        setProducts(activeProducts);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleCategorySelect = (slug: string) => {
    setSelectedCategory(slug);
    setShowMobileFilters(false);
    
    // Update URL
    const url = new URL(window.location.href);
    if (slug === 'all') {
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('category', slug);
    }
    window.history.pushState({}, '', url);
  };

  const renderCategoryFilter = (category: Category, level: number = 0): JSX.Element => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category._id);
    const isSelected = selectedCategory === category.slug;

    return (
      <div key={category._id} className={level > 0 ? 'ml-4' : ''}>
        <button
          onClick={() => {
            handleCategorySelect(category.slug);
            if (hasChildren) {
              toggleCategory(category._id);
            }
          }}
          className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
            isSelected
              ? 'bg-brand-orange text-white'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
        >
          <div className="flex items-center space-x-2 flex-1">
            <span className="text-sm font-medium">
              {category.name}
            </span>
          </div>
          {hasChildren && (
            <span onClick={(e) => {
              e.stopPropagation();
              toggleCategory(category._id);
            }}>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </span>
          )}
        </button>
        
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {category.children?.map(child => renderCategoryFilter(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Filter and sort products
  let filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort products
  switch (sortBy) {
    case 'price-low':
      filteredProducts.sort((a, b) => (a.specialPrice || a.price) - (b.specialPrice || b.price));
      break;
    case 'price-high':
      filteredProducts.sort((a, b) => (b.specialPrice || b.price) - (a.specialPrice || a.price));
      break;
    case 'name':
      filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'featured':
    default:
      break;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className={`max-w-7xl mx-auto px-4 py-8 pt-24`}>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-brand-black mb-2">
            {currentCategory?.name || 'All Products'}
          </h1>
          <p className="text-gray-600">
            {currentCategory?.description || 'Browse our wide selection of quality wholesale products'}
          </p>
        </div>

        {/* Subcategories Grid - Removed */}

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar Filters - Desktop */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
              <h3 className="font-bold text-lg text-brand-black mb-4 flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                Categories
              </h3>
              
              <div className="space-y-1">
                <button
                  onClick={() => handleCategorySelect('all')}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-brand-orange text-white'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className="text-sm font-medium">All Categories</span>
                </button>
                
                {categories.map(category => renderCategoryFilter(category))}
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="lg:col-span-3">
            {/* Search & Filters Bar */}
            <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Sort */}
                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent bg-white"
                  >
                    <option value="featured">Featured</option>
                    <option value="name">Name (A-Z)</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>

                  {/* Mobile Filter Button */}
                  <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className="lg:hidden px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <SlidersHorizontal className="w-5 h-5" />
                    <span>Filters</span>
                  </button>
                </div>
              </div>

              {/* Results Count */}
              <div className="mt-4 text-sm text-gray-600">
                Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
                {currentCategory && ` in ${currentCategory.name}`}
              </div>
            </div>

            {/* Mobile Filters */}
            {showMobileFilters && (
              <div className="lg:hidden bg-white rounded-2xl p-6 shadow-sm mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-brand-black flex items-center">
                    <Filter className="w-5 h-5 mr-2" />
                    Categories
                  </h3>
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>
                
                <div className="space-y-1">
                  <button
                    onClick={() => handleCategorySelect('all')}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-brand-orange text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span className="text-sm font-medium">All Categories</span>
                  </button>
                  
                  {categories.map(category => renderCategoryFilter(category))}
                </div>
              </div>
            )}

            {/* Products Grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-white rounded-2xl h-96 animate-pulse" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm 
                    ? 'Try adjusting your search or filters' 
                    : 'No products available in this category'}
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    handleCategorySelect('all');
                  }}
                  className="btn-secondary"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
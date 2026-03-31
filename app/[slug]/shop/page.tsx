'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useBranch } from '@/lib/branch-context';
import ProductCard from '@/components/ProductCard';
import { Search, ChevronDown, X, ChevronLeft, ChevronRight } from 'lucide-react';

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
  categories?: string[];
}

interface Category {
  _id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  level: number;
  children?: Category[];
}

const ITEMS_PER_PAGE = 25;

export default function ShopPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { branch, loading: branchLoading } = useBranch();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'price-asc' | 'price-desc'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Initialize from URL params
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    const pageParam = searchParams.get('page');
    if (categoryParam) setSelectedCategory(categoryParam);
    if (pageParam) setCurrentPage(parseInt(pageParam));
  }, [searchParams]);

  useEffect(() => {
    if (!branchLoading && branch) {
      fetchCategories();
    }
  }, [branchLoading, branch]);

  // Guard fetchProducts with isSearchMode so search results are never overwritten
  useEffect(() => {
    if (!branchLoading && branch && !isSearchMode) {
      fetchProducts();
    }
  }, [branchLoading, branch, selectedCategory, sortBy, currentPage, isSearchMode]);

  const fetchCategories = async () => {
    if (!branch) return;
    try {
      const res = await fetch(`/api/categories?branchId=${branch.id}&withChildren=true`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchProducts = async () => {
    if (!branch) return;
    setLoading(true);
    try {
      let url = `/api/products?branchId=${branch.id}&page=${currentPage}&limit=${ITEMS_PER_PAGE}`;

      if (selectedCategory) {
        url += `&category=${selectedCategory}`;
      }

      if (sortBy !== 'newest') {
        url += `&sort=${sortBy}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setTotalProducts(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch) return;

    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery || trimmedQuery.length < 2) {
      setIsSearchMode(false);
      setSearchQuery('');
      setCurrentPage(1);
      return;
    }

    setIsSearchMode(true);
    setLoading(true);
    try {
      // ✅ Correct path: /api/products/search
      const res = await fetch(
        `/api/products/search?q=${encodeURIComponent(trimmedQuery)}&branchId=${branch.id}`
      );
      if (res.ok) {
        const data = await res.json();
        const searchResults = applySorting(data.products || []);
        setProducts(searchResults);
        setTotalProducts(searchResults.length);
        setCurrentPage(1);
      } else {
        console.error('Search failed with status:', res.status);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const applySorting = (productList: Product[]) => {
    const sorted = [...productList];
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price-asc':
        sorted.sort((a, b) => (a.specialPrice || a.price) - (b.specialPrice || b.price));
        break;
      case 'price-desc':
        sorted.sort((a, b) => (b.specialPrice || b.price) - (a.specialPrice || a.price));
        break;
      default:
        break;
    }
    return sorted;
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setShowCategoryDropdown(false);
    setCategorySearchQuery('');
    setCurrentPage(1);
    setIsSearchMode(false);
    setSearchQuery('');

    if (categoryId) {
      router.push(`/${branch?.slug}/shop?category=${categoryId}`);
    } else {
      router.push(`/${branch?.slug}/shop`);
    }
  };

  const clearFilters = () => {
    setSelectedCategory('');
    setSearchQuery('');
    setSortBy('newest');
    setCurrentPage(1);
    setIsSearchMode(false);
    router.push(`/${branch?.slug}/shop`);
  };

  const flattenCategories = (
    cats: Category[],
    level: number = 0
  ): Array<{ category: Category; level: number }> => {
    let result: Array<{ category: Category; level: number }> = [];
    cats.forEach(cat => {
      result.push({ category: cat, level });
      if (cat.children && cat.children.length > 0) {
        result = result.concat(flattenCategories(cat.children, level + 1));
      }
    });
    return result;
  };

  const flatCategories = flattenCategories(categories);
  const filteredCategories = flatCategories.filter(({ category }) =>
    category.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  const selectedCategoryName =
    flatCategories.find(({ category }) => category._id === selectedCategory)?.category.name ||
    'All Categories';

  const activeFiltersCount = [selectedCategory, searchQuery].filter(Boolean).length;
  const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (branchLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Branch Not Found</h1>
          <p className="text-gray-600">The requested branch could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-brand-black mb-2">Shop {branch.displayName}</h1>
          <p className="text-gray-600">Browse our wide selection of quality products</p>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-brand-orange text-white rounded-xl hover:bg-orange-600 transition-colors font-semibold whitespace-nowrap"
              >
                Search
              </button>
            </form>

            {/* Category Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full md:w-64 px-4 py-3 bg-brand-orange text-white rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-between font-semibold"
              >
                <span className="truncate">{selectedCategoryName}</span>
                <ChevronDown
                  className={`w-5 h-5 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              {showCategoryDropdown && (
                <div className="absolute top-full mt-2 w-full md:w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden">
                  <div className="p-3 border-b border-gray-200">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        value={categorySearchQuery}
                        onChange={(e) => setCategorySearchQuery(e.target.value)}
                        placeholder="Search categories..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    <button
                      onClick={() => handleCategorySelect('')}
                      className={`w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors ${
                        !selectedCategory
                          ? 'bg-orange-50 text-brand-orange font-semibold'
                          : 'text-gray-700'
                      }`}
                    >
                      All Categories
                    </button>

                    {filteredCategories.length > 0 ? (
                      filteredCategories.map(({ category, level }) => (
                        <button
                          key={category._id}
                          onClick={() => handleCategorySelect(category._id)}
                          className={`w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors ${
                            selectedCategory === category._id
                              ? 'bg-orange-50 text-brand-orange font-semibold'
                              : 'text-gray-700'
                          }`}
                          style={{ paddingLeft: `${(level + 1) * 16}px` }}
                        >
                          {level > 0 && (
                            <span className="text-gray-400 mr-2">{'└ '.repeat(level)}</span>
                          )}
                          {category.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center text-gray-500">No categories found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent bg-white"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="name">Sort: A-Z</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>

          {/* Active Filters */}
          {activeFiltersCount > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Active filters:</span>

              {selectedCategory && (
                <button
                  onClick={() => handleCategorySelect('')}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-brand-orange/10 text-brand-orange rounded-full text-sm hover:bg-brand-orange/20 transition-colors"
                >
                  {selectedCategoryName}
                  <X className="w-3 h-3" />
                </button>
              )}

              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchMode(false);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-brand-orange/10 text-brand-orange rounded-full text-sm hover:bg-brand-orange/20 transition-colors"
                >
                  Search: &quot;{searchQuery}&quot;
                  <X className="w-3 h-3" />
                </button>
              )}

              <button
                onClick={clearFilters}
                className="text-sm text-brand-orange hover:text-orange-600 font-semibold ml-auto"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results Count */}
        {!loading && (
          <div className="mb-4">
            <p className="text-gray-600">
              {totalProducts} {totalProducts === 1 ? 'product' : 'products'} found
              {totalPages > 1 && !isSearchMode && ` (Page ${currentPage} of ${totalPages})`}
            </p>
          </div>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-96 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-gray-500">No products found</p>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-4 text-brand-orange hover:text-orange-600 font-semibold"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>

            {/* Pagination — hidden in search mode */}
            {totalPages > 1 && !isSearchMode && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`px-4 py-2 rounded-lg ${
                            currentPage === page
                              ? 'bg-brand-orange text-white'
                              : 'border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="px-2">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useBranch } from '@/lib/branch-context';
import ProductCard from '@/components/ProductCard';
import { Search, ChevronDown, X, Loader2, Shuffle } from 'lucide-react';

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
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { branch, loading: branchLoading } = useBranch();

  const [products, setProducts]           = useState<Product[]>([]);
  const [categories, setCategories]       = useState<Category[]>([]);
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery]   = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'newest' | 'name' | 'price-asc' | 'price-desc'>('default');
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasMore, setHasMore]             = useState(false);
  const [isSearchMode, setIsSearchMode]   = useState(false);

  // For random pagination: track IDs already shown so backend can exclude them
  const seenIdsRef = useRef<Set<string>>(new Set());

  const searchDebounceRef = useRef<NodeJS.Timeout>();

  // ── Init from URL ────────────────────────────────────────────────────────
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) setSelectedCategory(categoryParam);
  }, [searchParams]);

  useEffect(() => {
    if (!branchLoading && branch) fetchCategories();
  }, [branchLoading, branch]);

  // ── Main product fetch (fresh load) ─────────────────────────────────────
  useEffect(() => {
    if (!branchLoading && branch && !isSearchMode) {
      seenIdsRef.current = new Set();
      setProducts([]);
      fetchProducts(false);
    }
  }, [branchLoading, branch, selectedCategory, sortBy, isSearchMode]);

  // ── Debounced auto-search ────────────────────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const trimmed = searchQuery.trim();

    if (!trimmed || trimmed.length < 2) {
      if (isSearchMode) setIsSearchMode(false);
      return;
    }

    searchDebounceRef.current = setTimeout(() => performSearch(trimmed), 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  // ── Fetch helpers ────────────────────────────────────────────────────────

  const buildUrl = () => {
    let url = `/api/products?branchId=${branch!.id}&limit=${ITEMS_PER_PAGE}`;
    if (selectedCategory) url += `&category=${selectedCategory}`;

    if (sortBy === 'default') {
      url += `&sort=random`;
      // Pass already-seen IDs so backend excludes them → no duplicates across pages
      const seen = Array.from(seenIdsRef.current);
      if (seen.length > 0) url += `&excludeIds=${seen.join(',')}`;
    } else if (sortBy === 'newest') {
      // no extra sort param — API defaults to createdAt desc
    } else {
      url += `&sort=${sortBy}`;
    }

    return url;
  };

  const fetchProducts = async (append: boolean) => {
    if (!branch) return;
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const res = await fetch(buildUrl());
      if (res.ok) {
        const data = await res.json();
        const incoming: Product[] = data.products || [];

        // Track seen IDs for random pagination deduplication
        incoming.forEach(p => seenIdsRef.current.add(p._id));

        setProducts(prev => append ? [...prev, ...incoming] : incoming);

        if (sortBy === 'default') {
          // For random mode, hasMore = there are still unseen products left
          setHasMore(data.hasMore ?? false);
          // total here = remaining products (excluding seen), so show grand total differently
          setTotalProducts((data.total ?? 0) + seenIdsRef.current.size);
        } else {
          setTotalProducts(data.total || 0);
          setHasMore(data.page < (data.totalPages || 1));
        }
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  };

  const performSearch = async (query: string) => {
    if (!branch) return;
    setIsSearchMode(true);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/products/search?q=${encodeURIComponent(query)}&branchId=${branch.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setTotalProducts((data.products || []).length);
        setHasMore(false);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!branch) return;
    try {
      const res = await fetch(`/api/categories?branchId=${branch.id}&withChildren=true`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (err) { console.error('Failed to fetch categories:', err); }
  };

  // ── Category helpers ─────────────────────────────────────────────────────

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setShowCategoryDropdown(false);
    setCategorySearchQuery('');
    setIsSearchMode(false);
    setSearchQuery('');
    if (categoryId) router.push(`/${branch?.slug}/shop?category=${categoryId}`);
    else router.push(`/${branch?.slug}/shop`);
  };

  const clearFilters = () => {
    setSelectedCategory('');
    setSearchQuery('');
    setSortBy('default');
    setIsSearchMode(false);
    router.push(`/${branch?.slug}/shop`);
  };

  const flattenCategories = (
    cats: Category[], level = 0
  ): Array<{ category: Category; level: number }> => {
    let result: Array<{ category: Category; level: number }> = [];
    cats.forEach(cat => {
      result.push({ category: cat, level });
      if (cat.children?.length) result = result.concat(flattenCategories(cat.children, level + 1));
    });
    return result;
  };

  const flatCategories      = flattenCategories(categories);
  const filteredCategories  = flatCategories.filter(({ category }) =>
    category.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );
  const selectedCategoryName =
    flatCategories.find(({ category }) => category._id === selectedCategory)?.category.name ||
    'All Categories';

  const activeFiltersCount = [selectedCategory, searchQuery].filter(Boolean).length;

  // ── Early returns ────────────────────────────────────────────────────────

  if (branchLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
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

  // ── Render ───────────────────────────────────────────────────────────────

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

            {/* Auto-search input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              {isSearchMode && loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 animate-spin" />
              )}
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products…"
                className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setIsSearchMode(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full md:w-56 px-4 py-3 bg-brand-orange text-white rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-between font-semibold"
              >
                <span className="truncate">{selectedCategoryName}</span>
                <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showCategoryDropdown && (
                <div className="absolute top-full mt-2 w-full md:w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden">
                  <div className="p-3 border-b border-gray-200">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        value={categorySearchQuery}
                        onChange={e => setCategorySearchQuery(e.target.value)}
                        placeholder="Search categories..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <button
                      onClick={() => handleCategorySelect('')}
                      className={`w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors text-sm ${!selectedCategory ? 'bg-orange-50 text-brand-orange font-semibold' : 'text-gray-700'}`}
                    >
                      All Categories
                    </button>
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map(({ category, level }) => (
                        <button
                          key={category._id}
                          onClick={() => handleCategorySelect(category._id)}
                          className={`w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors text-sm ${selectedCategory === category._id ? 'bg-orange-50 text-brand-orange font-semibold' : 'text-gray-700'}`}
                          style={{ paddingLeft: `${(level + 1) * 16}px` }}
                        >
                          {level > 0 && <span className="text-gray-400 mr-1">{'└ '.repeat(level)}</span>}
                          {category.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center text-gray-500 text-sm">No categories found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => {
                setSortBy(e.target.value as any);
                setIsSearchMode(false);
                setSearchQuery('');
              }}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange bg-white text-sm"
            >
              <option value="default">Sort: Default</option>
              <option value="newest">Sort: Newest First</option>
              <option value="name">Sort: A–Z</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>

          {/* Active filters */}
          {activeFiltersCount > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Active filters:</span>
              {selectedCategory && (
                <button
                  onClick={() => handleCategorySelect('')}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-brand-orange/10 text-brand-orange rounded-full text-sm hover:bg-brand-orange/20 transition-colors"
                >
                  {selectedCategoryName}<X className="w-3 h-3" />
                </button>
              )}
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setIsSearchMode(false); }}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-brand-orange/10 text-brand-orange rounded-full text-sm hover:bg-brand-orange/20 transition-colors"
                >
                  &ldquo;{searchQuery}&rdquo;<X className="w-3 h-3" />
                </button>
              )}
              <button onClick={clearFilters} className="text-sm text-brand-orange hover:text-orange-600 font-semibold ml-auto">
                Clear all
              </button>
            </div>
          )}

          {/* Search mode indicator */}
          {isSearchMode && !loading && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-orange-500">{products.length}</span> results for &ldquo;{searchQuery}&rdquo;
              </p>
              <button
                onClick={() => { setSearchQuery(''); setIsSearchMode(false); }}
                className="text-xs text-orange-500 hover:text-orange-700 font-semibold"
              >
                Clear search
              </button>
            </div>
          )}
        </div>

        {/* Results count */}
        {!loading && (
          <div className="mb-4 flex items-center gap-2">
            <p className="text-gray-600 text-sm">
              {isSearchMode
                ? `${products.length} ${products.length === 1 ? 'product' : 'products'} found`
                : `${totalProducts} ${totalProducts === 1 ? 'product' : 'products'} · showing ${products.length}`
              }
            </p>
            {sortBy === 'default' && !isSearchMode && !loading && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Shuffle className="w-3 h-3" /> 
              </span>
            )}
          </div>
        )}

        {/* Products Grid */}
        {loading && products.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-96 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-gray-500">No products found</p>
            {activeFiltersCount > 0 && (
              <button onClick={clearFilters} className="mt-4 text-brand-orange hover:text-orange-600 font-semibold">
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

            {/* Load More */}
            {!isSearchMode && (
              <div className="mt-10 flex flex-col items-center gap-3">
                {hasMore ? (
                  <button
                    onClick={() => fetchProducts(true)}
                    disabled={loadingMore}
                    className="px-8 py-3 bg-brand-orange text-white font-semibold rounded-xl hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      'Load More'
                    )}
                  </button>
                ) : (
                  <p className="text-sm text-gray-400">You&apos;ve seen all {totalProducts} products</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
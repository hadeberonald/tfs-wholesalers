// app/(tabs)/shop.tsx
// Changes vs previous version:
//   1. Products tab uses FlatList with infinite scroll (onEndReached) instead of
//      page-prev/next pagination buttons — much smoother UX on mobile.
//   2. Search mode still fetches all results at once (fetchAll=true), same as web.
//   3. Specials/Combos tab is unchanged (already a flat list; no pagination needed).
//   4. "Load more" footer spinner shown while fetching the next page.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronDown, X, ShoppingBag, Tag } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { useLocalSearchParams } from 'expo-router';
import ProductCard from '@/components/ProductCard';
import SpecialCard from '@/components/SpecialCard';
import ComboCard from '@/components/ComboCard';
import api from '@/lib/api';
import type { Product, Category, Special } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP    = 8;
const COLUMN_COUNT = 2;
const CARD_WIDTH  = (SCREEN_WIDTH - 32 - CARD_GAP) / COLUMN_COUNT; // 16px padding each side

interface Combo {
  _id: string;
  name: string;
  slug: string;
  description: string;
  images?: string[];
  items: any[];
  comboPrice: number;
  regularPrice: number;
  stockLevel: number;
  active: boolean;
}

type SortOption = 'newest' | 'name' | 'price-asc' | 'price-desc';

function applySorting(products: Product[], sortBy: SortOption): Product[] {
  const sorted = [...products];
  switch (sortBy) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'price-asc':
      sorted.sort(
        (a, b) =>
          ((a as any).specialPrice || a.price) - ((b as any).specialPrice || b.price),
      );
      break;
    case 'price-desc':
      sorted.sort(
        (a, b) =>
          ((b as any).specialPrice || b.price) - ((a as any).specialPrice || a.price),
      );
      break;
    default:
      break;
  }
  return sorted;
}

const SORT_LABELS: Record<SortOption, string> = {
  newest:       'Newest First',
  name:         'A–Z',
  'price-asc':  'Price: Low → High',
  'price-desc': 'Price: High → Low',
};

// ─── Pair products into rows of 2 for the 2-column grid ──────────────────────
function pairProducts(products: Product[]): Array<[Product, Product | null]> {
  const pairs: Array<[Product, Product | null]> = [];
  for (let i = 0; i < products.length; i += 2) {
    pairs.push([products[i], products[i + 1] ?? null]);
  }
  return pairs;
}

export default function ShopScreen() {
  const params = useLocalSearchParams();
  const branch = useStore((state) => state.branch);

  const initialTab = params.tab === 'specials' ? 'specials' : 'products';
  const [activeTab, setActiveTab] = useState<'products' | 'specials'>(initialTab);

  const [products, setProducts]         = useState<Product[]>([]);
  const [specials, setSpecials]         = useState<Special[]>([]);
  const [combos, setCombos]             = useState<Combo[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [initialLoading, setInitialLoading] = useState(true); // first-page spinner
  const [loadingMore, setLoadingMore]   = useState(false);    // subsequent pages
  const [searchQuery, setSearchQuery]   = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    (params.categoryId as string) || null,
  );
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSortModal, setShowSortModal]         = useState(false);
  const [sortBy, setSortBy]                       = useState<SortOption>('newest');

  // Infinite-scroll state
  const [currentPage, setCurrentPage]   = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const PAGE_SIZE = 20; // sensible page size for infinite scroll

  const [isSearchMode, setIsSearchMode] = useState(false);

  // Track whether a fetch is already in flight to prevent double-fires
  const fetchingRef = useRef(false);

  // ── Tab param sync ────────────────────────────────────────────────────────
  useEffect(() => {
    if (params.tab === 'specials') setActiveTab('specials');
  }, [params.tab]);

  // ── Reset + reload when tab / category / sort changes ────────────────────
  useEffect(() => {
    if (!branch) return;
    loadCategories();

    if (activeTab === 'products') {
      if (!isSearchMode) {
        // Full reset — start from page 1 with a cleared list
        setProducts([]);
        setCurrentPage(1);
        setTotalPages(1);
        fetchPage(1, true);
      }
    } else {
      loadSpecials();
      loadCombos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, selectedCategory, activeTab, sortBy]);

  // ─── Data fetchers ────────────────────────────────────────────────────────

  const loadCategories = async () => {
    try {
      const res = await api.get(`/api/categories?branchId=${branch?._id}`);
      setCategories(res.data.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  /**
   * fetchPage — loads a single page and APPENDS to the product list.
   * @param page        1-based page number to fetch
   * @param isFirstPage pass true to replace the list (reset) rather than append
   */
  const fetchPage = useCallback(
    async (page: number, isFirstPage = false) => {
      if (!branch) return;
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        isFirstPage ? setInitialLoading(true) : setLoadingMore(true);

        let url = `/api/products?branchId=${branch._id}&page=${page}&limit=${PAGE_SIZE}`;
        if (selectedCategory) url += `&category=${selectedCategory}`;
        if (sortBy !== 'newest') url += `&sort=${sortBy}`;

        const res = await api.get(url);
        const incoming: Product[] = res.data.products || [];

        setProducts((prev) => (isFirstPage ? incoming : [...prev, ...incoming]));
        setTotalProducts(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
        setCurrentPage(page);
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setInitialLoading(false);
        setLoadingMore(false);
        fetchingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branch, selectedCategory, sortBy],
  );

  /** Called by FlatList when the user scrolls close to the bottom */
  const handleLoadMore = () => {
    if (isSearchMode) return;          // no pagination in search mode
    if (loadingMore || initialLoading) return;
    if (currentPage >= totalPages)     return;
    fetchPage(currentPage + 1);
  };

  const loadSpecials = async () => {
    try {
      setInitialLoading(true);
      const res = await api.get(`/api/specials?branchId=${branch?._id}&active=true`);
      const now = new Date();
      const activeSpecials = (res.data.specials || []).filter((s: Special) => {
        if (s.startDate && new Date(s.startDate) > now) return false;
        if (s.endDate   && new Date(s.endDate)   < now) return false;
        return s.active;
      });
      setSpecials(activeSpecials);
    } catch (error) {
      console.error('Failed to load specials:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadCombos = async () => {
    try {
      const res = await api.get(`/api/combos?branchId=${branch?._id}&active=true`);
      setCombos(res.data.combos || []);
    } catch (error) {
      console.error('Failed to load combos:', error);
    }
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      handleClearSearch();
      return;
    }
    try {
      setInitialLoading(true);
      setIsSearchMode(true);
      setCommittedQuery(trimmed);

      const res = await api.get(
        `/api/products/search?q=${encodeURIComponent(trimmed)}&branchId=${branch?._id}&fetchAll=true`,
      );
      const results = applySorting(res.data.products || [], sortBy);
      setProducts(results);
      setTotalProducts(results.length);
      setTotalPages(1);
      setCurrentPage(1);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setCommittedQuery('');
    setIsSearchMode(false);
    setProducts([]);
    setCurrentPage(1);
    setTotalPages(1);
    fetchPage(1, true);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const selectedCategoryName = selectedCategory
    ? categories.find((c) => c._id === selectedCategory)?.name
    : 'All Products';

  // ── FlatList render helpers ───────────────────────────────────────────────

  /** Each FlatList item is a row of 2 product cards */
  const productRows = pairProducts(products);

  const renderProductRow = ({ item }: { item: [Product, Product | null] }) => (
    <View style={styles.row}>
      <ProductCard product={item[0]} />
      {item[1] ? (
        <ProductCard product={item[1]} />
      ) : (
        // Empty placeholder so the first card keeps its width
        <View style={{ width: CARD_WIDTH }} />
      )}
    </View>
  );

  /** Footer: spinner while loading more, or "end" message */
  const renderProductFooter = () => {
    if (isSearchMode) return null;
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#FF6B35" />
          <Text style={styles.footerText}>Loading more…</Text>
        </View>
      );
    }
    if (!initialLoading && products.length > 0 && currentPage >= totalPages) {
      return (
        <View style={styles.footerLoader}>
          <Text style={styles.footerEnd}>All {totalProducts} products loaded</Text>
        </View>
      );
    }
    return null;
  };

  const renderProductHeader = () => (
    <View style={styles.filtersContainer}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Search color="#6b7280" size={20} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products… (min. 2 chars)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch}>
            <X color="#6b7280" size={20} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category (browse mode only) */}
      {!isSearchMode && (
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowCategoryModal(true)}
        >
          <Text style={styles.filterButtonText} numberOfLines={1}>
            {selectedCategoryName}
          </Text>
          <ChevronDown color="#fff" size={16} />
        </TouchableOpacity>
      )}

      {/* Sort */}
      <TouchableOpacity style={styles.sortButton} onPress={() => setShowSortModal(true)}>
        <Text style={styles.sortButtonText}>Sort: {SORT_LABELS[sortBy]}</Text>
        <ChevronDown color="#6b7280" size={16} />
      </TouchableOpacity>

      {/* Results info */}
      <View style={styles.resultsInfo}>
        <Text style={styles.resultsText}>
          {isSearchMode
            ? `Search: "${committedQuery}" — ${totalProducts} result${totalProducts !== 1 ? 's' : ''}`
            : `Showing ${products.length} of ${totalProducts} products`}
        </Text>
        {isSearchMode && (
          <TouchableOpacity onPress={handleClearSearch} style={styles.clearSearchBtn}>
            <X color="#FF6B35" size={14} />
            <Text style={styles.clearSearchText}>Clear search</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEmpty = () =>
    initialLoading ? null : (
      <View style={styles.emptyState}>
        <ShoppingBag color="#9ca3af" size={60} />
        <Text style={styles.emptyText}>
          {isSearchMode ? `No products found for "${committedQuery}"` : 'No products found'}
        </Text>
      </View>
    );

  // ─────────────────────────────────────────────────────────────────────────

  if (!branch) {
    return (
      <View style={styles.centerContainer}>
        <ShoppingBag color="#9ca3af" size={60} />
        <Text style={styles.errorText}>Please select a branch</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.tabActive]}
          onPress={() => setActiveTab('products')}
        >
          <ShoppingBag color={activeTab === 'products' ? '#FF6B35' : '#6b7280'} size={20} />
          <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>
            Products
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'specials' && styles.tabActive]}
          onPress={() => setActiveTab('specials')}
        >
          <Tag color={activeTab === 'specials' ? '#FF6B35' : '#6b7280'} size={20} />
          <Text style={[styles.tabText, activeTab === 'specials' && styles.tabTextActive]}>
            Specials & Combos
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Products Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'products' && (
        <>
          {initialLoading && products.length === 0 ? (
            // First load — show full-screen spinner so the FlatList doesn't flash empty
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
            </View>
          ) : (
            <FlatList
              data={productRows}
              keyExtractor={(_, index) => `row-${index}`}
              renderItem={renderProductRow}
              ListHeaderComponent={renderProductHeader}
              ListFooterComponent={renderProductFooter}
              ListEmptyComponent={renderEmpty}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.4}   // start fetching when 40% from the bottom
              contentContainerStyle={styles.flatListContent}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews            // free memory for off-screen cards
            />
          )}
        </>
      )}

      {/* ── Specials & Combos Tab ─────────────────────────────────────────── */}
      {activeTab === 'specials' && (
        <>
          {initialLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
            </View>
          ) : (
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.content}>
                {specials.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Special Offers</Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{specials.length}</Text>
                      </View>
                    </View>
                    <View style={styles.productGrid}>
                      {specials.map((special) => (
                        <SpecialCard key={special._id} special={special} />
                      ))}
                    </View>
                  </View>
                )}

                {combos.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Combo Deals</Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{combos.length}</Text>
                      </View>
                    </View>
                    <View style={styles.productGrid}>
                      {combos.map((combo) => (
                        <ComboCard key={combo._id} combo={combo} />
                      ))}
                    </View>
                  </View>
                )}

                {specials.length === 0 && combos.length === 0 && (
                  <View style={styles.emptyState}>
                    <Tag color="#9ca3af" size={60} />
                    <Text style={styles.emptyText}>No special offers available</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </>
      )}

      {/* ── Category Modal ────────────────────────────────────────────────── */}
      <Modal
        visible={showCategoryModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.dropdownMenu}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)} style={styles.dropdownClose}>
                <X color="#6b7280" size={20} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.dropdownItem, !selectedCategory && styles.dropdownItemActive]}
                onPress={() => {
                  setSelectedCategory(null);
                  setShowCategoryModal(false);
                }}
              >
                <Text style={styles.dropdownItemText}>All Products</Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat._id}
                  style={[
                    styles.dropdownItem,
                    selectedCategory === cat._id && styles.dropdownItemActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat._id);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Sort Modal ────────────────────────────────────────────────────── */}
      <Modal
        visible={showSortModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={[styles.dropdownMenu, styles.dropdownMenuSmall]}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Sort By</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)} style={styles.dropdownClose}>
                <X color="#6b7280" size={20} />
              </TouchableOpacity>
            </View>
            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.dropdownItem, sortBy === option && styles.dropdownItemActive]}
                onPress={() => {
                  setSortBy(option);
                  setShowSortModal(false);
                  if (isSearchMode) {
                    setProducts((prev) => applySorting(prev, option));
                  }
                }}
              >
                <Text style={styles.dropdownItemText}>{SORT_LABELS[option]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f9fafb' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView:      { flex: 1 },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabs:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:    { borderBottomColor: '#FF6B35' },
  tabText:      { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive:{ color: '#FF6B35' },

  // ── Filters header (rendered as FlatList ListHeaderComponent) ─────────────
  filtersContainer: { backgroundColor: '#fff', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginBottom: 16 },
  searchContainer:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  searchInput:      { flex: 1, fontSize: 16, color: '#1f2937' },
  filterButton:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FF6B35', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  filterButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  sortButton:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  sortButtonText:   { color: '#1f2937', fontSize: 15, fontWeight: '600', flex: 1 },
  resultsInfo:      { paddingVertical: 4, gap: 6 },
  resultsText:      { fontSize: 13, color: '#6b7280' },
  clearSearchBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearSearchText:  { fontSize: 13, color: '#FF6B35', fontWeight: '600' },

  // ── FlatList ──────────────────────────────────────────────────────────────
  flatListContent: { paddingBottom: 24 },
  row:             { flexDirection: 'row', gap: CARD_GAP, paddingHorizontal: 16, marginBottom: CARD_GAP },

  // ── Footer ────────────────────────────────────────────────────────────────
  footerLoader: { paddingVertical: 20, alignItems: 'center', gap: 8 },
  footerText:   { fontSize: 13, color: '#6b7280' },
  footerEnd:    { fontSize: 13, color: '#9ca3af' },

  // ── Empty / error ─────────────────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText:  { fontSize: 16, color: '#6b7280', marginTop: 16, textAlign: 'center' },
  errorText:  { fontSize: 16, color: '#9ca3af', marginTop: 12 },

  // ── Specials / combos (ScrollView) ────────────────────────────────────────
  content:      { padding: 16, paddingTop: 0 },
  section:      { marginBottom: 24 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  badge:        { backgroundColor: '#FF6B35', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText:    { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  productGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // ── Modals ────────────────────────────────────────────────────────────────
  dropdownOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', paddingTop: 220, paddingHorizontal: 16 },
  dropdownMenu:      { backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, maxHeight: 400, paddingBottom: 8 },
  dropdownMenuSmall: { maxHeight: 260 },
  dropdownHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  dropdownTitle:     { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  dropdownClose:     { padding: 4 },
  dropdownScroll:    { paddingVertical: 4 },
  dropdownItem:      { paddingVertical: 14, paddingHorizontal: 16, marginHorizontal: 8, marginVertical: 2, borderRadius: 8 },
  dropdownItemActive:{ backgroundColor: '#fef3e9' },
  dropdownItemText:  { fontSize: 16, color: '#1f2937', fontWeight: '500' },
});
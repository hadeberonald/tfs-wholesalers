// app/(tabs)/shop.tsx
import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
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
const CARD_GAP     = 8;
const COLUMN_COUNT = 2;
const CARD_WIDTH   = (SCREEN_WIDTH - 32 - CARD_GAP) / COLUMN_COUNT;

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

function pairProducts(products: Product[]): Array<[Product, Product | null]> {
  const pairs: Array<[Product, Product | null]> = [];
  for (let i = 0; i < products.length; i += 2) {
    pairs.push([products[i], products[i + 1] ?? null]);
  }
  return pairs;
}

// ─── ProductListHeader ────────────────────────────────────────────────────────
const ProductListHeader = memo(({
  searchQuery,
  isSearchMode,
  committedQuery,
  totalProducts,
  productsLength,
  selectedCategoryName,
  sortBy,
  onSearchChange,
  onSearchSubmit,
  onClearSearch,
  onOpenCategory,
  onOpenSort,
}: {
  searchQuery: string;
  isSearchMode: boolean;
  committedQuery: string;
  totalProducts: number;
  productsLength: number;
  selectedCategoryName: string;
  sortBy: SortOption;
  onSearchChange: (text: string) => void;
  onSearchSubmit: () => void;
  onClearSearch: () => void;
  onOpenCategory: () => void;
  onOpenSort: () => void;
}) => (
  <View style={styles.filtersContainer}>
    <View style={styles.searchContainer}>
      <Search color="#6b7280" size={20} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search products… (min. 2 chars)"
        placeholderTextColor="#9ca3af"
        value={searchQuery}
        onChangeText={onSearchChange}
        onSubmitEditing={onSearchSubmit}
        returnKeyType="search"
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={onClearSearch}>
          <X color="#6b7280" size={20} />
        </TouchableOpacity>
      )}
    </View>

    {!isSearchMode && (
      <TouchableOpacity style={styles.filterButton} onPress={onOpenCategory}>
        <Text style={styles.filterButtonText} numberOfLines={1}>
          {selectedCategoryName}
        </Text>
        <ChevronDown color="#fff" size={16} />
      </TouchableOpacity>
    )}

    <TouchableOpacity style={styles.sortButton} onPress={onOpenSort}>
      <Text style={styles.sortButtonText}>Sort: {SORT_LABELS[sortBy]}</Text>
      <ChevronDown color="#6b7280" size={16} />
    </TouchableOpacity>

    <View style={styles.resultsInfo}>
      <Text style={styles.resultsText}>
        {isSearchMode
          ? `Search: "${committedQuery}" — ${totalProducts} result${totalProducts !== 1 ? 's' : ''}`
          : `Showing ${productsLength} of ${totalProducts} products`}
      </Text>
      {isSearchMode && (
        <TouchableOpacity onPress={onClearSearch} style={styles.clearSearchBtn}>
          <X color="#FF6B35" size={14} />
          <Text style={styles.clearSearchText}>Clear search</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
));

// ─── Specials pagination constants ────────────────────────────────────────────
const SPECIALS_PAGE_SIZE = 20;

// ─────────────────────────────────────────────────────────────────────────────

export default function ShopScreen() {
  const params = useLocalSearchParams();
  const branch = useStore((state) => state.branch);

  const initialTab = params.tab === 'specials' ? 'specials' : 'products';
  const [activeTab, setActiveTab] = useState<'products' | 'specials'>(initialTab);

  const [products, setProducts]             = useState<Product[]>([]);
  const [specials, setSpecials]             = useState<Special[]>([]);
  const [combos, setCombos]                 = useState<Combo[]>([]);
  const [categories, setCategories]         = useState<Category[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore]       = useState(false);
  const [loadingMoreSpecials, setLoadingMoreSpecials] = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    (params.categoryId as string) || null,
  );
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSortModal, setShowSortModal]         = useState(false);
  const [sortBy, setSortBy]                       = useState<SortOption>('newest');

  const [currentPage, setCurrentPage]     = useState(1);
  const [totalPages, setTotalPages]       = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const PAGE_SIZE = 20;

  // Specials pagination
  const [specialsPage, setSpecialsPage]             = useState(1);
  const [specialsTotalPages, setSpecialsTotalPages] = useState(1);
  const [specialsTotal, setSpecialsTotal]           = useState(0);

  const [isSearchMode, setIsSearchMode] = useState(false);

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
        setProducts([]);
        setCurrentPage(1);
        setTotalPages(1);
        fetchPage(1, true);
      }
    } else {
      setSpecials([]);
      setSpecialsPage(1);
      setSpecialsTotalPages(1);
      loadSpecials(1, true);
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

  const handleLoadMore = () => {
    if (isSearchMode) return;
    if (loadingMore || initialLoading) return;
    if (currentPage >= totalPages) return;
    fetchPage(currentPage + 1);
  };

  // ── Specials — stock check now mirrors the API's hasAnyStock logic ────────
  const hasAnyStock = (product: any): boolean => {
    if ((product.stockLevel ?? 0) > 0) return true;
    if (Array.isArray(product.variants)) {
      return product.variants.some((v: any) => v.active && v.stockLevel > 0);
    }
    return false;
  };

  const loadSpecials = async (page = 1, isFirstPage = false) => {
    if (!branch) return;
    try {
      isFirstPage ? setInitialLoading(true) : setLoadingMoreSpecials(true);

      const res = await api.get(
        `/api/specials?branchId=${branch._id}&active=true&page=${page}&limit=${SPECIALS_PAGE_SIZE}`,
      );

      const now = new Date();
      const incoming: Special[] = (res.data.specials || []).filter((s: Special) => {
        if (s.startDate && new Date(s.startDate) > now) return false;
        if (s.endDate   && new Date(s.endDate)   < now) return false;
        if (!s.active) return false;
        // Hide if product is missing, inactive, or fully out of stock
        if (!s.product?.active) return false;
        return hasAnyStock(s.product);
      });

      setSpecials((prev) => (isFirstPage ? incoming : [...prev, ...incoming]));
      setSpecialsTotal(res.data.total || 0);
      setSpecialsTotalPages(res.data.totalPages || 1);
      setSpecialsPage(page);
    } catch (error) {
      console.error('Failed to load specials:', error);
    } finally {
      setInitialLoading(false);
      setLoadingMoreSpecials(false);
    }
  };

  const handleLoadMoreSpecials = () => {
    if (loadingMoreSpecials || initialLoading) return;
    if (specialsPage >= specialsTotalPages) return;
    loadSpecials(specialsPage + 1);
  };

  const loadCombos = async () => {
    try {
      const res = await api.get(`/api/combos?branchId=${branch?._id}&active=true`);
      setCombos((res.data.combos || []).filter((c: Combo) => c.stockLevel > 0));
    } catch (error) {
      console.error('Failed to load combos:', error);
    }
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, branch, sortBy]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setCommittedQuery('');
    setIsSearchMode(false);
    setProducts([]);
    setCurrentPage(1);
    setTotalPages(1);
    fetchPage(1, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const selectedCategoryName = selectedCategory
    ? (categories.find((c) => c._id === selectedCategory)?.name ?? 'All Products')
    : 'All Products';

  // ── FlatList render helpers ───────────────────────────────────────────────
  const productRows = pairProducts(products);

  const renderProductRow = ({ item }: { item: [Product, Product | null] }) => (
    <View style={styles.row}>
      <ProductCard product={item[0]} />
      {item[1] ? (
        <ProductCard product={item[1]} />
      ) : (
        <View style={{ width: CARD_WIDTH }} />
      )}
    </View>
  );

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

  const renderEmpty = () =>
    initialLoading ? null : (
      <View style={styles.emptyState}>
        <ShoppingBag color="#9ca3af" size={60} />
        <Text style={styles.emptyText}>
          {isSearchMode ? `No products found for "${committedQuery}"` : 'No products found'}
        </Text>
      </View>
    );

  // ── Specials FlatList helpers ─────────────────────────────────────────────
  const specialRows = pairProducts(specials as any) as any;

  const renderSpecialRow = ({ item }: { item: [Special, Special | null] }) => (
    <View style={styles.row}>
      <SpecialCard special={item[0]} />
      {item[1] ? <SpecialCard special={item[1]} /> : <View style={{ width: CARD_WIDTH }} />}
    </View>
  );

  const renderSpecialsFooter = () => {
    if (loadingMoreSpecials) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#FF6B35" />
          <Text style={styles.footerText}>Loading more specials…</Text>
        </View>
      );
    }
    if (!initialLoading && specials.length > 0 && specialsPage >= specialsTotalPages) {
      return (
        <View style={styles.footerLoader}>
          <Text style={styles.footerEnd}>{specials.length} specials loaded</Text>
        </View>
      );
    }
    return null;
  };

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
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
            </View>
          ) : (
            <FlatList
              data={productRows}
              keyExtractor={(_, index) => `row-${index}`}
              renderItem={renderProductRow}
              ListHeaderComponent={
                <ProductListHeader
                  searchQuery={searchQuery}
                  isSearchMode={isSearchMode}
                  committedQuery={committedQuery}
                  totalProducts={totalProducts}
                  productsLength={products.length}
                  selectedCategoryName={selectedCategoryName}
                  sortBy={sortBy}
                  onSearchChange={handleSearchChange}
                  onSearchSubmit={handleSearch}
                  onClearSearch={handleClearSearch}
                  onOpenCategory={() => setShowCategoryModal(true)}
                  onOpenSort={() => setShowSortModal(true)}
                />
              }
              ListFooterComponent={renderProductFooter}
              ListEmptyComponent={renderEmpty}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.4}
              contentContainerStyle={styles.flatListContent}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
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
            <FlatList
              data={specialRows}
              keyExtractor={(_: any, index: number) => `special-row-${index}`}
              renderItem={renderSpecialRow}
              onEndReached={handleLoadMoreSpecials}
              onEndReachedThreshold={0.4}
              ListHeaderComponent={
                specials.length > 0 ? (
                  <View style={styles.sectionHeaderStandalone}>
                    <Text style={styles.sectionTitle}>Special Offers</Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{specials.length}</Text>
                    </View>
                  </View>
                ) : null
              }
              ListFooterComponent={
                <>
                  {renderSpecialsFooter()}
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
                  {specials.length === 0 && combos.length === 0 && !initialLoading && (
                    <View style={styles.emptyState}>
                      <Tag color="#9ca3af" size={60} />
                      <Text style={styles.emptyText}>No special offers available</Text>
                    </View>
                  )}
                </>
              }
              contentContainerStyle={styles.flatListContent}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
            />
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

  tabs:          { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: '#FF6B35' },
  tabText:       { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#FF6B35' },

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

  flatListContent: { paddingBottom: 24 },
  row:             { flexDirection: 'row', gap: CARD_GAP, paddingHorizontal: 16, marginBottom: CARD_GAP },

  footerLoader: { paddingVertical: 20, alignItems: 'center', gap: 8 },
  footerText:   { fontSize: 13, color: '#6b7280' },
  footerEnd:    { fontSize: 13, color: '#9ca3af' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText:  { fontSize: 16, color: '#6b7280', marginTop: 16, textAlign: 'center' },
  errorText:  { fontSize: 16, color: '#9ca3af', marginTop: 12 },

  content:                { padding: 16, paddingTop: 0 },
  section:                { marginBottom: 24, paddingHorizontal: 16 },
  sectionHeader:          { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sectionHeaderStandalone:{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  sectionTitle:           { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  badge:                  { backgroundColor: '#FF6B35', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText:              { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  productGrid:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  dropdownOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', paddingTop: 220, paddingHorizontal: 16 },
  dropdownMenu:       { backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, maxHeight: 400, paddingBottom: 8 },
  dropdownMenuSmall:  { maxHeight: 260 },
  dropdownHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  dropdownTitle:      { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  dropdownClose:      { padding: 4 },
  dropdownScroll:     { paddingVertical: 4 },
  dropdownItem:       { paddingVertical: 14, paddingHorizontal: 16, marginHorizontal: 8, marginVertical: 2, borderRadius: 8 },
  dropdownItemActive: { backgroundColor: '#fef3e9' },
  dropdownItemText:   { fontSize: 16, color: '#1f2937', fontWeight: '500' },
});
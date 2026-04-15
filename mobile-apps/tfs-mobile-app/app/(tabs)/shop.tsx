// app/(tabs)/shop.tsx  — updated to accept ?tab=specials deep-link param

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronDown, ChevronLeft, ChevronRight, X, ShoppingBag, Tag } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { useLocalSearchParams } from 'expo-router';
import ProductCard from '@/components/ProductCard';
import SpecialCard from '@/components/SpecialCard';
import ComboCard from '@/components/ComboCard';
import api from '@/lib/api';
import type { Product, Category, Special } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

export default function ShopScreen() {
  const params = useLocalSearchParams();
  const branch = useStore((state) => state.branch);

  // ── If the header (or any navigator) passes ?tab=specials, open that tab ──
  const initialTab = params.tab === 'specials' ? 'specials' : 'products';
  const [activeTab, setActiveTab] = useState<'products' | 'specials'>(initialTab);

  const [products, setProducts]   = useState<Product[]>([]);
  const [specials, setSpecials]   = useState<Special[]>([]);
  const [combos, setCombos]       = useState<Combo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    (params.categoryId as string) || null
  );
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showLimitModal, setShowLimitModal]       = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [limit, setLimit]             = useState(25);
  const [isSearching, setIsSearching] = useState(false);

  // ── Re-open the correct tab if the param changes (e.g. user taps Specials
  //    from the header while already on the shop screen) ────────────────────
  useEffect(() => {
    if (params.tab === 'specials') setActiveTab('specials');
  }, [params.tab]);

  useEffect(() => {
    if (branch) {
      loadCategories();
      if (activeTab === 'products') {
        if (isSearching && searchQuery.trim().length >= 2) {
          handleSearch();
        } else {
          loadProducts();
        }
      } else {
        loadSpecials();
        loadCombos();
      }
    }
  }, [branch, selectedCategory, activeTab, currentPage, limit]);

  const loadCategories = async () => {
    try {
      const res = await api.get(`/api/categories?branchId=${branch?._id}`);
      setCategories(res.data.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      let url = `/api/products?branchId=${branch?._id}&page=${currentPage}&limit=${limit}`;
      if (selectedCategory) url += `&category=${selectedCategory}`;
      const res = await api.get(url);
      setProducts(res.data.products || []);
      setTotalProducts(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSpecials = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/specials?branchId=${branch?._id}&active=true`);
      const activeSpecials = (res.data.specials || []).filter((s: Special) => {
        const now = new Date();
        if (s.startDate && new Date(s.startDate) > now) return false;
        if (s.endDate   && new Date(s.endDate)   < now) return false;
        return s.active;
      });
      setSpecials(activeSpecials);
    } catch (error) {
      console.error('Failed to load specials:', error);
    } finally {
      setLoading(false);
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

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setIsSearching(false);
      setCurrentPage(1);
      loadProducts();
      return;
    }
    try {
      setLoading(true);
      setIsSearching(true);
      const res = await api.get(
        `/api/search?q=${encodeURIComponent(searchQuery)}&branchId=${branch?._id}&page=${currentPage}&limit=${limit}`
      );
      setProducts(res.data.products || []);
      setTotalProducts(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setCurrentPage(1);
    loadProducts();
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setCurrentPage(1);
    setShowLimitModal(false);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const selectedCategoryName = selectedCategory
    ? categories.find((c) => c._id === selectedCategory)?.name
    : 'All Products';

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

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {activeTab === 'products' && (
            <>
              {/* Search and Filters */}
              <View style={styles.filtersContainer}>
                <View style={styles.searchContainer}>
                  <Search color="#6b7280" size={20} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search products..."
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

                <View style={styles.filterRow}>
                  <TouchableOpacity
                    style={[styles.filterButton, { flex: 1 }]}
                    onPress={() => setShowCategoryModal(true)}
                  >
                    <Text style={styles.filterButtonText} numberOfLines={1}>{selectedCategoryName}</Text>
                    <ChevronDown color="#fff" size={16} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.limitButton} onPress={() => setShowLimitModal(true)}>
                    <Text style={styles.limitButtonText}>{limit}</Text>
                    <ChevronDown color="#6b7280" size={16} />
                  </TouchableOpacity>
                </View>

                <View style={styles.resultsInfo}>
                  <Text style={styles.resultsText}>
                    {isSearching && `Search: "${searchQuery}" — `}
                    Showing {products.length} of {totalProducts} products
                  </Text>
                </View>
              </View>

              <View style={[styles.content, { marginTop: 16 }]}>
                <View style={styles.productGrid}>
                  {products.length > 0 ? (
                    products.map((product) => (
                      <ProductCard key={product._id} product={product} />
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <ShoppingBag color="#9ca3af" size={60} />
                      <Text style={styles.emptyText}>
                        {isSearching ? 'No products found for your search' : 'No products found'}
                      </Text>
                    </View>
                  )}
                </View>

                {products.length > 0 && totalPages > 1 && (
                  <View style={styles.pagination}>
                    <TouchableOpacity
                      style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                      onPress={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft color={currentPage === 1 ? '#d1d5db' : '#6b7280'} size={20} />
                    </TouchableOpacity>
                    <View style={styles.pageInfo}>
                      <Text style={styles.pageText}>Page {currentPage} of {totalPages}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
                      onPress={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight color={currentPage === totalPages ? '#d1d5db' : '#6b7280'} size={20} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}

          {activeTab === 'specials' && (
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
          )}
        </ScrollView>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
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
                  onPress={() => { setSelectedCategory(null); setCurrentPage(1); setShowCategoryModal(false); }}
                >
                  <Text style={styles.dropdownItemText}>All Products</Text>
                </TouchableOpacity>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category._id}
                    style={[styles.dropdownItem, selectedCategory === category._id && styles.dropdownItemActive]}
                    onPress={() => { setSelectedCategory(category._id); setCurrentPage(1); setShowCategoryModal(false); }}
                  >
                    <Text style={styles.dropdownItemText}>{category.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Limit Modal */}
      {showLimitModal && (
        <Modal
          visible={showLimitModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowLimitModal(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowLimitModal(false)}
          >
            <View style={[styles.dropdownMenu, styles.dropdownMenuSmall]}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>Items Per Page</Text>
                <TouchableOpacity onPress={() => setShowLimitModal(false)} style={styles.dropdownClose}>
                  <X color="#6b7280" size={20} />
                </TouchableOpacity>
              </View>
              {[10, 25, 50].map((limitOption) => (
                <TouchableOpacity
                  key={limitOption}
                  style={[styles.dropdownItem, limit === limitOption && styles.dropdownItemActive]}
                  onPress={() => handleLimitChange(limitOption)}
                >
                  <Text style={styles.dropdownItemText}>{limitOption} items</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#FF6B35' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#FF6B35' },
  filtersContainer: { backgroundColor: '#fff', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  searchInput: { flex: 1, fontSize: 16, color: '#1f2937' },
  filterRow: { flexDirection: 'row', gap: 12 },
  filterButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FF6B35', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  filterButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  limitButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, gap: 8 },
  limitButtonText: { color: '#1f2937', fontSize: 16, fontWeight: '600' },
  resultsInfo: { paddingVertical: 8 },
  resultsText: { fontSize: 13, color: '#6b7280' },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingTop: 0 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  badge: { backgroundColor: '#FF6B35', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emptyState: { width: SCREEN_WIDTH - 32, alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#6b7280', marginTop: 16, textAlign: 'center' },
  errorText: { fontSize: 16, color: '#9ca3af', marginTop: 12 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 16 },
  pageButton: { padding: 12, backgroundColor: '#f3f4f6', borderRadius: 8 },
  pageButtonDisabled: { opacity: 0.3 },
  pageInfo: { paddingHorizontal: 20 },
  pageText: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', paddingTop: 220, paddingHorizontal: 16 },
  dropdownMenu: { backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, maxHeight: 400, paddingBottom: 8 },
  dropdownMenuSmall: { maxHeight: 230 },
  dropdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  dropdownTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  dropdownClose: { padding: 4 },
  dropdownScroll: { paddingVertical: 4 },
  dropdownItem: { paddingVertical: 14, paddingHorizontal: 16, marginHorizontal: 8, marginVertical: 2, borderRadius: 8 },
  dropdownItemActive: { backgroundColor: '#fef3e9' },
  dropdownItemText: { fontSize: 16, color: '#1f2937', fontWeight: '500' },
});
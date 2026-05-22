import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Image, Dimensions, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ShoppingBag, Package, Tag, ArrowRight, Star } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import ProductCard from '@/components/ProductCard';
import SpecialCard from '@/components/SpecialCard';
import ComboCard from '@/components/ComboCard';
import ListedCategoriesStrip from '@/components/ListedCategoriesStrip';
import api from '@/lib/api';
import type { Category, Product, Special } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_WIDTH = SCREEN_WIDTH - 32;

interface Combo {
  _id: string; name: string; slug: string; description: string;
  images?: string[];
  items: { productId: string; variantId?: string; quantity: number }[];
  comboPrice: number; regularPrice: number; stockLevel: number; active: boolean;
}

type FeedItem =
  | { kind: 'special'; data: Special }
  | { kind: 'combo';   data: Combo };

export default function HomeScreen() {
  const router = useRouter();
  const branch = useStore((state) => state.branch);

  const [featuredCategories,  setFeaturedCategories]  = useState<Category[]>([]);
  const [categoryProducts,    setCategoryProducts]    = useState<Record<string, Product[]>>({});
  const [featuredProducts,    setFeaturedProducts]    = useState<Product[]>([]);
  const [featuredSpecials,    setFeaturedSpecials]    = useState<Special[]>([]);
  const [featuredCombos,      setFeaturedCombos]      = useState<Combo[]>([]);
  const [loading,             setLoading]             = useState(true);
  const [activeSlide,         setActiveSlide]         = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => { if (branch) loadData(); }, [branch]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, specialsRes, combosRes, featuredRes] = await Promise.all([
        api.get(`/api/categories?branchId=${branch?._id}&featured=true`),
        api.get(`/api/specials?branchId=${branch?._id}&active=true&featured=true`),
        api.get(`/api/combos?branchId=${branch?._id}&active=true`),
        api.get(`/api/products?branchId=${branch?._id}&featured=true&limit=8`),
      ]);

      const categories = categoriesRes.data.categories || [];
      setFeaturedCategories(categories);

      setFeaturedProducts(featuredRes.data.products || []);

      const now = new Date();
      setFeaturedSpecials(
        (specialsRes.data.specials || [])
          .filter((s: Special) => {
            if (s.startDate && new Date(s.startDate) > now) return false;
            if (s.endDate   && new Date(s.endDate)   < now) return false;
            return s.active;
          })
          .slice(0, 6)
      );

      setFeaturedCombos(
        (combosRes.data.combos || []).filter((c: Combo) => c.stockLevel > 0).slice(0, 4)
      );

      const productsMap: Record<string, Product[]> = {};
      for (const category of categories) {
        const res = await api.get(
          `/api/products?branchId=${branch?._id}&category=${category._id}&limit=4`
        );
        productsMap[category._id] = res.data.products || [];
      }
      setCategoryProducts(productsMap);
    } catch (error) {
      console.error('Failed to load home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (event: any) => {
    setActiveSlide(Math.round(event.nativeEvent.contentOffset.x / CAROUSEL_WIDTH));
  };

  const navigateToCategory = (categoryId: string) =>
    router.push({ pathname: '/(tabs)/shop', params: { categoryId } });

  const dealsFeed: FeedItem[] = [
    ...featuredSpecials.map((s): FeedItem => ({ kind: 'special', data: s })),
    ...featuredCombos.map((c):   FeedItem => ({ kind: 'combo',   data: c })),
  ];

  if (!branch) return (
    <View style={styles.centerContainer}>
      <ShoppingBag color="#9ca3af" size={60} />
      <Text style={styles.errorText}>Please select a branch</Text>
    </View>
  );

  if (loading) return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );

  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

      {/* ── Featured category hero carousel ─────────────────────────────── */}
      {featuredCategories.length > 0 && (
        <View style={styles.carouselContainer}>
          <ScrollView
            ref={scrollViewRef}
            horizontal pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={CAROUSEL_WIDTH + 16}
            snapToAlignment="start"
            contentContainerStyle={styles.carouselContent}
          >
            {featuredCategories.map((category, index) => (
              <TouchableOpacity
                key={category._id}
                style={[
                  styles.carouselSlide,
                  index === 0 && { marginLeft: 16 },
                  index === featuredCategories.length - 1 && { marginRight: 16 },
                ]}
                onPress={() => navigateToCategory(category._id)}
                activeOpacity={0.9}
              >
                {category.banner || category.image ? (
                  <Image source={{ uri: category.banner || category.image }} style={styles.carouselImage} />
                ) : (
                  <View style={[styles.carouselImage, styles.carouselPlaceholder]}>
                    <ShoppingBag color="#FF6B35" size={60} />
                  </View>
                )}
                <LinearGradient
                  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.75)']}
                  style={styles.carouselOverlay}
                  locations={[0, 0.45, 1]}
                >
                  <View style={styles.carouselContentInner}>
                    <Text style={styles.carouselTitle}>{category.name}</Text>
                    {category.description && (
                      <Text style={styles.carouselDescription} numberOfLines={2}>
                        {category.description}
                      </Text>
                    )}
                    <View style={styles.shopNowButton}>
                      <Text style={styles.shopNowText}>Shop Now</Text>
                      <ArrowRight color="#fff" size={16} />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.indicators}>
            {featuredCategories.map((_, i) => (
              <View key={i} style={[styles.indicator, i === activeSlide && styles.indicatorActive]} />
            ))}
          </View>
        </View>
      )}

      {/* ── Listed categories strip ──────────────────────────────────────── */}
      {!!branch._id && (
        <View style={styles.stripSection}>
          <ListedCategoriesStrip branchId={branch._id} />
        </View>
      )}

      {/* ── Deals & Specials ─────────────────────────────────────────────── */}
      {dealsFeed.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Tag color="#FF6B35" size={24} />
              <Text style={styles.sectionTitle}>Deals & Specials</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/shop')}>
              <View style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>View All</Text>
                <ArrowRight color="#FF6B35" size={16} />
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.productGrid}>
            {dealsFeed.map(item =>
              item.kind === 'special'
                ? <SpecialCard key={`special-${item.data._id}`} special={item.data} />
                : <ComboCard   key={`combo-${item.data._id}`}   combo={item.data}   />
            )}
          </View>
        </View>
      )}

      {/* ── Per-category product grids ───────────────────────────────────── */}
      {featuredCategories.map(category => {
        const products = categoryProducts[category._id] || [];
        if (!products.length) return null;
        return (
          <View key={category._id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{category.name}</Text>
              <TouchableOpacity onPress={() => navigateToCategory(category._id)}>
                <View style={styles.viewAllButton}>
                  <Text style={styles.viewAllText}>View All</Text>
                  <ArrowRight color="#FF6B35" size={16} />
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.productGrid}>
              {products.slice(0, 4).map(product => (
                <ProductCard key={product._id} product={product} />
              ))}
            </View>
          </View>
        );
      })}

      {/* ── Featured Products ────────────────────────────────────────────── */}
      {featuredProducts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Star color="#FF6B35" size={22} />
              <Text style={styles.sectionTitle}>Featured Products</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/shop')}>
              <View style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>View All</Text>
                <ArrowRight color="#FF6B35" size={16} />
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.productGrid}>
            {featuredProducts.map(product => (
              <ProductCard key={product._id} product={product} />
            ))}
          </View>
        </View>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {featuredCategories.length === 0 && dealsFeed.length === 0 && featuredProducts.length === 0 && (
        <View style={styles.emptyState}>
          <Package color="#9ca3af" size={60} />
          <Text style={styles.emptyText}>No featured items yet</Text>
          <TouchableOpacity style={styles.shopButton} onPress={() => router.push('/(tabs)/shop')}>
            <Text style={styles.shopButtonText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView:       { flex: 1, backgroundColor: '#f9fafb' },
  centerContainer:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  carouselContainer:    { marginBottom: 0, marginTop: 16 },
  carouselContent:      { gap: 16 },
  carouselSlide:        { width: CAROUSEL_WIDTH, height: 200, borderRadius: 16, overflow: 'hidden' },
  carouselImage:        { width: '100%', height: '100%' },
  carouselPlaceholder:  { backgroundColor: '#fef3e9', alignItems: 'center', justifyContent: 'center' },
  carouselOverlay:      { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, justifyContent: 'flex-end' },
  carouselContentInner: { transform: [{ translateY: 0 }] },
  carouselTitle:        { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  carouselDescription:  { fontSize: 14, color: '#fff', opacity: 0.95 },
  indicators:           { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  indicator:            { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db' },
  indicatorActive:      { width: 24, backgroundColor: '#FF6B35' },

  shopNowButton: {
    marginTop: 14, alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FF6B35', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
  },
  shopNowText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  stripSection: {
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    marginBottom: 8,
  },

  section:               { marginBottom: 24, paddingHorizontal: 16 },
  sectionHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle:          { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  viewAllButton:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllText:           { fontSize: 14, color: '#FF6B35', fontWeight: '600' },
  productGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  emptyState:     { alignItems: 'center', paddingVertical: 60 },
  emptyText:      { fontSize: 16, color: '#6b7280', marginTop: 16, marginBottom: 24 },
  shopButton:     { backgroundColor: '#FF6B35', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  shopButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText:      { fontSize: 16, color: '#9ca3af', marginTop: 12 },
});
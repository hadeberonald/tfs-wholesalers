import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShoppingCart, Plus, Minus, Package, Tag, ArrowLeft, Heart } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/lib/api';
import type { Product, ProductVariant } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ✅ One selector per call — never object literals
  const branch             = useStore((state) => state.branch);
  const addToCart          = useStore((state) => state.addToCart);
  const addToWishlist      = useStore((state) => state.addToWishlist);
  const removeFromWishlist = useStore((state) => state.removeFromWishlist);
  const wishlist           = useStore((state) => state.wishlist);
  const user               = useStore((state) => state.user);
  const isAuthenticated    = !!user;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (params.slug && branch) loadProduct();
  }, [params.slug, branch]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/products?slug=${params.slug}&branchId=${branch?._id}`);
      if (res.data.products?.length > 0) {
        const prod = res.data.products[0];
        setProduct(prod);
        if (prod.hasVariants && prod.variants?.length > 0) {
          setSelectedVariant(prod.variants.find((v: ProductVariant) => v.active) || prod.variants[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load product:', error);
    } finally {
      setLoading(false);
    }
  };

  const isInWishlist = product
    ? wishlist.some((item) =>
        selectedVariant
          ? item.id === product._id && item.variantId === selectedVariant._id
          : item.id === product._id && !item.variantId
      )
    : false;

  const toggleWishlist = () => {
    if (!isAuthenticated || !product) return;
    if (isInWishlist) {
      removeFromWishlist(product._id, selectedVariant?._id);
    } else {
      const images = selectedVariant?.images?.length ? selectedVariant.images : product.images;
      const price  = selectedVariant?.specialPrice || selectedVariant?.price || product.specialPrice || product.price;
      addToWishlist({
        id:          product._id,
        variantId:   selectedVariant?._id,
        name:        product.name,
        variantName: selectedVariant?.name,
        price,
        image:       images[0] || '',
        sku:         selectedVariant?.sku || product.sku || '',
        slug:        product.slug,
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color="#1f2937" size={24} />
          </TouchableOpacity>
        </View>
        <View style={styles.centerContainer}><ActivityIndicator size="large" color="#FF6B35" /></View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color="#1f2937" size={24} />
          </TouchableOpacity>
        </View>
        <View style={styles.centerContainer}>
          <Package color="#9ca3af" size={60} />
          <Text style={styles.errorText}>Product not found</Text>
        </View>
      </View>
    );
  }

  const images      = selectedVariant?.images?.length ? selectedVariant.images : product.images;
  const price       = selectedVariant?.specialPrice || selectedVariant?.price || product.specialPrice || product.price;
  const comparePrice = selectedVariant?.compareAtPrice || product.compareAtPrice;
  const stockLevel  = selectedVariant?.stockLevel || product.stockLevel;
  const isInStock   = stockLevel > 0;
  const isLowStock  = stockLevel > 0 && stockLevel <= 5;

  const handleAddToCart = () => {
    if (!isInStock) return;
    addToCart({
      id:          product._id,
      variantId:   selectedVariant?._id,
      name:        product.name,
      variantName: selectedVariant?.name,
      price,
      image:       images[0] || '',
      quantity,
      sku:         selectedVariant?.sku || product.sku || '',
    });
    setQuantity(1);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1f2937" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Details</Text>
        {isAuthenticated && (
          <TouchableOpacity onPress={toggleWishlist} style={styles.wishlistButton}>
            <Heart color={isInWishlist ? '#ef4444' : '#6b7280'} fill={isInWishlist ? '#ef4444' : 'none'} size={24} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.imageGallery}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onScroll={(e) => setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
            scrollEventThrottle={16}>
            {images.map((image, index) => (
              <View key={index} style={styles.imageSlide}>
                <Image source={{ uri: image }} style={styles.productImage} resizeMode="cover" />
              </View>
            ))}
          </ScrollView>
          {images.length > 1 && (
            <View style={styles.imageIndicators}>
              {images.map((_, index) => (
                <View key={index} style={[styles.indicator, index === activeImageIndex && styles.indicatorActive]} />
              ))}
            </View>
          )}
          <View style={styles.badges}>
            {product.onSpecial && (
              <View style={styles.specialBadge}>
                <Tag color="#fff" size={12} />
                <Text style={styles.specialBadgeText}>SPECIAL</Text>
              </View>
            )}
            {!isInStock && (
              <View style={styles.outOfStockBadge}>
                <Text style={styles.outOfStockBadgeText}>OUT OF STOCK</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.productName}>{product.name}</Text>
          <View style={styles.priceSection}>
            <Text style={styles.price}>R{price.toFixed(2)}</Text>
            {comparePrice && comparePrice > price && (
              <View style={styles.comparePriceContainer}>
                <Text style={styles.comparePrice}>R{comparePrice.toFixed(2)}</Text>
                <View style={styles.savingsTag}>
                  <Text style={styles.savingsText}>Save R{(comparePrice - price).toFixed(2)}</Text>
                </View>
              </View>
            )}
          </View>

          {isLowStock && (
            <View style={styles.stockWarning}>
              <Text style={styles.stockWarningText}>Only {stockLevel} left in stock!</Text>
            </View>
          )}

          {product.hasVariants && product.variants && product.variants.length > 0 && (
            <View style={styles.variantsSection}>
              <Text style={styles.sectionTitle}>Select Option</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {product.variants.filter((v) => v.active).map((variant) => (
                  <TouchableOpacity key={variant._id}
                    style={[styles.variantButton, selectedVariant?._id === variant._id && styles.variantButtonActive]}
                    onPress={() => { setSelectedVariant(variant); setQuantity(1); }}>
                    <Text style={[styles.variantButtonText, selectedVariant?._id === variant._id && styles.variantButtonTextActive]}>
                      {variant.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {product.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
        <View style={styles.quantityControl}>
          <TouchableOpacity style={styles.quantityButton} onPress={() => quantity > 1 && setQuantity(quantity - 1)} disabled={quantity <= 1 || !isInStock}>
            <Minus color={quantity <= 1 || !isInStock ? '#d1d5db' : '#6b7280'} size={20} />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity style={styles.quantityButton} onPress={() => quantity < stockLevel && setQuantity(quantity + 1)} disabled={quantity >= stockLevel || !isInStock}>
            <Plus color={quantity >= stockLevel || !isInStock ? '#d1d5db' : '#6b7280'} size={20} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.addToCartButton, !isInStock && styles.addToCartButtonDisabled]} onPress={handleAddToCart} disabled={!isInStock}>
          <ShoppingCart color="#fff" size={20} />
          <Text style={styles.addToCartText}>{isInStock ? 'Add to Cart' : 'Out of Stock'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { padding: 4 },
  wishlistButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937', flex: 1, textAlign: 'center', marginHorizontal: 12 },
  scrollView: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageGallery: { position: 'relative', backgroundColor: '#fff' },
  imageSlide: { width: SCREEN_WIDTH, aspectRatio: 1 },
  productImage: { width: '100%', height: '100%' },
  imageIndicators: { position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  indicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  indicatorActive: { width: 24, backgroundColor: '#fff' },
  badges: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', gap: 8 },
  specialBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF6B35', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  specialBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  outOfStockBadge: { backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  outOfStockBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  infoSection: { padding: 20, backgroundColor: '#fff', marginTop: 8 },
  productName: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 },
  priceSection: { marginBottom: 16 },
  price: { fontSize: 32, fontWeight: 'bold', color: '#FF6B35', marginBottom: 8 },
  comparePriceContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  comparePrice: { fontSize: 18, color: '#9ca3af', textDecorationLine: 'line-through' },
  savingsTag: { backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  savingsText: { fontSize: 12, color: '#10b981', fontWeight: '600' },
  stockWarning: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 8, marginBottom: 16 },
  stockWarningText: { fontSize: 14, color: '#92400e', fontWeight: '600', textAlign: 'center' },
  variantsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 },
  variantButton: { backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, marginRight: 8, borderWidth: 2, borderColor: 'transparent' },
  variantButtonActive: { backgroundColor: '#fef3e9', borderColor: '#FF6B35' },
  variantButtonText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  variantButtonTextActive: { color: '#FF6B35', fontWeight: '600' },
  descriptionSection: { marginBottom: 24 },
  description: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 12 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  quantityButton: { padding: 8 },
  quantityText: { fontSize: 18, fontWeight: '600', color: '#1f2937', marginHorizontal: 16, minWidth: 30, textAlign: 'center' },
  addToCartButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF6B35', paddingVertical: 16, borderRadius: 12, gap: 8 },
  addToCartButtonDisabled: { backgroundColor: '#d1d5db' },
  addToCartText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { fontSize: 16, color: '#9ca3af', marginTop: 12 },
});
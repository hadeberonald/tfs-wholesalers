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
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShoppingCart, Plus, Minus, Tag, Star, Package } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/lib/api';
import type { Special, Product } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SpecialDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const branch    = useStore((state) => state.branch);
  const addToCart = useStore((state) => state.addToCart);
  // ✅ addToCart is now an alias in the store — no other store fixes needed here

  const [special, setSpecial] = useState<Special | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (params.slug && branch) {
      loadSpecial();
    }
  }, [params.slug, branch]);

  const loadSpecial = async () => {
    try {
      setLoading(true);
      const specialRes = await api.get(`/api/specials?slug=${params.slug}&branchId=${branch?._id}&active=true`);
      if (specialRes.data.specials?.length > 0) {
        const spec = specialRes.data.specials[0];
        setSpecial(spec);
        let productIds: string[] = [];
        if (spec.type === 'buy_x_get_y') {
          if (spec.conditions.buyProductId) productIds = [spec.conditions.buyProductId];
        } else if (spec.type === 'bundle') {
          if (spec.conditions.bundleProducts)
            productIds = spec.conditions.bundleProducts.map((bp: any) => bp.productId);
        } else {
          productIds = spec.productIds || (spec.productId ? [spec.productId] : []);
        }
        if (productIds.length > 0) {
          const results = await Promise.all(
            productIds.map((id: string) =>
              api.get(`/api/products/${id}`).then((r) => r.data.product).catch(() => null)
            )
          );
          const fetched = results.filter(Boolean);
          setProducts(fetched);
          if (fetched.length > 0) setSelectedProduct(fetched[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load special:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSpecialBadge = () => {
    if (!special) return 'SPECIAL';
    if (special.badgeText) return special.badgeText;
    switch (special.type) {
      case 'percentage_off': return `${special.conditions?.discountPercentage}% OFF`;
      case 'amount_off':     return `R${special.conditions?.discountAmount} OFF`;
      case 'fixed_price':    return `NOW R${special.conditions?.newPrice}`;
      case 'multibuy':       return `${special.conditions?.requiredQuantity} FOR R${special.conditions?.specialPrice}`;
      case 'buy_x_get_y':   return `BUY ${special.conditions?.buyQuantity} GET ${special.conditions?.getQuantity}`;
      case 'bundle':         return 'BUNDLE DEAL';
      default:               return 'SPECIAL';
    }
  };

  const getSpecialPrice = (product: Product) => {
    if (!special) return product.price;
    switch (special.type) {
      case 'percentage_off': {
        const off = (product.price * (special.conditions?.discountPercentage || 0)) / 100;
        const max = special.conditions?.maximumDiscount || Infinity;
        return product.price - Math.min(off, max);
      }
      case 'amount_off':  return Math.max(0, product.price - (special.conditions?.discountAmount || 0));
      case 'fixed_price': return special.conditions?.newPrice || product.price;
      case 'multibuy':    return (special.conditions?.specialPrice || product.price) / (special.conditions?.requiredQuantity || 1);
      case 'buy_x_get_y': return product.price;
      case 'bundle':      return special.conditions?.bundlePrice || product.price;
      default:            return product.specialPrice || product.price;
    }
  };

  const handleAddToCart = () => {
    if (!selectedProduct || !special) { Alert.alert('Error', 'Please select a product'); return; }
    if (!isInStock) return;
    const specialPrice = getSpecialPrice(selectedProduct);
    addToCart({ id: selectedProduct._id, name: selectedProduct.name, price: specialPrice, image: displayImages[0] || '', quantity, sku: selectedProduct.sku || '' });
    Alert.alert('Added to Cart', `${quantity} × ${selectedProduct.name} added to your cart`);
    setQuantity(1);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centerContainer}><ActivityIndicator size="large" color="#FF6B35" /></View>
      </View>
    );
  }

  if (!special) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centerContainer}>
          <Tag color="#9ca3af" size={60} />
          <Text style={styles.errorText}>Special not found</Text>
        </View>
      </View>
    );
  }

  const currentPrice  = selectedProduct ? getSpecialPrice(selectedProduct) : 0;
  const savings       = selectedProduct && special.type !== 'buy_x_get_y' ? selectedProduct.price - currentPrice : 0;
  const isInStock     = selectedProduct ? selectedProduct.stockLevel > 0 : false;
  const maxQuantity   = selectedProduct ? Math.min(selectedProduct.stockLevel, 99) : 0;
  const displayImages = special.images?.length ? special.images : (selectedProduct?.images || []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Special Offer</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {displayImages.length > 0 ? (
          <View style={styles.imageGallery}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onScroll={(e) => setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
              scrollEventThrottle={16}>
              {displayImages.map((image, index) => (
                <View key={index} style={styles.imageSlide}>
                  <Image source={{ uri: image }} style={styles.productImage} resizeMode="cover" />
                </View>
              ))}
            </ScrollView>
            {displayImages.length > 1 && (
              <View style={styles.imageIndicators}>
                {displayImages.map((_, index) => (
                  <View key={index} style={[styles.indicator, index === activeImageIndex && styles.indicatorActive]} />
                ))}
              </View>
            )}
            <View style={styles.badges}>
              <View style={styles.specialBadge}>
                <Tag color="#fff" size={12} />
                <Text style={styles.specialBadgeText}>{getSpecialBadge()}</Text>
              </View>
              {special.featured && (
                <View style={styles.featuredBadge}>
                  <Star color="#fff" size={12} fill="#fff" />
                  <Text style={styles.featuredBadgeText}>FEATURED</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Tag color="#FF6B35" size={80} />
            <Text style={styles.placeholderText}>Special Offer</Text>
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.specialName}>{special.name}</Text>
          {special.description && <Text style={styles.description}>{special.description}</Text>}

          {special.type === 'buy_x_get_y' && (
            <View style={styles.specialInfoCard}>
              <Text style={styles.specialInfoTitle}>Special Offer</Text>
              <Text style={styles.specialInfoText}>
                Buy {special.conditions?.buyQuantity}, Get {special.conditions?.getQuantity}{' '}
                {special.conditions?.getDiscount === 100 ? 'FREE!' : `at ${special.conditions?.getDiscount}% off`}
              </Text>
            </View>
          )}
          {special.type === 'multibuy' && (
            <View style={[styles.specialInfoCard, styles.specialInfoCardPurple]}>
              <Text style={[styles.specialInfoTitle, styles.specialInfoTitlePurple]}>Multibuy Deal</Text>
              <Text style={[styles.specialInfoText, styles.specialInfoTextPurple]}>
                Buy {special.conditions?.requiredQuantity} for only R{special.conditions?.specialPrice}
              </Text>
            </View>
          )}
          {special.type === 'bundle' && (
            <View style={[styles.specialInfoCard, { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' }]}>
              <Text style={[styles.specialInfoTitle, { color: '#7c3aed' }]}>Bundle Deal</Text>
              <Text style={[styles.specialInfoText, { color: '#7c3aed' }]}>
                Get all items for only R{special.conditions?.bundlePrice}
              </Text>
            </View>
          )}

          {products.length > 1 && (
            <View style={styles.productSelection}>
              <Text style={styles.sectionTitle}>Select Product</Text>
              <View style={styles.productGrid}>
                {products.map((product) => (
                  <TouchableOpacity key={product._id}
                    style={[styles.productOption, selectedProduct?._id === product._id && styles.productOptionActive, product.stockLevel === 0 && styles.productOptionDisabled]}
                    onPress={() => setSelectedProduct(product)} disabled={product.stockLevel === 0}>
                    <Text style={styles.productOptionName}>{product.name}</Text>
                    <Text style={styles.productOptionPrice}>R{getSpecialPrice(product).toFixed(2)}</Text>
                    {product.stockLevel === 0 && <Text style={styles.productOptionOutOfStock}>Out of stock</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {selectedProduct && (
            <View style={styles.priceSection}>
              <View>
                <Text style={styles.price}>R{currentPrice.toFixed(2)}</Text>
                {savings > 0 && <Text style={styles.oldPrice}>R{selectedProduct.price.toFixed(2)}</Text>}
              </View>
              {savings > 0 && (
                <View style={styles.savingsTag}>
                  <Text style={styles.savingsText}>
                    Save R{savings.toFixed(2)} ({Math.round((savings / selectedProduct.price) * 100)}% OFF)
                  </Text>
                </View>
              )}
            </View>
          )}

          {selectedProduct && (
            <View style={styles.stockSection}>
              {isInStock ? (
                <View style={styles.inStockRow}>
                  <View style={styles.stockDot} />
                  <Text style={styles.inStockText}>In Stock ({selectedProduct.stockLevel} available)</Text>
                </View>
              ) : (
                <View style={styles.outOfStockRow}>
                  <View style={[styles.stockDot, styles.stockDotRed]} />
                  <Text style={styles.outOfStockText}>Out of Stock</Text>
                </View>
              )}
            </View>
          )}

          {selectedProduct && (
            <View style={styles.productDetails}>
              <Text style={styles.detailsTitle}>Product Details</Text>
              {selectedProduct.description && <Text style={styles.detailsDescription}>{selectedProduct.description}</Text>}
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>SKU:</Text>
                <Text style={styles.detailsValue}>{selectedProduct.sku}</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {selectedProduct && isInStock && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
          <View style={styles.quantityControl}>
            <TouchableOpacity style={styles.quantityButton} onPress={() => quantity > 1 && setQuantity(quantity - 1)} disabled={quantity <= 1}>
              <Minus color={quantity <= 1 ? '#d1d5db' : '#6b7280'} size={20} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity style={styles.quantityButton} onPress={() => quantity < maxQuantity && setQuantity(quantity + 1)} disabled={quantity >= maxQuantity}>
              <Plus color={quantity >= maxQuantity ? '#d1d5db' : '#6b7280'} size={20} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.addToCartButton} onPress={handleAddToCart}>
            <ShoppingCart color="#fff" size={20} />
            <Text style={styles.addToCartText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { padding: 4 },
  backText: { fontSize: 16, color: '#FF6B35', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  scrollView: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageGallery: { position: 'relative', backgroundColor: '#fff' },
  imageSlide: { width: SCREEN_WIDTH, aspectRatio: 1 },
  productImage: { width: '100%', height: '100%' },
  placeholderContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { fontSize: 14, color: '#9ca3af', marginTop: 12 },
  imageIndicators: { position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  indicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  indicatorActive: { width: 24, backgroundColor: '#fff' },
  badges: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  specialBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  specialBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  featuredBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eab308', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  featuredBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  infoSection: { padding: 20, backgroundColor: '#fff', marginTop: 8 },
  specialName: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 },
  description: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 20 },
  specialInfoCard: { backgroundColor: '#dbeafe', borderWidth: 2, borderColor: '#93c5fd', borderRadius: 12, padding: 16, marginBottom: 20 },
  specialInfoCardPurple: { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' },
  specialInfoTitle: { fontSize: 16, fontWeight: '600', color: '#1e40af', marginBottom: 8 },
  specialInfoTitlePurple: { color: '#6b21a8' },
  specialInfoText: { fontSize: 14, color: '#1e40af' },
  specialInfoTextPurple: { color: '#6b21a8' },
  productSelection: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 12 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  productOption: { flex: 1, minWidth: '48%', padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  productOptionActive: { borderColor: '#FF6B35', backgroundColor: '#fef3e9' },
  productOptionDisabled: { opacity: 0.5 },
  productOptionName: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  productOptionPrice: { fontSize: 12, color: '#6b7280' },
  productOptionOutOfStock: { fontSize: 11, color: '#ef4444', marginTop: 4 },
  priceSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  price: { fontSize: 32, fontWeight: 'bold', color: '#FF6B35', marginBottom: 4 },
  oldPrice: { fontSize: 18, color: '#9ca3af', textDecorationLine: 'line-through' },
  savingsTag: { backgroundColor: '#d1fae5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  savingsText: { fontSize: 12, color: '#10b981', fontWeight: '600' },
  stockSection: { marginBottom: 20 },
  inStockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outOfStockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stockDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' },
  stockDotRed: { backgroundColor: '#dc2626' },
  inStockText: { fontSize: 14, fontWeight: '600', color: '#16a34a' },
  outOfStockText: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
  productDetails: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 20 },
  detailsTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 12 },
  detailsDescription: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 16 },
  detailsRow: { flexDirection: 'row', gap: 12 },
  detailsLabel: { fontSize: 14, color: '#6b7280', width: 80 },
  detailsValue: { fontSize: 14, fontWeight: '500', color: '#1f2937' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 12 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  quantityButton: { padding: 8 },
  quantityText: { fontSize: 18, fontWeight: '600', color: '#1f2937', marginHorizontal: 16, minWidth: 30, textAlign: 'center' },
  addToCartButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF6B35', paddingVertical: 16, borderRadius: 12, gap: 8 },
  addToCartText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { fontSize: 16, color: '#9ca3af', marginTop: 12 },
});
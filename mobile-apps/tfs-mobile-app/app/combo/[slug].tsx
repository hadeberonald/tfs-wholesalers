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
import { ShoppingCart, Plus, Minus, Package, Tag, ArrowLeft, Heart } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ComboItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface Combo {
  _id: string;
  name: string;
  slug: string;
  description: string;
  images?: string[];
  items: ComboItem[];
  comboPrice: number;
  regularPrice: number;
  stockLevel: number;
  active: boolean;
}

export default function ComboDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const branch = useStore((state) => state.branch);
  const addToCart = useStore((state) => state.addToCart);
  const addToWishlist = useStore((state) => state.addToWishlist);
  const removeFromWishlist = useStore((state) => state.removeFromWishlist);
  const wishlist = useStore((state) => state.wishlist || []);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  
  const [combo, setCombo] = useState<Combo | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (params.slug && branch) {
      loadCombo();
    }
  }, [params.slug, branch]);

  const loadCombo = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/combos?slug=${params.slug}&branchId=${branch?._id}&active=true`);
      
      if (res.data.combos && res.data.combos.length > 0) {
        setCombo(res.data.combos[0]);
      }
    } catch (error) {
      console.error('Failed to load combo:', error);
    } finally {
      setLoading(false);
    }
  };

  const isInWishlist = combo && wishlist.some((item) => item.id === combo._id);

  const toggleWishlist = () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to add items to your wishlist');
      return;
    }
    
    if (!combo) return;

    if (isInWishlist) {
      removeFromWishlist(combo._id);
    } else {
      addToWishlist({
        id: combo._id,
        name: combo.name,
        price: combo.comboPrice,
        image: combo.images?.[0] || '',
        sku: combo.slug,
        slug: combo.slug,
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
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </View>
    );
  }

  if (!combo) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color="#1f2937" size={24} />
          </TouchableOpacity>
        </View>
        <View style={styles.centerContainer}>
          <Package color="#9ca3af" size={60} />
          <Text style={styles.errorText}>Combo not found</Text>
        </View>
      </View>
    );
  }

  const images = combo.images && combo.images.length > 0 ? combo.images : [];
  const isInStock = combo.stockLevel > 0;
  const isLowStock = combo.stockLevel > 0 && combo.stockLevel <= 5;
  const savings = combo.regularPrice - combo.comboPrice;
  const savingsPercent = Math.round((savings / combo.regularPrice) * 100);

  const handleAddToCart = () => {
    if (!isInStock) return;

    addToCart({
      id: combo._id,
      name: combo.name,
      price: combo.comboPrice,
      image: combo.images?.[0] || '',
      quantity,
      sku: combo.slug,
    });

    Alert.alert('Added to Cart', `${quantity} ${combo.name} added to your cart`);
    setQuantity(1);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1f2937" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Combo Deal</Text>
        {isAuthenticated && (
          <TouchableOpacity onPress={toggleWishlist} style={styles.wishlistButton}>
            <Heart 
              color={isInWishlist ? "#ef4444" : "#6b7280"} 
              fill={isInWishlist ? "#ef4444" : "none"}
              size={24} 
            />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        {images.length > 0 ? (
          <View style={styles.imageGallery}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setActiveImageIndex(index);
              }}
              scrollEventThrottle={16}
            >
              {images.map((image, index) => (
                <View key={index} style={styles.imageSlide}>
                  <Image source={{ uri: image }} style={styles.productImage} resizeMode="cover" />
                </View>
              ))}
            </ScrollView>

            {/* Image Indicators */}
            {images.length > 1 && (
              <View style={styles.imageIndicators}>
                {images.map((_, index) => (
                  <View
                    key={index}
                    style={[styles.indicator, index === activeImageIndex && styles.indicatorActive]}
                  />
                ))}
              </View>
            )}

            {/* Badges */}
            <View style={styles.badges}>
              <View style={styles.comboBadge}>
                <Package color="#fff" size={12} />
                <Text style={styles.comboBadgeText}>COMBO DEAL</Text>
              </View>
              {savingsPercent > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>-{savingsPercent}%</Text>
                </View>
              )}
              {!isInStock && (
                <View style={styles.outOfStockBadge}>
                  <Text style={styles.outOfStockBadgeText}>OUT OF STOCK</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Package color="#FF6B35" size={80} />
          </View>
        )}

        {/* Combo Info */}
        <View style={styles.infoSection}>
          <Text style={styles.comboName}>{combo.name}</Text>

          {/* Description */}
          {combo.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>About This Combo</Text>
              <Text style={styles.description}>{combo.description}</Text>
            </View>
          )}

          {/* Stock Status */}
          <View style={styles.stockStatusSection}>
            {isInStock ? (
              <View style={styles.inStockRow}>
                <View style={styles.stockDot} />
                <Text style={styles.inStockText}>
                  In Stock ({combo.stockLevel} available)
                </Text>
              </View>
            ) : (
              <View style={styles.outOfStockRow}>
                <View style={[styles.stockDot, styles.stockDotRed]} />
                <Text style={styles.outOfStockText}>Out of Stock</Text>
              </View>
            )}
          </View>

          {/* What's Included */}
          {combo.items && combo.items.length > 0 && (
            <View style={styles.itemsSection}>
              <View style={styles.itemsHeader}>
                <Package color="#7c3aed" size={20} />
                <Text style={styles.itemsHeaderText}>
                  What's Included ({combo.items.length} items)
                </Text>
              </View>
              <View style={styles.itemsList}>
                {combo.items.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <View style={styles.checkIcon}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemQuantity}>
                        {item.quantity}x Item {index + 1}
                      </Text>
                      {item.variantId && (
                        <Text style={styles.itemVariant}>Variant included</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Price Comparison Card */}
          {savings > 0 && (
            <View style={styles.priceComparisonCard}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Regular Price:</Text>
                <Text style={styles.priceRegular}>R{combo.regularPrice.toFixed(2)}</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabelBold}>Combo Price:</Text>
                <Text style={styles.priceCombo}>R{combo.comboPrice.toFixed(2)}</Text>
              </View>
              <View style={styles.priceDivider} />
              <View style={styles.priceRow}>
                <Text style={styles.savingsLabel}>You Save:</Text>
                <Text style={styles.savingsAmount}>
                  R{savings.toFixed(2)} ({savingsPercent}%)
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
        <View style={styles.quantityControl}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => quantity > 1 && setQuantity(quantity - 1)}
            disabled={quantity <= 1 || !isInStock}
          >
            <Minus color={quantity <= 1 || !isInStock ? '#d1d5db' : '#6b7280'} size={20} />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => quantity < combo.stockLevel && setQuantity(quantity + 1)}
            disabled={quantity >= combo.stockLevel || !isInStock}
          >
            <Plus color={quantity >= combo.stockLevel || !isInStock ? '#d1d5db' : '#6b7280'} size={20} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.addToCartButton, !isInStock && styles.addToCartButtonDisabled]}
          onPress={handleAddToCart}
          disabled={!isInStock}
        >
          <ShoppingCart color="#fff" size={20} />
          <Text style={styles.addToCartText}>
            {isInStock ? 'Add to Cart' : 'Out of Stock'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: { padding: 4 },
  wishlistButton: { padding: 4 },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#1f2937', 
    flex: 1, 
    textAlign: 'center', 
    marginHorizontal: 12 
  },
  scrollView: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageGallery: { position: 'relative', backgroundColor: '#fff' },
  imageSlide: { width: SCREEN_WIDTH, aspectRatio: 1 },
  productImage: { width: '100%', height: '100%' },
  placeholderContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#fef3e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageIndicators: { 
    position: 'absolute', 
    bottom: 16, 
    left: 0, 
    right: 0, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 8 
  },
  indicator: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: 'rgba(255,255,255,0.5)' 
  },
  indicatorActive: { width: 24, backgroundColor: '#fff' },
  badges: { 
    position: 'absolute', 
    top: 16, 
    left: 16, 
    right: 16, 
    flexDirection: 'row', 
    gap: 8,
    flexWrap: 'wrap',
  },
  comboBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#8b5cf6', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8, 
    gap: 4 
  },
  comboBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  discountBadge: { 
    backgroundColor: '#10b981', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8 
  },
  discountBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  outOfStockBadge: { 
    backgroundColor: '#ef4444', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8 
  },
  outOfStockBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  infoSection: { padding: 20, backgroundColor: '#fff', marginTop: 8 },
  comboName: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 },
  descriptionSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 },
  description: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  stockStatusSection: {
    marginBottom: 20,
  },
  inStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  outOfStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  stockDotRed: {
    backgroundColor: '#dc2626',
  },
  inStockText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  outOfStockText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  itemsSection: { 
    marginBottom: 24, 
    backgroundColor: '#f5f3ff',
    borderWidth: 2,
    borderColor: '#ddd6fe',
    borderRadius: 12,
    padding: 16,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  itemsHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5b21b6',
  },
  itemsList: { gap: 10 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemInfo: { flex: 1 },
  itemQuantity: { fontSize: 14, fontWeight: '600', color: '#5b21b6', marginBottom: 2 },
  itemVariant: { fontSize: 12, color: '#7c3aed' },
  priceComparisonCard: {
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: '#fed7aa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  priceLabelBold: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  priceRegular: {
    fontSize: 16,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  priceCombo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#fed7aa',
    marginVertical: 8,
  },
  savingsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#15803d',
  },
  savingsAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  bottomBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderTopColor: '#e5e7eb', 
    gap: 12 
  },
  quantityControl: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f3f4f6', 
    borderRadius: 12, 
    paddingHorizontal: 12, 
    paddingVertical: 8 
  },
  quantityButton: { padding: 8 },
  quantityText: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#1f2937', 
    marginHorizontal: 16, 
    minWidth: 30, 
    textAlign: 'center' 
  },
  addToCartButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#FF6B35', 
    paddingVertical: 16, 
    borderRadius: 12, 
    gap: 8 
  },
  addToCartButtonDisabled: { backgroundColor: '#d1d5db' },
  addToCartText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { fontSize: 16, color: '#9ca3af', marginTop: 12 },
});
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingCart, Plus, Minus, Tag, Star, Heart } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import api from '@/lib/api';
import type { Special, Product } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 40) / 2;

interface SpecialCardProps {
  special: Special;
}

export default function SpecialCard({ special }: SpecialCardProps) {
  const router = useRouter();
  const addToCart = useStore((state) => state.addToCart);
  const addToWishlist = useStore((state) => state.addToWishlist);
  const removeFromWishlist = useStore((state) => state.removeFromWishlist);
  const wishlist = useStore((state) => state.wishlist || []);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const [product, setProduct] = useState<Product | null>(null);
  const [bundleQty, setBundleQty] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProduct();
  }, [special]);

  const fetchProduct = async () => {
    try {
      let productId = special.productId || special.productIds?.[0];
      if (special.type === 'buy_x_get_y' && special.conditions.buyProductId) {
        productId = special.conditions.buyProductId;
      }
      if (productId) {
        const res = await api.get(`/api/products/${productId}`);
        if (res.data.product) {
          setProduct(res.data.product);
        }
      }
    } catch (error) {
      console.error('Failed to fetch product for special');
    } finally {
      setLoading(false);
    }
  };

  const isInWishlist = product && wishlist.some((item) => item.id === product._id);

  const toggleWishlist = (e: any) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to add items to your wishlist');
      return;
    }
    if (!product) return;
    if (isInWishlist) {
      removeFromWishlist(product._id);
    } else {
      addToWishlist({
        id: product._id,
        name: product.name,
        price: getCartUnitPrice(),
        image: special.images?.[0] || product.images[0] || '',
        sku: product.sku || '',
        slug: product.slug,
      });
    }
  };

  const getSpecialBadge = () => {
    if (special.badgeText) return special.badgeText;
    switch (special.type) {
      case 'percentage_off':
        return `${special.conditions.discountPercentage}% OFF`;
      case 'amount_off':
        return `R${special.conditions.discountAmount} OFF`;
      case 'fixed_price':
        return `NOW R${special.conditions.newPrice}`;
      case 'multibuy':
        return `${special.conditions.requiredQuantity} FOR R${special.conditions.specialPrice}`;
      case 'buy_x_get_y':
        return `BUY ${special.conditions.buyQuantity} GET ${special.conditions.getQuantity}`;
      case 'bundle':
        return 'BUNDLE DEAL';
      default:
        return 'SPECIAL';
    }
  };

  const getDisplayPrice = () => {
    if (!product) return 0;
    switch (special.type) {
      case 'percentage_off': {
        const off = (product.price * (special.conditions.discountPercentage || 0)) / 100;
        return product.price - Math.min(off, special.conditions.maximumDiscount || Infinity);
      }
      case 'amount_off':
        return Math.max(0, product.price - (special.conditions.discountAmount || 0));
      case 'fixed_price':
        return special.conditions.newPrice || product.price;
      case 'multibuy':
        return special.conditions.specialPrice || product.price;
      case 'buy_x_get_y':
        return product.price;
      case 'bundle':
        return special.conditions.bundlePrice || product.price;
      default:
        return product.specialPrice || product.price;
    }
  };

  const getCartUnitPrice = () => {
    if (!product) return 0;
    switch (special.type) {
      case 'percentage_off': {
        const off = (product.price * (special.conditions.discountPercentage || 0)) / 100;
        return product.price - Math.min(off, special.conditions.maximumDiscount || Infinity);
      }
      case 'amount_off':
        return Math.max(0, product.price - (special.conditions.discountAmount || 0));
      case 'fixed_price':
        return special.conditions.newPrice || product.price;
      case 'multibuy':
        return (special.conditions.specialPrice || product.price) / (special.conditions.requiredQuantity || 1);
      case 'buy_x_get_y':
        return product.price;
      case 'bundle':
        return special.conditions.bundlePrice || product.price;
      default:
        return product.specialPrice || product.price;
    }
  };

  const isMultibuy = special.type === 'multibuy';
  const bundleSize = isMultibuy ? (special.conditions.requiredQuantity || 1) : 1;
  const actualQuantity = isMultibuy ? bundleQty * bundleSize : bundleQty;

  const incrementQuantity = (e: any) => {
    e.stopPropagation();
    if (!product) return;
    const nextActualQty = (bundleQty + 1) * bundleSize;
    if (nextActualQty <= product.stockLevel) {
      setBundleQty((q) => q + 1);
    }
  };

  const decrementQuantity = (e: any) => {
    e.stopPropagation();
    if (bundleQty > 1) {
      setBundleQty((q) => q - 1);
    }
  };

  const handleAddToCart = (e: any) => {
    e.stopPropagation();
    if (!product) return;
    addToCart({
      id: product._id,
      name: product.name,
      price: getCartUnitPrice(),
      image: special.images?.[0] || product.images[0] || '',
      quantity: actualQuantity,
      sku: product.sku || '',
      appliedSpecialId: special._id,
      originalPrice: product.price,
    });

    if (isMultibuy) {
      Alert.alert('Added to Cart', `${bundleQty} bundle${bundleQty > 1 ? 's' : ''} (${actualQuantity} items) added to your cart`);
    } else {
      Alert.alert('Added to Cart', `${actualQuantity} ${product.name} added to your cart`);
    }

    setBundleQty(1);
  };

  const badge = getSpecialBadge();
  const displayImage = special.images?.[0] || product?.images[0];
  const inStock = product && product.stockLevel > 0;
  const displayPrice = getDisplayPrice();

  const savings = (() => {
    if (!product) return 0;
    if (special.type === 'multibuy') {
      const reqQty = special.conditions.requiredQuantity || 1;
      return Math.max(0, product.price * reqQty - (special.conditions.specialPrice || product.price));
    }
    if (special.type === 'buy_x_get_y') return 0;
    return Math.max(0, product.price - displayPrice);
  })();

  const hasBanner =
    special.type === 'buy_x_get_y' ||
    special.type === 'multibuy' ||
    (special.type === 'bundle' && savings > 0);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/special/${special.slug}`)}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {displayImage ? (
          <Image source={{ uri: displayImage }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Tag color="#FF6B35" size={40} />
          </View>
        )}

        <View style={styles.badgesContainer}>
          <View style={styles.specialBadge}>
            <Tag color="#fff" size={10} />
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
          {special.featured && (
            <View style={styles.featuredBadge}>
              <Star color="#fff" size={10} fill="#fff" />
              <Text style={styles.badgeText}>FEATURED</Text>
            </View>
          )}
        </View>

        {isAuthenticated && product && (
          <TouchableOpacity style={styles.wishlistButton} onPress={toggleWishlist}>
            <Heart
              color={isInWishlist ? '#ef4444' : '#fff'}
              fill={isInWishlist ? '#ef4444' : 'none'}
              size={20}
            />
          </TouchableOpacity>
        )}

        {product && product.stockLevel < 10 && product.stockLevel > 0 && (
          <View style={styles.stockWarning}>
            <Text style={styles.stockWarningText}>{product.stockLevel} left</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.specialName} numberOfLines={2}>
          {special.name}
        </Text>

        <Text style={styles.description} numberOfLines={2}>
          {special.description}
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#FF6B35" />
          </View>
        ) : product ? (
          <>
            <View style={styles.middleSection}>
              <View style={styles.priceContainer}>
                <Text style={styles.price}>R{displayPrice.toFixed(2)}</Text>
              </View>

              {special.type === 'buy_x_get_y' && (
                <View style={styles.specialInfo}>
                  <Text style={styles.specialInfoText} numberOfLines={1}>
                    Buy {special.conditions.buyQuantity}, Get {special.conditions.getQuantity}
                    {special.conditions.getDiscount === 100
                      ? ' FREE!'
                      : ` ${special.conditions.getDiscount}% off`}
                  </Text>
                </View>
              )}

              {special.type === 'multibuy' && (
                <View style={styles.specialInfo}>
                  <Text style={styles.specialInfoText} numberOfLines={1}>
                    Buy {special.conditions.requiredQuantity} for R{special.conditions.specialPrice}
                  </Text>
                </View>
              )}

              {special.type === 'bundle' && savings > 0 && (
                <View style={[styles.specialInfo, styles.specialInfoPurple]}>
                  <Text style={[styles.specialInfoText, styles.specialInfoTextPurple]} numberOfLines={1}>
                    Bundle Deal - Save R{savings.toFixed(2)}!
                  </Text>
                </View>
              )}

              {!hasBanner && <View style={styles.bannerSpacer} />}
            </View>

            {inStock ? (
              <View style={styles.cartActions} onStartShouldSetResponder={() => true}>
                <View style={styles.quantityControl}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={decrementQuantity}
                    disabled={bundleQty <= 1}
                  >
                    <Minus color={bundleQty <= 1 ? '#d1d5db' : '#6b7280'} size={16} />
                  </TouchableOpacity>

                  <Text style={styles.quantityText}>{bundleQty}</Text>

                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={incrementQuantity}
                    disabled={(bundleQty + 1) * bundleSize > product.stockLevel}
                  >
                    <Plus color={(bundleQty + 1) * bundleSize > product.stockLevel ? '#d1d5db' : '#6b7280'} size={16} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
                  <ShoppingCart color="#fff" size={16} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.outOfStock}>
                <Text style={styles.outOfStockText}>Out of Stock</Text>
              </View>
            )}
          </>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#f3f4f6',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef3e9' },
  badgesContainer: { position: 'absolute', top: 8, left: 8, gap: 4 },
  specialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eab308',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 6,
    borderRadius: 20,
  },
  stockWarning: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#eab308',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  stockWarningText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  content: { padding: 12 },
  specialName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
    minHeight: 38,
  },
  description: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 8,
    minHeight: 28,
  },
  loadingContainer: { height: 80, alignItems: 'center', justifyContent: 'center' },
  middleSection: {
    minHeight: 80,
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  price: { fontSize: 18, fontWeight: 'bold', color: '#FF6B35' },
  specialInfo: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 6,
    padding: 6,
    marginBottom: 0,
  },
  specialInfoText: { fontSize: 10, color: '#1e40af', fontWeight: '600' },
  specialInfoPurple: { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' },
  specialInfoTextPurple: { color: '#7c3aed' },
  bannerSpacer: { height: 26 },
  cartActions: { flexDirection: 'row', gap: 8 },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  quantityButton: { padding: 8 },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    paddingHorizontal: 8,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  outOfStock: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  outOfStockText: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
});
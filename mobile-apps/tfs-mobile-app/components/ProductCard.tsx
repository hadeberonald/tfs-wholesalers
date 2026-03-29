import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingCart, Plus, Minus, Package, Tag, Heart } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import type { Product } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 40) / 2;

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();

  const addToCart          = useStore((s) => s.addToCart);
  const addToWishlist      = useStore((s) => s.addToWishlist);
  const removeFromWishlist = useStore((s) => s.removeFromWishlist);
  const wishlist           = useStore((s) => s.wishlist);
  const user               = useStore((s) => s.user);
  const isAuthenticated    = !!user;

  const [quantity, setQuantity] = useState(1);
  // No variant selected by default — base product is the default
  const [selectedVariant, setSelectedVariant] = useState<typeof product.variants extends Array<infer V> ? V : never | undefined>(undefined as any);

  // ── Derived display values — always fall back to base product ───────────────
  const displayPrice = selectedVariant
    ? (selectedVariant.specialPrice || selectedVariant.price || product.price)
    : (product.specialPrice || product.price);

  const comparePrice = selectedVariant
    ? (selectedVariant.compareAtPrice || product.compareAtPrice)
    : product.compareAtPrice;

  const hasDiscount     = !!(comparePrice && comparePrice > displayPrice);
  const discountPercent = hasDiscount
    ? Math.round(((comparePrice! - displayPrice) / comparePrice!) * 100)
    : 0;

  // Base product image first, switch to variant image only when variant selected
  const primaryImage = selectedVariant?.images?.length
    ? selectedVariant.images[0]
    : (product.images?.[0] || '');

  const stock   = selectedVariant ? selectedVariant.stockLevel : (product.stockLevel ?? 0);
  const inStock = stock > 0;
  const lowStock = stock > 0 && stock <= 10;
  // ───────────────────────────────────────────────────────────────────────────

  const isInWishlist = wishlist.some((item: any) =>
    selectedVariant
      ? item.id === product._id && item.variantId === selectedVariant._id
      : item.id === product._id && !item.variantId
  );

  const toggleWishlist = (e: any) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to use the wishlist feature');
      return;
    }
    if (isInWishlist) {
      removeFromWishlist(product._id, selectedVariant?._id);
    } else {
      addToWishlist({
        id:          product._id,
        variantId:   selectedVariant?._id,
        name:        product.name,
        variantName: selectedVariant?.name,
        price:       displayPrice,
        image:       primaryImage || '',
        sku:         selectedVariant?.sku || product.sku || product.slug,
        slug:        product.slug,
      });
    }
  };

  const handleAddToCart = (e: any) => {
    e.stopPropagation();
    addToCart({
      id:          product._id,
      variantId:   selectedVariant?._id,
      name:        product.name,
      variantName: selectedVariant?.name,
      price:       displayPrice,
      image:       primaryImage || '',
      quantity,
    });
    Alert.alert('Added to Cart', `${quantity} × ${product.name}${selectedVariant ? ` (${selectedVariant.name})` : ''} added to your cart`);
    setQuantity(1);
  };

  const incrementQuantity = (e: any) => {
    e.stopPropagation();
    if (quantity < stock) setQuantity((q) => q + 1);
  };

  const decrementQuantity = (e: any) => {
    e.stopPropagation();
    if (quantity > 1) setQuantity((q) => q - 1);
  };

  const handleVariantSelect = (variant: any) => {
    // If tapping already-selected variant, deselect back to base product
    if (selectedVariant?._id === variant._id) {
      setSelectedVariant(undefined);
    } else {
      setSelectedVariant(variant);
    }
    setQuantity(1);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/product/${product.slug}`)}
      activeOpacity={0.7}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Package color="#9ca3af" size={40} />
          </View>
        )}

        {/* Badges */}
        <View style={styles.badgesContainer}>
          {product.onSpecial && (
            <View style={styles.specialBadge}>
              <Tag color="#fff" size={10} />
              <Text style={styles.badgeText}>SPECIAL</Text>
            </View>
          )}
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.badgeText}>{discountPercent}% OFF</Text>
            </View>
          )}
          {product.hasVariants && (product.variants?.length ?? 0) > 1 && (
            <View style={styles.variantsBadge}>
              <Text style={styles.badgeText}>{product.variants!.length} OPTIONS</Text>
            </View>
          )}
        </View>

        {/* Wishlist */}
        {isAuthenticated && (
          <TouchableOpacity style={styles.wishlistButton} onPress={toggleWishlist}>
            <Heart
              color={isInWishlist ? '#ef4444' : '#fff'}
              fill={isInWishlist ? '#ef4444' : 'none'}
              size={20}
            />
          </TouchableOpacity>
        )}

        {/* Only show stock count when low (under 10) */}
        {lowStock && (
          <View style={styles.stockWarning}>
            <Text style={styles.stockWarningText}>{stock} left</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
          {selectedVariant && (
            <Text style={styles.variantName}> - {selectedVariant.name}</Text>
          )}
        </Text>

        {product.unitQuantity && product.unit && (
          <Text style={styles.unitText}>{product.unitQuantity}{product.unit}</Text>
        )}

        {product.description && (
          <Text style={styles.description} numberOfLines={2}>{product.description}</Text>
        )}

        {/* Variant selector — base product is default, tap variant to select, tap again to deselect */}
        {product.hasVariants && product.variants && product.variants.length > 0 && (
          <View style={styles.variantsRow}>
            {product.variants.filter((v: any) => v.active).map((variant: any) => (
              <TouchableOpacity
                key={variant._id}
                style={[styles.variantChip, selectedVariant?._id === variant._id && styles.variantChipActive]}
                onPress={(e) => { e.stopPropagation(); handleVariantSelect(variant); }}
              >
                <Text style={[styles.variantChipText, selectedVariant?._id === variant._id && styles.variantChipTextActive]}>
                  {variant.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.priceContainer}>
          <Text style={styles.price}>R{displayPrice.toFixed(2)}</Text>
          {hasDiscount && (
            <Text style={styles.oldPrice}>R{comparePrice!.toFixed(2)}</Text>
          )}
        </View>
        {hasDiscount && (
          <Text style={styles.savings}>Save R{(comparePrice! - displayPrice).toFixed(2)}</Text>
        )}

        {inStock ? (
          <View style={styles.cartActions} onStartShouldSetResponder={() => true}>
            <View style={styles.quantityControl}>
              <TouchableOpacity style={styles.quantityButton} onPress={decrementQuantity} disabled={quantity <= 1}>
                <Minus color="#6b7280" size={16} />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity style={styles.quantityButton} onPress={incrementQuantity} disabled={quantity >= stock}>
                <Plus color="#6b7280" size={16} />
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
  imageContainer: { width: '100%', aspectRatio: 4 / 3, position: 'relative' },
  image: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  badgesContainer: { position: 'absolute', top: 8, left: 8, gap: 4 },
  specialBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 4, gap: 3,
  },
  discountBadge: {
    backgroundColor: '#FF6B35', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
  },
  variantsBadge: {
    backgroundColor: '#8b5cf6', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  wishlistButton: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, padding: 6,
  },
  stockWarning: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: '#eab308', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
  },
  stockWarningText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  content: { padding: 12 },
  productName: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 4, minHeight: 36 },
  variantName: { color: '#6b7280', fontWeight: '400' },
  unitText: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  description: { fontSize: 11, color: '#6b7280', marginBottom: 6 },
  variantsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  variantChip: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  variantChipActive: { borderColor: '#FF6B35', backgroundColor: '#fef3e9' },
  variantChipText: { fontSize: 10, color: '#6b7280', fontWeight: '500' },
  variantChipTextActive: { color: '#FF6B35', fontWeight: '600' },
  priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  price: { fontSize: 18, fontWeight: 'bold', color: '#FF6B35' },
  oldPrice: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' },
  savings: { fontSize: 11, color: '#10b981', fontWeight: '600', marginBottom: 8 },
  cartActions: { flexDirection: 'row', gap: 8 },
  quantityControl: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
  },
  quantityButton: { padding: 8 },
  quantityText: { fontSize: 14, fontWeight: '600', color: '#1f2937', paddingHorizontal: 8 },
  addButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FF6B35', paddingVertical: 8, borderRadius: 8, gap: 4,
  },
  outOfStock: { backgroundColor: '#e5e7eb', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  outOfStockText: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
});
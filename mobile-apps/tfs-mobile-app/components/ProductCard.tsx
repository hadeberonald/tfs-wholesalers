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
  const addToCart = useStore((state) => state.addToCart);
  const addToWishlist = useStore((state) => state.addToWishlist);
  const removeFromWishlist = useStore((state) => state.removeFromWishlist);
  const wishlist = useStore((state) => state.wishlist || []);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(
    product.hasVariants && product.variants && product.variants.length > 0
      ? product.variants[0]
      : undefined
  );

  const displayPrice = selectedVariant?.price || product.specialPrice || product.price;
  const comparePrice = selectedVariant?.compareAtPrice || product.compareAtPrice;
  const hasDiscount = comparePrice && comparePrice > displayPrice;
  const discountPercent = hasDiscount
    ? Math.round(((comparePrice - displayPrice) / comparePrice) * 100)
    : 0;
  const primaryImage = selectedVariant?.images?.[0] || product.images[0];
  const stock = selectedVariant?.stockLevel ?? product.stockLevel;
  const inStock = stock > 0;

  const isInWishlist = wishlist.some((item) => {
    if (selectedVariant) {
      return item.id === product._id && item.variantId === selectedVariant._id;
    }
    return item.id === product._id && !item.variantId;
  });

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
        id: product._id,
        variantId: selectedVariant?._id,
        name: product.name,
        variantName: selectedVariant?.name,
        price: displayPrice,
        image: primaryImage || '',
        sku: selectedVariant?.sku || product.sku || product.slug,
        slug: product.slug,
      });
    }
  };

  const handleAddToCart = (e: any) => {
    e.stopPropagation();
    addToCart({
      id: product._id,
      variantId: selectedVariant?._id,
      name: product.name,
      variantName: selectedVariant?.name,
      price: displayPrice,
      image: primaryImage || '',
      quantity: quantity,
      sku: selectedVariant?.sku || product.sku || product.slug,
    });
    Alert.alert('Added to Cart', `${quantity} ${product.name} added to your cart`);
    setQuantity(1);
  };

  const incrementQuantity = (e: any) => {
    e.stopPropagation();
    if (quantity < stock) {
      setQuantity(q => q + 1);
    }
  };

  const decrementQuantity = (e: any) => {
    e.stopPropagation();
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
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

        {/* Badges - Top Left */}
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
          {product.hasVariants && product.variants && product.variants.length > 1 && (
            <View style={styles.variantsBadge}>
              <Text style={styles.badgeText}>{product.variants.length} OPTIONS</Text>
            </View>
          )}
        </View>

        {/* Wishlist Heart - Top Right */}
        {isAuthenticated && (
          <TouchableOpacity style={styles.wishlistButton} onPress={toggleWishlist}>
            <Heart 
              color={isInWishlist ? "#ef4444" : "#fff"} 
              fill={isInWishlist ? "#ef4444" : "none"}
              size={20} 
            />
          </TouchableOpacity>
        )}

        {/* Stock Warning - Bottom Right */}
        {stock < 10 && stock > 0 && (
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
          <Text style={styles.unitText}>
            {product.unitQuantity}{product.unit}
          </Text>
        )}

        {product.description && (
          <Text style={styles.description} numberOfLines={2}>
            {product.description}
          </Text>
        )}

        <View style={styles.priceContainer}>
          <Text style={styles.price}>R{displayPrice.toFixed(2)}</Text>
          {hasDiscount && (
            <Text style={styles.oldPrice}>R{comparePrice.toFixed(2)}</Text>
          )}
        </View>
        {hasDiscount && (
          <Text style={styles.savings}>
            Save R{(comparePrice! - displayPrice).toFixed(2)}
          </Text>
        )}

        {inStock ? (
          <View style={styles.cartActions} onStartShouldSetResponder={() => true}>
            <View style={styles.quantityControl}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={decrementQuantity}
                disabled={quantity <= 1}
              >
                <Minus color="#6b7280" size={16} />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={incrementQuantity}
                disabled={quantity >= stock}
              >
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
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgesContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    gap: 4,
  },
  specialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  discountBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  variantsBadge: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 6,
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
  stockWarningText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  content: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
    minHeight: 36,
  },
  variantName: {
    color: '#6b7280',
    fontWeight: '400',
  },
  unitText: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
  },
  description: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 6,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  oldPrice: {
    fontSize: 12,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  savings: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
    marginBottom: 8,
  },
  cartActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  quantityButton: {
    padding: 8,
  },
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
  outOfStockText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
});
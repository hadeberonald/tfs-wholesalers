import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { ShoppingCart, Plus, Minus, Package, Tag, Heart } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { shared } from './cardStyles';
import type { Product } from '@/lib/types';

interface ProductCardProps { product: Product; }

export default function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();

  const addToCart          = useStore((s) => s.addToCart);
  const addToWishlist      = useStore((s) => s.addToWishlist);
  const removeFromWishlist = useStore((s) => s.removeFromWishlist);
  const wishlist           = useStore((s) => s.wishlist);
  const user               = useStore((s) => s.user);
  const isAuthenticated    = !!user;

  const [quantity, setQuantity]                   = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  const activeVariants  = product.variants?.filter((v: any) => v.active) ?? [];
  const selectedVariant = activeVariants.find((v: any) => v._id === selectedVariantId) ?? undefined;
  const hasVariants     = product.hasVariants && activeVariants.length > 0;

  const displayPrice = selectedVariant
    ? (selectedVariant.specialPrice || selectedVariant.price || product.price)
    : (product.specialPrice || product.price);

  const comparePrice = selectedVariant
    ? (selectedVariant.compareAtPrice || product.compareAtPrice)
    : product.compareAtPrice;

  const hasDiscount     = !!(comparePrice && comparePrice > displayPrice);
  const discountPercent = hasDiscount
    ? Math.round(((comparePrice! - displayPrice) / comparePrice!) * 100) : 0;

  const primaryImage = selectedVariant?.images?.length
    ? selectedVariant.images[0] : (product.images?.[0] || '');

  const stock    = selectedVariant ? selectedVariant.stockLevel : (product.stockLevel ?? 0);
  const inStock  = stock > 0;
  const lowStock = stock > 0 && stock <= 10;

  const isInWishlist = wishlist.some((item: any) =>
    selectedVariant
      ? item.id === product._id && item.variantId === selectedVariant._id
      : item.id === product._id && !item.variantId,
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
        id: product._id, variantId: selectedVariant?._id,
        name: product.name, variantName: selectedVariant?.name,
        price: displayPrice, image: primaryImage || '',
        sku: selectedVariant?.sku || product.sku || product.slug,
        slug: product.slug,
      });
    }
  };

  const handleAddToCart = (e: any) => {
    e.stopPropagation();
    addToCart({
      id: product._id, variantId: selectedVariant?._id,
      name: product.name, variantName: selectedVariant?.name,
      price: displayPrice, image: primaryImage || '', quantity,
    });
    Alert.alert('Added to Cart',
      `${quantity} × ${product.name}${selectedVariant ? ` (${selectedVariant.name})` : ''} added to your cart`);
    setQuantity(1);
  };

  const increment = (e: any) => { e.stopPropagation(); if (quantity < stock) setQuantity(q => q + 1); };
  const decrement = (e: any) => { e.stopPropagation(); if (quantity > 1) setQuantity(q => q - 1); };

  return (
    <TouchableOpacity style={shared.card} onPress={() => router.push(`/product/${product.slug}`)} activeOpacity={0.7}>

      <View style={shared.imageContainer}>
        {primaryImage
          ? <Image source={{ uri: primaryImage }} style={shared.image} />
          : <View style={[shared.image, shared.placeholder]}><Package color="#9ca3af" size={40} /></View>
        }
        <View style={shared.badgesContainer}>
          {product.onSpecial && (
            <View style={[shared.badge, shared.badgeRed]}>
              <Tag color="#fff" size={10} />
              <Text style={shared.badgeText}>SPECIAL</Text>
            </View>
          )}
          {hasDiscount && (
            <View style={[shared.badge, shared.badgeOrange]}>
              <Text style={shared.badgeText}>{discountPercent}% OFF</Text>
            </View>
          )}
          {hasVariants && (
            <View style={[shared.badge, shared.badgePurple]}>
              <Text style={shared.badgeText}>{activeVariants.length + 1} OPTIONS</Text>
            </View>
          )}
        </View>
        {isAuthenticated && (
          <TouchableOpacity style={shared.wishlistButton} onPress={toggleWishlist}>
            <Heart color={isInWishlist ? '#ef4444' : '#fff'} fill={isInWishlist ? '#ef4444' : 'none'} size={20} />
          </TouchableOpacity>
        )}
        {lowStock && (
          <View style={shared.stockWarning}>
            <Text style={shared.stockWarningText}>{stock} left</Text>
          </View>
        )}
      </View>

      <View style={shared.content}>
        <Text style={shared.name} numberOfLines={2}>{product.name}</Text>

        {product.unitQuantity && product.unit && (
          <Text style={shared.unitText}>{product.unitQuantity}{product.unit}</Text>
        )}

        {/* Description: 3 lines when no variants/discount info below, 2 otherwise */}
        <Text style={shared.description} numberOfLines={hasVariants ? 2 : 3}>
          {product.description || ''}
        </Text>

        {/* Variant picker — only renders when needed, no empty spacer */}
        {hasVariants && (
          <View style={styles.pickerWrapper} onStartShouldSetResponder={() => true}>
            <Picker
              selectedValue={selectedVariantId}
              onValueChange={(val) => { setSelectedVariantId(val as string); setQuantity(1); }}
              style={styles.picker}
              dropdownIconColor="#6b7280"
            >
              <Picker.Item label={`${product.name} — R${product.price.toFixed(2)}`} value="" />
              {activeVariants.map((v: any) => (
                <Picker.Item
                  key={v._id}
                  label={`${v.name}${v.price ? ` — R${(v.specialPrice || v.price).toFixed(2)}` : ''}${v.stockLevel === 0 ? ' (Out of stock)' : ''}`}
                  value={v._id}
                />
              ))}
            </Picker>
          </View>
        )}

        <View style={shared.priceContainer}>
          <Text style={shared.price}>R{displayPrice.toFixed(2)}</Text>
          {hasDiscount && <Text style={shared.oldPrice}>R{comparePrice!.toFixed(2)}</Text>}
        </View>

        {/* Savings only renders when there IS a saving */}
        {hasDiscount && (
          <Text style={shared.savingsText}>Save R{(comparePrice! - displayPrice).toFixed(2)}</Text>
        )}

        {inStock ? (
          <View style={shared.cartActions} onStartShouldSetResponder={() => true}>
            <View style={shared.quantityControl}>
              <TouchableOpacity style={shared.quantityButton} onPress={decrement} disabled={quantity <= 1}>
                <Minus color={quantity <= 1 ? '#d1d5db' : '#6b7280'} size={16} />
              </TouchableOpacity>
              <Text style={shared.quantityText}>{quantity}</Text>
              <TouchableOpacity style={shared.quantityButton} onPress={increment} disabled={quantity >= stock}>
                <Plus color={quantity >= stock ? '#d1d5db' : '#6b7280'} size={16} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={shared.addButton} onPress={handleAddToCart}>
              <ShoppingCart color="#fff" size={16} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={shared.outOfStock}>
            <Text style={shared.outOfStockText}>Out of Stock</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pickerWrapper: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
    backgroundColor: '#fff', marginBottom: 6, overflow: 'hidden',
  },
  picker: { height: 36, color: '#1f2937' },
});
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions, Alert } from 'react-native';
import { Package, Plus, Minus, ShoppingCart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 40) / 2;

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

interface ComboCardProps {
  combo: Combo;
}

export default function ComboCard({ combo }: ComboCardProps) {
  const router = useRouter();
  const addToCart = useStore((state) => state.addToCart);
  const [quantity, setQuantity] = useState(1);

  const savings        = combo.regularPrice - combo.comboPrice;
  const savingsPercent = Math.round((savings / combo.regularPrice) * 100);
  const isInStock      = combo.stockLevel > 0;

  const increment = (e: any) => {
    e.stopPropagation();
    if (quantity < combo.stockLevel) setQuantity((q) => q + 1);
  };

  const decrement = (e: any) => {
    e.stopPropagation();
    if (quantity > 1) setQuantity((q) => q - 1);
  };

  const handleAddToCart = (e: any) => {
    e.stopPropagation();
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

  const hasBanner = savings > 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/combo/${combo.slug}`)}
      activeOpacity={0.7}
    >
      {/* ── Image ── */}
      <View style={styles.imageContainer}>
        {combo.images && combo.images.length > 0 ? (
          <Image source={{ uri: combo.images[0] }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Package color="#FF6B35" size={40} />
          </View>
        )}

        {/* Badges — top left */}
        <View style={styles.badgesContainer}>
          <View style={styles.comboBadge}>
            <Text style={styles.badgeText}>COMBO</Text>
          </View>
          {savingsPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.badgeText}>-{savingsPercent}%</Text>
            </View>
          )}
        </View>

        {/* Low-stock — bottom right, matches SpecialCard */}
        {combo.stockLevel < 10 && combo.stockLevel > 0 && (
          <View style={styles.stockWarning}>
            <Text style={styles.stockWarningText}>{combo.stockLevel} left</Text>
          </View>
        )}
      </View>

      {/* ── Content ── */}
      <View style={styles.content}>
        {/* Name — minHeight locks 2 lines */}
        <Text style={styles.name} numberOfLines={2}>
          {combo.name}
        </Text>

        {/* Description — minHeight locks 2 lines */}
        <Text style={styles.description} numberOfLines={2}>
          {combo.description}
        </Text>

        {/*
          Middle section — identical minHeight + spacer as SpecialCard.
          Keeps cart row pinned at the same position across all cards.
        */}
        <View style={styles.middleSection}>
          {/* Price — single price, no strikethrough */}
          <View style={styles.priceContainer}>
            <Text style={styles.price}>R{combo.comboPrice.toFixed(2)}</Text>
          </View>

          {/* Savings banner */}
          {hasBanner && (
            <View style={[styles.specialInfo, styles.specialInfoPurple]}>
              <Text style={[styles.specialInfoText, styles.specialInfoTextPurple]} numberOfLines={1}>
                Bundle Deal - Save R{savings.toFixed(2)}!
              </Text>
            </View>
          )}

          {/* Invisible spacer when no banner */}
          {!hasBanner && <View style={styles.bannerSpacer} />}
        </View>

        {/* ── Cart actions — pixel-perfect match to SpecialCard ── */}
        {isInStock ? (
          <View style={styles.cartActions} onStartShouldSetResponder={() => true}>
            {/* Quantity stepper — identical to SpecialCard */}
            <View style={styles.quantityControl}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={decrement}
                disabled={quantity <= 1}
              >
                <Minus color={quantity <= 1 ? '#d1d5db' : '#6b7280'} size={16} />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={increment}
                disabled={quantity >= combo.stockLevel}
              >
                <Plus color={quantity >= combo.stockLevel ? '#d1d5db' : '#6b7280'} size={16} />
              </TouchableOpacity>
            </View>

            {/* Cart button — identical to SpecialCard: flex:1, borderRadius:8, paddingVertical:8 */}
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
    position: 'relative',
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#f3f4f6',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef3e9' },

  // ── Badges — identical positioning/sizing to SpecialCard ──
  badgesContainer: { position: 'absolute', top: 8, left: 8, gap: 4 },
  comboBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },

  // Stock warning — bottom right, matches SpecialCard
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

  // ── Copied verbatim from SpecialCard ──
  name: {
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
  middleSection: {
    minHeight: 80,
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  price: { fontSize: 18, fontWeight: 'bold', color: '#FF6B35' },

  // Banner styles — copied verbatim from SpecialCard
  specialInfo: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 6,
    padding: 6,
  },
  specialInfoText: { fontSize: 10, color: '#1e40af', fontWeight: '600' },
  specialInfoPurple: { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' },
  specialInfoTextPurple: { color: '#7c3aed' },
  bannerSpacer: { height: 26 },

  // ── Cart actions — copied verbatim from SpecialCard ──
  cartActions: { flexDirection: 'row', gap: 8 },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  quantityButton: { padding: 8 },
  quantityText: { fontSize: 14, fontWeight: '600', color: '#1f2937', paddingHorizontal: 8 },
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
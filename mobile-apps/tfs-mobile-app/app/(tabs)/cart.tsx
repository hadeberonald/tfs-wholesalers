// app/(tabs)/cart.tsx
//
// ─── Fix summary ─────────────────────────────────────────────────────────────
// • subtotal  = sum of item.price * quantity (discounted price, excl. autoAdded)
// • savings   = sum of (originalPrice - price) * quantity for all items
// • autoAdded bonus rows are excluded from the subtotal (they're free / handled separately)

import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ShoppingCart, Trash2, Plus, Minus, Package,
  Tag, Gift, Lock, AlertCircle,
} from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function CartScreen() {
  const router          = useRouter();
  const items           = useStore((s) => s.items);
  const removeItem      = useStore((s) => s.removeItem);
  const updateQuantity  = useStore((s) => s.updateQuantity);
  const clearCart       = useStore((s) => s.clearCart);
  const branch          = useStore((s) => s.branch);
  const user            = useStore((s) => s.user);
  const isAuthenticated = !!user;

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (branch) fetchSpecials();
  }, [branch]);

  const fetchSpecials = async () => {
    if (!branch) return;
    setLoading(true);
    try {
      await api.get('/api/specials', { params: { branchId: branch._id, active: true } });
    } catch (err) {
      console.error('Failed to fetch specials:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Summary calculations ───────────────────────────────────────────────────
  // subtotal: discounted price × qty, only for real (non-auto-added) items
  const subtotal = items.reduce((sum, item) => {
    if (item.autoAdded) return sum;
    return sum + (item.price || 0) * item.quantity;
  }, 0);

  // savings: difference between original and discounted price for all items
  const totalSavings = items.reduce((sum, item) => {
    if (!item.originalPrice) return sum;
    const saving = (item.originalPrice - (item.price || 0)) * item.quantity;
    return sum + (saving > 0 ? saving : 0);
  }, 0);

  // freeItemSavings: full value of autoAdded free items (they cost R0 in cart)
  const freeItemSavings = items.reduce((sum, item) => {
    if (!item.autoAdded || !item.originalPrice) return sum;
    return sum + item.originalPrice * item.quantity;
  }, 0);

  const cartTotal   = subtotal;
  const deliveryFee = 85;
  const total       = cartTotal + deliveryFee;

  const totalDisplaySavings = totalSavings + freeItemSavings;

  // ── Item groups ────────────────────────────────────────────────────────────
  const regularItems    = items.filter((i) => !i.autoAdded && !i.isComboItem);
  const comboItems      = items.filter((i) => !i.autoAdded && i.isComboItem);
  const freeItems       = items.filter((i) => i.autoAdded && i.isFreeItem);
  const multibuyBonuses = items.filter((i) => i.autoAdded && i.isMultibuyBonus);

  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items including special offers?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearCart },
      ]
    );
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to continue with checkout',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/login') },
        ]
      );
      return;
    }
    router.push('/checkout');
  };

  const increaseQuantity = (id: string, currentQty: number, variantId?: string) =>
    updateQuantity(id, currentQty + 1, variantId);

  const decreaseQuantity = (id: string, currentQty: number, variantId?: string) => {
    if (currentQty > 1) updateQuantity(id, currentQty - 1, variantId);
    else handleRemoveItem(id, variantId);
  };

  const handleRemoveItem = (id: string, variantId?: string) => {
    const item = items.find((i) => {
      if (variantId) return i.id === id && i.variantId === variantId;
      return i.id === id && !i.variantId;
    });
    if (item?.autoAdded) {
      Alert.alert('Cannot Remove', 'This item is automatically added by a special and cannot be manually removed.', [{ text: 'OK' }]);
      return;
    }
    Alert.alert('Remove Item', 'Remove this item from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeItem(id, variantId) },
    ]);
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ShoppingCart color="#9ca3af" size={80} />
        <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
        <Text style={styles.emptyText}>Add some products to get started!</Text>
        <TouchableOpacity style={styles.shopButton} onPress={() => router.push('/(tabs)/shop')}>
          <Text style={styles.shopButtonText}>Start Shopping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Shopping Cart</Text>
        <TouchableOpacity onPress={handleClearCart}>
          <Text style={styles.clearButton}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.loadingText}>Loading specials...</Text>
          </View>
        )}

        {/* ── Regular Items ──────────────────────────────────────────────────── */}
        {regularItems.map((item) => {
          const itemPrice         = item.price || 0;
          const itemOriginalPrice = item.originalPrice || itemPrice;
          const itemTotal         = itemPrice * item.quantity;
          const itemOriginalTotal = itemOriginalPrice * item.quantity;
          const hasSpecial        = item.appliedSpecialId && item.meetsSpecialRequirement;
          const hasSpecialNotMet  = item.appliedSpecialId && !item.meetsSpecialRequirement;

          return (
            <View key={`${item.id}-${item.variantId || ''}`} style={styles.cartItem}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.itemImage} />
              ) : (
                <View style={[styles.itemImage, styles.itemPlaceholder]}>
                  <Package color="#9ca3af" size={32} />
                </View>
              )}

              <View style={styles.itemDetails}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name}
                  {item.variantName && <Text style={styles.variantName}> — {item.variantName}</Text>}
                </Text>

                {/* Price row */}
                {hasSpecial ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.itemPriceSpecial}>R{itemTotal.toFixed(2)}</Text>
                    {itemOriginalTotal > itemTotal && (
                      <Text style={styles.itemPriceOriginal}>R{itemOriginalTotal.toFixed(2)}</Text>
                    )}
                    <Tag color="#10b981" size={16} />
                  </View>
                ) : (
                  <Text style={styles.itemPrice}>R{itemTotal.toFixed(2)}</Text>
                )}

                <Text style={styles.unitPrice}>
                  {item.quantity} × R{itemPrice.toFixed(2)} each
                </Text>

                {/* Special badges */}
                {hasSpecial && (
                  <View style={styles.specialBadge}>
                    <Tag color="#10b981" size={12} />
                    <Text style={styles.specialBadgeText} numberOfLines={2}>{item.specialDescription}</Text>
                  </View>
                )}
                {hasSpecialNotMet && (
                  <View style={styles.specialBadgeBlue}>
                    <AlertCircle color="#3b82f6" size={12} />
                    <Text style={styles.specialBadgeTextBlue} numberOfLines={2}>{item.specialDescription}</Text>
                  </View>
                )}

                {/* Quantity control */}
                <View style={styles.quantityControl}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => decreaseQuantity(item.id, item.quantity, item.variantId)}
                  >
                    <Minus color="#6b7280" size={16} />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => increaseQuantity(item.id, item.quantity, item.variantId)}
                  >
                    <Plus color="#6b7280" size={16} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => handleRemoveItem(item.id, item.variantId)}
                style={styles.removeButton}
              >
                <Trash2 color="#ef4444" size={20} />
              </TouchableOpacity>
            </View>
          );
        })}

        {/* ── Combo Deals ────────────────────────────────────────────────────── */}
        {comboItems.length > 0 && (
          <View style={styles.comboSection}>
            <View style={styles.comboHeader}>
              <Package color="#7c3aed" size={24} />
              <Text style={styles.comboTitle}>Combo Deals</Text>
              <View style={styles.comboCount}>
                <Text style={styles.comboCountText}>{comboItems.length}</Text>
              </View>
            </View>

            {comboItems.map((item) => {
              const itemPrice         = item.price || 0;
              const itemOriginalPrice = item.originalPrice || itemPrice;
              const itemTotal         = itemPrice * item.quantity;
              const itemOriginalTotal = itemOriginalPrice * item.quantity;
              const savings           = itemOriginalTotal - itemTotal;
              const discountPercent   = itemOriginalPrice > 0 ? Math.round((savings / itemOriginalTotal) * 100) : 0;

              return (
                <View key={`${item.id}-combo`} style={styles.comboItem}>
                  <View style={styles.imageContainer}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.bonusItemImage} />
                    ) : (
                      <View style={[styles.bonusItemImage, styles.itemPlaceholder]}>
                        <Package color="#9ca3af" size={32} />
                      </View>
                    )}
                    <View style={styles.comboBadge}>
                      <Text style={styles.comboBadgeText}>COMBO</Text>
                    </View>
                  </View>

                  <View style={styles.itemDetails}>
                    <View style={styles.autoAddedHeader}>
                      <Package color="#7c3aed" size={14} />
                      <Text style={styles.comboAutoAddedText}>Combo Deal</Text>
                      {(item as any).comboItemCount && (
                        <View style={styles.comboItemCountBadge}>
                          <Text style={styles.comboItemCountText}>{(item as any).comboItemCount} items</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>

                    <View style={styles.priceRow}>
                      <Text style={styles.itemPriceSpecial}>R{itemTotal.toFixed(2)}</Text>
                      {savings > 0 && (
                        <Text style={styles.itemPriceOriginal}>R{itemOriginalTotal.toFixed(2)}</Text>
                      )}
                      {discountPercent > 0 && (
                        <View style={styles.discountBadgeInline}>
                          <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
                        </View>
                      )}
                    </View>

                    {savings > 0 && (
                      <View style={styles.comboBannerBox}>
                        <Tag color="#7c3aed" size={12} />
                        <Text style={styles.comboBannerText} numberOfLines={1}>
                          Bundle Deal — Save R{savings.toFixed(2)}!
                        </Text>
                      </View>
                    )}

                    <View style={styles.quantityControl}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => decreaseQuantity(item.id, item.quantity, item.variantId)}
                      >
                        <Minus color="#6b7280" size={16} />
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => increaseQuantity(item.id, item.quantity, item.variantId)}
                      >
                        <Plus color="#6b7280" size={16} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleRemoveItem(item.id, item.variantId)}
                    style={styles.removeButton}
                  >
                    <Trash2 color="#ef4444" size={20} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Multibuy Bundle Deals ──────────────────────────────────────────── */}
        {multibuyBonuses.length > 0 && (
          <View style={styles.bundleSection}>
            <View style={styles.bundleHeader}>
              <Package color="#7c3aed" size={24} />
              <Text style={styles.bundleTitle}>Bundle Deals</Text>
              <View style={styles.bundleCount}>
                <Text style={styles.bundleCountText}>{multibuyBonuses.length}</Text>
              </View>
            </View>

            {multibuyBonuses.map((item) => {
              const savings       = item.specialDiscount || 0;
              const originalTotal = (item.originalPrice || 0) * item.quantity;

              return (
                <View key={item.id} style={styles.bundleItem}>
                  <View style={styles.imageContainer}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.bonusItemImage} />
                    ) : (
                      <View style={[styles.bonusItemImage, styles.itemPlaceholder]}>
                        <Package color="#9ca3af" size={32} />
                      </View>
                    )}
                    <View style={styles.dealBadge}>
                      <Text style={styles.dealBadgeText}>DEAL</Text>
                    </View>
                  </View>

                  <View style={styles.itemDetails}>
                    <View style={styles.autoAddedHeader}>
                      <Package color="#7c3aed" size={14} />
                      <Text style={styles.bundleAutoAddedText}>Bundle Deal Active</Text>
                    </View>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.bundleDescription}>
                      <Tag color="#7c3aed" size={12} />
                      <Text style={styles.bundleDescriptionText} numberOfLines={2}>{item.specialDescription}</Text>
                    </View>
                    <View style={styles.bonusPricing}>
                      <Text style={styles.originalPrice}>R{originalTotal.toFixed(2)} original</Text>
                      <Text style={styles.bundlePricingNote}>Discount applied to item price above</Text>
                    </View>
                    {savings > 0 && (
                      <View style={[styles.savingsBadge, { backgroundColor: '#ede9fe' }]}>
                        <Text style={[styles.savingsText, { color: '#6d28d9' }]}>Save R{savings.toFixed(2)}</Text>
                      </View>
                    )}
                    <View style={styles.bonusQuantity}>
                      <Text style={styles.quantityLabel}>{item.quantity} items in bundle(s)</Text>
                      <View style={styles.lockedBadge}>
                        <Lock color="#6b7280" size={12} />
                        <Text style={styles.lockedText}>Auto-managed</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}

            <View style={[styles.infoBox, { borderColor: '#c4b5fd', backgroundColor: '#ede9fe' }]}>
              <AlertCircle color="#7c3aed" size={16} />
              <Text style={[styles.infoText, { color: '#4c1d95' }]}>
                Bundle pricing is automatically applied. The discounted price is already reflected in your item above.
              </Text>
            </View>
          </View>
        )}

        {/* ── Buy X Get Y Free Items ─────────────────────────────────────────── */}
        {freeItems.length > 0 && (
          <View style={styles.bonusSection}>
            <View style={styles.bonusHeader}>
              <Gift color="#10b981" size={24} />
              <Text style={styles.bonusTitle}>Bonus Items</Text>
              <View style={styles.bonusCount}>
                <Text style={styles.bonusCountText}>{freeItems.length}</Text>
              </View>
            </View>

            {freeItems.map((item) => {
              const itemPrice         = item.price || 0;
              const itemOriginalPrice = item.originalPrice || 0;
              const savings           = (itemOriginalPrice - itemPrice) * item.quantity;

              return (
                <View key={`${item.id}-${item.variantId || ''}-free`} style={styles.bonusItem}>
                  <View style={styles.imageContainer}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.bonusItemImage} />
                    ) : (
                      <View style={[styles.bonusItemImage, styles.itemPlaceholder]}>
                        <Package color="#9ca3af" size={32} />
                      </View>
                    )}
                    <View style={styles.freeBadge}>
                      <Text style={styles.freeBadgeText}>FREE</Text>
                    </View>
                  </View>

                  <View style={styles.itemDetails}>
                    <View style={styles.autoAddedHeader}>
                      <Gift color="#10b981" size={14} />
                      <Text style={styles.autoAddedText}>Auto-Added Bonus</Text>
                    </View>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name}
                      {item.variantName && <Text style={styles.variantName}> — {item.variantName}</Text>}
                    </Text>
                    <View style={styles.bonusDescription}>
                      <Tag color="#10b981" size={12} />
                      <Text style={styles.bonusDescriptionText} numberOfLines={2}>{item.specialDescription}</Text>
                    </View>
                    <View style={styles.bonusPricing}>
                      {itemPrice === 0 ? (
                        <Text style={styles.freeText}>FREE</Text>
                      ) : (
                        <View style={styles.priceRow}>
                          <Text style={styles.discountedPrice}>R{(itemPrice * item.quantity).toFixed(2)}</Text>
                          <Text style={styles.originalPrice}>R{(itemOriginalPrice * item.quantity).toFixed(2)}</Text>
                        </View>
                      )}
                    </View>
                    {savings > 0 && (
                      <View style={styles.savingsBadge}>
                        <Text style={styles.savingsText}>Save R{savings.toFixed(2)}</Text>
                      </View>
                    )}
                    <View style={styles.bonusQuantity}>
                      <Text style={styles.quantityLabel}>Qty: {item.quantity}</Text>
                      <View style={styles.lockedBadge}>
                        <Lock color="#6b7280" size={12} />
                        <Text style={styles.lockedText}>Auto-managed</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}

            <View style={styles.infoBox}>
              <AlertCircle color="#3b82f6" size={16} />
              <Text style={styles.infoText}>
                Bonus items are automatically added based on your qualifying purchases. Their quantities adjust automatically.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Cart Summary ──────────────────────────────────────────────────────── */}
      <View style={styles.summary}>

        {/* Subtotal row — shows discounted price */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>R{subtotal.toFixed(2)}</Text>
        </View>

        {/* Savings row — only shown when there are actual savings */}
        {totalDisplaySavings > 0 && (
          <View style={styles.savingsRow}>
            <View style={styles.savingsLabel}>
              <Tag color="#10b981" size={16} />
              <Text style={styles.savingsLabelText}>Special Savings</Text>
            </View>
            <Text style={styles.savingsValue}>-R{totalDisplaySavings.toFixed(2)}</Text>
          </View>
        )}

        {/* Delivery */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Delivery Fee</Text>
          <Text style={styles.summaryValue}>R{deliveryFee.toFixed(2)}</Text>
        </View>

        {/* Total */}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>R{total.toFixed(2)}</Text>
        </View>

        {/* Celebration banner */}
        {totalDisplaySavings > 0 && (
          <View style={styles.celebrationBadge}>
            <Text style={styles.celebrationText}>
              🎉 You're saving R{totalDisplaySavings.toFixed(2)} with specials!
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
          <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#fff', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title:       { fontSize: 28, fontWeight: 'bold', color: '#1f2937' },
  clearButton: { fontSize: 14, color: '#ef4444', fontWeight: '600' },

  loadingContainer: { padding: 32, alignItems: 'center' },
  loadingText:      { marginTop: 12, color: '#6b7280', fontSize: 14 },

  itemsList: { flex: 1, padding: 16 },

  // Regular cart item
  cartItem: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12,
    padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },
  itemImage:       { width: 80, height: 80, borderRadius: 8, backgroundColor: '#f3f4f6' },
  itemPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemDetails:     { flex: 1, marginLeft: 12 },
  itemName:        { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  variantName:     { color: '#6b7280', fontWeight: '400' },
  unitPrice:       { fontSize: 12, color: '#6b7280', marginBottom: 6 },

  priceRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  itemPrice:         { fontSize: 16, fontWeight: 'bold', color: '#FF6B35', marginBottom: 4 },
  itemPriceSpecial:  { fontSize: 16, fontWeight: 'bold', color: '#FF6B35' },
  itemPriceOriginal: { fontSize: 14, color: '#9ca3af', textDecorationLine: 'line-through' },

  specialBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, marginBottom: 8, alignSelf: 'flex-start',
  },
  specialBadgeText:     { fontSize: 11, color: '#059669', fontWeight: '600' },
  specialBadgeBlue: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, marginBottom: 8, alignSelf: 'flex-start',
  },
  specialBadgeTextBlue: { fontSize: 11, color: '#2563eb', fontWeight: '600' },

  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  quantityButton: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  quantityText: { fontSize: 16, fontWeight: '600', color: '#1f2937', minWidth: 24, textAlign: 'center' },
  removeButton: { justifyContent: 'center', alignItems: 'center', padding: 8, marginLeft: 4 },

  // Combo
  comboSection: { marginTop: 16 },
  comboHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  comboTitle:   { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  comboCount:   { backgroundColor: '#7c3aed', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  comboCountText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  comboItem: {
    flexDirection: 'row', backgroundColor: '#faf5ff', borderRadius: 12,
    padding: 12, marginBottom: 12, borderWidth: 2, borderColor: '#ddd6fe',
  },
  imageContainer: { position: 'relative' },
  bonusItemImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#fff', borderWidth: 2, borderColor: '#ddd6fe' },
  comboBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#7c3aed', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  comboBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  comboAutoAddedText: { fontSize: 10, color: '#7c3aed', fontWeight: 'bold', textTransform: 'uppercase' },
  comboItemCountBadge: { backgroundColor: '#ede9fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  comboItemCountText: { fontSize: 10, color: '#6d28d9', fontWeight: '600' },
  discountBadgeInline: { backgroundColor: '#ef4444', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  discountBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  comboBannerBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#ddd6fe',
  },
  comboBannerText: { fontSize: 11, color: '#5b21b6', fontWeight: '600', flex: 1 },

  // Bundle
  bundleSection: { marginTop: 16 },
  bundleHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  bundleTitle:   { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  bundleCount:   { backgroundColor: '#7c3aed', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  bundleCountText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  bundleItem: {
    flexDirection: 'row', backgroundColor: '#faf5ff', borderRadius: 12,
    padding: 12, marginBottom: 12, borderWidth: 2, borderColor: '#ddd6fe',
  },
  dealBadge:    { position: 'absolute', top: 4, right: 4, backgroundColor: '#7c3aed', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  dealBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  bundleDescription: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#ddd6fe',
  },
  bundleDescriptionText:  { fontSize: 11, color: '#5b21b6', fontWeight: '600', flex: 1 },
  bundleAutoAddedText:    { fontSize: 10, color: '#7c3aed', fontWeight: 'bold', textTransform: 'uppercase' },
  bundlePricingNote:      { fontSize: 11, color: '#7c3aed', fontWeight: '500', marginTop: 2 },

  // Bonus / free items
  bonusSection: { marginTop: 16 },
  bonusHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  bonusTitle:   { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  bonusCount:   { backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  bonusCountText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  bonusItem: {
    flexDirection: 'row', backgroundColor: '#ecfdf5', borderRadius: 12,
    padding: 12, marginBottom: 12, borderWidth: 2, borderColor: '#a7f3d0',
  },
  freeBadge:     { position: 'absolute', top: 4, right: 4, backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  freeBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  autoAddedHeader:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  autoAddedText:    { fontSize: 10, color: '#059669', fontWeight: 'bold', textTransform: 'uppercase' },
  bonusDescription: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.5)', paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#a7f3d0',
  },
  bonusDescriptionText: { fontSize: 11, color: '#047857', fontWeight: '600', flex: 1 },
  bonusPricing:         { marginBottom: 8 },
  freeText:             { fontSize: 18, fontWeight: 'bold', color: '#10b981' },
  discountedPrice:      { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
  originalPrice:        { fontSize: 13, color: '#9ca3af', textDecorationLine: 'line-through' },
  savingsBadge:         { backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 8 },
  savingsText:          { fontSize: 11, color: '#047857', fontWeight: 'bold' },
  bonusQuantity:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quantityLabel:        { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  lockedBadge:          { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockedText:           { fontSize: 10, color: '#6b7280' },
  infoBox:              { flexDirection: 'row', backgroundColor: '#dbeafe', padding: 12, borderRadius: 8, gap: 8, borderWidth: 1, borderColor: '#93c5fd' },
  infoText:             { flex: 1, fontSize: 12, color: '#1e40af', lineHeight: 16 },

  // ── Summary ──────────────────────────────────────────────────────────────
  summary: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },

  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 14, color: '#6b7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#1f2937' },

  savingsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#d1fae5', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#a7f3d0',
  },
  savingsLabel:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  savingsLabelText: { fontSize: 14, color: '#047857', fontWeight: '600' },
  savingsValue:     { fontSize: 16, fontWeight: 'bold', color: '#047857' },

  totalRow:   { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: '#FF6B35' },

  celebrationBadge: { backgroundColor: '#d1fae5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  celebrationText:  { fontSize: 12, color: '#047857', fontWeight: '600' },

  checkoutButton:     { backgroundColor: '#FF6B35', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  checkoutButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Empty state
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', padding: 20 },
  emptyTitle:     { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginTop: 16, marginBottom: 8 },
  emptyText:      { fontSize: 16, color: '#6b7280', marginBottom: 32, textAlign: 'center' },
  shopButton:     { backgroundColor: '#FF6B35', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  shopButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
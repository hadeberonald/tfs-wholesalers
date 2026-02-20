// app/checkout.tsx  (Expo Router — customer app)
//
// ─── What changed ────────────────────────────────────────────────────────────
// 1. Delivery fee comes from address-picker (distance-based, matches web logic)
// 2. Order schema normalized to match web POST /api/orders exactly:
//    - customerInfo  { name, email, phone }
//    - shippingAddress (not deliveryAddress) – matches web field name
//    - status: 'payment_pending' (set by web before payment)
//    - paymentStatus: 'pending'
//    - All special/bonus/combo fields preserved for picker app
// 3. Delivery fee displayed live as user picks address

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  MapPin, ChevronLeft, ChevronRight, Package, ShoppingBag,
  Truck, AlertCircle, CheckCircle, Tag,
} from 'lucide-react-native';
import { useStore } from '@/lib/store';
import api from '@/lib/api';
import type { DeliveryAddress } from '@/app/address-picker';

// ─────────────────────────────────────────────────────────────────────────────
// Constants – free delivery threshold (matches web)
// ─────────────────────────────────────────────────────────────────────────────
const FREE_DELIVERY_THRESHOLD = 500; // R500 cart subtotal → free delivery

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function specialTypeBadge(type?: string) {
  if (!type) return null;
  const map: Record<string, { label: string; bg: string; color: string }> = {
    buy_x_get_y:    { label: 'Buy X Get Y',   bg: '#d1fae5', color: '#065f46' },
    multibuy:       { label: 'Multibuy',       bg: '#ede9fe', color: '#5b21b6' },
    combo:          { label: 'Combo',          bg: '#ede9fe', color: '#5b21b6' },
    percentage_off: { label: '% Off',          bg: '#fef3c7', color: '#92400e' },
    amount_off:     { label: 'Amount Off',     bg: '#fef3c7', color: '#92400e' },
    fixed_price:    { label: 'Special Price',  bg: '#fef3c7', color: '#92400e' },
    bonus:          { label: 'Bonus',          bg: '#d1fae5', color: '#065f46' },
    bundle:         { label: 'Bundle',         bg: '#ede9fe', color: '#5b21b6' },
  };
  const s = map[type];
  if (!s) return null;
  return (
    <View style={[styles.specialBadge, { backgroundColor: s.bg }]}>
      <Tag size={10} color={s.color} />
      <Text style={[styles.specialBadgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function CheckoutScreen() {
  const router = useRouter();
  const {
    items,
    user,
    branch,
    getTotal,
    pendingDeliveryAddress,
    setPendingDeliveryAddress,
  } = useStore();

  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  // ── Consume address set by address-picker ─────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (pendingDeliveryAddress) {
        setDeliveryAddress(pendingDeliveryAddress as DeliveryAddress);
        setPendingDeliveryAddress(null);
      }
    }, [pendingDeliveryAddress])
  );

  // ── Financials ────────────────────────────────────────────────────────────
  const subtotal = getTotal();

  // If cart qualifies for free delivery, ignore distance fee
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD
    ? 0
    : (deliveryAddress?.deliveryFee ?? 0);

  const total = subtotal + deliveryFee;

  const totalSavings = items.reduce(
    (s, i) => s + ((i.specialDiscount || 0) * i.quantity),
    0,
  );

  // ── Item groups ───────────────────────────────────────────────────────────
  const regularItems = items.filter(
    (i) => !i.isBonusItem && !i.isFreeItem && !i.isMultibuyBonus && !i.isComboItem,
  );
  const bonusItems = items.filter(
    (i) => i.isBonusItem || i.isFreeItem || i.isMultibuyBonus,
  );
  const comboItems = items.filter((i) => i.isComboItem);

  // ── Place order ───────────────────────────────────────────────────────────
  const placeOrder = async () => {
    if (!deliveryAddress) {
      Alert.alert('Delivery Address Required', 'Please select a delivery address before continuing.');
      return;
    }
    if (deliveryAddress.outsideZone) {
      Alert.alert('Outside Delivery Zone', 'Your selected address is outside our delivery area. Please choose a different address.');
      return;
    }
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to place an order.');
      return;
    }
    if (!branch?._id && !branch?.id) {
      Alert.alert('Branch Error', 'Could not determine your branch. Please restart the app.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty.');
      return;
    }

    setPlacingOrder(true);
    try {
      const branchId = branch._id || branch.id;

      // ✅ Map cart items → order items
      // Schema matches web exactly so picker/delivery apps see the same shape
      const orderItems = items.map((item) => ({
        // Core product fields
        productId:   item.id,
        variantId:   item.variantId,
        name:        item.name,
        variantName: item.variantName,
        price:       item.price,
        originalPrice: item.originalPrice ?? item.price,
        quantity:    item.quantity,
        image:       item.image,
        sku:         (item as any).sku || '',

        // Special / promotion fields
        appliedSpecialId:        item.appliedSpecialId,
        specialDiscount:         item.specialDiscount,
        specialDescription:      item.specialDescription,
        specialType:             (item as any).specialType,
        specialConditions:       (item as any).specialConditions,
        meetsSpecialRequirement: item.meetsSpecialRequirement,

        // Bonus / free item flags
        isFreeItem:      item.isFreeItem       || false,
        isMultibuyBonus: item.isMultibuyBonus   || false,
        isBonusItem:     item.isBonusItem       || false,
        autoAdded:       item.autoAdded         || false,
        linkedToItemId:  item.linkedToItemId,

        // Combo flags
        isComboItem: item.isComboItem || false,
        comboId:     (item as any).comboId,
        comboName:   (item as any).comboName,
        comboItems:  (item as any).comboItems,
      }));

      // ✅ Order body normalized to match web /api/orders POST schema
      const orderBody = {
        // ── Identity ─────────────────────────────────────────────────────
        userId:   user.id,
        branchId,

        // ── Customer info (matches web schema) ───────────────────────────
        customerInfo: {
          name:  user.name,
          email: user.email,
          phone: (user as any).phone || '',
        },

        // ── Items ────────────────────────────────────────────────────────
        items: orderItems,

        // ── Address – uses 'shippingAddress' to match web schema ─────────
        shippingAddress: {
          address:     deliveryAddress.formattedAddress,
          lat:         deliveryAddress.lat,
          lng:         deliveryAddress.lng,
          city:        deliveryAddress.city,
          province:    deliveryAddress.province,
          postalCode:  deliveryAddress.postalCode,
          // Keep full address object for driver app
          street:      deliveryAddress.street,
          name:        deliveryAddress.name,
          country:     deliveryAddress.country,
        },

        // ── Financials ───────────────────────────────────────────────────
        subtotal:     parseFloat(subtotal.toFixed(2)),
        deliveryFee:  parseFloat(deliveryFee.toFixed(2)),
        total:        parseFloat(total.toFixed(2)),
        totalSavings: parseFloat(totalSavings.toFixed(2)),

        // ── Delivery meta ────────────────────────────────────────────────
        deliveryDistance: deliveryAddress.distance,  // km – useful for driver app
        deliveryNotes:    '',

        // ── Payment / status – matches web flow ──────────────────────────
        paymentMethod: 'card',
        paymentStatus: 'pending',
        status:        'payment_pending',

        // ── Source tag (helps admin distinguish web vs app orders) ───────
        orderSource: 'mobile_app',
      };

      const res = await api.post('/api/orders', orderBody);

      if (!res.data.success) {
        throw new Error(res.data.error || 'Failed to create order');
      }

      const { orderId, orderNumber } = res.data;

      // Navigate to payment screen
      router.push(
        `/payment?orderId=${orderId}&amount=${total.toFixed(2)}&orderNumber=${encodeURIComponent(orderNumber)}`,
      );
    } catch (e: any) {
      console.error('[Checkout] placeOrder error:', e);
      Alert.alert(
        'Order Failed',
        e?.response?.data?.error || e?.message || 'Something went wrong. Please try again.',
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────
  const renderItem = (item: typeof items[0], index: number) => {
    const isBonus  = item.isBonusItem || item.isFreeItem || item.isMultibuyBonus;
    const isCombo  = item.isComboItem;
    const linePrice = isBonus ? 0 : item.price * item.quantity;

    return (
      <View
        key={`${item.id}-${item.variantId}-${index}`}
        style={[
          styles.itemRow,
          isBonus && styles.itemRowBonus,
          isCombo && styles.itemRowCombo,
        ]}
      >
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.itemImg} />
        ) : (
          <View style={[styles.itemImg, styles.itemImgPlaceholder]}>
            <Package color="#d1d5db" size={18} />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <View style={styles.itemNameRow}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
              {item.variantName ? (
                <Text style={styles.itemVariant}> — {item.variantName}</Text>
              ) : null}
            </Text>
            {isBonus && (
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>FREE</Text>
              </View>
            )}
          </View>

          {(item as any).specialType && specialTypeBadge((item as any).specialType)}

          {isCombo && (item as any).comboItems?.length > 0 && (
            <Text style={styles.comboBreakdown} numberOfLines={2}>
              {(item as any).comboItems.map((c: any) => `${c.quantity}× ${c.productName}`).join(', ')}
            </Text>
          )}

          <View style={styles.itemQtyPriceRow}>
            <Text style={styles.itemQty}>×{item.quantity}</Text>
            {item.specialDiscount ? (
              <Text style={styles.itemOrigPrice}>
                R{(item.originalPrice ?? item.price).toFixed(2)}
              </Text>
            ) : null}
            <Text style={[styles.itemPrice, isBonus && styles.itemPriceFree]}>
              {isBonus ? 'FREE' : `R${linePrice.toFixed(2)}`}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Empty cart guard
  // ─────────────────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ShoppingBag color="#d1d5db" size={72} />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/(tabs)')}>
          <Text style={styles.shopBtnText}>Go Shopping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────
  const canCheckout = !!deliveryAddress && !deliveryAddress.outsideZone && !placingOrder;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color="#1f2937" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <Text style={styles.headerSub}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Delivery address ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>

          {deliveryAddress ? (
            <TouchableOpacity
              style={[
                styles.addressSelected,
                deliveryAddress.outsideZone && styles.addressSelectedError,
              ]}
              onPress={() => router.push('/address-picker')}
            >
              <View style={styles.addressIconWrap}>
                <MapPin color={deliveryAddress.outsideZone ? '#ef4444' : '#FF6B35'} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressStreet} numberOfLines={1}>
                  {deliveryAddress.street || deliveryAddress.name}
                </Text>
                <Text style={styles.addressCity} numberOfLines={1}>
                  {[deliveryAddress.city, deliveryAddress.province, deliveryAddress.postalCode]
                    .filter(Boolean).join(', ')}
                </Text>
                {deliveryAddress.outsideZone ? (
                  <Text style={styles.outsideZoneText}>
                    ⚠️ {deliveryAddress.distance.toFixed(1)} km – outside delivery area
                  </Text>
                ) : (
                  <Text style={styles.deliveryFeeInline}>
                    {deliveryAddress.distance.toFixed(1)} km ·{' '}
                    {deliveryFee === 0
                      ? '🎉 Free delivery!'
                      : `Delivery: R${deliveryFee.toFixed(2)}`}
                  </Text>
                )}
              </View>
              <ChevronRight color="#9ca3af" size={18} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.addressEmpty}
              onPress={() => router.push('/address-picker')}
            >
              <MapPin color="#FF6B35" size={20} />
              <Text style={styles.addressEmptyText}>Select delivery address</Text>
              <ChevronRight color="#9ca3af" size={18} />
            </TouchableOpacity>
          )}

          {/* Free delivery hint */}
          {deliveryAddress && !deliveryAddress.outsideZone && subtotal < FREE_DELIVERY_THRESHOLD && (
            <View style={styles.freeDeliveryHintRow}>
              <Truck color="#6b7280" size={14} />
              <Text style={styles.freeDeliveryHintText}>
                Add <Text style={{ fontWeight: '700' }}>R{(FREE_DELIVERY_THRESHOLD - subtotal).toFixed(2)}</Text> more for free delivery
              </Text>
            </View>
          )}
        </View>

        {/* ── Items ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Your Items ({items.length})</Text>

          {regularItems.map((item, i) => renderItem(item, i))}

          {comboItems.length > 0 && (
            <>
              <View style={styles.groupDivider}>
                <Text style={styles.groupDividerText}>📦 Combo Items</Text>
              </View>
              {comboItems.map((item, i) => renderItem(item, i + 1000))}
            </>
          )}

          {bonusItems.length > 0 && (
            <>
              <View style={styles.groupDivider}>
                <Text style={styles.groupDividerText}>🎁 Free Bonus Items</Text>
              </View>
              {bonusItems.map((item, i) => renderItem(item, i + 2000))}
            </>
          )}
        </View>

        {/* ── Savings notice ── */}
        {totalSavings > 0 && (
          <View style={styles.savingsCard}>
            <CheckCircle color="#10b981" size={18} />
            <Text style={styles.savingsText}>
              You're saving <Text style={{ fontWeight: '800' }}>R{totalSavings.toFixed(2)}</Text> with specials!
            </Text>
          </View>
        )}

        {bonusItems.length > 0 && (
          <View style={styles.bonusNotice}>
            <AlertCircle color="#f59e0b" size={16} />
            <Text style={styles.bonusNoticeText}>
              {bonusItems.length} free bonus item{bonusItems.length > 1 ? 's' : ''} will be included with your order
            </Text>
          </View>
        )}

        {/* ── Order summary ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Order Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>R{subtotal.toFixed(2)}</Text>
          </View>

          {totalSavings > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#10b981' }]}>Specials Savings</Text>
              <Text style={[styles.summaryValue, { color: '#10b981' }]}>-R{totalSavings.toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery</Text>
            <Text style={styles.summaryValue}>
              {!deliveryAddress ? (
                <Text style={{ color: '#9ca3af' }}>Select address</Text>
              ) : deliveryFee === 0 ? (
                <Text style={{ color: '#10b981', fontWeight: '700' }}>FREE</Text>
              ) : (
                `R${deliveryFee.toFixed(2)}`
              )}
            </Text>
          </View>

          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>R{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Delivery info */}
        <View style={styles.deliveryInfoRow}>
          <Truck color="#6b7280" size={16} />
          <Text style={styles.deliveryInfoText}>
            Delivered by TFS Wholesalers. Estimated 1–3 hours after order is confirmed.
          </Text>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        {!deliveryAddress && (
          <View style={styles.footerWarning}>
            <AlertCircle color="#f59e0b" size={14} />
            <Text style={styles.footerWarningText}>Select a delivery address to continue</Text>
          </View>
        )}
        {deliveryAddress?.outsideZone && (
          <View style={[styles.footerWarning, styles.footerError]}>
            <AlertCircle color="#ef4444" size={14} />
            <Text style={[styles.footerWarningText, { color: '#ef4444' }]}>
              Address is outside our delivery zone
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.placeOrderBtn, !canCheckout && styles.placeOrderBtnDisabled]}
          onPress={placeOrder}
          disabled={!canCheckout}
        >
          {placingOrder ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.placeOrderBtnText}>
                Place Order — R{total.toFixed(2)}
              </Text>
              <ChevronRight color="#fff" size={20} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, backgroundColor: '#f9fafb' },
  emptyTitle:     { fontSize: 20, fontWeight: '700', color: '#6b7280' },
  shopBtn:        { backgroundColor: '#FF6B35', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  shopBtnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1f2937' },
  headerSub:   { fontSize: 13, color: '#9ca3af' },

  scroll: { padding: 16 },

  sectionCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18,
    marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 14 },

  // Address
  addressSelected: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff7f3', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#fed7aa',
  },
  addressSelectedError: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  addressIconWrap: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fed7aa',
  },
  addressStreet:     { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  addressCity:       { fontSize: 12, color: '#6b7280', marginTop: 2 },
  deliveryFeeInline: { fontSize: 12, color: '#FF6B35', fontWeight: '600', marginTop: 3 },
  outsideZoneText:   { fontSize: 12, color: '#ef4444', fontWeight: '600', marginTop: 3 },
  addressEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 2, borderColor: '#FF6B35', borderStyle: 'dashed',
    borderRadius: 14, padding: 16,
  },
  addressEmptyText: { flex: 1, fontSize: 14, color: '#FF6B35', fontWeight: '600' },

  freeDeliveryHintRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  freeDeliveryHintText: { fontSize: 12, color: '#6b7280' },

  // Items
  itemRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9fafb',
  },
  itemRowBonus: { backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  itemRowCombo: { backgroundColor: '#f5f3ff', borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  itemImg:            { width: 48, height: 48, borderRadius: 10, backgroundColor: '#f3f4f6' },
  itemImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  itemName:     { flex: 1, fontSize: 13, fontWeight: '600', color: '#1f2937' },
  itemVariant:  { color: '#9ca3af', fontWeight: '400' },
  freeBadge:    { backgroundColor: '#d1fae5', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  freeBadgeText: { fontSize: 10, fontWeight: '800', color: '#065f46' },
  specialBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  specialBadgeText: { fontSize: 10, fontWeight: '700' },
  comboBreakdown: { fontSize: 11, color: '#7c3aed', marginTop: 3 },
  itemQtyPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  itemQty:         { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  itemOrigPrice:   { fontSize: 11, color: '#9ca3af', textDecorationLine: 'line-through' },
  itemPrice:       { fontSize: 14, fontWeight: '700', color: '#FF6B35' },
  itemPriceFree:   { color: '#10b981' },

  groupDivider: { marginVertical: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  groupDividerText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },

  // Savings
  savingsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 14,
  },
  savingsText: { flex: 1, fontSize: 13, color: '#15803d' },

  bonusNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fffbeb', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#fde68a', marginBottom: 14,
  },
  bonusNoticeText: { flex: 1, fontSize: 13, color: '#92400e' },

  // Summary
  summaryRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel:      { fontSize: 14, color: '#6b7280' },
  summaryValue:      { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  summaryTotal:      { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 4, marginBottom: 0 },
  summaryTotalLabel: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  summaryTotalValue: { fontSize: 22, fontWeight: '800', color: '#FF6B35' },

  deliveryInfoRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 4, marginBottom: 14,
  },
  deliveryInfoText: { flex: 1, fontSize: 12, color: '#9ca3af', lineHeight: 18 },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  footerWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  footerError: { /* inherits footerWarning */ },
  footerWarningText: { fontSize: 12, color: '#f59e0b', fontWeight: '600' },
  placeOrderBtn: {
    backgroundColor: '#FF6B35', borderRadius: 16, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: '#FF6B35', shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  placeOrderBtnDisabled: { backgroundColor: '#d1d5db', shadowOpacity: 0 },
  placeOrderBtnText:     { color: '#fff', fontSize: 17, fontWeight: '800' },
});
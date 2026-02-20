import { useRouter } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  Image,
} from 'react-native';
import {
  Package,
  CheckCircle,
  Clock,
  ShoppingBag,
  Truck,
  MapPin,
  ChevronLeft,
  RotateCcw,
} from 'lucide-react-native';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type OrderStatus =
  | 'pending' | 'confirmed' | 'picking' | 'packaging'
  | 'collecting' | 'out_for_delivery' | 'delivered' | 'cancelled';

interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  image?: string;
  variantName?: string;
  originalPrice?: number;
  specialDiscount?: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  totalSavings?: number;
  orderStatus: OrderStatus;
  paymentStatus: string;
  createdAt: string;
  deliveryAddress?: any;
  pickedAt?: string;
  estimatedDelivery?: string;
}

// ─── Step config ─────────────────────────────────────────────────────────────
const STEPS: {
  status: OrderStatus[];
  label: string;
  desc: string;
  icon: React.FC<any>;
  color: string;
}[] = [
  {
    status: ['pending', 'confirmed'],
    label: 'Order Confirmed',
    desc: 'We have received your order and it\'s being prepared.',
    icon: CheckCircle,
    color: '#10b981',
  },
  {
    status: ['picking'],
    label: 'Being Picked',
    desc: 'Our picker is carefully selecting your items.',
    icon: ShoppingBag,
    color: '#f59e0b',
  },
  {
    status: ['packaging', 'collecting'],
    label: 'Being Packaged',
    desc: 'Your order is being securely packaged for delivery.',
    icon: Package,
    color: '#8b5cf6',
  },
  {
    status: ['out_for_delivery'],
    label: 'Out for Delivery',
    desc: 'Your driver is on the way!',
    icon: Truck,
    color: '#3b82f6',
  },
  {
    status: ['delivered'],
    label: 'Delivered',
    desc: 'Your order has been delivered. Enjoy!',
    icon: MapPin,
    color: '#10b981',
  },
];

function getStepIndex(status: OrderStatus): number {
  return STEPS.findIndex((s) => s.status.includes(status));
}

// ─── Pulsing dot for active step ──────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: color,
        transform: [{ scale }],
        shadowColor: color,
        shadowOpacity: 0.6,
        shadowRadius: 6,
        elevation: 4,
      }}
    />
  );
}

// ─── Item card ────────────────────────────────────────────────────────────────
function ItemCard({ item }: { item: OrderItem }) {
  const hasSaving = (item.specialDiscount || 0) > 0;
  return (
    <View style={styles.itemCard}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.itemImg} />
      ) : (
        <View style={[styles.itemImg, styles.itemImgPlaceholder]}>
          <Package color="#d1d5db" size={22} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
          {item.variantName ? (
            <Text style={styles.itemVariant}> — {item.variantName}</Text>
          ) : null}
        </Text>
        <Text style={styles.itemSku}>SKU: {item.sku}</Text>
        <View style={styles.itemPriceRow}>
          <Text style={styles.itemQty}>×{item.quantity}</Text>
          <Text style={styles.itemPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
          {hasSaving && (
            <Text style={styles.itemSaving}>-R{item.specialDiscount!.toFixed(2)}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OrderBeingPickedScreen() {
  const router = useRouter();
  const { orderId = '' } = useLocalSearchParams<{ orderId: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/api/orders/${orderId}`);
      setOrder(res.data.order);
      if (!silent) {
        Animated.parallel([
          Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]).start();
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    // Poll every 15 s
    pollRef.current = setInterval(() => fetchOrder(true), 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrder]);

  const onRefresh = () => { setRefreshing(true); fetchOrder(); };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Package color="#d1d5db" size={64} />
        <Text style={styles.errorText}>Order not found</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchOrder()}>
          <RotateCcw color="#FF6B35" size={18} />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStepIdx = getStepIndex(order.orderStatus);
  const isCancelled = order.orderStatus === 'cancelled';
  const isDelivered = order.orderStatus === 'delivered';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color="#1f2937" size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Order #{order.orderNumber}</Text>
          <Text style={styles.headerSub}>
            Placed {new Date(order.createdAt).toLocaleDateString('en-ZA', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── Status banner ── */}
          {!isCancelled && (
            <View style={styles.bannerCard}>
              <View style={styles.bannerTop}>
                <View style={styles.bannerDotRow}>
                  <PulseDot color={STEPS[Math.max(0, currentStepIdx)]?.color || '#FF6B35'} />
                  <Text style={styles.bannerStatus}>
                    {STEPS[currentStepIdx]?.label || 'Processing'}
                  </Text>
                </View>
                <Clock color="#9ca3af" size={16} />
              </View>
              <Text style={styles.bannerDesc}>
                {STEPS[currentStepIdx]?.desc || 'Your order is being processed.'}
              </Text>
            </View>
          )}

          {isCancelled && (
            <View style={[styles.bannerCard, styles.bannerCancelled]}>
              <Text style={styles.bannerCancelledTitle}>Order Cancelled</Text>
              <Text style={styles.bannerCancelledDesc}>
                This order was cancelled. If you were charged, a refund will be processed.
              </Text>
            </View>
          )}

          {/* ── Progress stepper ── */}
          {!isCancelled && (
            <View style={styles.stepperCard}>
              {STEPS.map((step, idx) => {
                const isComplete = idx < currentStepIdx;
                const isActive = idx === currentStepIdx;
                const Icon = step.icon;
                return (
                  <View key={idx} style={styles.stepRow}>
                    {/* Line */}
                    <View style={styles.stepLineCol}>
                      <View
                        style={[
                          styles.stepCircle,
                          isComplete && { backgroundColor: step.color, borderColor: step.color },
                          isActive && { borderColor: step.color, borderWidth: 2.5 },
                        ]}
                      >
                        {isComplete ? (
                          <CheckCircle color="#fff" size={16} />
                        ) : isActive ? (
                          <PulseDot color={step.color} />
                        ) : (
                          <View style={styles.stepDotInactive} />
                        )}
                      </View>
                      {idx < STEPS.length - 1 && (
                        <View style={[styles.stepConnector, isComplete && { backgroundColor: step.color }]} />
                      )}
                    </View>
                    {/* Content */}
                    <View style={styles.stepContent}>
                      <View style={styles.stepLabelRow}>
                        <Icon
                          color={isComplete || isActive ? step.color : '#d1d5db'}
                          size={18}
                        />
                        <Text
                          style={[
                            styles.stepLabel,
                            (isComplete || isActive) && { color: '#1f2937', fontWeight: '700' },
                          ]}
                        >
                          {step.label}
                        </Text>
                      </View>
                      {isActive && (
                        <Text style={styles.stepDesc}>{step.desc}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Picker activity (if picking) ── */}
          {order.orderStatus === 'picking' && (
            <View style={styles.pickerCard}>
              <View style={styles.pickerHeader}>
                <ShoppingBag color="#f59e0b" size={20} />
                <Text style={styles.pickerTitle}>Your picker is working on it</Text>
              </View>
              <View style={styles.pickerItemList}>
                {order.items.map((item, i) => (
                  <View key={i} style={styles.pickerItem}>
                    <View style={styles.pickerItemDot} />
                    <Text style={styles.pickerItemName} numberOfLines={1}>
                      {item.name} {item.variantName ? `— ${item.variantName}` : ''}
                    </Text>
                    <Text style={styles.pickerItemQty}>×{item.quantity}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Items summary ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Your Items ({order.items.length})</Text>
            {order.items.map((item, i) => <ItemCard key={i} item={item} />)}
          </View>

          {/* ── Order totals ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>R{order.subtotal.toFixed(2)}</Text>
            </View>
            {(order.totalSavings || 0) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#10b981' }]}>Savings</Text>
                <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                  -R{order.totalSavings!.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery</Text>
              <Text style={styles.summaryValue}>R{order.deliveryFee.toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>R{order.total.toFixed(2)}</Text>
            </View>
          </View>

          {/* ── "Out for delivery" CTA ── */}
          {order.orderStatus === 'out_for_delivery' && (
            <TouchableOpacity
              style={styles.trackBtn}
              onPress={() => router.push(`/order-on-the-way?orderId=${order._id}`)}
            >
              <Truck color="#fff" size={20} />
              <Text style={styles.trackBtnText}>Track Live Delivery</Text>
            </TouchableOpacity>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 16, color: '#6b7280' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, borderWidth: 2, borderColor: '#FF6B35',
  },
  retryText: { color: '#FF6B35', fontWeight: '600', fontSize: 15 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  headerSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  scroll: { padding: 16, paddingBottom: 40 },

  // Banner
  bannerCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bannerDotRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerStatus: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  bannerDesc: { fontSize: 13, color: '#6b7280', lineHeight: 20 },
  bannerCancelled: { borderLeftColor: '#ef4444', backgroundColor: '#fef2f2' },
  bannerCancelledTitle: { fontSize: 16, fontWeight: '700', color: '#991b1b', marginBottom: 6 },
  bannerCancelledDesc: { fontSize: 13, color: '#dc2626', lineHeight: 20 },

  // Stepper
  stepperCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 20,
    marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  stepRow: { flexDirection: 'row', marginBottom: 0 },
  stepLineCol: { alignItems: 'center', width: 36 },
  stepCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f3f4f6', borderWidth: 2, borderColor: '#e5e7eb',
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotInactive: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db' },
  stepConnector: { width: 2, flex: 1, minHeight: 32, backgroundColor: '#e5e7eb', marginVertical: 2 },
  stepContent: { flex: 1, paddingLeft: 14, paddingBottom: 24 },
  stepLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepLabel: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
  stepDesc: { fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 18 },

  // Picker activity
  pickerCard: {
    backgroundColor: '#fffbeb', borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: '#fde68a', marginBottom: 14,
  },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: '#92400e' },
  pickerItemList: { gap: 10 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickerItemDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  pickerItemName: { flex: 1, fontSize: 13, color: '#78350f' },
  pickerItemQty: { fontSize: 13, color: '#92400e', fontWeight: '700' },

  // Items / Summary
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18,
    marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 14 },

  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  itemImg: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#f3f4f6' },
  itemImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  itemVariant: { color: '#9ca3af', fontWeight: '400' },
  itemSku: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  itemPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  itemQty: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#FF6B35' },
  itemSaving: { fontSize: 12, color: '#10b981', fontWeight: '600' },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 14, color: '#6b7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  summaryTotal: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 4, marginBottom: 0 },
  summaryTotalLabel: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  summaryTotalValue: { fontSize: 20, fontWeight: '800', color: '#FF6B35' },

  // Track CTA
  trackBtn: {
    backgroundColor: '#3b82f6', borderRadius: 16, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginBottom: 8,
    shadowColor: '#3b82f6', shadowOpacity: 0.4, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  trackBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
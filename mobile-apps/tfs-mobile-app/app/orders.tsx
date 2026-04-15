import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ChevronLeft, Package, ChevronRight, Clock, CheckCircle,
  Truck, AlertCircle, ShoppingBag, XCircle, RefreshCw,
} from 'lucide-react-native';
import { useStore } from '@/lib/store';
import api from '@/lib/api';

interface OrderItem {
  productId: string; variantId?: string; name: string; variantName?: string;
  price: number; quantity: number; image: string; sku: string;
  appliedSpecialId?: string; originalPrice?: number; specialDiscount?: number;
}
interface Order {
  _id: string; orderNumber: string; userId: string; items: OrderItem[];
  subtotal: number; deliveryFee: number; total: number; totalSavings?: number;
  status: string; paymentStatus: string; createdAt: string; updatedAt: string;
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  payment_pending: { label: 'Awaiting Payment', bg: '#fef3c7', text: '#92400e', icon: <Clock color="#92400e" size={14} /> },
  pending:         { label: 'Pending',           bg: '#fef3c7', text: '#92400e', icon: <Clock color="#92400e" size={14} /> },
  confirmed:       { label: 'Confirmed',         bg: '#dbeafe', text: '#1e40af', icon: <CheckCircle color="#1e40af" size={14} /> },
  preparing:       { label: 'Being Prepared',    bg: '#ede9fe', text: '#5b21b6', icon: <Package color="#5b21b6" size={14} /> },
  picking:         { label: 'Being Picked',      bg: '#ede9fe', text: '#5b21b6', icon: <Package color="#5b21b6" size={14} /> },
  packaging:       { label: 'Packaging',         bg: '#ede9fe', text: '#5b21b6', icon: <Package color="#5b21b6" size={14} /> },
  collecting:      { label: 'Ready to Collect',  bg: '#d1fae5', text: '#065f46', icon: <CheckCircle color="#065f46" size={14} /> },
  ready:           { label: 'Ready',             bg: '#d1fae5', text: '#065f46', icon: <CheckCircle color="#065f46" size={14} /> },
  ready_for_delivery: { label: 'Ready for Delivery', bg: '#d1fae5', text: '#065f46', icon: <CheckCircle color="#065f46" size={14} /> },
  out_for_delivery:   { label: 'On the Way',     bg: '#d1fae5', text: '#065f46', icon: <Truck color="#065f46" size={14} /> },
  'out-for-delivery': { label: 'On the Way',     bg: '#d1fae5', text: '#065f46', icon: <Truck color="#065f46" size={14} /> },
  delivered:       { label: 'Delivered',         bg: '#d1fae5', text: '#065f46', icon: <CheckCircle color="#065f46" size={14} /> },
  cancelled:       { label: 'Cancelled',         bg: '#fee2e2', text: '#991b1b', icon: <XCircle color="#991b1b" size={14} /> },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    bg: '#f3f4f6', text: '#6b7280',
    icon: <AlertCircle color="#6b7280" size={14} />,
  };
}

// ── Navigate to the correct order tracking screen based on status ─────────────

function getOrderRoute(orderId: string, status: string): string {
  switch (status) {
    case 'out_for_delivery':
    case 'out-for-delivery':
    case 'collecting':
      return `/order-on-the-way?orderId=${orderId}`;
    case 'delivered':
      return `/order-delivered?orderId=${orderId}`;
    case 'packaging':
    case 'ready':
    case 'ready_for_delivery':
      return `/order-being-picked?orderId=${orderId}`;
    case 'pending':
    case 'confirmed':
    case 'picking':
    case 'preparing':
      return `/order-preparing?orderId=${orderId}`;
    default:
      return ''; // No live tracking for terminal/payment states
  }
}

const ACTIVE_STATUSES = [
  'payment_pending', 'pending', 'confirmed', 'preparing', 'picking',
  'packaging', 'collecting', 'ready', 'ready_for_delivery',
  'out_for_delivery', 'out-for-delivery',
];

const FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useStore();

  const [orders,        setOrders]        = useState<Order[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [activeFilter,  setActiveFilter]  = useState('all');

  useFocusEffect(
    useCallback(() => {
      if (user?.id) fetchOrders();
      else setLoading(false);
    }, [user?.id])
  );

  const fetchOrders = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await api.get(`/api/orders?userId=${user?.id}`);
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error('[Orders] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (activeFilter === 'all')       return true;
    if (activeFilter === 'active')    return ACTIVE_STATUSES.includes(o.status);
    if (activeFilter === 'delivered') return o.status === 'delivered';
    if (activeFilter === 'cancelled') return o.status === 'cancelled';
    return true;
  });

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft color="#1f2937" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
        <View style={styles.centerState}>
          <Package color="#d1d5db" size={60} />
          <Text style={styles.centerTitle}>Sign in to view orders</Text>
          <TouchableOpacity style={styles.cta} onPress={() => router.push('/login')}>
            <Text style={styles.ctaText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color="#1f2937" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => fetchOrders(true)}>
          <RefreshCw color="#6b7280" size={18} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
              {f.key !== 'all' && (
                <View style={[styles.filterCount, activeFilter === f.key && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, activeFilter === f.key && styles.filterCountTextActive]}>
                    {f.key === 'active'
                      ? orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length
                      : orders.filter((o) => o.status === f.key).length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator size="large" color="#FF6B35" /></View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.centerState}>
          <ShoppingBag color="#d1d5db" size={60} />
          <Text style={styles.centerTitle}>
            {activeFilter === 'all' ? 'No orders yet' : `No ${activeFilter} orders`}
          </Text>
          {activeFilter === 'all' && (
            <TouchableOpacity style={styles.cta} onPress={() => router.push('/(tabs)')}>
              <Text style={styles.ctaText}>Start Shopping</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders(true)} tintColor="#FF6B35" />}
        >
          {filteredOrders.map((order) => (
            <OrderCard key={order._id} order={order} onPress={() => {
              const route = getOrderRoute(order._id, order.status);
              if (route) router.push(route as any);
            }} />
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ── Order Card ─────────────────────────────────────────────────────────────────

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const sc = getStatusConfig(order.status);
  const isActive = ACTIVE_STATUSES.includes(order.status);

  const previewItems = order.items.slice(0, 3);
  const extraCount   = order.items.length - 3;

  const PROGRESS_STEPS = ['pending', 'confirmed', 'picking', 'ready', 'out_for_delivery', 'delivered'];
  const stepIndex  = PROGRESS_STEPS.indexOf(order.status);
  const showProgress = stepIndex >= 0 && order.status !== 'cancelled' && order.status !== 'payment_pending';

  return (
    <View style={styles.orderCard}>
      <TouchableOpacity style={styles.orderCardTop} onPress={() => setExpanded(!expanded)} activeOpacity={0.75}>
        <View style={{ flex: 1 }}>
          <View style={styles.orderHeaderRow}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              {sc.icon}
              <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>
            {new Date(order.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <ChevronRight color="#d1d5db" size={18} style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }} />
      </TouchableOpacity>

      <View style={styles.orderPreviewRow}>
        {previewItems.map((item, i) => (
          <View key={`${item.productId}-${i}`} style={styles.thumbWrap}>
            {item.image
              ? <Image source={{ uri: item.image }} style={styles.thumb} />
              : <View style={[styles.thumb, styles.thumbPlaceholder]}><Package color="#d1d5db" size={14} /></View>
            }
            {item.quantity > 1 && (
              <View style={styles.thumbQtyBadge}><Text style={styles.thumbQtyText}>×{item.quantity}</Text></View>
            )}
          </View>
        ))}
        {extraCount > 0 && (
          <View style={styles.thumbExtra}><Text style={styles.thumbExtraText}>+{extraCount}</Text></View>
        )}
        <View style={{ flex: 1 }} />
        <View style={styles.totalCol}>
          {order.deliveryFee === 0 && <Text style={styles.freeDelivery}>Free delivery</Text>}
          <Text style={styles.orderTotal}>R{(order.total || 0).toFixed(2)}</Text>
        </View>
      </View>

      {showProgress && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, ((stepIndex + 1) / PROGRESS_STEPS.length) * 100)}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{sc.label}</Text>
        </View>
      )}

      {/* Track order button for active orders */}
      {isActive && (
        <TouchableOpacity style={styles.trackBtn} onPress={onPress}>
          <Truck color="#FF6B35" size={14} />
          <Text style={styles.trackBtnText}>Track Order</Text>
          <ChevronRight color="#FF6B35" size={14} />
        </TouchableOpacity>
      )}

      {expanded && (
        <View style={styles.expandedItems}>
          <View style={styles.expandedDivider} />
          {order.items.map((item, i) => (
            <View key={`exp-${item.productId}-${i}`} style={styles.expandedItem}>
              {item.image
                ? <Image source={{ uri: item.image }} style={styles.expandedThumb} />
                : <View style={[styles.expandedThumb, styles.thumbPlaceholder]}><Package color="#d1d5db" size={12} /></View>
              }
              <View style={{ flex: 1 }}>
                <Text style={styles.expandedItemName} numberOfLines={1}>
                  {item.name}{item.variantName ? <Text style={{ color: '#9ca3af' }}> — {item.variantName}</Text> : null}
                </Text>
                <Text style={styles.expandedItemSku}>×{item.quantity}</Text>
              </View>
              <Text style={styles.expandedItemPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.expandedSummary}>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>R{(order.subtotal || 0).toFixed(2)}</Text></View>
            {(order.totalSavings ?? 0) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#10b981' }]}>Savings</Text>
                <Text style={[styles.summaryValue, { color: '#10b981' }]}>-R{(order.totalSavings ?? 0).toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery</Text>
              <Text style={styles.summaryValue}>
                {order.deliveryFee === 0
                  ? <Text style={{ color: '#10b981', fontWeight: '700' }}>FREE</Text>
                  : `R${order.deliveryFee.toFixed(2)}`}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>R{(order.total || 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f9fafb' },
  header:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12 },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, fontSize: 20, fontWeight: '700', color: '#1f2937' },
  filterBar:    { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: 'transparent' },
  filterChipActive:     { backgroundColor: '#fff7f3', borderColor: '#FF6B35' },
  filterChipText:       { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  filterChipTextActive: { color: '#FF6B35' },
  filterCount:          { backgroundColor: '#e5e7eb', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  filterCountActive:    { backgroundColor: '#FF6B35' },
  filterCountText:      { fontSize: 10, fontWeight: '700', color: '#6b7280' },
  filterCountTextActive: { color: '#fff' },
  scroll:       { padding: 16 },
  centerState:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  centerTitle:  { fontSize: 18, fontWeight: '700', color: '#6b7280' },
  cta:          { backgroundColor: '#FF6B35', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28 },
  ctaText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  orderCard:    { backgroundColor: '#fff', borderRadius: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, overflow: 'hidden' },
  orderCardTop: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12 },
  orderHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  orderNumber:  { fontSize: 14, fontWeight: '800', color: '#1f2937' },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText:   { fontSize: 11, fontWeight: '700' },
  orderDate:    { fontSize: 12, color: '#9ca3af' },
  orderPreviewRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  thumbWrap:    { position: 'relative' },
  thumb:        { width: 44, height: 44, borderRadius: 10, backgroundColor: '#f3f4f6' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbQtyBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#FF6B35', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  thumbQtyText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  thumbExtra:   { width: 44, height: 44, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  thumbExtraText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  totalCol:     { alignItems: 'flex-end', gap: 2 },
  freeDelivery: { fontSize: 10, color: '#10b981', fontWeight: '600' },
  orderTotal:   { fontSize: 16, fontWeight: '800', color: '#FF6B35' },
  progressWrap: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  progressTrack: { height: 4, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FF6B35', borderRadius: 4 },
  progressLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500' },

  // Track order button
  trackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff7f3', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  trackBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#FF6B35' },

  expandedItems:   { paddingHorizontal: 16, paddingBottom: 16 },
  expandedDivider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 12 },
  expandedItem:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  expandedThumb:   { width: 36, height: 36, borderRadius: 8, backgroundColor: '#f3f4f6' },
  expandedItemName: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  expandedItemSku:  { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  expandedItemPrice: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
  expandedSummary: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12, gap: 8 },
  summaryRow:      { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel:    { fontSize: 13, color: '#6b7280' },
  summaryValue:    { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  summaryTotal:    { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 10, marginTop: 4 },
  summaryTotalLabel: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  summaryTotalValue: { fontSize: 18, fontWeight: '800', color: '#FF6B35' },
});
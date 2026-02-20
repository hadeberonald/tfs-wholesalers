// app/order-being-picked.tsx
// Statuses shown here: 'packaging' | 'collecting'
// Socket auto-navigates to order-on-the-way or order-delivered

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Platform, Image,
} from 'react-native';
import {
  Package, CheckCircle, Clock, ShoppingBag, Truck,
  MapPin, ChevronLeft,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOrderSocket } from '@/hooks/useOrderSocket';

type OrderStatus =
  | 'pending' | 'confirmed' | 'picking' | 'packaging'
  | 'collecting' | 'out_for_delivery' | 'delivered' | 'cancelled';

interface OrderItem {
  productId: string; name: string; sku: string; quantity: number;
  price: number; image?: string; variantName?: string;
  originalPrice?: number; specialDiscount?: number;
}
interface Order {
  _id: string; orderNumber: string; items: OrderItem[];
  subtotal: number; deliveryFee: number; total: number;
  totalSavings?: number; orderStatus: OrderStatus; paymentStatus: string;
  createdAt: string; deliveryAddress?: any;
}

const STEPS: { status: OrderStatus[]; label: string; desc: string; icon: React.FC<any>; color: string }[] = [
  { status: ['pending', 'confirmed'], label: 'Order Confirmed',   desc: "We've received your order.",           icon: CheckCircle, color: '#10b981' },
  { status: ['picking'],              label: 'Being Picked',      desc: 'Our picker is selecting your items.',  icon: ShoppingBag, color: '#f59e0b' },
  { status: ['packaging','collecting'],label: 'Being Packaged',   desc: 'Your order is being securely packaged.', icon: Package,   color: '#8b5cf6' },
  { status: ['out_for_delivery'],     label: 'Out for Delivery',  desc: 'Your driver is on the way!',           icon: Truck,       color: '#3b82f6' },
  { status: ['delivered'],            label: 'Delivered',         desc: 'Your order has arrived. Enjoy!',       icon: MapPin,      color: '#10b981' },
];

function getStepIndex(status: OrderStatus) {
  return STEPS.findIndex(s => s.status.includes(status));
}

function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,   duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      width: 10, height: 10, borderRadius: 5, backgroundColor: color,
      transform: [{ scale }], shadowColor: color, shadowOpacity: 0.6, shadowRadius: 6, elevation: 4,
    }} />
  );
}

export default function OrderBeingPickedScreen() {
  const router  = useRouter();
  const { orderId = '' } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder]   = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  const navigate = useCallback((status: OrderStatus) => {
    if (status === 'out_for_delivery') { router.replace(`/order-on-the-way?orderId=${orderId}`);  return true; }
    if (status === 'delivered')        { router.replace(`/order-delivered?orderId=${orderId}`);   return true; }
    if (['pending','confirmed','picking'].includes(status)) {
      router.replace(`/order-preparing?orderId=${orderId}`); return true;
    }
    return false;
  }, [orderId, router]);

  useOrderSocket(orderId, useCallback((o: Order) => {
    if (navigate(o.orderStatus)) return;
    setOrder(o);
    setLoading(false);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [navigate]));

  if (loading) return (
    <View style={s.centered}><ActivityIndicator size="large" color="#FF6B35" /></View>
  );
  if (!order) return (
    <View style={s.centered}><Package color="#d1d5db" size={64} /><Text style={s.errorText}>Order not found</Text></View>
  );

  const currentStepIdx = getStepIndex(order.orderStatus);
  const isCancelled    = order.orderStatus === 'cancelled';

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ChevronLeft color="#1f2937" size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Order #{order.orderNumber}</Text>
          <Text style={s.headerSub}>
            {new Date(order.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        <View style={s.liveIndicator}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Status banner */}
          {!isCancelled && (
            <View style={[s.card, { borderLeftWidth: 4, borderLeftColor: '#FF6B35' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <PulseDot color={STEPS[Math.max(0, currentStepIdx)]?.color || '#FF6B35'} />
                <Text style={s.bannerStatus}>{STEPS[currentStepIdx]?.label || 'Processing'}</Text>
              </View>
              <Text style={s.bannerDesc}>{STEPS[currentStepIdx]?.desc}</Text>
            </View>
          )}

          {isCancelled && (
            <View style={[s.card, { borderLeftWidth: 4, borderLeftColor: '#ef4444', backgroundColor: '#fef2f2' }]}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#991b1b', marginBottom: 6 }}>Order Cancelled</Text>
              <Text style={{ fontSize: 13, color: '#dc2626' }}>This order was cancelled. A refund will be processed if applicable.</Text>
            </View>
          )}

          {/* Stepper */}
          {!isCancelled && (
            <View style={s.card}>
              {STEPS.map((step, idx) => {
                const isComplete = idx < currentStepIdx;
                const isActive   = idx === currentStepIdx;
                const Icon       = step.icon;
                return (
                  <View key={idx} style={s.stepRow}>
                    <View style={s.stepLineCol}>
                      <View style={[s.stepCircle, isComplete && { backgroundColor: step.color, borderColor: step.color }, isActive && { borderColor: step.color, borderWidth: 2.5 }]}>
                        {isComplete ? <CheckCircle color="#fff" size={16} />
                          : isActive  ? <PulseDot color={step.color} />
                          : <View style={s.stepDotInactive} />}
                      </View>
                      {idx < STEPS.length - 1 && (
                        <View style={[s.stepConnector, isComplete && { backgroundColor: step.color }]} />
                      )}
                    </View>
                    <View style={s.stepContent}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Icon color={isComplete || isActive ? step.color : '#d1d5db'} size={18} />
                        <Text style={[s.stepLabel, (isComplete || isActive) && { color: '#1f2937', fontWeight: '700' }]}>{step.label}</Text>
                      </View>
                      {isActive && <Text style={s.stepDesc}>{step.desc}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Packaging detail */}
          {['packaging', 'collecting'].includes(order.orderStatus) && (
            <View style={[s.card, { borderWidth: 1, borderColor: '#c4b5fd', backgroundColor: '#f5f3ff' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Package color="#8b5cf6" size={20} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#5b21b6' }}>Being packaged now</Text>
              </View>
              {order.items.map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#8b5cf6' }} />
                  <Text style={{ flex: 1, fontSize: 13, color: '#4c1d95' }} numberOfLines={1}>
                    {item.name}{item.variantName ? ` — ${item.variantName}` : ''}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#5b21b6', fontWeight: '700' }}>×{item.quantity}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Items */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>Your Items ({order.items.length})</Text>
            {order.items.map((item, i) => (
              <View key={i} style={s.itemRow}>
                {item.image
                  ? <Image source={{ uri: item.image }} style={s.itemImg} />
                  : <View style={[s.itemImg, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }]}><Package color="#d1d5db" size={22} /></View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName} numberOfLines={1}>{item.name}{item.variantName ? <Text style={{ color: '#9ca3af', fontWeight: '400' }}> — {item.variantName}</Text> : null}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <Text style={s.itemQty}>×{item.quantity}</Text>
                    <Text style={s.itemPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Summary */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>Order Summary</Text>
            <View style={s.tRow}><Text style={s.tLabel}>Subtotal</Text><Text style={s.tVal}>R{order.subtotal.toFixed(2)}</Text></View>
            {(order.totalSavings || 0) > 0 && (
              <View style={s.tRow}><Text style={[s.tLabel, { color: '#10b981' }]}>Savings</Text><Text style={[s.tVal, { color: '#10b981' }]}>-R{order.totalSavings!.toFixed(2)}</Text></View>
            )}
            <View style={s.tRow}><Text style={s.tLabel}>Delivery</Text><Text style={s.tVal}>R{order.deliveryFee.toFixed(2)}</Text></View>
            <View style={[s.tRow, { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12, marginTop: 4 }]}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937' }}>Total</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#FF6B35' }}>R{order.total.toFixed(2)}</Text>
            </View>
          </View>

          {order.orderStatus === 'out_for_delivery' && (
            <TouchableOpacity style={s.trackBtn} onPress={() => router.push(`/order-on-the-way?orderId=${order._id}`)}>
              <Truck color="#fff" size={20} />
              <Text style={s.trackBtnText}>Track Live Delivery</Text>
            </TouchableOpacity>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const CARD: any = { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 };

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 16, color: '#6b7280' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  headerSub:   { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff3e0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },
  liveText: { fontSize: 11, fontWeight: '800', color: '#FF6B35' },
  scroll: { padding: 16, paddingBottom: 40 },
  card: CARD,
  bannerStatus: { fontSize: 16, fontWeight: '700', color: '#1f2937', flex: 1 },
  bannerDesc:   { fontSize: 13, color: '#6b7280', lineHeight: 20 },
  stepRow:       { flexDirection: 'row' },
  stepLineCol:   { alignItems: 'center', width: 36 },
  stepCircle:    { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  stepDotInactive: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db' },
  stepConnector: { width: 2, flex: 1, minHeight: 32, backgroundColor: '#e5e7eb', marginVertical: 2 },
  stepContent:   { flex: 1, paddingLeft: 14, paddingBottom: 24 },
  stepLabel:     { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
  stepDesc:      { fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 18 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 14 },
  itemRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  itemImg:  { width: 52, height: 52, borderRadius: 10 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  itemQty:  { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  itemPrice:{ fontSize: 14, fontWeight: '700', color: '#FF6B35' },
  tRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  tLabel: { fontSize: 14, color: '#6b7280' },
  tVal:   { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  trackBtn: { backgroundColor: '#3b82f6', borderRadius: 16, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 },
  trackBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
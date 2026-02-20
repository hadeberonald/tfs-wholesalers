// app/order-preparing.tsx  — REAL-TIME ITEM PICKING
// Shows each item being ticked off as the picker scans them, in real time.
// Uses the item:scanned socket event via the updated useOrderSocket hook.

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Easing, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft, Package, CheckCircle, ShoppingBag,
  Star, Zap, Clock,
} from 'lucide-react-native';
import { useOrderSocket } from '@/hooks/useOrderSocket';

interface OrderItem {
  productId: string;
  name: string;
  variantName?: string;
  quantity: number;
  price: number;
  image?: string;
  autoAdded?: boolean;
  scanned?: boolean;  // ← set by server when picker scans
}

interface Order {
  _id: string;
  orderNumber: string;
  orderStatus: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  totalSavings?: number;
  createdAt: string;
  pickerName?: string;
  estimatedMinutes?: number;
}

// ── Animated helpers ──────────────────────────────────────────────────────────
function BounceDots() {
  const d = [0, 1, 2].map(() => useRef(new Animated.Value(0)).current);
  useEffect(() => {
    d.forEach((dot, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 180),
        Animated.timing(dot, { toValue: -10, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0,   duration: 360, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
        Animated.delay(540),
      ])).start()
    );
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      {d.map((dot, i) => (
        <Animated.View key={i} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF6B35', transform: [{ translateY: dot }] }} />
      ))}
    </View>
  );
}

function PulseRings({ size }: { size: number }) {
  const rings = [0, 1, 2].map(() => useRef(new Animated.Value(0)).current);
  useEffect(() => {
    rings.forEach((r, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 700),
        Animated.timing(r, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])).start()
    );
  }, []);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', position: 'absolute' }}>
      {rings.map((r, i) => {
        const scale   = r.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
        const opacity = r.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.55, 0.15, 0] });
        return <Animated.View key={i} style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: '#FF6B35', transform: [{ scale }], opacity }} />;
      })}
    </View>
  );
}

function ActiveDot() {
  const sc = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(sc, { toValue: 1.6, duration: 800, useNativeDriver: true }),
      Animated.timing(sc, { toValue: 1,   duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6B35', transform: [{ scale: sc }] }} />;
}

// ── Tick animation for a just-scanned item ────────────────────────────────────
function ItemPickedTick() {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <CheckCircle size={20} color="#10b981" fill="#10b981" />
    </Animated.View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OrderPreparingScreen() {
  const router = useRouter();
  const { orderId = '' } = useLocalSearchParams<{ orderId: string }>();

  const [order, setOrder]     = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  // Track which items are scanned locally so we can animate them immediately
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());

  const heroOp = useRef(new Animated.Value(0)).current;
  const heroY  = useRef(new Animated.Value(28)).current;
  const cardOp = useRef(new Animated.Value(0)).current;

  // ── Navigation gate ───────────────────────────────────────────────────────
  // DB documents use `status`; some legacy code uses `orderStatus`.
  // Always resolve whichever field is present.
  const navigate = useCallback((status: string | undefined) => {
    if (!status) return false;
    if (['packaging', 'collecting'].includes(status)) {
      router.replace(`/order-being-picked?orderId=${orderId}`); return true;
    }
    if (status === 'out_for_delivery') { router.replace(`/order-on-the-way?orderId=${orderId}`);  return true; }
    if (status === 'delivered')        { router.replace(`/order-delivered?orderId=${orderId}`);   return true; }
    return false;
  }, [orderId, router]);

  // ── Socket: order status changes ─────────────────────────────────────────
  const handleOrderUpdate = useCallback((o: any) => {
    // Normalise — DB field is `status`, customer app Order type calls it `orderStatus`
    const status = o.status ?? o.orderStatus;
    if (navigate(status)) return;
    setOrder({ ...o, status, orderStatus: status });  // normalise both field names
    setLoading(false);
    // Re-sync scanned state from server
    setScannedIds(new Set(o.items.filter(i => i.scanned).map(i => i.productId)));
    Animated.parallel([
      Animated.spring(heroOp, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.timing(cardOp, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [navigate]);

  // ── Socket: per-item scan ─────────────────────────────────────────────────
  const handleItemScanned = useCallback((payload: any) => {
    setScannedIds(prev => new Set([...prev, payload.productId]));
    if (payload.order) {
      const s = payload.order.status ?? payload.order.orderStatus;
      setOrder({ ...payload.order, status: s, orderStatus: s });
    }
  }, []);

  useOrderSocket(orderId, handleOrderUpdate, handleItemScanned);

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(heroOp, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(heroY,  { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
      ]),
      Animated.timing(cardOp, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  if (loading) return (
    <View style={s.bg}>
      <View style={s.centered}>
        <View style={{ width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }}>
          <PulseRings size={90} />
          <View style={s.heroInner}><ShoppingBag color="#FF6B35" size={30} /></View>
        </View>
        <Text style={[s.mutedText, { marginTop: 24 }]}>Loading your order…</Text>
      </View>
    </View>
  );

  if (!order) return (
    <View style={s.bg}><View style={s.centered}><Package color="#d1d5db" size={52} /><Text style={s.mutedText}>Order not found</Text></View></View>
  );

  const currentStatus = (order as any).status ?? order.orderStatus;
  const isPicking    = currentStatus === 'picking';
  const regularItems = order.items.filter(i => !i.autoAdded);
  const freeItems    = order.items.filter(i => i.autoAdded);
  const scannedCount = order.items.filter(i => i.scanned || scannedIds.has(i.productId)).length;
  const totalCount   = order.items.length;

  const steps = [
    { label: 'Order Confirmed',  done: true,      active: false },
    { label: 'Being Picked',     done: isPicking,  active: isPicking },
    { label: 'Packed & Ready',   done: false,      active: false },
    { label: 'Driver Assigned',  done: false,      active: false },
    { label: 'Out for Delivery', done: false,      active: false },
  ];

  return (
    <View style={s.bg}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
            <ChevronLeft color="#1f2937" size={22} />
          </TouchableOpacity>
          <Text style={s.headerOrder}>Order #{order.orderNumber}</Text>
          <View style={s.liveIndicator}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 44 }}>
          {/* Hero */}
          <Animated.View style={[s.heroSection, { opacity: heroOp, transform: [{ translateY: heroY }] }]}>
            <View style={{ width: 130, height: 130, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
              <PulseRings size={130} />
              <View style={s.heroInner}><ShoppingBag color="#FF6B35" size={40} /></View>
            </View>
            <Text style={s.heroTitle}>{isPicking ? 'Being Picked' : 'Order Confirmed'}</Text>
            <Text style={s.heroSub}>
              {isPicking
                ? 'Our picker is carefully selecting your items right now'
                : 'Your order is confirmed and queued for picking'}
            </Text>
            <View style={{ marginTop: 20 }}><BounceDots /></View>
          </Animated.View>

          <Animated.View style={{ opacity: cardOp }}>
            {/* Live status */}
            <View style={[s.card, { borderLeftWidth: 4, borderLeftColor: '#FF6B35' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <ActiveDot />
                <Text style={s.cardMainText}>{isPicking ? 'Picker Active' : 'Awaiting Picker'}</Text>
                <View style={s.liveBadge}><Text style={s.liveBadgeText}>LIVE</Text></View>
              </View>
              {order.estimatedMinutes
                ? <Text style={s.etaText}>Est. ready in <Text style={{ color: '#FF6B35', fontWeight: '700' }}>{order.estimatedMinutes} min</Text></Text>
                : <Text style={s.etaText}>Time estimate coming soon…</Text>
              }
              {isPicking && order.pickerName && (
                <View style={s.pickerRow}>
                  <View style={s.pickerAvatar}><Text style={{ color: '#FF6B35', fontWeight: '800', fontSize: 14 }}>{order.pickerName[0]}</Text></View>
                  <Text style={s.pickerNameText}>{order.pickerName} is on it</Text>
                </View>
              )}
            </View>

            {/* ── Real-time picking progress ── */}
            {isPicking && (
              <View style={[s.card, { borderColor: '#fed7aa', borderWidth: 1.5 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <Text style={s.cardLabel}>ITEMS BEING PICKED</Text>
                  <View style={s.pickProgressPill}>
                    <Text style={s.pickProgressText}>{scannedCount}/{totalCount}</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={s.pickBar}>
                  <Animated.View style={[s.pickBarFill, { width: `${totalCount > 0 ? (scannedCount / totalCount) * 100 : 0}%` }]} />
                </View>

                {/* Item list */}
                {[...regularItems, ...freeItems].map((item, i) => {
                  const isItemScanned = item.scanned || scannedIds.has(item.productId);
                  return (
                    <View key={`${item.productId}-${i}`} style={[s.pickItemRow, isItemScanned && s.pickItemRowDone]}>
                      {item.image
                        ? <Image source={{ uri: item.image }} style={s.pickItemImg} />
                        : <View style={[s.pickItemImg, { backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }]}><Package color="#d1d5db" size={14} /></View>
                      }
                      <View style={{ flex: 1 }}>
                        <Text style={[s.pickItemName, isItemScanned && { color: '#6b7280', textDecorationLine: 'line-through' }]} numberOfLines={1}>
                          {item.name}{item.variantName ? ` — ${item.variantName}` : ''}
                        </Text>
                        {item.autoAdded && <Text style={{ fontSize: 10, color: '#10b981', fontWeight: '700' }}>🎁 Free bonus</Text>}
                      </View>
                      <View style={s.pickItemRight}>
                        <Text style={s.pickItemQty}>×{item.quantity}</Text>
                        {isItemScanned
                          ? <ItemPickedTick />
                          : <View style={s.pickItemPending}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db' }} /></View>
                        }
                      </View>
                    </View>
                  );
                })}

                {scannedCount === totalCount && totalCount > 0 && (
                  <View style={s.allPickedBanner}>
                    <CheckCircle size={16} color="#10b981" />
                    <Text style={s.allPickedText}>All items picked! Packaging next…</Text>
                  </View>
                )}
              </View>
            )}

            {/* Steps */}
            <View style={s.card}>
              <Text style={s.cardLabel}>ORDER PROGRESS</Text>
              {steps.map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ alignItems: 'center', width: 32 }}>
                    <View style={[s.stepDot, step.active && s.stepDotActive, step.done && !step.active && s.stepDotDone, !step.done && !step.active && s.stepDotPending]}>
                      {step.done && !step.active && <CheckCircle color="#fff" size={13} />}
                      {step.active && <Zap color="#FF6B35" size={12} />}
                    </View>
                    {i < steps.length - 1 && <View style={[s.stepLine, step.done && { backgroundColor: '#10b981' }]} />}
                  </View>
                  <Text style={[s.stepLabel, step.done && !step.active && s.stepLabelDone, step.active && s.stepLabelActive]}>{step.label}</Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={s.card}>
              <View style={s.tRow}><Text style={s.tLabel}>Subtotal</Text><Text style={s.tVal}>R{order.subtotal.toFixed(2)}</Text></View>
              {(order.totalSavings || 0) > 0 && (
                <View style={s.tRow}><Text style={[s.tLabel, { color: '#10b981' }]}>Saved 🎉</Text><Text style={[s.tVal, { color: '#10b981' }]}>-R{order.totalSavings!.toFixed(2)}</Text></View>
              )}
              <View style={s.tRow}><Text style={s.tLabel}>Delivery</Text><Text style={s.tVal}>R{order.deliveryFee.toFixed(2)}</Text></View>
              <View style={[s.tRow, s.tTotalRow]}>
                <Text style={s.tTotalLabel}>Total Paid</Text>
                <Text style={s.tTotalVal}>R{order.total.toFixed(2)}</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const CARD: any = { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 };

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  mutedText: { color: '#9ca3af', fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  headerOrder: { color: '#1f2937', fontSize: 16, fontWeight: '700' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff3e0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },
  liveText: { color: '#FF6B35', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  heroSection: { alignItems: 'center', paddingVertical: 24 },
  heroInner: { width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(255,107,53,0.08)', borderWidth: 2, borderColor: 'rgba(255,107,53,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#1f2937', letterSpacing: -0.5, marginBottom: 8 },
  heroSub: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 21, maxWidth: 270 },
  card: CARD,
  cardLabel: { color: '#9ca3af', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 14 },
  cardMainText: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1f2937' },
  liveBadge: { backgroundColor: '#fff3e0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  liveBadgeText: { color: '#FF6B35', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  etaText: { color: '#6b7280', fontSize: 13 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  pickerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,107,53,0.1)', alignItems: 'center', justifyContent: 'center' },
  pickerNameText: { color: '#4b5563', fontSize: 13, fontWeight: '500' },

  // Real-time picking card
  pickProgressPill: { backgroundColor: '#fff7ed', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#fed7aa' },
  pickProgressText: { color: '#FF6B35', fontSize: 12, fontWeight: '700' },
  pickBar: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden', marginBottom: 14 },
  pickBarFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 3 },
  pickItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  pickItemRowDone: { opacity: 0.65 },
  pickItemImg: { width: 36, height: 36, borderRadius: 8 },
  pickItemName: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  pickItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickItemQty: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  pickItemPending: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  allPickedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginTop: 12 },
  allPickedText: { color: '#15803d', fontSize: 13, fontWeight: '700' },

  stepDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  stepDotActive: { borderColor: '#FF6B35', backgroundColor: 'rgba(255,107,53,0.08)' },
  stepDotDone: { backgroundColor: '#10b981', borderColor: '#10b981' },
  stepDotPending: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' },
  stepLine: { width: 2, height: 24, backgroundColor: '#e5e7eb', marginVertical: 2 },
  stepLabel: { color: '#9ca3af', fontSize: 14, paddingTop: 7, paddingBottom: 26, paddingLeft: 14, fontWeight: '500' },
  stepLabelDone: { color: '#10b981', fontWeight: '600' },
  stepLabelActive: { color: '#1f2937', fontWeight: '700' },
  tRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  tLabel: { color: '#6b7280', fontSize: 14 },
  tVal: { color: '#1f2937', fontSize: 14, fontWeight: '600' },
  tTotalRow: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 14, marginTop: 4, marginBottom: 0 },
  tTotalLabel: { color: '#1f2937', fontSize: 16, fontWeight: '700' },
  tTotalVal: { color: '#FF6B35', fontSize: 22, fontWeight: '800' },
});
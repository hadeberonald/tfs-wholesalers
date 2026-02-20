// app/order-preparing.tsx
// Real-time via Socket.IO — no polling.
// useOrderSocket() does the initial fetch + listens for order:updated events.

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Easing, Image, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft, Package, CheckCircle, ShoppingBag,
  RotateCcw, Star, Zap, Clock,
} from 'lucide-react-native';
import { useOrderSocket } from '@/hooks/useOrderSocket';

interface OrderItem {
  name: string; variantName?: string; quantity: number;
  price: number; image?: string; autoAdded?: boolean;
}
interface Order {
  _id: string; orderNumber: string; orderStatus: string;
  items: OrderItem[]; subtotal: number; deliveryFee: number;
  total: number; totalSavings?: number; createdAt: string;
  pickerName?: string; estimatedMinutes?: number;
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OrderPreparingScreen() {
  const router = useRouter();
  const { orderId = '' } = useLocalSearchParams<{ orderId: string }>();

  const [order, setOrder]     = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const heroOp = useRef(new Animated.Value(0)).current;
  const heroY  = useRef(new Animated.Value(28)).current;
  const cardOp = useRef(new Animated.Value(0)).current;

  // ── Navigation gate ───────────────────────────────────────────────────────
  const navigate = useCallback((status: string) => {
    if (['packaging', 'collecting'].includes(status)) {
      router.replace(`/order-being-picked?orderId=${orderId}`); return true;
    }
    if (status === 'out_for_delivery') {
      router.replace(`/order-on-the-way?orderId=${orderId}`); return true;
    }
    if (status === 'delivered') {
      router.replace(`/order-delivered?orderId=${orderId}`); return true;
    }
    return false;
  }, [orderId, router]);

  // ── Socket hook ───────────────────────────────────────────────────────────
  useOrderSocket(orderId, useCallback((o: Order) => {
    if (navigate(o.orderStatus)) return;
    setOrder(o);
    setLoading(false);
  }, [navigate]));

  // ── Entry animation ───────────────────────────────────────────────────────
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
    <View style={s.bg}>
      <View style={s.centered}>
        <Package color="#d1d5db" size={52} />
        <Text style={s.mutedText}>Order not found</Text>
      </View>
    </View>
  );

  const isPicking    = order.orderStatus === 'picking';
  const regularItems = order.items.filter(i => !i.autoAdded);
  const freeItems    = order.items.filter(i => i.autoAdded);

  const steps = [
    { label: 'Order Confirmed',  done: true,     active: false },
    { label: 'Being Picked',     done: isPicking, active: isPicking },
    { label: 'Packed & Ready',   done: false,     active: false },
    { label: 'Driver Assigned',  done: false,     active: false },
    { label: 'Out for Delivery', done: false,     active: false },
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
          {/* No manual refresh needed — socket keeps it live */}
          <View style={s.liveIndicator}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 44 }}
        >
          {/* Hero */}
          <Animated.View style={[s.heroSection, { opacity: heroOp, transform: [{ translateY: heroY }] }]}>
            <View style={{ width: 130, height: 130, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
              <PulseRings size={130} />
              <View style={s.heroInner}>
                <ShoppingBag color="#FF6B35" size={40} />
              </View>
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
                  <View style={s.pickerAvatar}>
                    <Text style={{ color: '#FF6B35', fontWeight: '800', fontSize: 14 }}>{order.pickerName[0]}</Text>
                  </View>
                  <Text style={s.pickerNameText}>{order.pickerName} is on it</Text>
                </View>
              )}
            </View>

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
                  <Text style={[s.stepLabel, step.done && !step.active && s.stepLabelDone, step.active && s.stepLabelActive]}>
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Items */}
            <View style={s.card}>
              <Text style={s.cardLabel}>YOUR ITEMS ({order.items.length})</Text>
              {regularItems.map((item, i) => (
                <View key={i} style={s.itemRow}>
                  {item.image
                    ? <Image source={{ uri: item.image }} style={s.itemImg} />
                    : <View style={[s.itemImg, s.itemImgFb]}><Package color="#FF6B35" size={15} /></View>
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName} numberOfLines={1}>
                      {item.name}{item.variantName ? <Text style={s.itemVariant}> — {item.variantName}</Text> : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <View style={s.qtyPill}><Text style={s.qtyText}>×{item.quantity}</Text></View>
                      <Text style={s.itemPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              ))}
              {freeItems.map((item, i) => (
                <View key={`f${i}`} style={[s.itemRow, { backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 8 }]}>
                  <View style={[s.itemImg, s.itemImgFb]}><Star color="#10b981" size={14} fill="#10b981" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '600', marginTop: 2 }}>🎁 Bonus item</Text>
                  </View>
                  <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '700' }}>FREE</Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={s.card}>
              <View style={s.tRow}><Text style={s.tLabel}>Subtotal</Text><Text style={s.tVal}>R{order.subtotal.toFixed(2)}</Text></View>
              {(order.totalSavings || 0) > 0 && (
                <View style={s.tRow}>
                  <Text style={[s.tLabel, { color: '#10b981' }]}>Saved 🎉</Text>
                  <Text style={[s.tVal, { color: '#10b981' }]}>-R{order.totalSavings!.toFixed(2)}</Text>
                </View>
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

  stepDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  stepDotActive: { borderColor: '#FF6B35', backgroundColor: 'rgba(255,107,53,0.08)' },
  stepDotDone: { backgroundColor: '#10b981', borderColor: '#10b981' },
  stepDotPending: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' },
  stepLine: { width: 2, height: 24, backgroundColor: '#e5e7eb', marginVertical: 2 },
  stepLabel: { color: '#9ca3af', fontSize: 14, paddingTop: 7, paddingBottom: 26, paddingLeft: 14, fontWeight: '500' },
  stepLabelDone: { color: '#10b981', fontWeight: '600' },
  stepLabelActive: { color: '#1f2937', fontWeight: '700' },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  itemImg: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#f3f4f6' },
  itemImgFb: { alignItems: 'center', justifyContent: 'center' },
  itemName: { color: '#1f2937', fontSize: 13, fontWeight: '600' },
  itemVariant: { color: '#9ca3af', fontWeight: '400' },
  qtyPill: { backgroundColor: 'rgba(255,107,53,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  qtyText: { color: '#FF6B35', fontSize: 11, fontWeight: '700' },
  itemPrice: { color: '#6b7280', fontSize: 13, fontWeight: '600' },

  tRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  tLabel: { color: '#6b7280', fontSize: 14 },
  tVal: { color: '#1f2937', fontSize: 14, fontWeight: '600' },
  tTotalRow: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 14, marginTop: 4, marginBottom: 0 },
  tTotalLabel: { color: '#1f2937', fontSize: 16, fontWeight: '700' },
  tTotalVal: { color: '#FF6B35', fontSize: 22, fontWeight: '800' },
});
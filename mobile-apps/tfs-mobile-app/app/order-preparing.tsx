// app/order-preparing.tsx
// Triggered immediately after payment success. Polls every 10s and auto-navigates.
// Statuses handled: 'pending' | 'confirmed' | 'picking'

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Package, CheckCircle, ShoppingBag, RotateCcw, Star, Zap } from 'lucide-react-native';
import api from '@/lib/api';

interface OrderItem {
  name: string; variantName?: string; quantity: number;
  price: number; image?: string; autoAdded?: boolean; originalPrice?: number;
}
interface Order {
  _id: string; orderNumber: string; orderStatus: string;
  items: OrderItem[]; subtotal: number; deliveryFee: number;
  total: number; totalSavings?: number; createdAt: string;
  pickerName?: string; estimatedMinutes?: number;
}

function BounceDots() {
  const d = [0,1,2].map(() => useRef(new Animated.Value(0)).current);
  useEffect(() => {
    d.forEach((dot, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 180),
      Animated.timing(dot, { toValue: -10, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(dot, { toValue: 0, duration: 360, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(540),
    ])).start());
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      {d.map((dot, i) => <Animated.View key={i} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF6B35', transform: [{ translateY: dot }] }} />)}
    </View>
  );
}

function PulseRings({ size }: { size: number }) {
  const rings = [0,1,2].map(() => useRef(new Animated.Value(0)).current);
  useEffect(() => {
    rings.forEach((r, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 700),
      Animated.timing(r, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: true }),
    ])).start());
  }, []);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', position: 'absolute' }}>
      {rings.map((r, i) => {
        const scale = r.interpolate({ inputRange: [0,1], outputRange: [1, 2.8] });
        const opacity = r.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.55, 0.15, 0] });
        return <Animated.View key={i} style={{ position: 'absolute', width: size, height: size, borderRadius: size/2, borderWidth: 1.5, borderColor: '#FF6B35', transform: [{ scale }], opacity }} />;
      })}
    </View>
  );
}

function ActiveDot() {
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(s, { toValue: 1.6, duration: 800, useNativeDriver: true }),
      Animated.timing(s, { toValue: 1, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6B35', transform: [{ scale: s }] }} />;
}

export default function OrderPreparingScreen() {
  const router = useRouter();
  const { orderId = '' } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const heroOp = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(28)).current;
  const cardOp = useRef(new Animated.Value(0)).current;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async (silent = false) => {
    try {
      const res = await api.get(`/api/orders/${orderId}`);
      const o: Order = res.data.order;
      setOrder(o);
      if (['ready','packaging'].includes(o.orderStatus)) router.replace(`/order-ready?orderId=${orderId}`);
      else if (['out_for_delivery','collecting'].includes(o.orderStatus)) router.replace(`/order-on-the-way?orderId=${orderId}`);
      else if (o.orderStatus === 'delivered') router.replace(`/order-delivered?orderId=${orderId}`);
    } catch {}
    setLoading(false); setRefreshing(false);
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(heroOp, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(heroY, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
      ]),
      Animated.timing(cardOp, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
    pollRef.current = setInterval(() => fetchOrder(true), 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrder]);

  if (loading) return (
    <View style={s.bg}>
      <SafeAreaView style={s.centered}>
        <View style={{ width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }}>
          <PulseRings size={90} />
          <View style={s.heroInner}><ShoppingBag color="#FF6B35" size={30} /></View>
        </View>
      </SafeAreaView>
    </View>
  );

  if (!order) return (
    <View style={s.bg}>
      <SafeAreaView style={s.centered}>
        <Package color="#333" size={52} />
        <Text style={s.mutedText}>Order not found</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => fetchOrder()}>
          <RotateCcw color="#FF6B35" size={15} /><Text style={s.retryText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );

  const isPicking = order.orderStatus === 'picking';
  const regularItems = order.items.filter(i => !i.autoAdded);
  const freeItems = order.items.filter(i => i.autoAdded);

  const steps = [
    { label: 'Order Confirmed',  done: true,      active: false },
    { label: 'Being Picked',     done: isPicking,  active: isPicking },
    { label: 'Packed & Ready',   done: false,      active: false },
    { label: 'Driver Assigned',  done: false,      active: false },
    { label: 'Out for Delivery', done: false,      active: false },
  ];

  return (
    <View style={s.bg}>
      <SafeAreaView style={{ flex: 1 }} edges={['top','left','right']}>
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
            <ChevronLeft color="#fff" size={22} />
          </TouchableOpacity>
          <Text style={s.headerOrder}>#{order.orderNumber}</Text>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: 'rgba(255,107,53,0.15)' }]} onPress={() => { setRefreshing(true); fetchOrder(); }}>
            <RotateCcw color="#FF6B35" size={16} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 44 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrder(); }} tintColor="#FF6B35" />}
        >
          {/* ── Hero ── */}
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
            {/* ── Live status ── */}
            <View style={[s.card, { borderColor: 'rgba(255,107,53,0.3)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <ActiveDot />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 }}>
                  {isPicking ? 'Picker Active' : 'Awaiting Picker'}
                </Text>
                <View style={s.liveBadge}><Text style={s.liveBadgeText}>LIVE</Text></View>
              </View>
              {order.estimatedMinutes
                ? <Text style={s.etaText}>Est. ready in <Text style={{ color: '#FF6B35', fontWeight: '700' }}>{order.estimatedMinutes} min</Text></Text>
                : <Text style={s.etaText}>Time estimate coming soon…</Text>
              }
              {isPicking && order.pickerName && (
                <View style={s.pickerRow}>
                  <View style={s.pickerAvatar}><Text style={{ color: '#FF6B35', fontWeight: '800', fontSize: 14 }}>{order.pickerName[0]}</Text></View>
                  <Text style={{ color: '#bbb', fontSize: 13, fontWeight: '500' }}>{order.pickerName} is on it</Text>
                </View>
              )}
            </View>

            {/* ── Steps ── */}
            <View style={s.card}>
              <Text style={s.cardLabel}>ORDER PROGRESS</Text>
              {steps.map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ alignItems: 'center', width: 32 }}>
                    <View style={[s.stepDot,
                      step.active && s.stepDotActive,
                      step.done && !step.active && s.stepDotDone,
                      !step.done && !step.active && s.stepDotPending,
                    ]}>
                      {step.done && !step.active && <CheckCircle color="#fff" size={13} />}
                      {step.active && <Zap color="#FF6B35" size={12} />}
                    </View>
                    {i < steps.length - 1 && <View style={[s.stepLine, step.done && { backgroundColor: '#4ade80' }]} />}
                  </View>
                  <Text style={[s.stepLabel, step.done && !step.active && s.stepLabelDone, step.active && s.stepLabelActive]}>
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* ── Items ── */}
            <View style={s.card}>
              <Text style={s.cardLabel}>YOUR ITEMS ({order.items.length})</Text>
              {regularItems.map((item, i) => (
                <View key={i} style={s.itemRow}>
                  {item.image
                    ? <Image source={{ uri: item.image }} style={s.itemImg} />
                    : <View style={[s.itemImg, s.itemImgFb]}><Package color="#FF6B35" size={15} /></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName} numberOfLines={1}>{item.name}{item.variantName ? <Text style={s.itemVariant}> — {item.variantName}</Text> : ''}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <View style={s.qtyPill}><Text style={s.qtyText}>×{item.quantity}</Text></View>
                      <Text style={s.itemPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              ))}
              {freeItems.map((item, i) => (
                <View key={`f${i}`} style={[s.itemRow, { backgroundColor: 'rgba(255,107,53,0.06)', borderRadius: 10 }]}>
                  <View style={[s.itemImg, s.itemImgFb]}><Star color="#FF6B35" size={14} fill="#FF6B35" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={{ color: '#FF6B35', fontSize: 11, fontWeight: '600', marginTop: 2 }}>🎁 Bonus item</Text>
                  </View>
                  <Text style={{ color: '#4ade80', fontSize: 13, fontWeight: '700' }}>FREE</Text>
                </View>
              ))}
            </View>

            {/* ── Totals ── */}
            <View style={s.card}>
              <View style={s.tRow}><Text style={s.tLabel}>Subtotal</Text><Text style={s.tVal}>R{order.subtotal.toFixed(2)}</Text></View>
              {(order.totalSavings || 0) > 0 && (
                <View style={s.tRow}><Text style={[s.tLabel, { color: '#4ade80' }]}>Saved 🎉</Text><Text style={[s.tVal, { color: '#4ade80' }]}>-R{order.totalSavings!.toFixed(2)}</Text></View>
              )}
              <View style={s.tRow}><Text style={s.tLabel}>Delivery</Text><Text style={s.tVal}>R{order.deliveryFee.toFixed(2)}</Text></View>
              <View style={[s.tRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 14, marginTop: 4, marginBottom: 0 }]}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Total Paid</Text>
                <Text style={{ color: '#FF6B35', fontSize: 22, fontWeight: '800' }}>R{order.total.toFixed(2)}</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const CARD = { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 22, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' };
const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0c0c0c' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  mutedText: { color: '#555', fontSize: 14 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#FF6B35' },
  retryText: { color: '#FF6B35', fontWeight: '700', fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerOrder: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  heroSection: { alignItems: 'center', paddingVertical: 20 },
  heroInner: { width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(255,107,53,0.1)', borderWidth: 2, borderColor: 'rgba(255,107,53,0.25)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 10 },
  heroSub: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 21, maxWidth: 270 },
  card: CARD,
  cardLabel: { color: '#444', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 18 },
  liveBadge: { backgroundColor: 'rgba(255,107,53,0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  liveBadgeText: { color: '#FF6B35', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  etaText: { color: '#666', fontSize: 13 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  pickerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,107,53,0.15)', alignItems: 'center', justifyContent: 'center' },
  stepDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  stepDotActive: { borderColor: '#FF6B35', backgroundColor: 'rgba(255,107,53,0.1)' },
  stepDotDone: { backgroundColor: '#14532d', borderColor: '#4ade80' },
  stepDotPending: { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: '#222' },
  stepLine: { width: 2, height: 24, backgroundColor: '#1e1e1e', marginVertical: 2 },
  stepLabel: { color: '#333', fontSize: 14, paddingTop: 7, paddingBottom: 26, paddingLeft: 14, fontWeight: '500' },
  stepLabelDone: { color: '#4ade80' },
  stepLabelActive: { color: '#fff', fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  itemImg: { width: 46, height: 46, borderRadius: 11, backgroundColor: '#1a1a1a' },
  itemImgFb: { alignItems: 'center', justifyContent: 'center' },
  itemName: { color: '#ddd', fontSize: 13, fontWeight: '600' },
  itemVariant: { color: '#555', fontWeight: '400' },
  qtyPill: { backgroundColor: 'rgba(255,107,53,0.14)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  qtyText: { color: '#FF6B35', fontSize: 11, fontWeight: '700' },
  itemPrice: { color: '#888', fontSize: 13, fontWeight: '600' },
  tRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  tLabel: { color: '#555', fontSize: 14 },
  tVal: { color: '#bbb', fontSize: 14, fontWeight: '600' },
});
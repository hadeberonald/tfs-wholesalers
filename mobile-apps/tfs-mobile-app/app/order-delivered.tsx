// app/order-delivered.tsx
// The grand finale. Confetti explosion, celebration state, review prompt.

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Easing, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, ShoppingBag, Star, Home, Package } from 'lucide-react-native';
import api from '@/lib/api';

const { width: SW } = Dimensions.get('window');

interface Order {
  _id: string; orderNumber: string; orderStatus: string;
  subtotal: number; deliveryFee: number; total: number;
  totalSavings?: number; items: { name: string; quantity: number; price: number; autoAdded?: boolean }[];
  deliveredAt?: string; driverInfo?: { name: string };
}

// ── Confetti particle ─────────────────────────────────────────────────────────
function ConfettiParticle({ delay, x, color, size }: { delay: number; x: number; color: string; size: number }) {
  const y = useRef(new Animated.Value(-30)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(y, { toValue: 520, duration: 2200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(rot, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(1400),
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(Math.random() > 0.5 ? 1 : -1) * 720}deg`] });

  return (
    <Animated.View style={{
      position: 'absolute', left: x, top: 0,
      width: size, height: size * 0.6, borderRadius: 2,
      backgroundColor: color,
      transform: [{ translateY: y }, { rotate }],
      opacity,
    }} />
  );
}

function ConfettiBurst() {
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    delay: Math.random() * 600,
    x: Math.random() * SW,
    color: ['#FF6B35', '#4ade80', '#facc15', '#a78bfa', '#f472b6', '#38bdf8', '#fb923c'][Math.floor(Math.random() * 7)],
    size: 6 + Math.random() * 10,
  }));
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 550, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map(p => <ConfettiParticle key={p.id} {...p} />)}
    </View>
  );
}

// ── Star rating ───────────────────────────────────────────────────────────────
function StarRating({ rating, onRate }: { rating: number; onRate: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onRate(n)}>
          <Star
            color={n <= rating ? '#facc15' : '#2a2a2a'}
            fill={n <= rating ? '#facc15' : 'transparent'}
            size={32}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Big check with shimmer ────────────────────────────────────────────────────
function DeliveryCheck() {
  const scale = useRef(new Animated.Value(0.3)).current;
  const outerScale = useRef(new Animated.Value(0.6)).current;
  const outerOpacity = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(100),
          Animated.parallel([
            Animated.spring(outerScale, { toValue: 1.5, friction: 4, tension: 60, useNativeDriver: true }),
            Animated.timing(outerOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
          ]),
        ]),
      ]),
    ]).start();

    // Shimmer loop on the outer ring
    Animated.loop(Animated.sequence([
      Animated.delay(1500),
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ])).start();
  }, []);

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.5] });

  return (
    <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
      {/* Burst ring */}
      <Animated.View style={{
        position: 'absolute', width: 150, height: 150, borderRadius: 75,
        borderWidth: 2, borderColor: '#4ade80',
        transform: [{ scale: outerScale }], opacity: outerOpacity,
      }} />
      {/* Shimmer ring */}
      <Animated.View style={{
        position: 'absolute', width: 130, height: 130, borderRadius: 65,
        borderWidth: 2, borderColor: '#4ade80', opacity: shimmerOpacity,
      }} />
      {/* Main circle */}
      <Animated.View style={[od.bigCheck, { transform: [{ scale }] }]}>
        <CheckCircle color="#fff" size={62} fill="#22c55e" />
      </Animated.View>
    </View>
  );
}

export default function OrderDeliveredScreen() {
  const router = useRouter();
  const { orderId = '' } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);
  const contentOp = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(30)).current;

  const fetchOrder = useCallback(async () => {
    try {
      const res = await api.get(`/api/orders/${orderId}`);
      setOrder(res.data.order);
    } catch {}
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    Animated.parallel([
      Animated.timing(contentOp, { toValue: 1, duration: 700, delay: 400, useNativeDriver: true }),
      Animated.spring(contentY, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(t);
  }, [fetchOrder]);

  const handleRate = (n: number) => {
    setRating(n);
    if (!rated) {
      setRated(true);
      try { api.post(`/api/orders/${orderId}/rate`, { rating: n }); } catch {}
    }
  };

  const nonFreeItems = order?.items.filter(i => !i.autoAdded) ?? [];

  return (
    <View style={od.bg}>
      {showConfetti && <ConfettiBurst />}

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header – minimal, no back button — this is the end state */}
        <View style={od.header}>
          <View style={{ flex: 1 }} />
          <Text style={od.headerLabel}>Delivery Complete</Text>
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
          {/* ── Hero ── */}
          <View style={od.heroSection}>
            <DeliveryCheck />
            <Text style={od.heroTitle}>Delivered! 🎉</Text>
            {order?.driverInfo?.name && (
              <Text style={od.heroSub}>Brought to you by <Text style={{ color: '#fff', fontWeight: '700' }}>{order.driverInfo.name}</Text></Text>
            )}
            {!order?.driverInfo && (
              <Text style={od.heroSub}>Your order has arrived. Enjoy every bite!</Text>
            )}
            {order?.deliveredAt && (
              <View style={od.deliveredAtPill}>
                <Text style={od.deliveredAtText}>
                  ✓ Delivered at {new Date(order.deliveredAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
          </View>

          <Animated.View style={{ opacity: contentOp, transform: [{ translateY: contentY }] }}>
            {/* ── Rating card ── */}
            <View style={[od.card, { borderColor: 'rgba(250,204,21,0.25)' }]}>
              <Text style={od.cardLabel}>HOW WAS YOUR DELIVERY?</Text>
              <Text style={{ color: '#bbb', fontSize: 14, marginBottom: 16 }}>
                {rated ? (rating >= 4 ? 'Thank you! We love the love! ❤️' : 'Thanks for your feedback — we\'ll do better!') : 'Tap a star to rate your experience'}
              </Text>
              <StarRating rating={rating} onRate={handleRate} />
            </View>

            {/* ── Savings celebration ── */}
            {(order?.totalSavings || 0) > 0 && (
              <View style={od.savingsCard}>
                <Text style={od.savingsEmoji}>🎁</Text>
                <View>
                  <Text style={od.savingsTitle}>You saved R{order!.totalSavings!.toFixed(2)} today!</Text>
                  <Text style={od.savingsSub}>Thanks to your specials and promotions</Text>
                </View>
              </View>
            )}

            {/* ── Order breakdown ── */}
            {order && (
              <View style={od.card}>
                <Text style={od.cardLabel}>ORDER #{order.orderNumber}</Text>
                {nonFreeItems.map((item, i) => (
                  <View key={i} style={od.itemRow}>
                    <View style={od.qtyPill}><Text style={od.qtyText}>×{item.quantity}</Text></View>
                    <Text style={od.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={od.itemPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
                  </View>
                ))}
                <View style={od.divider} />
                <View style={od.totalRow}><Text style={od.totalLabel}>Total Paid</Text><Text style={od.totalValue}>R{order.total.toFixed(2)}</Text></View>
              </View>
            )}

            {/* ── CTAs ── */}
            <TouchableOpacity style={od.primaryBtn} onPress={() => router.replace('/(tabs)')}>
              <Home color="#fff" size={18} />
              <Text style={od.primaryBtnText}>Back to Shop</Text>
            </TouchableOpacity>

            <TouchableOpacity style={od.secondaryBtn} onPress={() => router.push('/(tabs)/orders')}>
              <Package color="#FF6B35" size={18} />
              <Text style={od.secondaryBtnText}>View Order History</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const CARD = { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 22, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' };
const od = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#080d0a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  headerLabel: { color: '#555', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  heroSection: { alignItems: 'center', paddingVertical: 28 },
  bigCheck: { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 2, borderColor: 'rgba(74,222,128,0.3)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1, marginBottom: 10 },
  heroSub: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 21, maxWidth: 260 },
  deliveredAtPill: { marginTop: 14, backgroundColor: 'rgba(74,222,128,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)' },
  deliveredAtText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  card: CARD,
  cardLabel: { color: '#444', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 14 },
  savingsCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(250,204,21,0.07)', borderRadius: 22, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(250,204,21,0.2)' },
  savingsEmoji: { fontSize: 36 },
  savingsTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  savingsSub: { color: '#888', fontSize: 12, marginTop: 3 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  qtyPill: { backgroundColor: 'rgba(255,107,53,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 30, alignItems: 'center' },
  qtyText: { color: '#FF6B35', fontSize: 11, fontWeight: '700' },
  itemName: { flex: 1, color: '#ddd', fontSize: 13, fontWeight: '500' },
  itemPrice: { color: '#888', fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  totalValue: { color: '#4ade80', fontSize: 22, fontWeight: '800' },
  primaryBtn: { backgroundColor: '#FF6B35', borderRadius: 18, height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12, shadowColor: '#FF6B35', shadowOpacity: 0.35, shadowRadius: 14, elevation: 7 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryBtn: { borderRadius: 18, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderColor: 'rgba(255,107,53,0.4)' },
  secondaryBtnText: { color: '#FF6B35', fontSize: 15, fontWeight: '700' },
});
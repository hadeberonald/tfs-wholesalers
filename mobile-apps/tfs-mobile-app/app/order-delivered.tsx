// app/order-delivered.tsx
// Terminal screen — no navigation away, but still uses useOrderSocket
// so if somehow the user lands here before status is confirmed delivered,
// the screen stays accurate.

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Easing, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, Star, Home, Package } from 'lucide-react-native';
import { useOrderSocket } from '@/hooks/useOrderSocket';
import api from '@/lib/api';

const { width: SW } = Dimensions.get('window');

interface Order {
  _id: string; orderNumber: string;
  subtotal: number; deliveryFee: number; total: number; totalSavings?: number;
  items: { name: string; quantity: number; price: number; autoAdded?: boolean }[];
  deliveredAt?: string; driverInfo?: { name: string };
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function ConfettiParticle({ delay, x, color, size }: { delay: number; x: number; color: string; size: number }) {
  const y   = useRef(new Animated.Value(-30)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const op  = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(y,   { toValue: 520, duration: 2200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(rot, { toValue: 1,   duration: 2200, useNativeDriver: true }),
        Animated.sequence([Animated.delay(1400), Animated.timing(op, { toValue: 0, duration: 800, useNativeDriver: true })]),
      ]),
    ]).start();
  }, []);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(Math.random() > 0.5 ? 1 : -1) * 720}deg`] });
  return (
    <Animated.View style={{ position: 'absolute', left: x, top: 0, width: size, height: size * 0.6, borderRadius: 2, backgroundColor: color, transform: [{ translateY: y }, { rotate }], opacity: op }} />
  );
}

function ConfettiBurst() {
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i, delay: Math.random() * 600, x: Math.random() * SW,
    color: ['#FF6B35','#4ade80','#facc15','#a78bfa','#f472b6','#38bdf8'][Math.floor(Math.random() * 6)],
    size: 6 + Math.random() * 10,
  }));
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 550, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map(p => <ConfettiParticle key={p.id} {...p} />)}
    </View>
  );
}

function DeliveryCheck() {
  const scale = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[s.bigCheck, { transform: [{ scale }] }]}>
      <CheckCircle color="#fff" size={62} fill="#22c55e" />
    </Animated.View>
  );
}

function StarRating({ rating, onRate }: { rating: number; onRate: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onRate(n)}>
          <Star color={n <= rating ? '#facc15' : '#d1d5db'} fill={n <= rating ? '#facc15' : 'transparent'} size={32} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function OrderDeliveredScreen() {
  const router = useRouter();
  const { orderId = '' } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder]   = useState<Order | null>(null);
  const [rating, setRating] = useState(0);
  const [rated,  setRated]  = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);
  const contentOp = useRef(new Animated.Value(0)).current;
  const contentY  = useRef(new Animated.Value(30)).current;

  // Socket keeps the order data fresh (e.g. deliveredAt timestamp arrives)
  // No navigation away — this is the terminal screen
  useOrderSocket(orderId, useCallback((o: Order) => {
    setOrder(o);
  }, []));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentOp, { toValue: 1, duration: 700, delay: 400, useNativeDriver: true }),
      Animated.spring(contentY,  { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const handleRate = (n: number) => {
    setRating(n);
    if (!rated) {
      setRated(true);
      api.post(`/api/orders/${orderId}/rate`, { rating: n }).catch(() => {});
    }
  };

  const visibleItems = order?.items.filter(i => !i.autoAdded) ?? [];

  return (
    <View style={s.bg}>
      {showConfetti && <ConfettiBurst />}
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={s.header}>
          <Text style={s.headerLabel}>Delivery Complete</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
          {/* Hero */}
          <View style={s.heroSection}>
            <DeliveryCheck />
            <Text style={s.heroTitle}>Delivered! 🎉</Text>
            {order?.driverInfo?.name
              ? <Text style={s.heroSub}>Brought to you by <Text style={{ color: '#1f2937', fontWeight: '700' }}>{order.driverInfo.name}</Text></Text>
              : <Text style={s.heroSub}>Your order has arrived. Enjoy!</Text>
            }
            {order?.deliveredAt && (
              <View style={s.deliveredPill}>
                <Text style={s.deliveredPillText}>
                  ✓ Delivered at {new Date(order.deliveredAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
          </View>

          <Animated.View style={{ opacity: contentOp, transform: [{ translateY: contentY }] }}>

            {/* Rating */}
            <View style={s.card}>
              <Text style={s.cardLabel}>HOW WAS YOUR DELIVERY?</Text>
              <Text style={s.cardSub}>
                {rated ? (rating >= 4 ? 'Thank you! We love the love! ❤️' : "Thanks — we'll do better!") : 'Tap a star to rate'}
              </Text>
              <StarRating rating={rating} onRate={handleRate} />
            </View>

            {/* Savings */}
            {(order?.totalSavings || 0) > 0 && (
              <View style={s.savingsCard}>
                <Text style={{ fontSize: 36 }}>🎁</Text>
                <View>
                  <Text style={s.savingsTitle}>You saved R{order!.totalSavings!.toFixed(2)} today!</Text>
                  <Text style={s.savingsSub}>Thanks to your specials and promotions</Text>
                </View>
              </View>
            )}

            {/* Order breakdown */}
            {order && (
              <View style={s.card}>
                <Text style={s.cardLabel}>ORDER #{order.orderNumber}</Text>
                {visibleItems.map((item, i) => (
                  <View key={i} style={s.itemRow}>
                    <View style={s.qtyPill}><Text style={s.qtyText}>×{item.quantity}</Text></View>
                    <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.itemPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
                  </View>
                ))}
                <View style={s.divider} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937' }}>Total Paid</Text>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#22c55e' }}>R{order.total.toFixed(2)}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/(tabs)')}>
              <Home color="#fff" size={18} />
              <Text style={s.primaryBtnText}>Back to Shop</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.secondaryBtn} onPress={() => router.push('/(tabs)/orders')}>
              <Package color="#FF6B35" size={18} />
              <Text style={s.secondaryBtnText}>View Order History</Text>
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const CARD: any = { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 };

const s = StyleSheet.create({
  bg:         { flex: 1, backgroundColor: '#f9fafb' },
  header:     { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerLabel:{ color: '#9ca3af', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  heroSection:{ alignItems: 'center', paddingVertical: 28 },
  bigCheck:   { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 2, borderColor: 'rgba(74,222,128,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  heroTitle:  { fontSize: 32, fontWeight: '800', color: '#1f2937', letterSpacing: -1, marginBottom: 10 },
  heroSub:    { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 21, maxWidth: 260 },
  deliveredPill:     { marginTop: 14, backgroundColor: '#f0fdf4', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#bbf7d0' },
  deliveredPillText: { color: '#16a34a', fontSize: 13, fontWeight: '600' },
  card:     CARD,
  cardLabel:{ color: '#9ca3af', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  cardSub:  { color: '#6b7280', fontSize: 14, marginBottom: 16 },
  savingsCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fffbeb', borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#fde68a' },
  savingsTitle:{ color: '#1f2937', fontSize: 16, fontWeight: '700' },
  savingsSub:  { color: '#6b7280', fontSize: 12, marginTop: 3 },
  itemRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  qtyPill:   { backgroundColor: 'rgba(255,107,53,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 30, alignItems: 'center' },
  qtyText:   { color: '#FF6B35', fontSize: 11, fontWeight: '700' },
  itemName:  { flex: 1, color: '#1f2937', fontSize: 13, fontWeight: '500' },
  itemPrice: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  divider:   { height: 1, backgroundColor: '#f3f4f6', marginVertical: 12 },
  primaryBtn:     { backgroundColor: '#FF6B35', borderRadius: 18, height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12, shadowColor: '#FF6B35', shadowOpacity: 0.3, shadowRadius: 14, elevation: 6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryBtn:     { borderRadius: 18, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderColor: 'rgba(255,107,53,0.35)' },
  secondaryBtnText: { color: '#FF6B35', fontSize: 15, fontWeight: '700' },
});
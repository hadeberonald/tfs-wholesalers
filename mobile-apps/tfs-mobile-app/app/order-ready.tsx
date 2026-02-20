// app/order-ready.tsx
// Status: 'ready' | 'packaging'
// Order is packed, driver being assigned. Cinematic reveal, green theme.

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Package, CheckCircle, Truck, RotateCcw, Clock } from 'lucide-react-native';
import api from '@/lib/api';

interface Order {
  _id: string; orderNumber: string; orderStatus: string;
  subtotal: number; deliveryFee: number; total: number;
  totalSavings?: number; estimatedMinutes?: number;
  items: { name: string; variantName?: string; quantity: number; price: number; autoAdded?: boolean }[];
}

function CheckmarkBurst() {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(ringScale, { toValue: 1.8, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={{ width: 130, height: 130, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
      {/* Burst ring */}
      <Animated.View style={{
        position: 'absolute', width: 130, height: 130, borderRadius: 65,
        borderWidth: 3, borderColor: '#4ade80',
        transform: [{ scale: ringScale }], opacity: ringOpacity,
      }} />
      {/* Static outer ring */}
      <View style={{ position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 1.5, borderColor: 'rgba(74,222,128,0.2)' }} />
      {/* Checkmark circle */}
      <Animated.View style={[st.checkCircle, { transform: [{ scale }], opacity }]}>
        <CheckCircle color="#fff" size={52} fill="#22c55e" />
      </Animated.View>
    </View>
  );
}

function SpinningDots() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(rot, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <View key={i} style={{
            position: 'absolute', width: 6, height: 6, borderRadius: 3,
            backgroundColor: i % 2 === 0 ? '#4ade80' : 'rgba(74,222,128,0.3)',
            top: 2 + Math.sin(i * Math.PI / 3) * 14,
            left: 15 + Math.cos(i * Math.PI / 3) * 14,
          }} />
        ))}
      </View>
    </Animated.View>
  );
}

export default function OrderReadyScreen() {
  const router = useRouter();
  const { orderId = '' } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const contentOp = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(24)).current;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async (silent = false) => {
    try {
      const res = await api.get(`/api/orders/${orderId}`);
      const o: Order = res.data.order;
      setOrder(o);
      if (['out_for_delivery','collecting'].includes(o.orderStatus)) router.replace(`/order-on-the-way?orderId=${orderId}`);
      else if (o.orderStatus === 'delivered') router.replace(`/order-delivered?orderId=${orderId}`);
      else if (['pending','confirmed','picking'].includes(o.orderStatus)) router.replace(`/order-preparing?orderId=${orderId}`);
    } catch {}
    setLoading(false); setRefreshing(false);
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    Animated.parallel([
      Animated.timing(contentOp, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }),
      Animated.spring(contentY, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
    ]).start();
    pollRef.current = setInterval(() => fetchOrder(true), 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrder]);

  if (loading || !order) return (
    <View style={st.bg}><SafeAreaView style={st.centered}><SpinningDots /></SafeAreaView></View>
  );

  const regularItems = order.items.filter(i => !i.autoAdded);
  const driverAssigned = order.orderStatus !== 'packaging';

  return (
    <View style={st.bg}>
      <SafeAreaView style={{ flex: 1 }} edges={['top','left','right']}>
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity style={st.iconBtn} onPress={() => router.back()}>
            <ChevronLeft color="#fff" size={22} />
          </TouchableOpacity>
          <Text style={st.headerOrder}>#{order.orderNumber}</Text>
          <TouchableOpacity style={[st.iconBtn, { backgroundColor: 'rgba(74,222,128,0.12)' }]} onPress={() => { setRefreshing(true); fetchOrder(); }}>
            <RotateCcw color="#4ade80" size={16} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 44 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrder(); }} tintColor="#4ade80" />}
        >
          {/* Hero */}
          <View style={st.heroSection}>
            <CheckmarkBurst />
            <Text style={st.heroTitle}>Packed & Ready! 🎉</Text>
            <Text style={st.heroSub}>Your order is sealed and waiting for a driver to collect it</Text>
          </View>

          <Animated.View style={{ opacity: contentOp, transform: [{ translateY: contentY }] }}>
            {/* Status card */}
            <View style={[st.card, { borderColor: 'rgba(74,222,128,0.3)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <SpinningDots />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                    {driverAssigned ? 'Driver Assigned' : 'Assigning Driver'}
                  </Text>
                  <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                    {driverAssigned ? 'Your driver is heading to the store' : 'Finding the nearest available driver…'}
                  </Text>
                </View>
                <View style={{ backgroundColor: 'rgba(74,222,128,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                  <Text style={{ color: '#4ade80', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>READY</Text>
                </View>
              </View>
              {order.estimatedMinutes && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                  <Clock color="#4ade80" size={15} />
                  <Text style={{ color: '#bbb', fontSize: 13 }}>
                    Delivery in approx. <Text style={{ color: '#4ade80', fontWeight: '700' }}>{order.estimatedMinutes} min</Text>
                  </Text>
                </View>
              )}
            </View>

            {/* Progress */}
            <View style={st.card}>
              <Text style={st.cardLabel}>ORDER PROGRESS</Text>
              {[
                { label: 'Order Confirmed', done: true },
                { label: 'Items Picked',    done: true },
                { label: 'Packed & Ready',  done: true, current: true },
                { label: 'Driver on Route', done: driverAssigned },
                { label: 'Out for Delivery', done: false },
              ].map((step, i, arr) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ alignItems: 'center', width: 32 }}>
                    <View style={[st.stepDot,
                      step.done && st.stepDotDone,
                      !step.done && st.stepDotPending,
                    ]}>
                      {step.done && <CheckCircle color="#fff" size={13} />}
                    </View>
                    {i < arr.length - 1 && <View style={[st.stepLine, step.done && { backgroundColor: '#4ade80' }]} />}
                  </View>
                  <Text style={[st.stepLabel,
                    step.done && { color: '#4ade80' },
                    step.current && { color: '#fff', fontWeight: '700' },
                    !step.done && { color: '#2a2a2a' },
                  ]}>{step.label}{step.current ? ' ✓' : ''}</Text>
                </View>
              ))}
            </View>

            {/* What to expect */}
            <View style={st.card}>
              <Text style={st.cardLabel}>WHAT HAPPENS NEXT</Text>
              <View style={st.nextRow}>
                <View style={[st.nextIcon, { backgroundColor: 'rgba(74,222,128,0.12)' }]}>
                  <Truck color="#4ade80" size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Driver collecting your order</Text>
                  <Text style={{ color: '#666', fontSize: 12, marginTop: 3, lineHeight: 18 }}>
                    Once collected, you'll see live tracking with their exact location
                  </Text>
                </View>
              </View>
              <View style={st.nextRow}>
                <View style={[st.nextIcon, { backgroundColor: 'rgba(255,107,53,0.12)' }]}>
                  <Package color="#FF6B35" size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Your order is sealed & ready</Text>
                  <Text style={{ color: '#666', fontSize: 12, marginTop: 3, lineHeight: 18 }}>
                    {regularItems.length} item{regularItems.length !== 1 ? 's' : ''} packed securely for delivery
                  </Text>
                </View>
              </View>
            </View>

            {/* Summary */}
            <View style={st.card}>
              <View style={st.tRow}><Text style={st.tLabel}>Subtotal</Text><Text style={st.tVal}>R{order.subtotal.toFixed(2)}</Text></View>
              {(order.totalSavings || 0) > 0 && (
                <View style={st.tRow}><Text style={[st.tLabel, { color: '#4ade80' }]}>Saved</Text><Text style={[st.tVal, { color: '#4ade80' }]}>-R{order.totalSavings!.toFixed(2)}</Text></View>
              )}
              <View style={st.tRow}><Text style={st.tLabel}>Delivery</Text><Text style={st.tVal}>R{order.deliveryFee.toFixed(2)}</Text></View>
              <View style={[st.tRow, st.grandRow]}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Total Paid</Text>
                <Text style={{ color: '#4ade80', fontSize: 22, fontWeight: '800' }}>R{order.total.toFixed(2)}</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const CARD = { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 22, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' };
const st = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#080e0a' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerOrder: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  heroSection: { alignItems: 'center', paddingVertical: 24 },
  checkCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(34,197,94,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(74,222,128,0.3)' },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 10 },
  heroSub: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 21, maxWidth: 280 },
  card: CARD,
  cardLabel: { color: '#444', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 18 },
  stepDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  stepDotDone: { backgroundColor: '#14532d', borderColor: '#4ade80' },
  stepDotPending: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: '#1e1e1e' },
  stepLine: { width: 2, height: 24, backgroundColor: '#151515', marginVertical: 2 },
  stepLabel: { fontSize: 14, paddingTop: 7, paddingBottom: 26, paddingLeft: 14, fontWeight: '500' },
  nextRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  nextIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  tLabel: { color: '#555', fontSize: 14 },
  tVal: { color: '#bbb', fontSize: 14, fontWeight: '600' },
  grandRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 14, marginTop: 4, marginBottom: 0 },
});
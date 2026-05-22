// app/order-on-the-way.tsx
// Status: 'out_for_delivery'
// Socket auto-navigates to order-delivered when status changes.

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Truck, MapPin, CheckCircle, Users } from 'lucide-react-native';
import { useOrderSocket } from '@/hooks/useOrderSocket';

interface Order {
  _id: string;
  orderNumber: string;
  orderStatus: string;
  total: number;
  deliveryAddress: { street?: string; city?: string; province?: string };
  driverInfo?: { name: string; vehicleReg?: string };
  ordersBeforeMe?: number;
}

function TruckBounce() {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: -8, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0,  duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ translateY: bob }] }}>
      <View style={s.truckCircle}><Truck color="#FF6B35" size={40} /></View>
    </Animated.View>
  );
}

export default function OrderOnTheWayScreen() {
  const router = useRouter();
  const { orderId = '' } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder]     = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const navigate = useCallback((status: string) => {
    if (status === 'delivered') { router.replace(`/order-delivered?orderId=${orderId}`); return true; }
    return false;
  }, [orderId, router]);

  useOrderSocket(orderId, useCallback((o: Order) => {
    if (navigate(o.orderStatus)) return;
    setOrder(o);
    setLoading(false);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
    ]).start();
  }, [navigate]));

  const ahead = order?.ordersBeforeMe ?? 0;
  const addressParts = order
    ? [order.deliveryAddress.street, order.deliveryAddress.city, order.deliveryAddress.province].filter(Boolean).join(', ')
    : '';

  return (
    <View style={s.bg}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={s.header}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
            <ChevronLeft color="#1f2937" size={22} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>On the Way</Text>
          <View style={s.livePill}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.centered}>
            <Text style={s.mutedText}>Locating your driver…</Text>
          </View>
        ) : (
          <Animated.ScrollView
            style={{ opacity: fadeAnim }}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[s.heroSection, { transform: [{ translateY: slideAnim }] }]}>
              <TruckBounce />
              <Text style={s.heroTitle}>Your order is on its way!</Text>
              <Text style={s.heroSub}>Sit tight — your delivery is heading to you now</Text>
            </Animated.View>

            {/* Queue position */}
            <View style={s.card}>
              <View style={[s.queueBadge, ahead === 0 ? s.queueNext : s.queueWait]}>
                {ahead === 0
                  ? <CheckCircle color="#22c55e" size={16} />
                  : <Users color="#f59e0b" size={16} />}
                <Text style={[s.queueText, { color: ahead === 0 ? '#16a34a' : '#b45309' }]}>
                  {ahead === 0 ? "You're next!" : `${ahead} stop${ahead > 1 ? 's' : ''} before you`}
                </Text>
              </View>
            </View>

            {/* Delivery address */}
            {!!addressParts && (
              <View style={s.card}>
                <View style={s.row}>
                  <View style={s.iconWrap}><MapPin color="#FF6B35" size={18} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>DELIVERING TO</Text>
                    <Text style={s.rowValue}>{addressParts}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Driver info — name + vehicle only, no call button */}
            {order?.driverInfo && (
              <View style={s.card}>
                <View style={s.row}>
                  <View style={s.driverAvatar}><Truck color="#FF6B35" size={20} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>YOUR DRIVER</Text>
                    <Text style={s.rowValue}>{order.driverInfo.name}</Text>
                    {order.driverInfo.vehicleReg && (
                      <Text style={s.rowSub}>{order.driverInfo.vehicleReg}</Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            <View style={s.refRow}>
              <Text style={s.refText}>Order #{order?.orderNumber}</Text>
              <Text style={s.refTotal}>R{order?.total.toFixed(2)}</Text>
            </View>
          </Animated.ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const CARD: any = {
  backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14,
  borderWidth: 1, borderColor: '#f3f4f6',
  shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
};

const s = StyleSheet.create({
  bg:        { flex: 1, backgroundColor: '#f9fafb' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mutedText: { color: '#9ca3af', fontSize: 14 },
  scroll:    { paddingHorizontal: 20, paddingBottom: 44 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  iconBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  livePill:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff3e0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  liveDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },
  liveText:    { color: '#FF6B35', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  heroSection: { alignItems: 'center', paddingVertical: 36, gap: 14 },
  truckCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff7f3', borderWidth: 2, borderColor: '#fed7aa', alignItems: 'center', justifyContent: 'center' },
  heroTitle:   { fontSize: 24, fontWeight: '800', color: '#1f2937', letterSpacing: -0.5, textAlign: 'center' },
  heroSub:     { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 21, maxWidth: 260 },

  card: CARD,

  queueBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  queueNext:  { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  queueWait:  { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  queueText:  { fontSize: 14, fontWeight: '700' },

  row:         { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff7f3', alignItems: 'center', justifyContent: 'center' },
  rowLabel:    { fontSize: 10, color: '#9ca3af', fontWeight: '700', letterSpacing: 0.8, marginBottom: 3 },
  rowValue:    { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  rowSub:      { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff7f3', borderWidth: 2, borderColor: '#fed7aa', alignItems: 'center', justifyContent: 'center' },

  refRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  refText:  { fontSize: 12, color: '#9ca3af' },
  refTotal: { fontSize: 14, fontWeight: '700', color: '#FF6B35' },
});
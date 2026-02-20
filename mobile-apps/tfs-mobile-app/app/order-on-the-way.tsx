// app/order-on-the-way.tsx
// Status: 'out_for_delivery' | 'collecting'
// Full-screen map, driver location, queue position, ETA.

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
  Dimensions, Linking, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  ChevronLeft, Truck, MapPin, Phone, Clock, CheckCircle,
  Users, RotateCcw, ChevronUp, ChevronDown,
} from 'lucide-react-native';
import api from '@/lib/api';

const { height: SH, width: SW } = Dimensions.get('window');

interface Order {
  _id: string; orderNumber: string; orderStatus: string; total: number;
  deliveryAddress: { street?: string; city?: string; province?: string; lat?: number; lng?: number };
  driverInfo?: { name: string; phone?: string; vehicleReg?: string };
  driverLocation?: { lat: number; lng: number; updatedAt: string };
  ordersBeforeMe?: number;
  estimatedMinutes?: number;
}

// ── Animated truck icon ────────────────────────────────────────────────────────
function TruckPin() {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: -5, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ translateY: bob }] }}>
      <View style={ot.truckPin}>
        <Truck color="#fff" size={16} />
      </View>
      <View style={ot.truckPinTail} />
    </Animated.View>
  );
}

// ── Destination pin ────────────────────────────────────────────────────────────
function DestPin() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.3, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={[ot.destRing, { transform: [{ scale: pulse }] }]} />
      <View style={ot.destPin}><MapPin color="#fff" size={16} fill="#FF6B35" /></View>
    </View>
  );
}

// ── Queue badge ────────────────────────────────────────────────────────────────
function QueueBadge({ ahead }: { ahead: number }) {
  const slideIn = useRef(new Animated.Value(-60)).current;
  useEffect(() => {
    Animated.spring(slideIn, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }).start();
  }, []);
  const isNext = ahead === 0;
  return (
    <Animated.View style={[ot.queueBadge, isNext ? ot.queueBadgeNext : ot.queueBadgeWait, { transform: [{ translateX: slideIn }] }]}>
      {isNext ? <CheckCircle color="#22c55e" size={15} /> : <Users color="#f59e0b" size={15} />}
      <Text style={[ot.queueText, isNext ? { color: '#16a34a' } : { color: '#b45309' }]}>
        {isNext ? "You're next!" : `${ahead} stop${ahead > 1 ? 's' : ''} before you`}
      </Text>
    </Animated.View>
  );
}

// ── Bottom sheet ───────────────────────────────────────────────────────────────
function BottomSheet({ order, onCall, expanded, onToggle }: {
  order: Order; onCall: () => void; expanded: boolean; onToggle: () => void;
}) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(300)).current;
  const ahead = order.ordersBeforeMe ?? 0;

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, friction: 7, tension: 55, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[ot.sheet, { paddingBottom: insets.bottom + 12, transform: [{ translateY: slideY }] }]}>
      {/* Drag handle + toggle */}
      <TouchableOpacity style={ot.handleRow} onPress={onToggle} activeOpacity={0.7}>
        <View style={ot.handle} />
        {expanded ? <ChevronDown color="#888" size={18} /> : <ChevronUp color="#888" size={18} />}
      </TouchableOpacity>

      {/* ETA + queue */}
      <View style={ot.etaRow}>
        <View>
          <Text style={ot.etaSmall}>ESTIMATED ARRIVAL</Text>
          <Text style={ot.etaBig}>
            {!order.estimatedMinutes ? 'Calculating…'
              : order.estimatedMinutes < 2 ? 'Arriving now!'
              : `~${order.estimatedMinutes} min`}
          </Text>
        </View>
        <QueueBadge ahead={ahead} />
      </View>

      {expanded && (
        <>
          {/* Address */}
          <View style={ot.addrRow}>
            <View style={ot.addrIcon}><MapPin color="#FF6B35" size={15} /></View>
            <Text style={ot.addrText} numberOfLines={2}>
              {[order.deliveryAddress?.street, order.deliveryAddress?.city, order.deliveryAddress?.province].filter(Boolean).join(', ')}
            </Text>
          </View>

          {/* Driver card */}
          {order.driverInfo && (
            <View style={ot.driverCard}>
              <View style={ot.driverAvatarWrap}>
                <Truck color="#FF6B35" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ot.driverName}>{order.driverInfo.name}</Text>
                {order.driverInfo.vehicleReg && (
                  <Text style={ot.driverVehicle}>{order.driverInfo.vehicleReg}</Text>
                )}
              </View>
              {order.driverInfo.phone && (
                <TouchableOpacity style={ot.callBtn} onPress={onCall} activeOpacity={0.8}>
                  <Phone color="#fff" size={17} />
                  <Text style={ot.callText}>Call</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}

      {/* Order ref strip */}
      <View style={ot.orderRefRow}>
        <Truck color="#444" size={13} />
        <Text style={ot.orderRef}>Order #{order.orderNumber}</Text>
        <Text style={ot.orderTotal}>R{order.total.toFixed(2)}</Text>
      </View>
    </Animated.View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function OrderOnTheWayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId = '' } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const mapRef = useRef<MapView>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async (silent = false) => {
    try {
      const res = await api.get(`/api/orders/${orderId}`);
      const o: Order = res.data.order;
      setOrder(o);
      if (o.orderStatus === 'delivered') router.replace(`/order-delivered?orderId=${orderId}`);
      // Fit map
      if (o.driverLocation && o.deliveryAddress?.lat) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates([
            { latitude: o.driverLocation!.lat, longitude: o.driverLocation!.lng },
            { latitude: o.deliveryAddress.lat!, longitude: o.deliveryAddress.lng! },
          ], { edgePadding: { top: 90, right: 44, bottom: sheetExpanded ? SH * 0.48 : SH * 0.28, left: 44 }, animated: true });
        }, 500);
      }
    } catch {}
    setLoading(false);
  }, [orderId, sheetExpanded]);

  useEffect(() => {
    fetchOrder();
    pollRef.current = setInterval(() => fetchOrder(true), 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrder]);

  const callDriver = () => {
    const phone = order?.driverInfo?.phone?.replace(/\s/g, '');
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const driverCoords = order?.driverLocation
    ? { latitude: order.driverLocation.lat, longitude: order.driverLocation.lng }
    : null;
  const destCoords = order?.deliveryAddress?.lat
    ? { latitude: order.deliveryAddress.lat!, longitude: order.deliveryAddress.lng! }
    : null;

  const initialRegion = driverCoords
    ? { latitude: driverCoords.latitude, longitude: driverCoords.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : { latitude: -28.4793, longitude: 30.5952, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <View style={{ flex: 1, backgroundColor: '#111' }}>
      {/* ── Map ── */}
      {!loading && (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          showsUserLocation
          showsCompass={false}
          showsMyLocationButton={false}
          customMapStyle={darkMapStyle}
        >
          {driverCoords && (
            <Marker coordinate={driverCoords} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
              <TruckPin />
            </Marker>
          )}
          {destCoords && (
            <Marker coordinate={destCoords} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
              <DestPin />
            </Marker>
          )}
          {driverCoords && destCoords && (
            <Polyline
              coordinates={[driverCoords, destCoords]}
              strokeColor="#FF6B35"
              strokeWidth={3}
              lineDashPattern={[8, 5]}
            />
          )}
        </MapView>
      )}

      {loading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#555', fontSize: 14 }}>Locating your driver…</Text>
        </View>
      )}

      {/* ── Top bar ── */}
      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <View style={ot.topBar}>
          <TouchableOpacity style={ot.topBtn} onPress={() => router.back()}>
            <ChevronLeft color="#1a1a1a" size={22} />
          </TouchableOpacity>
          <View style={ot.topTitle}>
            <Truck color="#FF6B35" size={15} />
            <Text style={ot.topTitleText}>On the Way</Text>
          </View>
          <View style={ot.livePill}>
            <View style={ot.liveDot} />
            <Text style={ot.liveText}>LIVE</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* ── Last updated badge ── */}
      {order?.driverLocation && (
        <View style={[ot.updatedBadge, { top: insets.top + 72 }]}>
          <Clock color="#888" size={11} />
          <Text style={ot.updatedText}>
            Updated {new Date(order.driverLocation.updatedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}

      {/* ── Bottom sheet ── */}
      {order && (
        <BottomSheet
          order={order}
          onCall={callDriver}
          expanded={sheetExpanded}
          onToggle={() => setSheetExpanded(e => !e)}
        />
      )}
    </View>
  );
}

const ot = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  topBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  topTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  topTitleText: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  liveText: { fontSize: 11, fontWeight: '800', color: '#ef4444', letterSpacing: 0.5 },
  updatedBadge: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  updatedText: { fontSize: 11, color: '#aaa' },
  truckPin: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FF6B35', alignItems: 'center', justifyContent: 'center', shadowColor: '#FF6B35', shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  truckPinTail: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FF6B35', alignSelf: 'center' },
  destRing: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,107,53,0.4)' },
  destPin: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FF6B35', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, elevation: 20 },
  handleRow: { alignItems: 'center', paddingVertical: 8, flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 6 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb' },
  etaRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 },
  etaSmall: { fontSize: 10, color: '#9ca3af', fontWeight: '700', letterSpacing: 0.8, marginBottom: 3 },
  etaBig: { fontSize: 32, fontWeight: '800', color: '#111', letterSpacing: -0.5 },
  queueBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginBottom: 6 },
  queueBadgeNext: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  queueBadgeWait: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  queueText: { fontSize: 12, fontWeight: '700' },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff7f3', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#fed7aa', marginBottom: 14 },
  addrIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fed7aa' },
  addrText: { flex: 1, fontSize: 13, color: '#1a1a1a', fontWeight: '500', lineHeight: 19 },
  driverCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#f9fafb', borderRadius: 16, padding: 14, marginBottom: 14 },
  driverAvatarWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff3f0', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fed7aa' },
  driverName: { fontSize: 15, fontWeight: '700', color: '#111' },
  driverVehicle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#22c55e', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, shadowColor: '#22c55e', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  callText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  orderRefRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderRef: { flex: 1, fontSize: 12, color: '#9ca3af' },
  orderTotal: { fontSize: 14, fontWeight: '700', color: '#FF6B35' },
});

// Minimal dark map style
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373760' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c6e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
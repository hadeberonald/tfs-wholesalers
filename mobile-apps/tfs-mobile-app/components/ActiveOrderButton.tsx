// components/ActiveOrderButton.tsx
// A persistent floating pill that appears whenever the user has an active order.
// Mount this inside your root _layout.tsx so it floats over all tab screens.
// Automatically polls for active orders and shows status + animated indicator.
// Tapping routes to the correct order status screen.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Truck, ShoppingBag, Package, CheckCircle, ChevronRight } from 'lucide-react-native';
import api from '@/lib/api';
import { useStore } from '@/lib/store';

const { width: SW } = Dimensions.get('window');

// ── Order status config ────────────────────────────────────────────────────────
type ActiveStatus = 'pending' | 'confirmed' | 'picking' | 'packaging' | 'ready' | 'collecting' | 'out_for_delivery';

const STATUS_CONFIG: Record<ActiveStatus, {
  label: string; sublabel: string; route: string;
  icon: React.FC<any>; color: string; bg: string; pulse: boolean;
}> = {
  pending:          { label: 'Order Placed',       sublabel: 'Confirming your order…',    route: '/order-preparing', icon: ShoppingBag, color: '#FF6B35', bg: '#1a0f08', pulse: true  },
  confirmed:        { label: 'Order Confirmed',     sublabel: 'Getting a picker ready',     route: '/order-preparing', icon: ShoppingBag, color: '#FF6B35', bg: '#1a0f08', pulse: true  },
  picking:          { label: 'Being Picked',        sublabel: 'Picker is selecting items',  route: '/order-preparing', icon: ShoppingBag, color: '#f59e0b', bg: '#1a1200', pulse: true  },
  packaging:        { label: 'Being Packed',        sublabel: 'Sealing your order',          route: '/order-ready',     icon: Package,     color: '#a78bfa', bg: '#120d1a', pulse: true  },
  ready:            { label: 'Ready for Pickup',    sublabel: 'Driver being assigned',       route: '/order-ready',     icon: Package,     color: '#4ade80', bg: '#081209', pulse: false },
  collecting:       { label: 'Driver Collecting',   sublabel: 'Heading to the store',        route: '/order-on-the-way', icon: Truck,      color: '#38bdf8', bg: '#080e12', pulse: true  },
  out_for_delivery: { label: 'On the Way!',         sublabel: 'Driver heading to you',       route: '/order-on-the-way', icon: Truck,      color: '#FF6B35', bg: '#1a0f08', pulse: true  },
};

const ACTIVE_STATUSES: ActiveStatus[] = ['pending','confirmed','picking','packaging','ready','collecting','out_for_delivery'];
const HIDDEN_ROUTES = ['/order-preparing', '/order-ready', '/order-on-the-way', '/order-delivered', '/payment', '/checkout', '/address-picker'];

// ── Pulse dot ──────────────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const s = useRef(new Animated.Value(1)).current;
  const op = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(s, { toValue: 1.8, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(s, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(op, { toValue: 0.15, duration: 700, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.7, duration: 700, useNativeDriver: true }),
      ]),
    ])).start();
  }, []);
  return (
    <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: color, transform: [{ scale: s }], opacity: op }} />
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }} />
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ActiveOrderButton() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const user = useStore(s => s.user);

  const [activeOrder, setActiveOrder] = useState<{ _id: string; orderNumber: string; orderStatus: string } | null>(null);
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visibleRef = useRef(false);

  const fetchActiveOrder = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/api/orders/active');
      const order = res.data.order;
      if (order && ACTIVE_STATUSES.includes(order.orderStatus)) {
        setActiveOrder(order);
      } else {
        setActiveOrder(null);
      }
    } catch {
      setActiveOrder(null);
    }
  }, [user]);

  // Show/hide animation
  const show = useCallback(() => {
    if (visibleRef.current) return;
    visibleRef.current = true;
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    // Initial attention wiggle
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 5, duration: 60, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -5, duration: 60, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 4, duration: 60, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -4, duration: 60, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }, 600);
  }, []);

  const hide = useCallback(() => {
    if (!visibleRef.current) return;
    visibleRef.current = false;
    Animated.parallel([
      Animated.spring(translateY, { toValue: 120, friction: 8, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  // Status change wiggle to grab attention
  const statusWiggle = useCallback(() => {
    Animated.sequence([
      Animated.timing(wiggle, { toValue: -8, duration: 80, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 8, duration: 80, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -5, duration: 80, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    fetchActiveOrder();
    pollRef.current = setInterval(() => fetchActiveOrder(), 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchActiveOrder]);

  const isHiddenRoute = HIDDEN_ROUTES.some(r => pathname.startsWith(r));

  useEffect(() => {
    if (activeOrder && !isHiddenRoute) show();
    else hide();
  }, [activeOrder, isHiddenRoute]);

  // Wiggle on status change
  const prevStatus = useRef<string | null>(null);
  useEffect(() => {
    if (activeOrder && prevStatus.current && prevStatus.current !== activeOrder.orderStatus) {
      statusWiggle();
    }
    prevStatus.current = activeOrder?.orderStatus ?? null;
  }, [activeOrder?.orderStatus]);

  const handlePress = () => {
    if (!activeOrder) return;
    const cfg = STATUS_CONFIG[activeOrder.orderStatus as ActiveStatus];
    if (cfg) router.push(`${cfg.route}?orderId=${activeOrder._id}`);
  };

  if (!activeOrder) return null;
  const cfg = STATUS_CONFIG[activeOrder.orderStatus as ActiveStatus] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: insets.bottom + 90, // sit above tab bar
          transform: [{ translateY }, { translateX: wiggle }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={[styles.pill, { backgroundColor: cfg.bg, borderColor: `${cfg.color}33` }]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        {/* Left icon + pulse */}
        <View style={[styles.iconWrap, { backgroundColor: `${cfg.color}18` }]}>
          <Icon color={cfg.color} size={18} />
        </View>

        {/* Text */}
        <View style={styles.textWrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            {cfg.pulse && <PulseDot color={cfg.color} />}
            <Text style={[styles.pillTitle, { color: '#fff' }]} numberOfLines={1}>{cfg.label}</Text>
          </View>
          <Text style={styles.pillSub} numberOfLines={1}>{cfg.sublabel}</Text>
        </View>

        {/* Right arrow */}
        <View style={[styles.arrowWrap, { backgroundColor: `${cfg.color}22` }]}>
          <ChevronRight color={cfg.color} size={16} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16, right: 16,
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 22, paddingVertical: 13, paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1 },
  pillTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
  pillSub: { fontSize: 11, color: '#888', marginTop: 1, fontWeight: '500' },
  arrowWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
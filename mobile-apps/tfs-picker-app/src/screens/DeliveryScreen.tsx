// src/screens/DeliveryScreen.tsx  (maps to "DeliveryDetail" in navigator)
// Full offline support:
//   - Order is cached to AsyncStorage on first successful fetch
//   - Package verifications are stored locally (survive hard-close)
//   - "Complete Delivery" enqueues the action and syncs when back online
//   - Offline banner shows when no network is detected

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Linking, Platform, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { MapPin, Package, CheckCircle, Navigation, Phone, ArrowLeft, WifiOff } from 'lucide-react-native';
import { useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import StatusStepper from '../components/StatusStepper';
import { useAppModal } from '../components/AppModal';
import {
  enqueueAction,
  cacheOrder,
  getCachedOrder,
  flushQueue,
  getPendingCount,
} from '../services/offlineSync';

const API_URL = 'https://tfs-wholesalers-ifad.onrender.com';

// ─── Verified-packages persistence (per order, survives hard-close) ───────────
const VERIFIED_KEY = (orderId: string) => `verified_packages:${orderId}`;

async function loadVerified(orderId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(VERIFIED_KEY(orderId));
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

async function saveVerified(orderId: string, set: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(VERIFIED_KEY(orderId), JSON.stringify(Array.from(set)));
  } catch {
    // non-fatal
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeliveryDetailScreen({ navigation: navProp }: any) {
  const navigation    = navProp as any;
  const route         = useRoute();
  const params        = route.params as { orderId: string };
  const { showModal } = useAppModal();
  const insets        = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning]         = useState(false);
  const [order, setOrder]               = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [isOnline, setIsOnline]         = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [verifiedPackages, setVerifiedPackages] = useState<Set<string>>(new Set());

  // Keep a stable ref so callbacks always see the latest verified set
  const verifiedRef = useRef<Set<string>>(new Set());

  // ── Network monitor ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const online = !!state.isConnected;
      setIsOnline(online);
      if (online) {
        flushQueue().catch(() => {});
        refreshPendingCount();
      }
    });
    // Check immediately
    NetInfo.fetch().then(s => setIsOnline(!!s.isConnected));
    return () => unsub();
  }, []);

  const refreshPendingCount = async () => {
    const n = await getPendingCount();
    setPendingCount(n);
  };

  // ── Load order (network first, cache fallback) ─────────────────────────────
  useEffect(() => {
    fetchOrder();
  }, [params.orderId]);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await axios.get(`${API_URL}/api/orders/${params.orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000,
      });
      const fetched = response.data.order;
      setOrder(fetched);
      // Cache for offline use
      await cacheOrder(fetched);
    } catch (err: any) {
      // Network error — try cache
      const cached = await getCachedOrder(params.orderId);
      if (cached) {
        setOrder(cached);
      } else {
        showModal({ title: 'Error', message: 'Failed to load order and no offline copy is available.', buttons: [{ text: 'OK' }] });
      }
    } finally {
      setLoading(false);
    }
  }, [params.orderId]);

  // ── Restore persisted verified packages (hard-close recovery) ─────────────
  useEffect(() => {
    if (!order?._id) return;
    loadVerified(order._id).then(saved => {
      verifiedRef.current = saved;
      setVerifiedPackages(new Set(saved));
    });
    refreshPendingCount();
  }, [order?._id]);

  // ── QR scanning ───────────────────────────────────────────────────────────
  const handleQRScanned = async ({ data }: any) => {
    if (!scanning || !order) return;
    setScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const packageExists = order.packages?.find((pkg: any) => pkg.qrCode === data);
    if (!packageExists) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showModal({
        title: 'Error',
        message: 'This package does not belong to this order.',
        buttons: [{ text: 'OK', onPress: () => setTimeout(() => setScanning(true), 500) }],
      });
      return;
    }

    if (verifiedRef.current.has(data)) {
      showModal({
        title: 'Already Verified',
        message: 'This package was already verified.',
        buttons: [{ text: 'OK', onPress: () => setTimeout(() => setScanning(true), 500) }],
      });
      return;
    }

    const newVerified = new Set(verifiedRef.current);
    newVerified.add(data);
    verifiedRef.current = newVerified;
    setVerifiedPackages(new Set(newVerified));

    // Persist immediately — survives hard-close
    await saveVerified(order._id, newVerified);

    const totalPackages = order.packages?.length || 0;

    if (newVerified.size === totalPackages) {
      showModal({
        title: 'All Packages Verified!',
        message: 'Ready to complete delivery.',
        buttons: [{ text: 'Complete Delivery', onPress: handleCompleteDelivery }],
      });
    } else {
      showModal({
        title: 'Package Verified ✓',
        message: `${newVerified.size} of ${totalPackages} packages verified.`,
        buttons: [{ text: 'Continue', onPress: () => setTimeout(() => setScanning(true), 500) }],
      });
    }
  };

  // ── Complete delivery (offline-safe) ───────────────────────────────────────
  const handleCompleteDelivery = async () => {
    const deliveredAt = new Date().toISOString();

    // Optimistically update UI
    setOrder((prev: any) => ({ ...prev, status: 'delivered' }));
    // Update cache so offline re-open shows correct status
    if (order) await cacheOrder({ ...order, status: 'delivered', deliveredAt });

    // Enqueue — will sync now if online, later if offline
    await enqueueAction('delivery_completed', order._id, {
      status: 'delivered',
      deliveredAt,
    });

    await refreshPendingCount();

    // Clear the persisted verified set — delivery is done
    await AsyncStorage.removeItem(VERIFIED_KEY(order._id));

    if (isOnline) {
      showModal({
        title: 'Delivery Complete!',
        message: 'Order has been marked as delivered.',
        buttons: [{ text: 'OK', onPress: () => navigation.navigate('Deliveries') }],
      });
    } else {
      showModal({
        title: 'Saved Offline ✓',
        message: 'Delivery marked as complete. It will sync automatically when you\'re back online.',
        buttons: [{ text: 'OK', onPress: () => navigation.navigate('Deliveries') }],
      });
    }
  };

  // ── Address helpers ────────────────────────────────────────────────────────
  const getAddress = (o: any): string => {
    if (o.shippingAddress?.address) {
      const addr = o.shippingAddress.address;
      if (typeof addr === 'string') return addr;
      if (typeof addr === 'object')
        return [addr.street, addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ') || 'Address not available';
    }
    if (o.deliveryAddress) {
      if (typeof o.deliveryAddress === 'string') return o.deliveryAddress;
      if (typeof o.deliveryAddress === 'object') {
        const a = o.deliveryAddress as any;
        return [a.street, a.city, a.province, a.postalCode].filter(Boolean).join(', ') || 'Address not available';
      }
    }
    return 'Address not available';
  };

  const handleNavigate = () => {
    if (!order?.shippingAddress) {
      showModal({ title: 'Error', message: 'No delivery address available.', buttons: [{ text: 'OK' }] });
      return;
    }
    const { lat, lng } = order.shippingAddress;
    const address = getAddress(order);
    const scheme  = Platform.select({ ios: 'maps://0,0?q=', android: 'geo:0,0?q=' });
    const label   = encodeURIComponent(address);
    const url     = Platform.select({
      ios:     `${scheme}${label}@${lat},${lng}`,
      android: `${scheme}${lat},${lng}(${label})`,
    });
    Linking.openURL(url!).catch(() =>
      showModal({ title: 'Error', message: 'Could not open maps app.', buttons: [{ text: 'OK' }] })
    );
  };

  const handleCall = () => {
    Linking.openURL(`tel:${order.customerInfo.phone.replace(/\s/g, '')}`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>Loading order...</Text>
    </View>
  );

  if (!order) return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>Order not found</Text>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const totalPackages = order.packages?.length || 0;
  const allVerified   = verifiedPackages.size === totalPackages && totalPackages > 0;
  const bottomPad     = Math.max(insets.bottom, 16);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: bottomPad + 16 }}
    >
      {/* ── Offline banner ─────────────────────────────────────────────────── */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={16} color="#92400e" />
          <Text style={styles.offlineBannerText}>
            You're offline — scans are saved locally and will sync when reconnected.
          </Text>
        </View>
      )}

      {/* ── Pending sync badge ────────────────────────────────────────────── */}
      {isOnline && pendingCount > 0 && (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color="#1d4ed8" />
          <Text style={styles.syncBannerText}>Syncing {pendingCount} pending action{pendingCount !== 1 ? 's' : ''}…</Text>
        </View>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#FF6B35" />
          <Text style={styles.headerBackButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Deliver Order</Text>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
      </View>

      <StatusStepper currentStatus={order.status} />

      {/* ── Delivery details ──────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Details</Text>
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Ionicons name="person" size={20} color="#666" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Customer</Text>
              <Text style={styles.detailValue}>{order.customerInfo?.name}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Phone size={20} color="#666" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Phone</Text>
              <TouchableOpacity onPress={handleCall}>
                <Text style={[styles.detailValue, styles.phoneLink]}>{order.customerInfo?.phone}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.detailRow}>
            <MapPin size={20} color="#666" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue}>{getAddress(order)}</Text>
            </View>
          </View>
          {order.deliveryNotes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Delivery Notes:</Text>
              <Text style={styles.notesText}>{order.deliveryNotes}</Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
        <Navigation size={24} color="#fff" />
        <Text style={styles.navigateButtonText}>Navigate with Google Maps</Text>
      </TouchableOpacity>

      {/* ── Package verification progress ─────────────────────────────────── */}
      <View style={styles.progressSection}>
        <Text style={styles.progressTitle}>Package Verification</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: totalPackages > 0 ? `${(verifiedPackages.size / totalPackages) * 100}%` : '0%' }]} />
        </View>
        <Text style={styles.progressText}>{verifiedPackages.size} / {totalPackages} packages verified</Text>
      </View>

      {/* ── Package list ──────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Packages to Deliver</Text>
        {order.packages?.map((pkg: any, index: number) => (
          <View
            key={index}
            style={[styles.packageCard, verifiedPackages.has(pkg.qrCode) && styles.packageCardVerified]}
          >
            <View style={styles.packageInfo}>
              <Text style={styles.packageNumber}>Package {pkg.packageNumber} of {pkg.totalPackages}</Text>
              <Text style={styles.packageQR}>QR: {pkg.qrCode}</Text>
            </View>
            {verifiedPackages.has(pkg.qrCode) && <CheckCircle size={32} color="#10B981" />}
          </View>
        ))}
      </View>

      {/* ── Scanner ───────────────────────────────────────────────────────── */}
      {scanning && (
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={handleQRScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerText}>Scan package QR code</Text>
            <TouchableOpacity style={styles.cancelScanButton} onPress={() => setScanning(false)}>
              <Text style={styles.cancelScanText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      {!scanning && !allVerified && totalPackages > 0 && (
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => { if (!permission?.granted) requestPermission(); else setScanning(true); }}
        >
          <Package size={24} color="#fff" />
          <Text style={styles.scanButtonText}>Verify Package ({verifiedPackages.size}/{totalPackages})</Text>
        </TouchableOpacity>
      )}

      {allVerified && (
        <TouchableOpacity style={styles.completeButton} onPress={handleCompleteDelivery}>
          <CheckCircle size={24} color="#fff" />
          <Text style={styles.completeButtonText}>
            {isOnline ? 'Complete Delivery' : 'Complete Delivery (Offline)'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f5' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorText:   { fontSize: 18, color: '#666', marginBottom: 20 },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef3c7', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#fde68a',
  },
  offlineBannerText: { flex: 1, fontSize: 13, color: '#92400e', fontWeight: '600' },

  syncBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#eff6ff', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#bfdbfe',
  },
  syncBannerText: { fontSize: 13, color: '#1d4ed8', fontWeight: '600' },

  header:               { backgroundColor: '#fff', padding: 24, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  headerBackButton:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  headerBackButtonText: { fontSize: 16, color: '#FF6B35', fontWeight: '600' },
  backButton:           { backgroundColor: '#FF6B35', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText:       { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerTitle:          { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  orderNumber:          { fontSize: 16, color: '#666' },

  section:       { backgroundColor: '#fff', padding: 16, marginTop: 12 },
  sectionTitle:  { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 12 },
  detailCard:    { gap: 16 },
  detailRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailContent: { flex: 1 },
  detailLabel:   { fontSize: 12, fontWeight: '600', color: '#999', marginBottom: 4 },
  detailValue:   { fontSize: 16, color: '#1a1a1a' },
  phoneLink:     { color: '#3B82F6', textDecorationLine: 'underline' },
  notesBox:      { backgroundColor: '#FFF9E6', padding: 12, borderRadius: 8, marginTop: 8 },
  notesLabel:    { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  notesText:     { fontSize: 14, color: '#666' },

  navigateButton:     { backgroundColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, margin: 16, borderRadius: 12, gap: 8 },
  navigateButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  progressSection: { backgroundColor: '#fff', padding: 16, marginTop: 12 },
  progressTitle:   { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  progressBar:     { height: 8, backgroundColor: '#e5e5e5', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill:    { height: '100%', backgroundColor: '#10B981' },
  progressText:    { fontSize: 14, color: '#666', textAlign: 'center' },

  packageCard:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderWidth: 2, borderColor: '#ddd', borderRadius: 12, marginBottom: 8 },
  packageCardVerified: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  packageInfo:         { flex: 1 },
  packageNumber:       { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  packageQR:           { fontSize: 14, color: '#666' },

  scannerContainer: { height: 400, backgroundColor: '#000', marginTop: 12, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  scannerOverlay:   { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scannerFrame:     { width: 250, height: 250, borderWidth: 3, borderColor: '#FF6B35', borderRadius: 12 },
  scannerText:      { marginTop: 20, color: '#fff', fontSize: 18, fontWeight: '600' },
  cancelScanButton: { marginTop: 30, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  cancelScanText:   { color: '#fff', fontSize: 16, fontWeight: '600' },

  scanButton:         { backgroundColor: '#FF6B35', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, margin: 16, borderRadius: 12, gap: 8 },
  scanButtonText:     { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  completeButton:     { backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, margin: 16, marginBottom: 0, borderRadius: 12, gap: 8 },
  completeButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
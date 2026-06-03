// src/screens/DeliveryCollectionScreen.tsx
// Offline-safe: scanned packages are written to AsyncStorage before hitting the
// network.  If offline, the PATCH is enqueued and flushed on reconnect.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Package, CheckCircle, ArrowLeft, Truck, WifiOff } from 'lucide-react-native';
import { useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import StatusStepper from '../components/StatusStepper';
import { useAppModal } from '../components/AppModal';
import { useAuthStore } from '../stores/authStore';
import { logHandlingEvent } from '../lib/handlingLog';
import {
  enqueueAction,
  cacheOrder,
  getCachedOrder,
  flushQueue,
} from '../services/offlineSync';

const API_URL = 'https://tfs-wholesalers-ifad.onrender.com';

// ─── Persist scanned packages per order (survives hard-close) ────────────────
const SCANNED_KEY = (orderId: string) => `scanned_packages:${orderId}`;

async function loadScanned(orderId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SCANNED_KEY(orderId));
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

async function saveScanned(orderId: string, set: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(SCANNED_KEY(orderId), JSON.stringify(Array.from(set)));
  } catch {
    // non-fatal
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeliveryCollectionScreen({ navigation: navProp }: any) {
  const navigation    = navProp as any;
  const route         = useRoute();
  const params        = route.params as { orderId: string; claiming?: boolean };
  const { showModal } = useAppModal();
  const { user }      = useAuthStore();
  const insets        = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning]         = useState(false);
  const [order, setOrder]               = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [assigning, setAssigning]       = useState(false);
  const [isOnline, setIsOnline]         = useState(true);
  const [scannedPackages, setScannedPackages] = useState<Set<string>>(new Set());

  const scannedRef = useRef<Set<string>>(new Set());

  // ── Network monitor ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const online = !!state.isConnected;
      setIsOnline(online);
      if (online) flushQueue().catch(() => {});
    });
    NetInfo.fetch().then(s => setIsOnline(!!s.isConnected));
    return () => unsub();
  }, []);

  // ── Fetch order ────────────────────────────────────────────────────────────
  useEffect(() => { fetchOrder(); }, [params.orderId]);

  const fetchOrder = useCallback(async () => {
    try {
      const token    = await AsyncStorage.getItem('auth_token');
      let fetched: any;

      try {
        const response = await axios.get(`${API_URL}/api/orders/${params.orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000,
        });
        fetched = response.data.order;
        await cacheOrder(fetched);
      } catch {
        // Network error — fall back to cache
        const cached = await getCachedOrder(params.orderId);
        if (!cached) {
          showModal({ title: 'Error', message: 'Failed to load order and no offline copy is available.', buttons: [{ text: 'OK' }] });
          setLoading(false);
          return;
        }
        fetched = cached;
      }

      // ── Claim driver (online only) ─────────────────────────────────────
      if (params.claiming && !fetched.assignedDriverId && token) {
        try {
          setAssigning(true);
          await axios.patch(
            `${API_URL}/api/orders/${params.orderId}`,
            { assignedDriverId: user?.id, assignedDriverName: user?.name },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          fetched.assignedDriverId   = user?.id;
          fetched.assignedDriverName = user?.name;
        } catch {
          // Non-fatal — we'll retry when back online
        } finally {
          setAssigning(false);
        }
      }

      // ── Move to 'collecting' (online only) ────────────────────────────
      if (fetched.status !== 'collecting' && token) {
        try {
          await axios.patch(
            `${API_URL}/api/orders/${params.orderId}`,
            { status: 'collecting', collectingStartedAt: new Date().toISOString() },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          fetched.status = 'collecting';
          await cacheOrder(fetched);
        } catch {
          // Non-fatal offline; update cache locally
          fetched.status = 'collecting';
          await cacheOrder(fetched);
        }
      }

      setOrder(fetched);

      // Restore server-side collected packages
      if (fetched.collectedPackages?.length) {
        const serverSet = new Set<string>(fetched.collectedPackages as string[]);
        // Merge with anything saved locally (driver might have scanned offline)
        const localSet  = await loadScanned(params.orderId);
        const merged    = new Set<string>([...serverSet, ...localSet]);
        scannedRef.current = merged;
        setScannedPackages(new Set(merged));
        await saveScanned(params.orderId, merged);
      } else {
        // Just restore local saves
        const localSet = await loadScanned(params.orderId);
        scannedRef.current = localSet;
        setScannedPackages(new Set(localSet));
      }
    } catch (error: any) {
      console.error('fetchOrder failed:', error.message);
    } finally {
      setLoading(false);
    }
  }, [params.orderId, params.claiming, user?.id]);

  // ── QR scan handler ────────────────────────────────────────────────────────
  const handleQRScanned = async ({ data }: any) => {
    if (!scanning || !order) return;
    setScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const packageExists = order.packages?.find((pkg: any) => pkg.qrCode === data);
    if (!packageExists) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showModal({
        title: 'Wrong Package',
        message: 'This package belongs to a different order.',
        buttons: [{ text: 'OK', onPress: () => setTimeout(() => setScanning(true), 500) }],
      });
      return;
    }

    if (scannedRef.current.has(data)) {
      showModal({
        title: 'Already Scanned',
        message: 'This package was already collected.',
        buttons: [{ text: 'OK', onPress: () => setTimeout(() => setScanning(true), 500) }],
      });
      return;
    }

    const newScanned = new Set(scannedRef.current);
    newScanned.add(data);
    scannedRef.current = newScanned;
    setScannedPackages(new Set(newScanned));

    // ── Persist locally first (hard-close safe) ────────────────────────────
    await saveScanned(order._id, newScanned);
    // ── Update cache too so the order object reflects progress ────────────
    await cacheOrder({ ...order, collectedPackages: Array.from(newScanned) });

    const totalPackages = order.packages?.length || 0;
    const token         = await AsyncStorage.getItem('auth_token');

    // ── Enqueue the sync action (flushes immediately if online) ───────────
    await enqueueAction('package_collected', order._id, {
      collectedPackages: Array.from(newScanned),
    });

    // Accountability log (best-effort, requires network)
    if (token) {
      logHandlingEvent(params.orderId, {
        eventType:  'package_collected',
        packageQr:  data,
        packageNum: packageExists.packageNumber,
      }, token);
    }

    if (newScanned.size === totalPackages) {
      if (token) {
        logHandlingEvent(params.orderId, {
          eventType: 'delivery_started',
          meta:      { totalPackages, allCollected: true },
        }, token);
      }

      showModal({
        title: 'All Packages Collected!',
        message: `Order ${order.orderNumber} is ready. Pool more orders or start your run.`,
        buttons: [
          { text: 'Collect More Orders', onPress: () => navigation.goBack() },
          { text: 'Start Delivery Now', style: 'cancel', onPress: handleStartDelivery },
        ],
      });
    } else {
      showModal({
        title: `Package Collected ✓${!isOnline ? ' (Offline)' : ''}`,
        message: `${newScanned.size} of ${totalPackages} packages collected.${!isOnline ? '\nSaved locally — will sync on reconnect.' : ''}`,
        buttons: [{ text: 'Continue', onPress: () => setTimeout(() => setScanning(true), 500) }],
      });
    }
  };

  // ── Start delivery ─────────────────────────────────────────────────────────
  const handleStartDelivery = async () => {
    const deliveryStartedAt = new Date().toISOString();

    // Update local cache
    await cacheOrder({ ...order, status: 'out_for_delivery', deliveryStartedAt });

    // Enqueue (syncs immediately if online)
    await enqueueAction('delivery_started', order._id, {
      status: 'out_for_delivery',
      deliveryStartedAt,
    });

    setOrder((prev: any) => ({ ...prev, status: 'out_for_delivery' }));
    navigation.navigate('DeliveryDetail', { orderId: order._id });
  };

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading || assigning) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>{assigning ? 'Claiming delivery…' : 'Loading order…'}</Text>
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

  const totalPackages      = order.packages?.length || 0;
  const collectionComplete = scannedPackages.size === totalPackages && totalPackages > 0;
  const bottomPad          = Math.max(insets.bottom, 16);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: bottomPad + 16 }}
    >
      {/* Offline banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={16} color="#92400e" />
          <Text style={styles.offlineBannerText}>
            You're offline — scans are saved locally and will sync when reconnected.
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#FF6B35" />
          <Text style={styles.headerBackButtonText}>Back to List</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Collect Packages</Text>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        {params.claiming && (
          <View style={styles.claimedBadge}>
            <Text style={styles.claimedBadgeText}>✓ Delivery claimed</Text>
          </View>
        )}
      </View>

      <StatusStepper currentStatus={order.status} />

      {/* Progress */}
      <View style={styles.progressSection}>
        <Text style={styles.progressTitle}>Collection Progress</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: totalPackages > 0 ? `${(scannedPackages.size / totalPackages) * 100}%` : '0%' },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {scannedPackages.size} / {totalPackages} packages collected
        </Text>
      </View>

      {/* Package list */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Packages</Text>
        {totalPackages === 0 && (
          <Text style={styles.noPackagesText}>No packages yet — packaging may still be in progress.</Text>
        )}
        {order.packages?.map((pkg: any, index: number) => (
          <View
            key={index}
            style={[styles.packageCard, scannedPackages.has(pkg.qrCode) && styles.packageCardScanned]}
          >
            <View style={styles.packageInfo}>
              <Text style={styles.packageNumber}>Package {pkg.packageNumber} of {pkg.totalPackages}</Text>
              <Text style={styles.packageQR}>QR: {pkg.qrCode}</Text>
              <Text style={styles.packageItems}>{pkg.items?.length || 0} items</Text>
            </View>
            {scannedPackages.has(pkg.qrCode) && <CheckCircle size={32} color="#10B981" />}
          </View>
        ))}
      </View>

      {/* Camera */}
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

      {/* Actions */}
      <View style={styles.actions}>
        {!collectionComplete && !scanning && totalPackages > 0 && (
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => { if (!permission?.granted) requestPermission(); else setScanning(true); }}
          >
            <Package size={24} color="#fff" />
            <Text style={styles.scanButtonText}>
              Scan Package ({scannedPackages.size}/{totalPackages})
              {!isOnline ? ' 📴' : ''}
            </Text>
          </TouchableOpacity>
        )}

        {collectionComplete && (
          <>
            <TouchableOpacity style={styles.collectMoreButton} onPress={() => navigation.goBack()}>
              <Package size={24} color="#FF6B35" />
              <Text style={styles.collectMoreButtonText}>Collect More Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deliveryButton} onPress={handleStartDelivery}>
              <Truck size={24} color="#fff" />
              <Text style={styles.deliveryButtonText}>Start Delivery Now</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Customer info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer Details</Text>
        <View style={styles.customerCard}>
          <Text style={styles.customerName}>{order.customerInfo?.name}</Text>
          <Text style={styles.customerPhone}>{order.customerInfo?.phone}</Text>
          <Text style={styles.customerTotal}>Total: R{order.total?.toFixed(2)}</Text>
        </View>
      </View>
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

  header:               { backgroundColor: '#fff', padding: 24, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  headerBackButton:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  headerBackButtonText: { fontSize: 16, color: '#FF6B35', fontWeight: '600' },
  backButton:           { backgroundColor: '#FF6B35', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText:       { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerTitle:          { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  orderNumber:          { fontSize: 16, color: '#666' },

  claimedBadge:     { marginTop: 10, backgroundColor: '#d1fae5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  claimedBadgeText: { fontSize: 13, fontWeight: '700', color: '#065f46' },

  progressSection: { backgroundColor: '#fff', padding: 16, marginTop: 12 },
  progressTitle:   { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  progressBar:     { height: 8, backgroundColor: '#e5e5e5', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill:    { height: '100%', backgroundColor: '#F59E0B' },
  progressText:    { fontSize: 14, color: '#666', textAlign: 'center' },

  section:        { backgroundColor: '#fff', padding: 16, marginTop: 12 },
  sectionTitle:   { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 12 },
  noPackagesText: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic' },

  packageCard:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderWidth: 2, borderColor: '#ddd', borderRadius: 12, marginBottom: 8 },
  packageCardScanned: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  packageInfo:        { flex: 1 },
  packageNumber:      { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  packageQR:          { fontSize: 12, color: '#666', marginBottom: 2 },
  packageItems:       { fontSize: 12, color: '#999' },

  scannerContainer: { height: 400, backgroundColor: '#000', marginTop: 12, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  scannerOverlay:   { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scannerFrame:     { width: 250, height: 250, borderWidth: 3, borderColor: '#FF6B35', borderRadius: 12 },
  scannerText:      { marginTop: 20, color: '#fff', fontSize: 18, fontWeight: '600' },
  cancelScanButton: { marginTop: 30, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  cancelScanText:   { color: '#fff', fontSize: 16, fontWeight: '600' },

  actions:               { padding: 16, gap: 12 },
  scanButton:            { backgroundColor: '#F59E0B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 8 },
  scanButtonText:        { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  collectMoreButton:     { backgroundColor: '#fff', borderWidth: 2, borderColor: '#FF6B35', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 8 },
  collectMoreButtonText: { color: '#FF6B35', fontSize: 18, fontWeight: 'bold' },
  deliveryButton:        { backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 8 },
  deliveryButtonText:    { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  customerCard:  { backgroundColor: '#f8f8f8', padding: 16, borderRadius: 12 },
  customerName:  { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  customerPhone: { fontSize: 14, color: '#666', marginBottom: 8 },
  customerTotal: { fontSize: 16, fontWeight: 'bold', color: '#FF6B35' },
});
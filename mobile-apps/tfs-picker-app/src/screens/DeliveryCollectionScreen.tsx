import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Package, CheckCircle, ArrowLeft, Truck } from 'lucide-react-native';
import { useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import StatusStepper from '../components/StatusStepper';

const API_URL = 'https://tfs-wholesalers.onrender.com';

export default function DeliveryCollectionScreen({ navigation: navProp }: any) {
  // Cast to avoid generic useNavigation() `never` typing
  const navigation = navProp as any;

  const route = useRoute();
  const params = route.params as { orderId: string };

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scannedPackages, setScannedPackages] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchOrder();
  }, [params.orderId]);

  // ── fetch & ensure status === 'collecting' ──────────────────────────────
  const fetchOrder = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await axios.get(`${API_URL}/api/orders/${params.orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const fetched = response.data.order;

      // Safety-net: if packaging already set this we skip; otherwise do it now
      if (fetched.status !== 'collecting') {
        await axios.patch(
          `${API_URL}/api/orders/${params.orderId}`,
          { status: 'collecting', collectingStartedAt: new Date().toISOString() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        fetched.status = 'collecting';
      }

      setOrder(fetched);

      // Restore already-collected packages from the server
      if (fetched.collectedPackages) {
        setScannedPackages(new Set(fetched.collectedPackages));
      }
    } catch (error: any) {
      console.error('Failed to fetch order:', error.response?.data || error.message);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  // ── QR scan ──────────────────────────────────────────────────────────────
  const handleQRScanned = async ({ data }: any) => {
    if (!scanning || !order) return;

    setScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Validate QR belongs to this order
    const packageExists = order.packages?.find((pkg: any) => pkg.qrCode === data);
    if (!packageExists) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Wrong Order', 'This package belongs to a different order');
      setTimeout(() => setScanning(true), 2000);
      return;
    }

    if (scannedPackages.has(data)) {
      Alert.alert('Already Scanned', 'This package was already collected');
      setTimeout(() => setScanning(true), 2000);
      return;
    }

    // Optimistic local update
    const newScanned = new Set(scannedPackages);
    newScanned.add(data);
    setScannedPackages(newScanned);

    // Persist to backend
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.patch(
        `${API_URL}/api/orders/${order._id}`,
        { collectedPackages: Array.from(newScanned) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const totalPackages = order.packages?.length || 0;

      if (newScanned.size === totalPackages) {
        Alert.alert(
          'All Packages Collected!',
          `Order ${order.orderNumber} is ready for delivery`,
          [
            { text: 'Start Delivery Now', onPress: () => handleStartDelivery() },
            { text: 'Collect More Orders', onPress: () => navigation.goBack(), style: 'cancel' },
          ]
        );
      } else {
        Alert.alert(
          'Package Collected',
          `${newScanned.size} of ${totalPackages} packages collected`,
          [{ text: 'Continue', onPress: () => setTimeout(() => setScanning(true), 500) }]
        );
      }
    } catch (error) {
      console.error('Failed to update order:', error);
      Alert.alert('Error', 'Failed to save collection progress');
      // Revert optimistic update
      setScannedPackages(new Set(Array.from(scannedPackages)));
    }
  };

  // ── start delivery → status becomes 'out_for_delivery' ──────────────────
  const handleStartDelivery = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.patch(
        `${API_URL}/api/orders/${order._id}`,
        {
          status: 'out_for_delivery',
          deliveryStartedAt: new Date().toISOString(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local order so if user goes back the stepper is correct
      setOrder((prev: any) => ({ ...prev, status: 'out_for_delivery' }));

      navigation.navigate('DeliveryDetail', { orderId: order._id });
    } catch (error) {
      console.error('Failed to start delivery:', error);
      Alert.alert('Error', 'Failed to start delivery');
    }
  };

  // ── loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading order...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Order not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalPackages = order.packages?.length || 0;
  const collectionComplete = scannedPackages.size === totalPackages;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#FF6B35" />
          <Text style={styles.headerBackButtonText}>Back to List</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Collect Packages</Text>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
      </View>

      {/* ─── STATUS STEPPER ─── */}
      <StatusStepper currentStatus={order.status} />

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <Text style={styles.progressTitle}>Collection Progress</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(scannedPackages.size / totalPackages) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {scannedPackages.size} / {totalPackages} packages collected
        </Text>
      </View>

      {/* Package List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Packages</Text>
        {order.packages?.map((pkg: any, index: number) => (
          <View
            key={index}
            style={[styles.packageCard, scannedPackages.has(pkg.qrCode) && styles.packageCardScanned]}
          >
            <View style={styles.packageInfo}>
              <Text style={styles.packageNumber}>
                Package {pkg.packageNumber} of {pkg.totalPackages}
              </Text>
              <Text style={styles.packageQR}>QR: {pkg.qrCode}</Text>
              <Text style={styles.packageItems}>{pkg.items?.length || 0} items</Text>
            </View>
            {scannedPackages.has(pkg.qrCode) && <CheckCircle size={32} color="#10B981" />}
          </View>
        ))}
      </View>

      {/* Live scanner overlay */}
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

      {/* Action buttons */}
      <View style={styles.actions}>
        {!collectionComplete && !scanning && (
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => {
              if (!permission?.granted) requestPermission();
              else setScanning(true);
            }}
          >
            <Package size={24} color="#fff" />
            <Text style={styles.scanButtonText}>
              Scan Package ({scannedPackages.size}/{totalPackages})
            </Text>
          </TouchableOpacity>
        )}

        {collectionComplete && (
          <>
            <TouchableOpacity style={styles.deliveryButton} onPress={handleStartDelivery}>
              <Truck size={24} color="#fff" />
              <Text style={styles.deliveryButtonText}>Start Delivery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.continueButton} onPress={() => navigation.goBack()}>
              <Package size={24} color="#FF6B35" />
              <Text style={styles.continueButtonText}>Collect More Orders</Text>
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
          <Text style={styles.customerTotal}>Total: R{order.total.toFixed(2)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorText: { fontSize: 18, color: '#666', marginBottom: 20 },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerBackButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  headerBackButtonText: { fontSize: 16, color: '#FF6B35', fontWeight: '600' },
  backButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  orderNumber: { fontSize: 16, color: '#666' },
  progressSection: { backgroundColor: '#fff', padding: 16, marginTop: 12 },
  progressTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e5e5',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: '100%', backgroundColor: '#F59E0B' },
  progressText: { fontSize: 14, color: '#666', textAlign: 'center' },
  section: { backgroundColor: '#fff', padding: 16, marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 12 },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    marginBottom: 8,
  },
  packageCardScanned: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  packageInfo: { flex: 1 },
  packageNumber: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  packageQR: { fontSize: 12, color: '#666', marginBottom: 2 },
  packageItems: { fontSize: 12, color: '#999' },
  scannerContainer: {
    height: 400,
    backgroundColor: '#000',
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: { width: 250, height: 250, borderWidth: 3, borderColor: '#FF6B35', borderRadius: 12 },
  scannerText: { marginTop: 20, color: '#fff', fontSize: 18, fontWeight: '600' },
  cancelScanButton: {
    marginTop: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelScanText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  actions: { padding: 16, gap: 12 },
  scanButton: {
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  scanButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  deliveryButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  deliveryButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  continueButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonText: { color: '#FF6B35', fontSize: 18, fontWeight: 'bold' },
  customerCard: { backgroundColor: '#f8f8f8', padding: 16, borderRadius: 12 },
  customerName: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  customerPhone: { fontSize: 14, color: '#666', marginBottom: 8 },
  customerTotal: { fontSize: 16, fontWeight: 'bold', color: '#FF6B35' },
});
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Package, QrCode, CheckCircle } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useOrdersStore } from '../stores/ordersStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import StatusStepper from '../components/StatusStepper';

const API_URL = 'https://tfs-wholesalers.onrender.com';

export default function PackagingScreen({ navigation: navProp }: any) {
  // Cast nav prop to avoid the generic useNavigation() `never` issue
  const navigation = navProp as any;

  const route = useRoute();
  const params = route.params as { orderId?: string; orderNumber?: string } | undefined;
  const orderId = params?.orderId;

  const { completeOrder } = useOrdersStore();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [totalPackages, setTotalPackages] = useState('1');
  const [packages, setPackages] = useState<any[]>([]);
  const [currentPackageItems, setCurrentPackageItems] = useState<string[]>([]);

  // ── fetch order & ensure status is 'packaging' ──────────────────────────
  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        const token = await AsyncStorage.getItem('auth_token');
        const response = await axios.get(`${API_URL}/api/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const fetched = response.data.order;

        // If the upstream screen already moved us to 'packaging' great;
        // otherwise do it now (safety net).
        if (fetched.status !== 'packaging') {
          await axios.patch(
            `${API_URL}/api/orders/${orderId}`,
            { status: 'packaging', packagingStartedAt: new Date().toISOString() },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          fetched.status = 'packaging';
        }

        setOrder(fetched);
      } catch (error: any) {
        console.error('Failed to fetch order:', error.response?.data || error.message);
        Alert.alert('Error', 'Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  // ── QR scan handler ──────────────────────────────────────────────────────
  const handleQRScanned = async ({ data }: any) => {
    if (!scanning) return;
    setScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const packageNum = packages.length + 1;
    const total = parseInt(totalPackages);

    // Build the new package object exactly as the server expects
    const newPackage = {
      qrCode: data,
      packageNumber: packageNum,
      totalPackages: total,
      items: currentPackageItems, // string[] of productId values
    };

    // Merge with packages already persisted on the server-side order
    const existingPackages = order.packages || [];
    const updatedPackages = [...existingPackages, newPackage];

    // ── log everything BEFORE the request so we can see what goes out ──
    console.log('📦 ── createPackage payload ──────────────────');
    console.log('   orderId         :', orderId);
    console.log('   URL             :', `${API_URL}/api/orders/${orderId}`);
    console.log('   newPackage      :', JSON.stringify(newPackage, null, 2));
    console.log('   full packages[] :', JSON.stringify(updatedPackages, null, 2));
    console.log('─────────────────────────────────────────────');

    try {
      const token = await AsyncStorage.getItem('auth_token');

      const response = await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        { packages: updatedPackages },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('✅ createPackage success:', JSON.stringify(response.data, null, 2));

      // Update local order so the next scan includes this package
      setOrder((prev: any) => ({ ...prev, packages: updatedPackages }));

      setPackages([...packages, newPackage]);
      setCurrentPackageItems([]);

      Alert.alert('Success', `Package ${packageNum} of ${total} created successfully!`);

      // Last package → finish the packaging stage
      if (packageNum === total) {
        handleCompleteOrder();
      }
    } catch (error: any) {
      // ── log the FULL server response (the real 400 message lives here) ──
      console.error('❌ createPackage FAILED');
      console.error('   status        :', error.response?.status);
      console.error('   response.data :', JSON.stringify(error.response?.data, null, 2));
      console.error('   message       :', error.message);
      console.error('   config.data   :', error.config?.data); // echoes what we sent

      const serverMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Failed to create package';

      Alert.alert('Error', serverMessage);
    }
  };

  // ── mark packaging done & move status → collecting ──────────────────────
  const handleCompleteOrder = async () => {
    try {
      // Transition status to 'collecting' so the driver can pick up
      const token = await AsyncStorage.getItem('auth_token');
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        { status: 'collecting', packagingCompletedAt: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Also call the store helper if it does extra bookkeeping
      await completeOrder(orderId!);

      Alert.alert('Order Packaged!', 'Order is now ready for collection', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Main', { screen: 'Orders' }),
        },
      ]);
    } catch (error) {
      console.error('Complete order error:', error);
      Alert.alert('Error', 'Failed to complete packaging');
    }
  };

  // ── item toggle ──────────────────────────────────────────────────────────
  const toggleItemForPackage = (itemId: string) => {
    setCurrentPackageItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // ── loading / error guards ───────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading order...</Text>
      </View>
    );
  }

  if (!orderId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No order ID provided</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Order not found</Text>
        <Text style={styles.errorSubtext}>Order ID: {orderId}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allPackagesCreated = packages.length === parseInt(totalPackages);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Package Order</Text>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
      </View>

      {/* ─── STATUS STEPPER ─── */}
      <StatusStepper currentStatus={order.status} />

      {/* Total Packages Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Total Number of Packages</Text>
        <TextInput
          style={styles.input}
          value={totalPackages}
          onChangeText={setTotalPackages}
          keyboardType="number-pad"
          editable={packages.length === 0}
        />
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <Text style={styles.progressText}>
          Packages Created: {packages.length} / {totalPackages}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(packages.length / parseInt(totalPackages)) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Current Package */}
      {!allPackagesCreated && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Package {packages.length + 1} of {totalPackages}
          </Text>

          {/* Item Selection */}
          <Text style={styles.label}>Select items for this package:</Text>
          {order.items.map((item: any, index: number) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.itemCheckbox,
                currentPackageItems.includes(item.productId) && styles.itemCheckboxSelected,
              ]}
              onPress={() => toggleItemForPackage(item.productId)}
            >
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
              </View>
              {currentPackageItems.includes(item.productId) && (
                <CheckCircle size={24} color="#10B981" />
              )}
            </TouchableOpacity>
          ))}

          {/* QR Scanner or Scan Button */}
          {scanning ? (
            <View style={styles.scannerContainer}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={handleQRScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFrame} />
                <Text style={styles.scannerText}>Scan package QR code</Text>
                <TouchableOpacity
                  style={styles.cancelScanButton}
                  onPress={() => setScanning(false)}
                >
                  <Text style={styles.cancelScanText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.scanButton, currentPackageItems.length === 0 && styles.scanButtonDisabled]}
              onPress={() => {
                if (!permission?.granted) requestPermission();
                else setScanning(true);
              }}
              disabled={currentPackageItems.length === 0}
            >
              <QrCode size={24} color="#fff" />
              <Text style={styles.scanButtonText}>
                Scan QR Code for Package {packages.length + 1}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Created Packages */}
      {packages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Created Packages</Text>
          {packages.map((pkg, index) => (
            <View key={index} style={styles.packageCard}>
              <View style={styles.packageHeader}>
                <Package size={24} color="#10B981" />
                <Text style={styles.packageTitle}>
                  Package {pkg.packageNumber} of {pkg.totalPackages}
                </Text>
                <CheckCircle size={24} color="#10B981" />
              </View>
              <Text style={styles.packageQR}>QR: {pkg.qrCode}</Text>
              <Text style={styles.packageItems}>{pkg.items.length} items</Text>
            </View>
          ))}
        </View>
      )}

      {/* Complete Button (shown when all packages created) */}
      {allPackagesCreated && (
        <TouchableOpacity style={styles.completeButton} onPress={handleCompleteOrder}>
          <CheckCircle size={24} color="#fff" />
          <Text style={styles.completeButtonText}>Complete Packaging</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorText: { fontSize: 18, fontWeight: 'bold', color: '#666', marginBottom: 8 },
  errorSubtext: { fontSize: 14, color: '#999', marginBottom: 20 },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: { marginTop: 12 },
  backButtonText: { fontSize: 16, color: '#FF6B35', fontWeight: '600', marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  orderNumber: { fontSize: 16, color: '#666' },
  section: { backgroundColor: '#fff', padding: 16, marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  progressSection: { backgroundColor: '#fff', padding: 16, marginTop: 12 },
  progressText: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: '#e5e5e5', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10B981' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  itemCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 8,
  },
  itemCheckboxSelected: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  itemQuantity: { fontSize: 14, color: '#666', marginTop: 4 },
  scannerContainer: {
    height: 300,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: { width: 200, height: 200, borderWidth: 3, borderColor: '#FF6B35', borderRadius: 12 },
  scannerText: { marginTop: 16, color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelScanButton: {
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelScanText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  scanButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  scanButtonDisabled: { opacity: 0.5 },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  packageCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  packageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  packageTitle: { flex: 1, fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
  packageQR: { fontSize: 14, color: '#666', marginBottom: 4 },
  packageItems: { fontSize: 14, fontWeight: '600', color: '#333' },
  completeButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
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
import { Package, QrCode, CheckCircle, Gift, Tag } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useOrdersStore } from '../stores/ordersStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import StatusStepper from '../components/StatusStepper';

const API_URL = 'https://tfs-wholesalers.onrender.com';

interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  variantName?: string;
  appliedSpecialId?: string;
  isBonusItem?: boolean;
  specialType?: string;
  specialConditions?: any;
  isComboItem?: boolean;
  comboId?: string;
  comboName?: string;
  comboItems?: Array<{
    productId: string;
    productName: string;
    quantity: number;
  }>;
}

export default function PackagingScreen({ navigation: navProp }: any) {
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

  // ── Helper to get item badge ────────────────────────────────────────────
  const getItemBadge = (item: OrderItem) => {
    if (item.isComboItem) {
      return 'COMBO';
    }
    if (item.isBonusItem) {
      return 'FREE';
    }
    if (!item.specialType) return null;

    switch (item.specialType) {
      case 'percentage_off':
        return `${item.specialConditions?.discountPercentage}% OFF`;
      case 'amount_off':
        return `R${item.specialConditions?.discountAmount} OFF`;
      case 'multibuy':
        return 'MULTIBUY';
      case 'buy_x_get_y':
        return 'PROMO';
      default:
        return 'SPECIAL';
    }
  };

  // ── Helper to get item description ──────────────────────────────────────
  const getItemDescription = (item: OrderItem) => {
    if (item.isComboItem && item.comboName) {
      return `Part of ${item.comboName}`;
    }
    if (item.isBonusItem) {
      return 'Bonus item from promotion';
    }
    if (!item.specialType) return null;

    switch (item.specialType) {
      case 'buy_x_get_y':
        const discount = item.specialConditions?.getDiscount || 100;
        if (discount === 100) {
          return `Buy ${item.specialConditions?.buyQuantity}, get ${item.specialConditions?.getQuantity} FREE!`;
        }
        return `Buy ${item.specialConditions?.buyQuantity}, get ${item.specialConditions?.getQuantity} at ${discount}% off`;
      case 'multibuy':
        return `${item.specialConditions?.requiredQuantity} for R${item.specialConditions?.specialPrice}`;
      case 'percentage_off':
        return `${item.specialConditions?.discountPercentage}% discount applied`;
      case 'amount_off':
        return `R${item.specialConditions?.discountAmount} discount applied`;
      default:
        return 'Special offer applied';
    }
  };

  // ── QR scan handler ──────────────────────────────────────────────────────
  const handleQRScanned = async ({ data }: any) => {
    if (!scanning) return;
    setScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const packageNum = packages.length + 1;
    const total = parseInt(totalPackages);

    const newPackage = {
      qrCode: data,
      packageNumber: packageNum,
      totalPackages: total,
      items: currentPackageItems,
    };

    const existingPackages = order.packages || [];
    const updatedPackages = [...existingPackages, newPackage];

    console.log('📦 ── createPackage payload ──────────────────');
    console.log('   orderId         :', orderId);
    console.log('   newPackage      :', JSON.stringify(newPackage, null, 2));
    console.log('─────────────────────────────────────────────');

    try {
      const token = await AsyncStorage.getItem('auth_token');

      const response = await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        { packages: updatedPackages },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('✅ createPackage success');

      setOrder((prev: any) => ({ ...prev, packages: updatedPackages }));

      setPackages([...packages, newPackage]);
      setCurrentPackageItems([]);

      Alert.alert('Success', `Package ${packageNum} of ${total} created successfully!`);

      if (packageNum === total) {
        handleCompleteOrder();
      }
    } catch (error: any) {
      console.error('❌ createPackage FAILED');
      console.error('   response.data :', JSON.stringify(error.response?.data, null, 2));

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
      const token = await AsyncStorage.getItem('auth_token');
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        { status: 'collecting', packagingCompletedAt: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

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
  const hasComboItems = order.items.some((item: OrderItem) => item.isComboItem);
  const hasSpecialItems = order.items.some(
    (item: OrderItem) => item.isBonusItem || item.specialType
  );

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

      {/* STATUS STEPPER */}
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
          {order.items.map((item: OrderItem, index: number) => {
            const itemBadge = getItemBadge(item);
            const itemDesc = getItemDescription(item);
            const isSelected = currentPackageItems.includes(item.productId);

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.itemCheckbox,
                  isSelected && styles.itemCheckboxSelected,
                  item.isComboItem && styles.itemCheckboxCombo,
                  item.isBonusItem && styles.itemCheckboxBonus,
                  item.specialType && !item.isBonusItem && !item.isComboItem && styles.itemCheckboxSpecial,
                ]}
                onPress={() => toggleItemForPackage(item.productId)}
              >
                <View style={styles.itemInfo}>
                  <View style={styles.itemNameRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.variantName && (
                      <Text style={styles.variantName}> - {item.variantName}</Text>
                    )}
                  </View>

                  {/* Badge */}
                  {itemBadge && (
                    <View
                      style={[
                        styles.specialBadge,
                        item.isComboItem
                          ? styles.specialBadgeCombo
                          : item.isBonusItem
                          ? styles.specialBadgeFree
                          : styles.specialBadgePromo,
                      ]}
                    >
                      {item.isComboItem ? (
                        <Package size={12} color="#9333EA" />
                      ) : item.isBonusItem ? (
                        <Gift size={12} color="#10B981" />
                      ) : (
                        <Tag size={12} color="#FF6B35" />
                      )}
                      <Text
                        style={[
                          styles.specialBadgeText,
                          item.isComboItem
                            ? styles.specialBadgeTextCombo
                            : item.isBonusItem
                            ? styles.specialBadgeTextFree
                            : styles.specialBadgeTextPromo,
                        ]}
                      >
                        {itemBadge}
                      </Text>
                    </View>
                  )}

                  {/* Description */}
                  {itemDesc && <Text style={styles.specialDesc}>{itemDesc}</Text>}

                  {/* Combo Items Breakdown */}
                  {item.isComboItem && item.comboItems && item.comboItems.length > 0 && (
                    <View style={styles.comboItemsBox}>
                      <Text style={styles.comboItemsTitle}>Includes:</Text>
                      {item.comboItems.map((comboItem, idx) => (
                        <Text key={idx} style={styles.comboItemText}>
                          • {comboItem.quantity}× {comboItem.productName}
                        </Text>
                      ))}
                    </View>
                  )}

                  <View style={styles.itemBottomRow}>
                    <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                    {item.sku && <Text style={styles.itemSku}>SKU: {item.sku}</Text>}
                  </View>
                </View>

                {isSelected && <CheckCircle size={24} color="#10B981" />}
              </TouchableOpacity>
            );
          })}

          {/* Important Notice for Special/Combo Items */}
          {(hasComboItems || hasSpecialItems) && (
            <View style={styles.noticeBox}>
              <Package size={20} color="#9333EA" />
              <View style={styles.noticeContent}>
                <Text style={styles.noticeTitle}>
                  {hasComboItems && hasSpecialItems
                    ? 'Combo & Promotional Items'
                    : hasComboItems
                    ? 'Combo Items Notice'
                    : 'Promotional Items Notice'}
                </Text>
                <Text style={styles.noticeText}>
                  {hasComboItems && hasSpecialItems
                    ? 'This order contains combo deals and promotional items. Ensure ALL items are scanned and packaged.'
                    : hasComboItems
                    ? 'This order contains combo deals. Each combo includes multiple items - ensure all items are packaged.'
                    : 'This order contains promotional items. Ensure ALL items (including free/bonus items) are scanned and packaged.'}
                </Text>
              </View>
            </View>
          )}

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
              style={[
                styles.scanButton,
                currentPackageItems.length === 0 && styles.scanButtonDisabled,
              ]}
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
              <Text style={styles.packageItems}>{pkg.items.length} items packaged</Text>
            </View>
          ))}
        </View>
      )}

      {/* Complete Button */}
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
  itemCheckboxCombo: { borderColor: '#9333EA', backgroundColor: '#FAF5FF' },
  itemCheckboxBonus: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  itemCheckboxSpecial: { borderColor: '#FF6B35', backgroundColor: '#FFF7ED' },
  itemInfo: { flex: 1 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  variantName: { fontSize: 14, color: '#666', fontStyle: 'italic' },
  specialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginVertical: 4,
    gap: 4,
  },
  specialBadgeCombo: { backgroundColor: '#E9D5FF' },
  specialBadgeFree: { backgroundColor: '#D1FAE5' },
  specialBadgePromo: { backgroundColor: '#FED7AA' },
  specialBadgeText: { fontSize: 11, fontWeight: 'bold' },
  specialBadgeTextCombo: { color: '#7E22CE' },
  specialBadgeTextFree: { color: '#059669' },
  specialBadgeTextPromo: { color: '#EA580C' },
  specialDesc: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 2, marginBottom: 4 },
  comboItemsBox: {
    backgroundColor: '#F5F3FF',
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  comboItemsTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#7E22CE',
    marginBottom: 4,
  },
  comboItemText: {
    fontSize: 11,
    color: '#6B21A8',
    marginBottom: 2,
  },
  itemBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  itemQuantity: { fontSize: 14, color: '#666' },
  itemSku: { fontSize: 12, color: '#999' },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FAF5FF',
    borderWidth: 2,
    borderColor: '#9333EA',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
    gap: 12,
  },
  noticeContent: { flex: 1 },
  noticeTitle: { fontSize: 14, fontWeight: 'bold', color: '#7E22CE', marginBottom: 4 },
  noticeText: { fontSize: 13, color: '#6B21A8', lineHeight: 18 },
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
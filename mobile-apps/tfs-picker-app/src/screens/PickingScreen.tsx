import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import BarcodeScanner from '../components/BarcodeScanner';
import { useNavigation, useRoute } from '@react-navigation/native';
import StatusStepper from '../components/StatusStepper'; // shared stepper

const API_URL = 'https://tfs-wholesalers.onrender.com';

// ─── Interfaces ─────────────────────────────────────────────────────────────
interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  barcode?: string;
  image?: string;
  description?: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
  status: string;
  total: number;
  customerName?: string;
  deliveryAddress?: string;
}

// ─── Main Screen ────────────────────────────────────────────────────────────
export default function OrderPickingScreen({ route, navigation: navProp }: any) {
  const { orderId } = route.params;
  const { token } = useAuthStore();

  // Use the prop directly – avoids the generic useNavigation() `never` issue
  const navigation = navProp as any;

  const [order, setOrder] = useState<Order | null>(null);
  const [scannedItems, setScannedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState<OrderItem | null>(null);

  useEffect(() => {
    fetchOrder();
  }, []);

  // ── enrich order items with live product data (barcodes, images, etc.) ────
  const enrichItemsWithProductData = async (items: OrderItem[]): Promise<OrderItem[]> => {
    try {
      const enriched = await Promise.all(
        items.map(async (item) => {
          try {
            const res = await axios.get(`${API_URL}/api/products/${item.productId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            const product = res.data.product || res.data; // handle both { product: {...} } and bare object

            // Merge live product fields onto the order item —
            // only overwrite if the product actually has a value
            return {
              ...item,
              barcode: product.barcode || item.barcode,
              image: product.image || item.image,
              description: product.description || item.description,
            };
          } catch {
            // If a single product fetch fails, keep the original item intact
            return item;
          }
        })
      );
      return enriched;
    } catch {
      // If the whole enrichment somehow fails, return original items
      return items;
    }
  };

  const fetchOrder = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let orderData: Order = response.data.order;

      // Enrich items with live barcode / image / description from products
      orderData = {
        ...orderData,
        items: await enrichItemsWithProductData(orderData.items),
      };

      setOrder(orderData);

      // If status is still 'pending', transition it to 'picking'
      if (orderData.status === 'pending') {
        await axios.patch(
          `${API_URL}/api/orders/${orderId}`,
          { status: 'picking', pickingStartedAt: new Date().toISOString() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        // Update local copy so the stepper reflects it immediately
        setOrder((prev) => (prev ? { ...prev, status: 'picking' } : prev));
      }
    } catch (error: any) {
      console.error('Fetch order error:', error.response?.data || error.message);
      Alert.alert('Error', 'Failed to fetch order details');
    } finally {
      setLoading(false);
    }
  };

  // ── scanning helpers ──────────────────────────────────────────────────────
  const handleScanPress = (item: OrderItem) => {
    if (!item.barcode) {
      Alert.alert(
        'No Barcode',
        'This product does not have a barcode assigned. Use manual confirmation.'
      );
      return;
    }
    setCurrentItem(item);
    setScannerVisible(true);
  };

  const handleBarcodeScanned = async (scannedBarcode: string) => {
    if (!currentItem) return;

    if (currentItem.barcode === scannedBarcode) {
      setScannedItems((prev) => new Set([...prev, currentItem.productId]));
      Alert.alert('✓ Correct', `${currentItem.name} scanned successfully!`);
    } else {
      try {
        const response = await axios.get(
          `${API_URL}/api/products?barcode=${scannedBarcode}`
        );
        if (response.data.product) {
          Alert.alert(
            '✗ Wrong Product',
            `You scanned: ${response.data.product.name}\n\nExpected: ${currentItem.name}`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', 'Barcode does not match any product');
        }
      } catch {
        Alert.alert('Error', 'Invalid barcode');
      }
    }
    setCurrentItem(null);
  };

  const handleManualConfirm = (item: OrderItem) => {
    Alert.alert(
      'Manual Confirmation',
      `Confirm you picked:\n\n${item.name}\nSKU: ${item.sku}\nQuantity: ${item.quantity}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            setScannedItems((prev) => new Set([...prev, item.productId]));
          },
        },
      ]
    );
  };

  // ── proceed to packaging ──────────────────────────────────────────────────
  const handleCompleteOrder = async () => {
    if (!order) return;

    if (scannedItems.size < order.items.length) {
      Alert.alert(
        'Incomplete Order',
        `You've only picked ${scannedItems.size} of ${order.items.length} items.\n\nComplete picking before packaging.`,
        [{ text: 'OK', style: 'cancel' }]
      );
      return;
    }

    // Transition status → packaging
    try {
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        { status: 'packaging', packagingStartedAt: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error: any) {
      console.error('Status update failed:', error.response?.data || error.message);
      // non-fatal – still allow navigation
    }

    navigation.navigate('Packaging', {
      orderId: orderId,
      orderNumber: order.orderNumber,
    });
  };

  // ── render helpers ────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: OrderItem }) => {
    const isScanned = scannedItems.has(item.productId);

    return (
      <View style={[styles.itemCard, isScanned && styles.itemCardScanned]}>
        <View style={styles.itemHeader}>
          {item.image && (
            <Image source={{ uri: item.image }} style={styles.itemImage} />
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemSKU}>SKU: {item.sku}</Text>
            <Text style={styles.itemPrice}>R{item.price.toFixed(2)} each</Text>
          </View>
          {isScanned && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
            </View>
          )}
        </View>

        {item.description && (
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.itemMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Quantity</Text>
            <Text style={styles.metaValue}>{item.quantity}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Subtotal</Text>
            <Text style={styles.metaValue}>
              R{(item.price * item.quantity).toFixed(2)}
            </Text>
          </View>
          {item.barcode && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Barcode</Text>
              <Text style={styles.metaValueBarcode}>{item.barcode}</Text>
            </View>
          )}
        </View>

        {!isScanned && (
          <View style={styles.itemActions}>
            {item.barcode ? (
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => handleScanPress(item)}
              >
                <Ionicons name="barcode-outline" size={20} color="#fff" />
                <Text style={styles.scanButtonText}>Scan to Verify</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.noBarcodeWarning}>
                <Ionicons name="warning-outline" size={16} color="#FF9800" />
                <Text style={styles.noBarcodeText}>No barcode linked</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.manualButton}
              onPress={() => handleManualConfirm(item)}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.manualButtonText}>Manual Pick</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ── loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={64} color="#999" />
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  const progress = (scannedItems.size / order.items.length) * 100;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{order.orderNumber}</Text>
        {order.customerName && (
          <Text style={styles.customerName}>
            <Ionicons name="person" size={14} /> {order.customerName}
          </Text>
        )}
      </View>

      {/* ─── STATUS STEPPER ─── */}
      <StatusStepper currentStatus={order.status} />

      {/* Picking progress */}
      <View style={styles.pickingProgress}>
        <Text style={styles.headerSubtitle}>
          {scannedItems.size} of {order.items.length} items picked ({Math.round(progress)}%)
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      {/* Item list */}
      <FlatList
        data={order.items}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.productId}-${index}`}
        contentContainerStyle={styles.list}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerLabel}>Order Total</Text>
          <Text style={styles.footerTotal}>R{order.total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.completeButton,
            scannedItems.size === order.items.length
              ? styles.completeButtonReady
              : styles.completeButtonDisabled,
          ]}
          onPress={handleCompleteOrder}
          disabled={scannedItems.size < order.items.length}
        >
          <Ionicons name="arrow-forward" size={20} color="#fff" />
          <Text style={styles.completeButtonText}>
            {scannedItems.size === order.items.length
              ? 'Continue to Packaging'
              : 'Pick All Items First'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Barcode scanner modal */}
      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => {
          setScannerVisible(false);
          setCurrentItem(null);
        }}
        onScan={handleBarcodeScanned}
      />
    </View>
  );
}

// ─── Screen styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#999', marginTop: 12 },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  backText: { fontSize: 16, color: '#FF6B35', fontWeight: '600', marginBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
  customerName: { fontSize: 14, color: '#666', marginTop: 4 },
  pickingProgress: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerSubtitle: { fontSize: 16, color: '#666', marginBottom: 8 },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
  list: { padding: 16 },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  itemCardScanned: { borderColor: '#4CAF50', backgroundColor: '#f1f8f4' },
  itemHeader: { flexDirection: 'row', marginBottom: 12 },
  itemImage: { width: 80, height: 80, borderRadius: 8, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  itemSKU: { fontSize: 14, color: '#666', marginBottom: 2 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: '#FF6B35' },
  checkmark: { marginLeft: 8 },
  itemDescription: { fontSize: 14, color: '#666', marginBottom: 12, lineHeight: 20 },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
  metaValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  metaValueBarcode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'monospace',
  },
  itemActions: { flexDirection: 'row', gap: 8 },
  scanButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#FF6B35',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  manualButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#666',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  manualButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  noBarcodeWarning: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF3E0',
    padding: 14,
    borderRadius: 8,
  },
  noBarcodeText: { color: '#FF9800', fontSize: 12, fontWeight: '600' },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  footerInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  footerLabel: { fontSize: 16, color: '#666' },
  footerTotal: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' },
  completeButton: {
    flexDirection: 'row',
    backgroundColor: '#999',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completeButtonReady: { backgroundColor: '#FF6B35' },
  completeButtonDisabled: { opacity: 0.5 },
  completeButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
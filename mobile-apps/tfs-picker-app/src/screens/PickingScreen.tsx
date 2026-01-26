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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import BarcodeScanner from '../components/BarcodeScanner';

const API_URL = 'https://tfs-wholesalers.onrender.com';

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

export default function OrderPickingScreen({ route, navigation }: any) {
  const { orderId } = route.params;
  const { token } = useAuthStore();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [scannedItems, setScannedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState<OrderItem | null>(null);

  useEffect(() => {
    fetchOrder();
  }, []);

  const fetchOrder = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrder(response.data.order);
    } catch (error: any) {
      console.error('Fetch order error:', error.response?.data || error.message);
      Alert.alert('Error', 'Failed to fetch order details');
    } finally {
      setLoading(false);
    }
  };

  const handleScanPress = (item: OrderItem) => {
    if (!item.barcode) {
      Alert.alert('No Barcode', 'This product does not have a barcode assigned. Use manual confirmation.');
      return;
    }
    setCurrentItem(item);
    setScannerVisible(true);
  };

  const handleBarcodeScanned = async (scannedBarcode: string) => {
    if (!currentItem) return;

    if (currentItem.barcode === scannedBarcode) {
      setScannedItems(prev => new Set([...prev, currentItem.productId]));
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
      } catch (error) {
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
            setScannedItems(prev => new Set([...prev, item.productId]));
          },
        },
      ]
    );
  };

  const handleCompleteOrder = async () => {
    if (!order) return;

    const totalItems = order.items.length;
    const scannedCount = scannedItems.size;

    if (scannedCount < totalItems) {
      Alert.alert(
        'Incomplete Order',
        `You've only picked ${scannedCount} of ${totalItems} items.\n\nComplete picking before packaging.`,
        [
          { text: 'OK', style: 'cancel' }
        ]
      );
    } else {
      // All items picked, go to packaging
      navigation.navigate('Packaging', { orderId });
    }
  };

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Order #{order.orderNumber}</Text>
        {order.customerName && (
          <Text style={styles.customerName}>
            <Ionicons name="person" size={14} /> {order.customerName}
          </Text>
        )}
        <Text style={styles.headerSubtitle}>
          {scannedItems.size} of {order.items.length} items picked ({Math.round(progress)}%)
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <FlatList
        data={order.items}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.productId}-${index}`}
        contentContainerStyle={styles.list}
      />

      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerLabel}>Order Total</Text>
          <Text style={styles.footerTotal}>R{order.total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.completeButton,
            scannedItems.size === order.items.length && styles.completeButtonReady,
            scannedItems.size < order.items.length && styles.completeButtonDisabled,
          ]}
          onPress={handleCompleteOrder}
          disabled={scannedItems.size < order.items.length}
        >
          <Ionicons name="arrow-forward" size={20} color="#fff" />
          <Text style={styles.completeButtonText}>
            {scannedItems.size === order.items.length ? 'Continue to Packaging' : 'Pick All Items First'}
          </Text>
        </TouchableOpacity>
      </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  customerName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  list: {
    padding: 16,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  itemCardScanned: {
    borderColor: '#4CAF50',
    backgroundColor: '#f1f8f4',
  },
  itemHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  itemSKU: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  checkmark: {
    marginLeft: 8,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  metaValueBarcode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'monospace',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
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
  scanButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
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
  manualButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
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
  noBarcodeText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  footerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  footerLabel: {
    fontSize: 16,
    color: '#666',
  },
  footerTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  completeButton: {
    flexDirection: 'row',
    backgroundColor: '#999',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completeButtonReady: {
    backgroundColor: '#FF6B35',
  },
  completeButtonDisabled: {
    opacity: 0.5,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
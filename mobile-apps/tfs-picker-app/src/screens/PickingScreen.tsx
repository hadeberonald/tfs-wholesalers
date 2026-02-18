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
import { Gift, Tag, Package as PackageIcon } from 'lucide-react-native';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import BarcodeScanner from '../components/BarcodeScanner';
import { useNavigation, useRoute } from '@react-navigation/native';
import StatusStepper from '../components/StatusStepper';

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

            const product = res.data.product || res.data;

            return {
              ...item,
              barcode: product.barcode || item.barcode,
              image: product.image || item.image,
              description: product.description || item.description,
            };
          } catch {
            return item;
          }
        })
      );
      return enriched;
    } catch {
      return items;
    }
  };

  const fetchOrder = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let orderData: Order = response.data.order;

      orderData = {
        ...orderData,
        items: await enrichItemsWithProductData(orderData.items),
      };

      setOrder(orderData);

      if (orderData.status === 'pending') {
        await axios.patch(
          `${API_URL}/api/orders/${orderId}`,
          { status: 'picking', pickingStartedAt: new Date().toISOString() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setOrder((prev) => (prev ? { ...prev, status: 'picking' } : prev));
      }
    } catch (error: any) {
      console.error('Fetch order error:', error.response?.data || error.message);
      Alert.alert('Error', 'Failed to fetch order details');
    } finally {
      setLoading(false);
    }
  };

  // ── Helper to get special/combo badge text ────────────────────────────────────
  const getItemBadge = (item: OrderItem) => {
    // Combo badge takes priority
    if (item.isComboItem) {
      return 'COMBO ITEM';
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
      case 'fixed_price':
        return `SPECIAL`;
      case 'multibuy':
        return `MULTIBUY`;
      case 'buy_x_get_y':
        return `PROMO`;
      default:
        return 'SPECIAL';
    }
  };

  // ── Helper to get item description ───────────────────────────────────
  const getItemDescription = (item: OrderItem) => {
    // Combo description
    if (item.isComboItem && item.comboName) {
      return `Part of ${item.comboName} combo`;
    }

    if (item.isBonusItem) {
      return 'Free bonus item';
    }

    if (!item.specialType) return null;

    switch (item.specialType) {
      case 'buy_x_get_y':
        const discount = item.specialConditions?.getDiscount || 100;
        if (discount === 100) {
          return `Buy ${item.specialConditions?.buyQuantity}, get ${item.specialConditions?.getQuantity} FREE`;
        }
        return `Buy ${item.specialConditions?.buyQuantity}, get ${item.specialConditions?.getQuantity} at ${discount}% off`;
      case 'multibuy':
        return `${item.specialConditions?.requiredQuantity} for R${item.specialConditions?.specialPrice}`;
      case 'percentage_off':
        return `${item.specialConditions?.discountPercentage}% discount`;
      case 'amount_off':
        return `R${item.specialConditions?.discountAmount} off`;
      case 'fixed_price':
        return `Special price: R${item.specialConditions?.newPrice}`;
      default:
        return 'Special offer';
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
    let specialInfo = '';
    
    if (item.isComboItem && item.comboName) {
      specialInfo = `\n\n📦 COMBO: ${item.comboName}`;
    } else if (item.isBonusItem) {
      specialInfo = '\n\n🎁 FREE BONUS ITEM';
    }
    
    Alert.alert(
      'Manual Confirmation',
      `Confirm you picked:\n\n${item.name}${item.variantName ? ` - ${item.variantName}` : ''}\nSKU: ${item.sku}\nQuantity: ${item.quantity}${specialInfo}`,
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
      const comboItemsCount = order.items.filter((item) => item.isComboItem).length;
      const specialItemsCount = order.items.filter(
        (item) => item.isBonusItem || item.specialType
      ).length;
      
      let message = `You've only picked ${scannedItems.size} of ${order.items.length} items.\n\n`;
      
      if (comboItemsCount > 0) {
        message += `⚠️ This order includes ${comboItemsCount} combo item${comboItemsCount > 1 ? 's' : ''}. `;
      }
      if (specialItemsCount > 0) {
        message += `⚠️ ${specialItemsCount} promotional item${specialItemsCount > 1 ? 's' : ''}. `;
      }
      
      message += '\n\nEnsure all items (including combo and promotional items) are picked.';

      Alert.alert('Incomplete Order', message, [{ text: 'OK', style: 'cancel' }]);
      return;
    }

    try {
      await axios.patch(
        `${API_URL}/api/orders/${orderId}`,
        { status: 'packaging', packagingStartedAt: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error: any) {
      console.error('Status update failed:', error.response?.data || error.message);
    }

    navigation.navigate('Packaging', {
      orderId: orderId,
      orderNumber: order.orderNumber,
    });
  };

  // ── render helpers ────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: OrderItem }) => {
    const isScanned = scannedItems.has(item.productId);
    const itemBadge = getItemBadge(item);
    const itemDesc = getItemDescription(item);

    return (
      <View
        style={[
          styles.itemCard,
          isScanned && styles.itemCardScanned,
          item.isComboItem && styles.itemCardCombo,
          item.isBonusItem && styles.itemCardBonus,
          item.specialType && !item.isBonusItem && !item.isComboItem && styles.itemCardSpecial,
        ]}
      >
        <View style={styles.itemHeader}>
          {item.image && (
            <Image source={{ uri: item.image }} style={styles.itemImage} />
          )}
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
                  styles.itemBadge,
                  item.isComboItem
                    ? styles.itemBadgeCombo
                    : item.isBonusItem
                    ? styles.itemBadgeFree
                    : styles.itemBadgePromo,
                ]}
              >
                {item.isComboItem ? (
                  <PackageIcon size={12} color="#9333EA" />
                ) : item.isBonusItem ? (
                  <Gift size={12} color="#10B981" />
                ) : (
                  <Tag size={12} color="#FF6B35" />
                )}
                <Text
                  style={[
                    styles.itemBadgeText,
                    item.isComboItem
                      ? styles.itemBadgeTextCombo
                      : item.isBonusItem
                      ? styles.itemBadgeTextFree
                      : styles.itemBadgeTextPromo,
                  ]}
                >
                  {itemBadge}
                </Text>
              </View>
            )}

            <Text style={styles.itemSKU}>SKU: {item.sku}</Text>
            <Text style={styles.itemPrice}>R{item.price.toFixed(2)} each</Text>
          </View>
          {isScanned && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
            </View>
          )}
        </View>

        {/* Item Description */}
        {itemDesc && (
          <View style={styles.itemDescContainer}>
            <Text style={styles.itemDescText}>
              {item.isComboItem ? '📦' : '🏷️'} {itemDesc}
            </Text>
          </View>
        )}

        {/* Combo Items Breakdown */}
        {item.isComboItem && item.comboItems && item.comboItems.length > 0 && (
          <View style={styles.comboItemsContainer}>
            <Text style={styles.comboItemsTitle}>Combo includes:</Text>
            {item.comboItems.map((comboItem, idx) => (
              <View key={idx} style={styles.comboItemRow}>
                <View style={styles.comboItemQty}>
                  <Text style={styles.comboItemQtyText}>{comboItem.quantity}×</Text>
                </View>
                <Text style={styles.comboItemName}>{comboItem.productName}</Text>
              </View>
            ))}
          </View>
        )}

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
  const hasComboItems = order.items.some((item) => item.isComboItem);
  const hasSpecialItems = order.items.some(
    (item) => item.isBonusItem || item.specialType
  );

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

      {/* STATUS STEPPER */}
      <StatusStepper currentStatus={order.status} />

      {/* Picking progress */}
      <View style={styles.pickingProgress}>
        <Text style={styles.headerSubtitle}>
          {scannedItems.size} of {order.items.length} items picked (
          {Math.round(progress)}%)
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      {/* Special/Combo Items Notice */}
      {(hasComboItems || hasSpecialItems) && (
        <View style={styles.noticeBox}>
          <PackageIcon size={20} color="#9333EA" />
          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>
              {hasComboItems && hasSpecialItems
                ? 'Combo & Promotional Items'
                : hasComboItems
                ? 'Combo Items'
                : 'Promotional Items'}
            </Text>
            <Text style={styles.noticeText}>
              {hasComboItems && hasSpecialItems
                ? 'This order contains combo deals and promotional items. Ensure ALL items are picked.'
                : hasComboItems
                ? 'This order contains combo deals. Each combo includes multiple items - pick all items shown.'
                : 'This order contains promotional items. Ensure ALL items (including free/bonus items) are picked.'}
            </Text>
          </View>
        </View>
      )}

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
  backText: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
    marginBottom: 8,
  },
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
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FAF5FF',
    borderWidth: 2,
    borderColor: '#9333EA',
    borderRadius: 8,
    padding: 12,
    margin: 16,
    gap: 12,
  },
  noticeContent: { flex: 1 },
  noticeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7E22CE',
    marginBottom: 4,
  },
  noticeText: { fontSize: 13, color: '#6B21A8', lineHeight: 18 },
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
  itemCardCombo: { borderColor: '#9333EA', backgroundColor: '#FAF5FF' },
  itemCardBonus: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  itemCardSpecial: { borderColor: '#FF6B35', backgroundColor: '#FFF7ED' },
  itemHeader: { flexDirection: 'row', marginBottom: 12 },
  itemImage: { width: 80, height: 80, borderRadius: 8, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  itemName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  variantName: { fontSize: 14, color: '#666', fontStyle: 'italic' },
  itemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginVertical: 4,
    gap: 4,
  },
  itemBadgeCombo: { backgroundColor: '#E9D5FF' },
  itemBadgeFree: { backgroundColor: '#D1FAE5' },
  itemBadgePromo: { backgroundColor: '#FED7AA' },
  itemBadgeText: { fontSize: 11, fontWeight: 'bold' },
  itemBadgeTextCombo: { color: '#7E22CE' },
  itemBadgeTextFree: { color: '#059669' },
  itemBadgeTextPromo: { color: '#EA580C' },
  itemDescContainer: {
    backgroundColor: '#F0F9FF',
    borderLeftWidth: 3,
    borderLeftColor: '#0EA5E9',
    padding: 8,
    marginBottom: 8,
    borderRadius: 4,
  },
  itemDescText: {
    fontSize: 12,
    color: '#0C4A6E',
    fontWeight: '600',
  },
  comboItemsContainer: {
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  comboItemsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7E22CE',
    marginBottom: 6,
  },
  comboItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  comboItemQty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#9333EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  comboItemQtyText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  comboItemName: {
    fontSize: 13,
    color: '#6B21A8',
    flex: 1,
  },
  itemSKU: { fontSize: 14, color: '#666', marginBottom: 2 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: '#FF6B35' },
  checkmark: { marginLeft: 8 },
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
  footerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
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
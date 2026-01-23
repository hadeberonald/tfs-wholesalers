import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { CheckCircle, XCircle, Package, Camera as CameraIcon } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useOrdersStore } from '../stores/ordersStore';

export default function PickingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId } = route.params as { orderId: string };
  
  const { orders, scanProduct } = useOrdersStore();
  const order = orders.find((o) => o._id === orderId);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<Set<string>>(new Set());

  const handleBarCodeScanned = async ({ data }: any) => {
    if (!scanning) return;

    setScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Check if product exists in order and hasn't been scanned
    const success = await scanProduct(orderId, data);

    if (success) {
      setScannedItems((prev) => new Set([...prev, data]));
      Alert.alert('Success', 'Product scanned successfully!');
    } else {
      Vibration.vibrate(500);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Product not found in this order or already scanned');
    }

    // Re-enable scanning after 2 seconds
    setTimeout(() => setScanning(true), 2000);
  };

  const allItemsScanned = order?.items.every((item) => item.scanned);

  const handleContinueToPackaging = () => {
    if (!allItemsScanned) {
      Alert.alert('Warning', 'Not all items have been scanned. Continue anyway?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => navigation.navigate('Packaging', { orderId }) },
      ]);
    } else {
      navigation.navigate('Packaging', { orderId });
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <CameraIcon size={64} color="#ccc" />
        <Text style={styles.errorText}>No access to camera</Text>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={requestPermission}
        >
          <Text style={styles.scanButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text>Order not found</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: any }) => {
    const isScanned = item.scanned || scannedItems.has(item.sku);
    
    return (
      <View style={[styles.itemCard, isScanned && styles.itemCardScanned]}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemSku}>SKU: {item.sku}</Text>
          <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
        </View>
        
        <View style={styles.itemStatus}>
          {isScanned ? (
            <CheckCircle size={32} color="#10B981" />
          ) : (
            <XCircle size={32} color="#EF4444" />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pick Order</Text>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${
                  (scannedItems.size / order.items.length) * 100
                }%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {scannedItems.size} / {order.items.length} items scanned
        </Text>
      </View>

      {/* Scanner */}
      {scanning && (
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'],
            }}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerText}>
              Align barcode within frame
            </Text>
          </View>
        </View>
      )}

      {!scanning && (
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setScanning(true)}
        >
          <CameraIcon size={24} color="#fff" />
          <Text style={styles.scanButtonText}>Scan Product</Text>
        </TouchableOpacity>
      )}

      {/* Items List */}
      <FlatList
        data={order.items}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.productId}-${index}`}
        contentContainerStyle={styles.list}
      />

      {/* Continue Button */}
      {scannedItems.size > 0 && (
        <TouchableOpacity
          style={[
            styles.continueButton,
            allItemsScanned && styles.continueButtonReady,
          ]}
          onPress={handleContinueToPackaging}
        >
          <Package size={24} color="#fff" />
          <Text style={styles.continueButtonText}>
            Continue to Packaging
          </Text>
        </TouchableOpacity>
      )}
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
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 16,
    color: '#666',
  },
  progressContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e5e5',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scannerContainer: {
    height: 300,
    backgroundColor: '#000',
    position: 'relative',
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#FF6B35',
    borderRadius: 12,
  },
  scannerText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  list: {
    padding: 16,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  itemCardScanned: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  itemSku: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  itemStatus: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonReady: {
    backgroundColor: '#10B981',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
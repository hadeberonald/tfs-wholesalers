import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Package, QrCode, CheckCircle } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useOrdersStore } from '../stores/ordersStore';

export default function PackagingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId } = route.params as { orderId: string };
  
  const { orders, createPackage, completeOrder } = useOrdersStore();
  const order = orders.find((o) => o._id === orderId);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [totalPackages, setTotalPackages] = useState('1');
  const [packages, setPackages] = useState<any[]>([]);
  const [currentPackageItems, setCurrentPackageItems] = useState<string[]>([]);

  const handleQRScanned = async ({ data }: any) => {
    if (!scanning) return;

    setScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const packageNum = packages.length + 1;
    const total = parseInt(totalPackages);

    try {
      await createPackage(
        orderId,
        data,
        currentPackageItems,
        packageNum,
        total
      );

      setPackages([
        ...packages,
        {
          qrCode: data,
          packageNumber: packageNum,
          totalPackages: total,
          items: currentPackageItems,
        },
      ]);

      setCurrentPackageItems([]);

      Alert.alert(
        'Success',
        `Package ${packageNum} of ${total} created successfully!`
      );

      // If all packages created, complete the order
      if (packageNum === total) {
        handleCompleteOrder();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create package');
    }
  };

  const handleCompleteOrder = async () => {
    try {
      await completeOrder(orderId);
      Alert.alert(
        'Order Complete!',
        'Order is now ready for delivery',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Orders'),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to complete order');
    }
  };

  const toggleItemForPackage = (itemId: string) => {
    if (currentPackageItems.includes(itemId)) {
      setCurrentPackageItems(currentPackageItems.filter((id) => id !== itemId));
    } else {
      setCurrentPackageItems([...currentPackageItems, itemId]);
    }
  };

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text>Order not found</Text>
      </View>
    );
  }

  const allPackagesCreated = packages.length === parseInt(totalPackages);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Package Order</Text>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
      </View>

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
              {
                width: `${
                  (packages.length / parseInt(totalPackages)) * 100
                }%`,
              },
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
          {order.items.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.itemCheckbox,
                currentPackageItems.includes(item.productId) &&
                  styles.itemCheckboxSelected,
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

          {/* QR Scanner */}
          {scanning ? (
            <View style={styles.scannerContainer}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={handleQRScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
              />
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFrame} />
                <Text style={styles.scannerText}>
                  Scan package QR code
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.scanButton,
                currentPackageItems.length === 0 && styles.scanButtonDisabled,
              ]}
              onPress={() => {
                if (!permission?.granted) {
                  requestPermission();
                } else {
                  setScanning(true);
                }
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
              <Text style={styles.packageItems}>
                {pkg.items.length} items
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Complete Button */}
      {allPackagesCreated && (
        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleCompleteOrder}
        >
          <CheckCircle size={24} color="#fff" />
          <Text style={styles.completeButtonText}>
            Complete Order
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
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
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  progressSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e5e5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
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
  itemCheckboxSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
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
  scannerFrame: {
    width: 200,
    height: 200,
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
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  scanButtonDisabled: {
    opacity: 0.5,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  packageCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  packageTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  packageQR: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  packageItems: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
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
  completeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
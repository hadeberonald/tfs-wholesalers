import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { MapPin, Package, CheckCircle, Navigation, Phone } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function DeliveryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as any;
  
  // Get order from params
  const order = params?.order;

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scannedPackages, setScannedPackages] = useState<Set<string>>(new Set());
  const [collectionComplete, setCollectionComplete] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState(false);

  const totalPackages = order?.packages?.length || 0;

  // Check if order exists
  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Order not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleQRScanned = async ({ data }: any) => {
    if (!scanning) return;

    setScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Check if QR code belongs to this order
    const packageExists = order.packages?.find((pkg: any) => pkg.qrCode === data);

    if (!packageExists) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'This package does not belong to this order');
      setTimeout(() => setScanning(true), 2000);
      return;
    }

    if (scannedPackages.has(data)) {
      Alert.alert('Already Scanned', 'This package was already scanned');
      setTimeout(() => setScanning(true), 2000);
      return;
    }

    // Add to scanned packages
    const newScanned = new Set(scannedPackages);
    newScanned.add(data);
    setScannedPackages(newScanned);

    if (newScanned.size === totalPackages) {
      if (deliveryMode) {
        // All packages scanned at delivery
        handleCompleteDelivery();
      } else {
        // All packages scanned for collection
        setCollectionComplete(true);
        Alert.alert(
          'Collection Complete',
          'All packages collected. Ready for delivery!',
          [{ text: 'OK' }]
        );
      }
    } else {
      Alert.alert(
        'Package Scanned',
        `${newScanned.size} of ${totalPackages} packages scanned`
      );
      setTimeout(() => setScanning(true), 2000);
    }
  };

  const handleNavigate = () => {
    const { address, lat, lng } = order.shippingAddress;
    
    const scheme = Platform.select({
      ios: 'maps://0,0?q=',
      android: 'geo:0,0?q=',
    });
    
    const latLng = `${lat},${lng}`;
    const label = encodeURIComponent(address);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    Linking.openURL(url!).catch(() =>
      Alert.alert('Error', 'Could not open maps app')
    );
  };

  const handleCall = () => {
    const phone = order.customerInfo.phone.replace(/\s/g, '');
    Linking.openURL(`tel:${phone}`);
  };

  const startDelivery = () => {
    setDeliveryMode(true);
    setScannedPackages(new Set());
    Alert.alert(
      'Delivery Started',
      'Please scan all packages again to confirm delivery',
      [{ text: 'OK', onPress: () => setScanning(true) }]
    );
  };

  const handleCompleteDelivery = async () => {
    try {
      // Update order status to delivered
      // Update all packages as delivered
      // This would call your API
      
      Alert.alert(
        'Delivery Complete!',
        'Order has been successfully delivered',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Deliveries'),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to complete delivery');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.headerBackButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {deliveryMode ? 'Confirm Delivery' : 'Collect Packages'}
        </Text>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
      </View>

      {/* Package Scanning Progress */}
      <View style={styles.progressSection}>
        <Text style={styles.progressTitle}>
          {deliveryMode ? 'Scan for Delivery' : 'Scan for Collection'}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(scannedPackages.size / totalPackages) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {scannedPackages.size} / {totalPackages} packages scanned
        </Text>
      </View>

      {/* Package List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Packages</Text>
        {order.packages?.map((pkg: any, index: number) => (
          <View
            key={index}
            style={[
              styles.packageCard,
              scannedPackages.has(pkg.qrCode) && styles.packageCardScanned,
            ]}
          >
            <View style={styles.packageInfo}>
              <Text style={styles.packageNumber}>
                Package {pkg.packageNumber} of {pkg.totalPackages}
              </Text>
              <Text style={styles.packageQR}>QR: {pkg.qrCode}</Text>
            </View>
            {scannedPackages.has(pkg.qrCode) && (
              <CheckCircle size={32} color="#10B981" />
            )}
          </View>
        ))}
      </View>

      {/* Scanner */}
      {scanning && (
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
            <Text style={styles.scannerText}>Scan package QR code</Text>
            <TouchableOpacity
              style={styles.cancelScanButton}
              onPress={() => setScanning(false)}
            >
              <Text style={styles.cancelScanText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!scanning && !collectionComplete && !deliveryMode && (
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => {
            if (!permission?.granted) {
              requestPermission();
            } else {
              setScanning(true);
            }
          }}
        >
          <Package size={24} color="#fff" />
          <Text style={styles.scanButtonText}>Scan Package</Text>
        </TouchableOpacity>
      )}

      {/* Delivery Details (shown after collection) */}
      {collectionComplete && !deliveryMode && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Details</Text>
            
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Customer:</Text>
                <Text style={styles.detailValue}>
                  {order.customerInfo.name}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone:</Text>
                <TouchableOpacity onPress={handleCall}>
                  <Text style={[styles.detailValue, styles.phoneLink]}>
                    {order.customerInfo.phone}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address:</Text>
                <Text style={styles.detailValue}>
                  {order.shippingAddress.address}
                </Text>
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

          <TouchableOpacity style={styles.startDeliveryButton} onPress={startDelivery}>
            <Package size={24} color="#fff" />
            <Text style={styles.startDeliveryButtonText}>
              Arrived - Start Delivery
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Delivery Mode - Verification */}
      {deliveryMode && !scanning && scannedPackages.size < totalPackages && (
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => {
            if (!permission?.granted) {
              requestPermission();
            } else {
              setScanning(true);
            }
          }}
        >
          <Package size={24} color="#fff" />
          <Text style={styles.scanButtonText}>
            Scan Package ({scannedPackages.size}/{totalPackages})
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
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerBackButton: {
    marginBottom: 16,
  },
  headerBackButtonText: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
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
  progressSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
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
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
  packageCardScanned: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  packageInfo: {
    flex: 1,
  },
  packageNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  packageQR: {
    fontSize: 14,
    color: '#666',
  },
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
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#FF6B35',
    borderRadius: 12,
  },
  scannerText: {
    marginTop: 20,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelScanButton: {
    marginTop: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelScanText: {
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
  detailCard: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#1a1a1a',
    flex: 1,
    textAlign: 'right',
  },
  phoneLink: {
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
  notesBox: {
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#666',
  },
  navigateButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  navigateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  startDeliveryButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 32,
    borderRadius: 12,
    gap: 8,
  },
  startDeliveryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
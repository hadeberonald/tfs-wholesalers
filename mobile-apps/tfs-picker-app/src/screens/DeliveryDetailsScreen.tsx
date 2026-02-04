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
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { MapPin, Package, CheckCircle, Navigation, Phone, ArrowLeft } from 'lucide-react-native';
import { useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import StatusStepper from '../components/StatusStepper';

const API_URL = 'https://tfs-wholesalers.onrender.com';

export default function DeliveryDetailScreen({ navigation: navProp }: any) {
  // Use the prop directly – avoids the generic useNavigation() `never` issue
  const navigation = navProp as any;

  const route = useRoute();
  const params = route.params as { orderId: string };
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifiedPackages, setVerifiedPackages] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchOrder();
  }, [params.orderId]);

  const fetchOrder = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await axios.get(
        `${API_URL}/api/orders/${params.orderId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      setOrder(response.data.order);
    } catch (error: any) {
      console.error('Failed to fetch order:', error.response?.data || error.message);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleQRScanned = async ({ data }: any) => {
    if (!scanning || !order) return;

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

    if (verifiedPackages.has(data)) {
      Alert.alert('Already Verified', 'This package was already verified');
      setTimeout(() => setScanning(true), 2000);
      return;
    }

    // Add to verified packages
    const newVerified = new Set(verifiedPackages);
    newVerified.add(data);
    setVerifiedPackages(newVerified);

    const totalPackages = order.packages?.length || 0;
    
    if (newVerified.size === totalPackages) {
      // All packages verified at delivery
      Alert.alert(
        'All Packages Verified!',
        'Ready to complete delivery',
        [
          {
            text: 'Complete Delivery',
            onPress: () => handleCompleteDelivery(),
          },
        ]
      );
    } else {
      Alert.alert(
        'Package Verified',
        `${newVerified.size} of ${totalPackages} packages verified`,
        [
          {
            text: 'Continue',
            onPress: () => setTimeout(() => setScanning(true), 500),
          },
        ]
      );
    }
  };

  const getAddress = (order: any): string => {
    if (order.shippingAddress?.address) {
      const addr = order.shippingAddress.address;
      if (typeof addr === 'string') {
        return addr;
      }
      if (typeof addr === 'object' && addr !== null) {
        const parts = [
          addr.street,
          addr.city,
          addr.province,
          addr.postalCode
        ].filter(Boolean);
        return parts.join(', ') || 'Address not available';
      }
    }
    if (order.deliveryAddress) {
      if (typeof order.deliveryAddress === 'string') {
        return order.deliveryAddress;
      }
      if (typeof order.deliveryAddress === 'object' && order.deliveryAddress !== null) {
        const addr = order.deliveryAddress as any;
        const parts = [
          addr.street,
          addr.city,
          addr.province,
          addr.postalCode
        ].filter(Boolean);
        return parts.join(', ') || 'Address not available';
      }
    }
    return 'Address not available';
  };

  const handleNavigate = () => {
    if (!order?.shippingAddress) {
      Alert.alert('Error', 'No delivery address available');
      return;
    }

    const { lat, lng } = order.shippingAddress;
    const address = getAddress(order);
    
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

  const handleCompleteDelivery = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.patch(
        `${API_URL}/api/orders/${order._id}`,
        {
          status: 'delivered',
          deliveredAt: new Date().toISOString(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Optimistically update local order so stepper shows 'delivered'
      setOrder((prev: any) => ({ ...prev, status: 'delivered' }));
      
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
      console.error('Failed to complete delivery:', error);
      Alert.alert('Error', 'Failed to complete delivery');
    }
  };

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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalPackages = order.packages?.length || 0;
  const allVerified = verifiedPackages.size === totalPackages;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#FF6B35" />
          <Text style={styles.headerBackButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Deliver Order</Text>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
      </View>

      {/* ─── STATUS STEPPER ─── */}
      <StatusStepper currentStatus={order.status} />

      {/* Delivery Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Details</Text>
        
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Ionicons name="person" size={20} color="#666" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Customer</Text>
              <Text style={styles.detailValue}>
                {order.customerInfo.name}
              </Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <Phone size={20} color="#666" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Phone</Text>
              <TouchableOpacity onPress={handleCall}>
                <Text style={[styles.detailValue, styles.phoneLink]}>
                  {order.customerInfo.phone}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <MapPin size={20} color="#666" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue}>
                {getAddress(order)}
              </Text>
            </View>
          </View>
          
          {order.deliveryNotes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Delivery Notes:</Text>
              <Text style={styles.notesText}>{order.deliveryNotes}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Navigation Button */}
      <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
        <Navigation size={24} color="#fff" />
        <Text style={styles.navigateButtonText}>Navigate with Google Maps</Text>
      </TouchableOpacity>

      {/* Verification Progress */}
      <View style={styles.progressSection}>
        <Text style={styles.progressTitle}>Package Verification</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(verifiedPackages.size / totalPackages) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {verifiedPackages.size} / {totalPackages} packages verified
        </Text>
      </View>

      {/* Package List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Packages to Deliver</Text>
        {order.packages?.map((pkg: any, index: number) => (
          <View
            key={index}
            style={[
              styles.packageCard,
              verifiedPackages.has(pkg.qrCode) && styles.packageCardVerified,
            ]}
          >
            <View style={styles.packageInfo}>
              <Text style={styles.packageNumber}>
                Package {pkg.packageNumber} of {pkg.totalPackages}
              </Text>
              <Text style={styles.packageQR}>QR: {pkg.qrCode}</Text>
            </View>
            {verifiedPackages.has(pkg.qrCode) && (
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

      {/* Action Buttons */}
      {!scanning && !allVerified && (
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
            Verify Package ({verifiedPackages.size}/{totalPackages})
          </Text>
        </TouchableOpacity>
      )}

      {allVerified && (
        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleCompleteDelivery}
        >
          <CheckCircle size={24} color="#fff" />
          <Text style={styles.completeButtonText}>
            Complete Delivery
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  detailCard: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#1a1a1a',
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
  packageCardVerified: {
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
  completeButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 16,
    marginBottom: 32,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
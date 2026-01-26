import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Package, MapPin, Clock, CheckCircle } from 'lucide-react-native';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { useFocusEffect } from '@react-navigation/native';

const API_URL = 'https://tfs-wholesalers.onrender.com';

interface Order {
  _id: string;
  orderNumber: string;
  customerInfo: {
    name: string;
    phone: string;
    email: string;
  };
  shippingAddress: {
    address: string;
    lat: number;
    lng: number;
  };
  total: number;
  status: string;
  packages?: any[];
  deliveryNotes?: string;
  createdAt: string;
}

export default function DeliveriesListScreen({ navigation }: any) {
  const { token } = useAuthStore();
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch orders when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchDeliveries();
      
      // Poll every 30 seconds while screen is focused
      const interval = setInterval(() => {
        fetchDeliveries(true); // Silent refresh
      }, 30000);

      return () => clearInterval(interval);
    }, [])
  );

  const fetchDeliveries = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await axios.get(`${API_URL}/api/orders?all=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Split orders into pending and completed
      const pending = response.data.orders.filter(
        (order: Order) => 
          order.status === 'ready_for_delivery' || 
          order.status === 'out_for_delivery'
      );

      const completed = response.data.orders.filter(
        (order: Order) => order.status === 'delivered'
      );

      console.log('📦 Pending deliveries:', pending.length);
      console.log('✅ Completed deliveries:', completed.length);
      
      setPendingOrders(pending);
      setCompletedOrders(completed);
    } catch (error: any) {
      console.error('Fetch deliveries error:', error.response?.data || error.message);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeliveries();
  };

  const handleOrderPress = (order: Order) => {
    navigation.navigate('DeliveryDetail', { order });
  };

  const renderOrder = ({ item, section }: { item: Order; section: any }) => {
    const packageCount = item.packages?.length || 0;
    const isOutForDelivery = item.status === 'out_for_delivery';
    const isCompleted = item.status === 'delivered';

    return (
      <TouchableOpacity
        style={[
          styles.orderCard,
          isOutForDelivery && styles.orderCardActive,
          isCompleted && styles.orderCardCompleted,
        ]}
        onPress={() => !isCompleted && handleOrderPress(item)}
        disabled={isCompleted}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            {isOutForDelivery && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>Out for Delivery</Text>
              </View>
            )}
            {isCompleted && (
              <View style={[styles.statusBadge, styles.statusBadgeCompleted]}>
                <CheckCircle size={12} color="#fff" />
                <Text style={styles.statusBadgeText}>Delivered</Text>
              </View>
            )}
          </View>
          <Text style={styles.orderTotal}>R{item.total.toFixed(2)}</Text>
        </View>

        <View style={styles.orderInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="person" size={16} color="#666" />
            <Text style={styles.infoText}>{item.customerInfo.name}</Text>
          </View>

          <View style={styles.infoRow}>
            <MapPin size={16} color="#666" />
            <Text style={styles.infoText} numberOfLines={1}>
              {item.shippingAddress.address}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Package size={16} color="#666" />
            <Text style={styles.infoText}>
              {packageCount} {packageCount === 1 ? 'package' : 'packages'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Clock size={16} color="#666" />
            <Text style={styles.infoText}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {!isCompleted && (
          <View style={styles.orderFooter}>
            <TouchableOpacity
              style={styles.deliverButton}
              onPress={() => handleOrderPress(item)}
            >
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={styles.deliverButtonText}>
                {isOutForDelivery ? 'Continue Delivery' : 'Start Delivery'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading deliveries...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Deliveries</Text>
        <Text style={styles.headerSubtitle}>
          {pendingOrders.length} pending • {completedOrders.length} completed
        </Text>
      </View>

      {pendingOrders.length === 0 && completedOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Deliveries</Text>
          <Text style={styles.emptyText}>
            No orders ready for delivery yet
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={20} color="#FF6B35" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={[
            { title: 'Pending Deliveries', data: pendingOrders },
            { title: 'Completed', data: completedOrders },
          ]}
          renderItem={renderOrder}
          renderSectionHeader={({ section: { title, data } }) =>
            data.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
                <Text style={styles.sectionCount}>{data.length}</Text>
              </View>
            ) : null
          }
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B35"
            />
          }
        />
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardActive: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF5F0',
  },
  orderCardCompleted: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
    opacity: 0.7,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  statusBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusBadgeCompleted: {
    backgroundColor: '#10B981',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  orderInfo: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  orderFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingTop: 12,
  },
  deliverButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B35',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deliverButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  refreshButtonText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    backgroundColor: '#e5e5e5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Package, Clock } from 'lucide-react-native';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { useFocusEffect } from '@react-navigation/native';

const API_URL = 'https://tfs-wholesalers.onrender.com';

interface Order {
  _id: string;
  orderNumber: string;
  customerInfo?: {
    name: string;
  };
  items: any[];
  total: number;
  status: string;
  createdAt: string;
}

// Statuses that should never appear in the picker's queue
const EXCLUDED_STATUSES = [
  'payment_pending', // created but payment not yet verified
  'payment_failed',  // payment was attempted but declined / timed out
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
];

export default function OrdersListScreen({ navigation }: any) {
  const { token } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch orders when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      
      // Poll every 30 seconds while screen is focused
      const interval = setInterval(() => {
        fetchOrders(true); // Silent refresh
      }, 30000);

      return () => clearInterval(interval);
    }, [])
  );

  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const response = await axios.get(`${API_URL}/api/orders?all=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Filter out any order whose status is in the exclusion list
      const pendingOrders = response.data.orders.filter(
        (order: Order) => !EXCLUDED_STATUSES.includes(order.status)
      );

      console.log('📋 Pending orders for picking:', pendingOrders.length);
      setOrders(pendingOrders);
    } catch (error: any) {
      console.error('Fetch orders error:', error.response?.data || error.message);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleOrderPress = (order: Order) => {
    navigation.navigate('Picking', { orderId: order._id });
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const itemCount = item.items?.length || 0;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => handleOrderPress(item)}
      >
        <View style={styles.orderHeader}>
          <Text style={styles.orderNumber}>{item.orderNumber}</Text>
          <Text style={styles.orderTotal}>R{item.total.toFixed(2)}</Text>
        </View>

        <View style={styles.orderInfo}>
          {item.customerInfo?.name && (
            <View style={styles.infoRow}>
              <Ionicons name="person" size={16} color="#666" />
              <Text style={styles.infoText}>{item.customerInfo.name}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Package size={16} color="#666" />
            <Text style={styles.infoText}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Clock size={16} color="#666" />
            <Text style={styles.infoText}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.orderFooter}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Ready to Pick</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#FF6B35" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders to Pick</Text>
        <Text style={styles.headerSubtitle}>
          {orders.length} {orders.length === 1 ? 'order' : 'orders'}
        </Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Orders</Text>
          <Text style={styles.emptyText}>
            All orders have been picked!
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={20} color="#FF6B35" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingTop: 12,
  },
  statusBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#FF9800',
    fontSize: 12,
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
});
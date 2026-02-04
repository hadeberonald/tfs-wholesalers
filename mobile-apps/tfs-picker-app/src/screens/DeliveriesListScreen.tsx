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
import { Package, MapPin, Clock, CheckCircle, Truck } from 'lucide-react-native';
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
  shippingAddress?: {
    address: string | {
      street?: string;
      city?: string;
      province?: string;
      postalCode?: string;
    };
    lat: number;
    lng: number;
  };
  deliveryAddress?: string | {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  total: number;
  status: string;
  packages?: any[];
  deliveryNotes?: string;
  createdAt: string;
  collectedPackages?: string[]; // QR codes of collected packages
  deliveryStartedAt?: string;
}

type TabType = 'pending' | 'collecting' | 'delivering' | 'completed';

// ─── shared filter helpers (single source of truth for tabs + badges) ────────
// pending  : sitting in the warehouse, untouched
const isPending = (o: Order) =>
  o.status === 'ready_for_delivery' &&
  (!o.collectedPackages || o.collectedPackages.length === 0);

// collecting: driver has opened the order (status flipped to 'collecting' by
//             DeliveryCollectionScreen) OR partially collected but still
//             ready_for_delivery (edge-case / race)
const isCollecting = (o: Order) =>
  o.status === 'collecting' ||
  (o.status === 'ready_for_delivery' &&
    o.collectedPackages &&
    o.collectedPackages.length > 0 &&
    o.collectedPackages.length < (o.packages?.length || 0));

// delivering: all packages collected, on the road
const isDelivering = (o: Order) => o.status === 'out_for_delivery';

// completed : handed over to customer
const isCompleted = (o: Order) => o.status === 'delivered';

export default function DeliveriesListScreen({ navigation }: any) {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch orders when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchDeliveries();
      
      // Poll every 20 seconds while screen is focused
      const interval = setInterval(() => {
        fetchDeliveries(true); // Silent refresh
      }, 20000);

      return () => clearInterval(interval);
    }, [])
  );

  const fetchDeliveries = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await axios.get(`${API_URL}/api/orders?all=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setOrders(response.data.orders);
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
    if (activeTab === 'pending' || activeTab === 'collecting') {
      // Go to collection screen
      navigation.navigate('DeliveryCollection', { orderId: order._id });
    } else if (activeTab === 'delivering') {
      // Go to delivery detail screen
      navigation.navigate('DeliveryDetail', { orderId: order._id });
    }
  };

  // Helper function to get address string
  const getAddress = (order: Order): string => {
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

  // Filter orders by tab — uses the same helpers as the badges
  const getFilteredOrders = (): Order[] => {
    switch (activeTab) {
      case 'pending':    return orders.filter(isPending);
      case 'collecting': return orders.filter(isCollecting);
      case 'delivering': return orders.filter(isDelivering);
      case 'completed':  return orders.filter(isCompleted);
      default:           return [];
    }
  };

  const filteredOrders = getFilteredOrders();

  const renderOrder = ({ item }: { item: Order }) => {
    const packageCount = item.packages?.length || 0;
    const collectedCount = item.collectedPackages?.length || 0;
    const address = getAddress(item);
    
    const isCollectingCard = activeTab === 'collecting';
    const isDeliveringCard = activeTab === 'delivering';
    const isCompletedCard  = activeTab === 'completed';

    return (
      <TouchableOpacity
        style={[
          styles.orderCard,
          isCollectingCard && styles.orderCardCollecting,
          isDeliveringCard && styles.orderCardActive,
          isCompletedCard  && styles.orderCardCompleted,
        ]}
        onPress={() => !isCompletedCard && handleOrderPress(item)}
        disabled={isCompletedCard}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            {isCollectingCard && (
              <View style={[styles.statusBadge, { backgroundColor: '#F59E0B' }]}>
                <Package size={12} color="#fff" />
                <Text style={styles.statusBadgeText}>Collecting</Text>
              </View>
            )}
            {isDeliveringCard && (
              <View style={styles.statusBadge}>
                <Truck size={12} color="#fff" />
                <Text style={styles.statusBadgeText}>Out for Delivery</Text>
              </View>
            )}
            {isCompletedCard && (
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
            <Text style={styles.infoText}>
              {item.customerInfo?.name || 'Customer name not available'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <MapPin size={16} color="#666" />
            <Text style={styles.infoText} numberOfLines={1}>
              {address}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Package size={16} color="#666" />
            <Text style={styles.infoText}>
              {isCollectingCard || isDeliveringCard
                ? `${collectedCount}/${packageCount} packages collected`
                : `${packageCount} ${packageCount === 1 ? 'package' : 'packages'}`
              }
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Clock size={16} color="#666" />
            <Text style={styles.infoText}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {!isCompletedCard && (
          <View style={styles.orderFooter}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                isCollectingCard  && { backgroundColor: '#F59E0B' },
                isDeliveringCard  && { backgroundColor: '#10B981' },
              ]}
              onPress={() => handleOrderPress(item)}
            >
              {activeTab === 'pending' && (
                <>
                  <Package size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Start Collection</Text>
                </>
              )}
              {isCollectingCard && (
                <>
                  <Package size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Continue Collection</Text>
                </>
              )}
              {isDeliveringCard && (
                <>
                  <Ionicons name="navigate" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Deliver Order</Text>
                </>
              )}
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
          Manage your delivery workflow
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Package size={20} color={activeTab === 'pending' ? '#FF6B35' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pending
          </Text>
          <View style={[styles.badge, activeTab === 'pending' && styles.badgeActive]}>
            <Text style={[styles.badgeText, activeTab === 'pending' && styles.badgeTextActive]}>
              {orders.filter(isPending).length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'collecting' && styles.tabActive]}
          onPress={() => setActiveTab('collecting')}
        >
          <Package size={20} color={activeTab === 'collecting' ? '#FF6B35' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'collecting' && styles.tabTextActive]}>
            Collecting
          </Text>
          <View style={[styles.badge, activeTab === 'collecting' && styles.badgeActive]}>
            <Text style={[styles.badgeText, activeTab === 'collecting' && styles.badgeTextActive]}>
              {orders.filter(isCollecting).length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'delivering' && styles.tabActive]}
          onPress={() => setActiveTab('delivering')}
        >
          <Truck size={20} color={activeTab === 'delivering' ? '#FF6B35' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'delivering' && styles.tabTextActive]}>
            Delivering
          </Text>
          <View style={[styles.badge, activeTab === 'delivering' && styles.badgeActive]}>
            <Text style={[styles.badgeText, activeTab === 'delivering' && styles.badgeTextActive]}>
              {orders.filter(isDelivering).length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
          onPress={() => setActiveTab('completed')}
        >
          <CheckCircle size={20} color={activeTab === 'completed' ? '#FF6B35' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            Done
          </Text>
          <View style={[styles.badge, activeTab === 'completed' && styles.badgeActive]}>
            <Text style={[styles.badgeText, activeTab === 'completed' && styles.badgeTextActive]}>
              {orders.filter(isCompleted).length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Order List */}
      {filteredOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Orders</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'pending' && 'No pending deliveries'}
            {activeTab === 'collecting' && 'No orders being collected'}
            {activeTab === 'delivering' && 'No orders out for delivery'}
            {activeTab === 'completed' && 'No completed deliveries'}
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={20} color="#FF6B35" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    gap: 4,
  },
  tabActive: {
    borderBottomColor: '#FF6B35',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#FF6B35',
  },
  badge: {
    backgroundColor: '#e5e5e5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: '#FF6B35',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#666',
  },
  badgeTextActive: {
    color: '#fff',
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
  orderCardCollecting: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
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
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B35',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
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
});
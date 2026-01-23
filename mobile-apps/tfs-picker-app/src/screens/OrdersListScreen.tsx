import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Package, Clock, CheckCircle } from 'lucide-react-native';
import { useOrdersStore } from '../stores/ordersStore';
import { useAuthStore } from '../stores/authStore';

export default function OrdersListScreen() {
  const navigation = useNavigation();
  const { orders, loading, fetchOrders, assignOrder } = useOrdersStore();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const handlePickOrder = async (orderId: string) => {
    try {
      if (!user?.id) return;
      
      await assignOrder(orderId, user.id);
      navigation.navigate('Picking', { orderId });
    } catch (error) {
      console.error('Failed to pick order:', error);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'assigned':
        return '#3B82F6';
      case 'picking':
        return '#8B5CF6';
      case 'packed':
        return '#10B981';
      case 'ready':
        return '#059669';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'pending':
        return Clock;
      case 'ready':
        return CheckCircle;
      default:
        return Package;
    }
  };

  const renderOrder = ({ item }: { item: any }) => {
    const StatusIcon = getStatusIcon(item.pickingStatus);
    const isAssignedToMe = item.assignedPicker === user?.id;
    const canPick = !item.pickingStatus || item.pickingStatus === 'pending' || isAssignedToMe;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => canPick && handlePickOrder(item._id)}
        disabled={!canPick}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            <Text style={styles.customerName}>{item.customerInfo.name}</Text>
          </View>
          
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(item.pickingStatus)}20` },
            ]}
          >
            <StatusIcon
              size={16}
              color={getStatusColor(item.pickingStatus)}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.pickingStatus) },
              ]}
            >
              {item.pickingStatus || 'New'}
            </Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Items:</Text>
            <Text style={styles.detailValue}>{item.items.length}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total:</Text>
            <Text style={styles.detailValue}>R{item.total.toFixed(2)}</Text>
          </View>
        </View>

        {canPick && (
          <TouchableOpacity
            style={styles.pickButton}
            onPress={() => handlePickOrder(item._id)}
          >
            <Package size={20} color="#fff" />
            <Text style={styles.pickButtonText}>
              {isAssignedToMe ? 'Continue Picking' : 'Start Picking'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
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
        <Text style={styles.headerSubtitle}>{orders.length} pending orders</Text>
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Package size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No orders to pick</Text>
            <Text style={styles.emptySubtitle}>
              New orders will appear here
            </Text>
          </View>
        }
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
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  list: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  pickButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  pickButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
});

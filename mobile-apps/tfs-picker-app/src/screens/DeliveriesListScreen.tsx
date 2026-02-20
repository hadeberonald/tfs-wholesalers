// src/screens/DeliveriesListScreen.tsx
// Real-time via Socket.IO — deliveries update instantly when order status changes.

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Truck, MapPin, Clock, Package } from 'lucide-react-native';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { useFocusEffect } from '@react-navigation/native';
import { connectPickerSocket } from '../services/socketService';

const API_URL = 'https://tfs-wholesalers.onrender.com';

const DELIVERY_STATUSES = ['collecting', 'ready_for_delivery', 'out_for_delivery'];

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  collecting:         { label: 'Ready for Pickup',  color: '#6d28d9', bg: '#ede9fe' },
  ready_for_delivery: { label: 'Awaiting Driver',   color: '#b45309', bg: '#fef3c7' },
  out_for_delivery:   { label: 'Out for Delivery',  color: '#065f46', bg: '#d1fae5' },
};

interface Order {
  _id: string; orderNumber: string;
  customerInfo?: { name: string; phone?: string };
  shippingAddress?: { streetAddress?: string; suburb?: string; city?: string; province?: string };
  items: any[]; total: number; status: string;
  packages?: any[]; createdAt: string;
}

export default function DeliveriesListScreen({ navigation }: any) {
  const { token, activeBranch } = useAuthStore();
  const [orders, setOrders]         = useState<Order[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeliveries = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params: any = { all: true };
      if (activeBranch?._id || activeBranch?.id) params.branchId = activeBranch._id || activeBranch.id;

      const response = await axios.get(`${API_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      const deliveryOrders = response.data.orders.filter((o: Order) =>
        DELIVERY_STATUSES.includes(o.status)
      );
      setOrders(deliveryOrders);
    } catch (err: any) {
      console.error('Fetch deliveries error:', err.response?.data || err.message);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, [activeBranch?._id, token]);

  // ── Socket setup ───────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const branchId = activeBranch?._id || activeBranch?.id;
      if (!branchId) return;

      fetchDeliveries();

      const socket = connectPickerSocket(branchId);

      const handleOrderUpdated = ({ order, status }: { order: Order; status: string }) => {
        setOrders(prev => {
          const isDeliveryStatus = DELIVERY_STATUSES.includes(status);

          if (!isDeliveryStatus) {
            // Order left delivery scope (e.g. delivered) — remove it
            return prev.filter(o => o._id !== order._id);
          }

          const exists = prev.find(o => o._id === order._id);
          if (exists) {
            return prev.map(o => o._id === order._id ? { ...o, ...order } : o);
          }
          // Order just entered delivery scope (e.g. packaging → collecting)
          return [order, ...prev];
        });
      };

      socket.on('order:updated', handleOrderUpdated);
      const handleReconnect = () => fetchDeliveries(true);
      socket.on('connect', handleReconnect);

      return () => {
        socket.off('order:updated', handleOrderUpdated);
        socket.off('connect', handleReconnect);
      };
    }, [activeBranch?._id, fetchDeliveries])
  );

  const onRefresh = () => { setRefreshing(true); fetchDeliveries(); };

  const renderOrder = ({ item }: { item: Order }) => {
    const statusInfo = STATUS_LABELS[item.status] || { label: item.status, color: '#374151', bg: '#f3f4f6' };
    const address    = item.shippingAddress;
    const addressLine = address
      ? [address.streetAddress, address.suburb, address.city].filter(Boolean).join(', ')
      : null;
    const packageCount = item.packages?.length || 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('DeliveryDetail', { orderId: item._id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber}>{item.orderNumber}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusPillText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          {item.customerInfo?.name && (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={16} color="#6b7280" />
              <Text style={styles.infoText}>{item.customerInfo.name}</Text>
              {item.customerInfo.phone && <Text style={styles.phoneText}>{item.customerInfo.phone}</Text>}
            </View>
          )}
          {addressLine && (
            <View style={styles.infoRow}>
              <MapPin size={16} color="#6b7280" />
              <Text style={styles.infoText} numberOfLines={1}>{addressLine}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Package size={16} color="#6b7280" />
            <Text style={styles.infoText}>
              {packageCount > 0
                ? `${packageCount} package${packageCount !== 1 ? 's' : ''}`
                : `${item.items?.length || 0} items`}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Clock size={16} color="#6b7280" />
            <Text style={styles.infoText}>{new Date(item.createdAt).toLocaleString()}</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.total}>R{item.total.toFixed(2)}</Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('DeliveryDetail', { orderId: item._id })}
          >
            <Truck size={16} color="#fff" />
            <Text style={styles.actionBtnText}>{item.status === 'collecting' ? 'Collect' : 'View'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>Loading deliveries…</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Deliveries</Text>
          <Text style={styles.headerSubtitle}>
            {orders.length} {orders.length === 1 ? 'order' : 'orders'}
            {activeBranch ? ` · ${activeBranch.name}` : ''}
          </Text>
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Truck size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Deliveries</Text>
          <Text style={styles.emptyText}>Orders ready for collection will appear here instantly.</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={20} color="#FF6B35" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f5f5f5' },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:{ marginTop: 12, fontSize: 16, color: '#666' },

  header: {
    backgroundColor: '#fff', padding: 20, paddingTop: 60,
    borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  headerTitle:    { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  liveIndicator:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff3e0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 4 },
  liveDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  liveText: { fontSize: 12, fontWeight: '800', color: '#FF6B35' },

  list: { padding: 16 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderNumber: { fontSize: 17, fontWeight: 'bold', color: '#1a1a1a' },
  statusPill:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  cardBody: { gap: 8, marginBottom: 14 },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: '#6b7280', flex: 1 },
  phoneText:{ fontSize: 13, color: '#FF6B35', fontWeight: '600' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 },
  total:      { fontSize: 18, fontWeight: 'bold', color: '#FF6B35' },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF6B35', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  emptyState:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle:       { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginTop: 16 },
  emptyText:        { fontSize: 16, color: '#666', marginTop: 8, textAlign: 'center' },
  refreshButton:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderWidth: 2, borderColor: '#FF6B35' },
  refreshButtonText:{ color: '#FF6B35', fontSize: 16, fontWeight: '600' },
});
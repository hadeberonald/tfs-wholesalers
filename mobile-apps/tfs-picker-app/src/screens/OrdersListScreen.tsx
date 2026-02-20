// src/screens/OrdersListScreen.tsx
// Real-time via Socket.IO — new orders and status changes appear instantly.
// Falls back to a 30s refresh on reconnect to catch any missed events.

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Package, Clock } from 'lucide-react-native';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { useFocusEffect } from '@react-navigation/native';
import { connectPickerSocket, getSocket } from '../services/socketService';

const API_URL = 'https://tfs-wholesalers.onrender.com';

const EXCLUDED_STATUSES = [
  'payment_pending', 'payment_failed',
  'ready_for_delivery', 'out_for_delivery', 'delivered',
];

interface Order {
  _id: string; orderNumber: string;
  customerInfo?: { name: string };
  items: any[]; total: number; status: string; createdAt: string;
}

export default function OrdersListScreen({ navigation }: any) {
  const { token, activeBranch } = useAuthStore();
  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Keep a ref to orders so socket handler always sees the latest list
  const ordersRef = useRef<Order[]>([]);
  ordersRef.current = orders;

  // ── Fetch all relevant orders ──────────────────────────────────────────────
  const fetchOrders = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params: any = { all: true };
      if (activeBranch?._id || activeBranch?.id) {
        params.branchId = activeBranch._id || activeBranch.id;
      }
      const response = await axios.get(`${API_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      const pending = response.data.orders.filter(
        (o: Order) => !EXCLUDED_STATUSES.includes(o.status)
      );
      setOrders(pending);
    } catch (err: any) {
      console.error('Fetch orders error:', err.response?.data || err.message);
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

      // Initial data load
      fetchOrders();

      // Connect + join branch room
      const socket = connectPickerSocket(branchId);

      // ── Handle real-time order updates ─────────────────────────────────────
      const handleOrderUpdated = ({ order, status }: { order: Order; status: string }) => {
        console.log(`[Socket] order:updated — ${order.orderNumber} → ${status}`);

        setOrders(prev => {
          // If the order should now be excluded (delivered, etc.), remove it
          if (EXCLUDED_STATUSES.includes(status)) {
            return prev.filter(o => o._id !== order._id);
          }

          // If the order is already in the list, update it
          const exists = prev.find(o => o._id === order._id);
          if (exists) {
            return prev.map(o => o._id === order._id ? { ...o, ...order } : o);
          }

          // Brand-new order — prepend to list
          return [order, ...prev];
        });
      };

      socket.on('order:updated', handleOrderUpdated);

      // On reconnect, re-fetch in case we missed events while offline
      const handleReconnect = () => {
        console.log('[Socket] Reconnected — refreshing orders');
        fetchOrders(true);
      };
      socket.on('connect', handleReconnect);

      return () => {
        socket.off('order:updated', handleOrderUpdated);
        socket.off('connect', handleReconnect);
      };
    }, [activeBranch?._id, fetchOrders])
  );

  const onRefresh = () => { setRefreshing(true); fetchOrders(); };

  const renderOrder = ({ item }: { item: Order }) => {
    const itemCount = item.items?.length || 0;
    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => navigation.navigate('Picking', { orderId: item._id })}
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
            <Text style={styles.infoText}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Clock size={16} color="#666" />
            <Text style={styles.infoText}>{new Date(item.createdAt).toLocaleString()}</Text>
          </View>
        </View>
        <View style={styles.orderFooter}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {item.status === 'picking' ? 'Being Picked' : 'Ready to Pick'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#FF6B35" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>Loading orders…</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Orders to Pick</Text>
          <Text style={styles.headerSubtitle}>
            {orders.length} {orders.length === 1 ? 'order' : 'orders'}
            {activeBranch ? ` · ${activeBranch.name}` : ''}
          </Text>
        </View>
        {/* Live indicator */}
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Orders</Text>
          <Text style={styles.emptyText}>New orders will appear here instantly.</Text>
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },

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

  orderCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 2, borderColor: '#e5e5e5',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderNumber: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  orderTotal:  { fontSize: 18, fontWeight: 'bold', color: '#FF6B35' },
  orderInfo:   { gap: 8, marginBottom: 12 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText:    { fontSize: 14, color: '#666', flex: 1 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e5e5e5', paddingTop: 12 },
  statusBadge:     { backgroundColor: '#FFF3E0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  statusBadgeText: { color: '#FF9800', fontSize: 12, fontWeight: 'bold' },

  emptyState:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle:      { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginTop: 16 },
  emptyText:       { fontSize: 16, color: '#666', marginTop: 8, textAlign: 'center' },
  refreshButton:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderWidth: 2, borderColor: '#FF6B35' },
  refreshButtonText: { color: '#FF6B35', fontSize: 16, fontWeight: '600' },
});
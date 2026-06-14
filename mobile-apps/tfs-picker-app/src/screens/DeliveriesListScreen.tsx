// src/screens/DeliveriesListScreen.tsx
import React, { useState, useCallback } from 'react';
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

const API_URL = 'https://tfs-wholesalers-ifad.onrender.com';

const DELIVERY_STATUSES = ['collecting', 'ready_for_delivery', 'out_for_delivery'];

const STATUS_LABELS: Record<string, string> = {
  collecting:         'Collecting packages',
  ready_for_delivery: 'Ready to go',
  out_for_delivery:   'Out for delivery',
};

interface Order {
  _id: string; orderNumber: string;
  customerInfo?: { name: string; phone?: string };
  shippingAddress?: { streetAddress?: string; suburb?: string; city?: string; province?: string; address?: string; lat?: number; lng?: number };
  deliveryAddress?: string;
  items: any[]; total: number; status: string;
  packages?: any[]; createdAt: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
}

type TabKey = 'available' | 'mine';

function getAddressSnippet(order: Order): string | null {
  const sa = order.shippingAddress;
  if (sa) {
    if (typeof (sa as any).address === 'string' && (sa as any).address) return (sa as any).address;
    const parts = [sa.streetAddress, sa.suburb, sa.city].filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  if (typeof order.deliveryAddress === 'string' && order.deliveryAddress) return order.deliveryAddress;
  return null;
}

export default function DeliveriesListScreen({ navigation }: any) {
  const { token, activeBranch, user } = useAuthStore();

  const [allOrders, setAllOrders]   = useState<Order[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab]   = useState<TabKey>('available');

  const fetchDeliveries = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params: any = { all: true };
      if (activeBranch?._id || activeBranch?.id)
        params.branchId = activeBranch._id || activeBranch.id;
      const response = await axios.get(`${API_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      const deliveryOrders = response.data.orders.filter((o: Order) =>
        DELIVERY_STATUSES.includes(o.status)
      );
      setAllOrders(deliveryOrders);
    } catch (err: any) {
      console.error('Fetch deliveries error:', err.response?.data || err.message);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, [activeBranch?._id, token]);

  useFocusEffect(
    useCallback(() => {
      const branchId = activeBranch?._id || activeBranch?.id;
      if (!branchId) return;

      fetchDeliveries();

      let socket: any = null;

      // connectPickerSocket is now async — reads JWT from AsyncStorage
      connectPickerSocket(branchId).then((s) => {
        socket = s;

        const handleOrderUpdated = ({ order, status }: { order: Order; status: string }) => {
          setAllOrders(prev => {
            if (!DELIVERY_STATUSES.includes(status)) return prev.filter(o => o._id !== order._id);
            const exists = prev.find(o => o._id === order._id);
            if (exists) return prev.map(o => o._id === order._id ? { ...o, ...order } : o);
            return [order, ...prev];
          });
        };

        const handleReconnect = () => fetchDeliveries(true);

        socket.on('order:updated', handleOrderUpdated);
        socket.on('connect', handleReconnect);
      });

      return () => {
        if (socket) {
          socket.off('order:updated');
          socket.off('connect');
        }
      };
    }, [activeBranch?._id, fetchDeliveries])
  );

  const onRefresh = () => { setRefreshing(true); fetchDeliveries(); };

  const myOrders        = allOrders.filter(o => o.assignedDriverId === user?.id);
  const availableOrders = allOrders.filter(o => !o.assignedDriverId);
  const displayOrders   = activeTab === 'mine' ? myOrders : availableOrders;

  const readyToDeliverCount = myOrders.filter(
    o => o.status === 'collecting' || o.status === 'ready_for_delivery'
  ).length;

  const renderOrder = ({ item }: { item: Order }) => {
    const addressLine  = getAddressSnippet(item);
    const packageCount = item.packages?.length || 0;
    const isMine       = item.assignedDriverId === user?.id;
    const statusLabel  = STATUS_LABELS[item.status] || item.status;

    const handleStartDelivery = () => {
      if (item.status === 'collecting' || item.status === 'ready_for_delivery') {
        navigation.navigate('DeliveryCollection', { orderId: item._id });
      } else {
        navigation.navigate('DeliveryDetail', { orderId: item._id });
      }
    };

    const handleTakeDelivery = () => {
      navigation.navigate('DeliveryCollection', { orderId: item._id, claiming: true });
    };

    const handleViewDetail = () => {
      navigation.navigate('DeliveryDetail', { orderId: item._id });
    };

    return (
      <TouchableOpacity
        style={[styles.card, isMine && styles.cardMine]}
        onPress={isMine ? handleStartDelivery : handleViewDetail}
        activeOpacity={0.75}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber}>{item.orderNumber}</Text>
          {isMine && (
            <Text style={styles.myStatusText}>{statusLabel}</Text>
          )}
        </View>

        <View style={styles.cardBody}>
          {item.customerInfo?.name && (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={15} color="#6b7280" />
              <Text style={styles.infoText} numberOfLines={1}>{item.customerInfo.name}</Text>
              {item.customerInfo.phone && (
                <Text style={styles.phoneText}>{item.customerInfo.phone}</Text>
              )}
            </View>
          )}

          {addressLine ? (
            <View style={styles.infoRow}>
              <MapPin size={15} color="#FF6B35" />
              <Text style={styles.addressText} numberOfLines={2}>{addressLine}</Text>
            </View>
          ) : (
            <View style={styles.infoRow}>
              <MapPin size={15} color="#d1d5db" />
              <Text style={styles.noAddressText}>No address on file</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Package size={15} color="#6b7280" />
            <Text style={styles.infoText}>
              {packageCount > 0
                ? `${packageCount} package${packageCount !== 1 ? 's' : ''}`
                : `${item.items?.length || 0} items`}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Clock size={15} color="#6b7280" />
            <Text style={styles.infoText}>{new Date(item.createdAt).toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.total}>R{item.total.toFixed(2)}</Text>

          {isMine ? (
            <TouchableOpacity style={styles.actionBtn} onPress={handleStartDelivery}>
              <Truck size={15} color="#fff" />
              <Text style={styles.actionBtnText}>
                {item.status === 'out_for_delivery' ? 'Continue Delivery' : 'Continue Collection'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.btnGroup}>
              <TouchableOpacity style={styles.viewBtn} onPress={handleViewDetail}>
                <Ionicons name="eye-outline" size={15} color="#FF6B35" />
                <Text style={styles.viewBtnText}>Details</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.claimBtn} onPress={handleTakeDelivery}>
                <Truck size={15} color="#fff" />
                <Text style={styles.claimBtnText}>Take Delivery</Text>
              </TouchableOpacity>
            </View>
          )}
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
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Deliveries</Text>
          <Text style={styles.headerSubtitle}>{activeBranch?.name || ''}</Text>
          {readyToDeliverCount > 0 && (
            <View style={styles.poolBanner}>
              <Package size={13} color="#92400e" />
              <Text style={styles.poolBannerText}>
                {readyToDeliverCount} order{readyToDeliverCount !== 1 ? 's' : ''} collected — pool more or start your run
              </Text>
            </View>
          )}
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['available', 'mine'] as TabKey[]).map(tab => {
          const count    = tab === 'available' ? availableOrders.length : myOrders.length;
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab === 'available' ? 'Available' : 'My Deliveries'}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {displayOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <Truck size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>
            {activeTab === 'mine' ? 'No Active Deliveries' : 'No Available Deliveries'}
          </Text>
          <Text style={styles.emptyText}>
            {activeTab === 'mine'
              ? 'Take a delivery from the Available tab to get started.'
              : 'Orders ready for collection will appear here instantly.'}
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={20} color="#FF6B35" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayOrders}
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
  container:   { flex: 1, backgroundColor: '#f5f5f5' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  header: {
    backgroundColor: '#fff', padding: 20, paddingTop: 60,
    borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  headerLeft:     { flex: 1, marginRight: 12 },
  headerTitle:    { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  poolBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, backgroundColor: '#fef3c7',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  poolBannerText: { fontSize: 12, fontWeight: '600', color: '#92400e', flexShrink: 1 },
  liveIndicator:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff3e0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 4 },
  liveDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  liveText:       { fontSize: 12, fontWeight: '800', color: '#FF6B35' },
  tabs:               { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  tab:                { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive:          { borderBottomColor: '#FF6B35' },
  tabText:            { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  tabTextActive:      { color: '#FF6B35' },
  tabBadge:           { backgroundColor: '#e5e7eb', borderRadius: 10, minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' },
  tabBadgeActive:     { backgroundColor: '#fff3e0' },
  tabBadgeText:       { fontSize: 11, fontWeight: '800', color: '#6b7280' },
  tabBadgeTextActive: { color: '#FF6B35' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  cardMine: { borderLeftWidth: 4, borderLeftColor: '#10b981' },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderNumber:  { fontSize: 17, fontWeight: 'bold', color: '#1a1a1a' },
  myStatusText: { fontSize: 12, color: '#10b981', fontWeight: '600' },
  cardBody:      { gap: 7, marginBottom: 14 },
  infoRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  infoText:      { fontSize: 13, color: '#6b7280', flex: 1 },
  phoneText:     { fontSize: 13, color: '#FF6B35', fontWeight: '600' },
  addressText:   { fontSize: 13, color: '#374151', fontWeight: '500', flex: 1, lineHeight: 18 },
  noAddressText: { fontSize: 13, color: '#d1d5db', fontStyle: 'italic' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12,
  },
  total: { fontSize: 17, fontWeight: 'bold', color: '#FF6B35' },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B981', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnGroup:     { flexDirection: 'row', gap: 8 },
  viewBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: '#FF6B35', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  viewBtnText:  { color: '#FF6B35', fontSize: 13, fontWeight: '700' },
  claimBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF6B35', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  claimBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyState:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle:        { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginTop: 16 },
  emptyText:         { fontSize: 16, color: '#666', marginTop: 8, textAlign: 'center' },
  refreshButton:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderWidth: 2, borderColor: '#FF6B35' },
  refreshButtonText: { color: '#FF6B35', fontSize: 16, fontWeight: '600' },
});

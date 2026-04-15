import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  User, Package, MapPin, Settings, LogOut, ChevronRight,
  ShoppingBag, Clock, TrendingUp, Tag, Heart, Mail, Phone, Trash2,
} from 'lucide-react-native';
import { useStore } from '@/lib/store';
import api from '@/lib/api';

interface Order {
  _id: string; orderNumber: string; items: any[];
  total: number; status: string; paymentStatus: string; createdAt: string;
}

function getStatusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case 'pending':
    case 'payment_pending':  return { bg: '#fef3c7', text: '#92400e' };
    case 'confirmed':        return { bg: '#dbeafe', text: '#1e40af' };
    case 'preparing':
    case 'picking':          return { bg: '#ede9fe', text: '#5b21b6' };
    case 'ready':
    case 'out-for-delivery':
    case 'delivered':        return { bg: '#d1fae5', text: '#065f46' };
    case 'cancelled':        return { bg: '#fee2e2', text: '#991b1b' };
    default:                 return { bg: '#f3f4f6', text: '#6b7280' };
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'payment_pending':  return 'Awaiting Payment';
    case 'out-for-delivery': return 'Out for Delivery';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function StatCard({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, accent && styles.statIconWrapAccent]}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NavRow({ icon, label, onPress, danger = false, subtitle }: {
  icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean; subtitle?: string;
}) {
  return (
    <TouchableOpacity style={[styles.navRow, danger && styles.navRowDanger]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.navIconWrap, danger && styles.navIconWrapDanger]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.navLabel, danger && styles.navLabelDanger]}>{label}</Text>
        {subtitle ? <Text style={styles.navSubtitle}>{subtitle}</Text> : null}
      </View>
      {!danger && <ChevronRight color="#d1d5db" size={18} />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useStore();

  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats,   setStats]   = useState({ totalOrders: 0, pendingOrders: 0, totalSpent: 0 });
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) fetchOrders();
      else setLoading(false);
    }, [user?.id])
  );

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/orders?userId=${user?.id}`);
      const all: Order[] = res.data.orders || [];
      setOrders(all.slice(0, 3));
      setStats({
        totalOrders:   all.length,
        pendingOrders: all.filter(o => ['pending','payment_pending','confirmed','preparing','picking'].includes(o.status)).length,
        totalSpent:    all.reduce((s, o) => s + (o.total || 0), 0),
      });
    } catch (err) {
      console.error('[Profile] fetchOrders error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await logout();
        router.replace('/branch-select');
      }},
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            // Second confirmation — irreversible action
            Alert.alert(
              'Are you absolutely sure?',
              `Your account (${user?.email}) will be permanently deleted.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete It',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setDeleting(true);
                      await api.delete(`/api/users/${user?.id}`);
                      await logout();
                      router.replace('/branch-select');
                    } catch (err: any) {
                      setDeleting(false);
                      Alert.alert(
                        'Delete Failed',
                        err.response?.data?.error || 'Could not delete account. Please contact support.',
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // ── Not signed in ──────────────────────────────────────────────────────────

  if (!user) {
    return (
      <View style={styles.guestContainer}>
        <View style={styles.guestIconWrap}><User color="#FF6B35" size={40} /></View>
        <Text style={styles.guestTitle}>You're not signed in</Text>
        <Text style={styles.guestSub}>Sign in to view your profile, track orders and manage your account.</Text>
        <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/login')}>
          <Text style={styles.signInBtnText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.registerBtn} onPress={() => router.push('/register')}>
          <Text style={styles.registerBtnText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initial = user.name.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </View>
          <Text style={styles.heroName}>{user.name}</Text>
          <View style={styles.heroMetaRow}>
            <Mail color="#FF6B35" size={13} />
            <Text style={styles.heroMeta}>{user.email}</Text>
          </View>
          {user.phone ? (
            <View style={styles.heroMetaRow}>
              <Phone color="#FF6B35" size={13} />
              <Text style={styles.heroMeta}>{user.phone}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats */}
        {loading ? (
          <View style={styles.statsLoading}><ActivityIndicator color="#FF6B35" /></View>
        ) : (
          <View style={styles.statsRow}>
            <StatCard icon={<ShoppingBag color="#3b82f6" size={20} />} label="Orders"  value={String(stats.totalOrders)} />
            <StatCard icon={<Clock color="#f59e0b" size={20} />}        label="Active"  value={String(stats.pendingOrders)} />
            <StatCard icon={<TrendingUp color="#10b981" size={20} />}   label="Spent"   value={`R${stats.totalSpent.toFixed(0)}`} accent />
          </View>
        )}

        {/* Recent Orders */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity onPress={() => router.push('/orders')}>
              <Text style={styles.sectionLink}>View All</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color="#FF6B35" style={{ paddingVertical: 24 }} />
          ) : orders.length === 0 ? (
            <View style={styles.emptyOrders}>
              <Package color="#d1d5db" size={40} />
              <Text style={styles.emptyOrdersText}>No orders yet</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)')}>
                <Text style={styles.emptyOrdersLink}>Start shopping →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            orders.map((order) => {
              const sc = getStatusColor(order.status);
              return (
                <TouchableOpacity key={order._id} style={styles.orderRow} onPress={() => router.push('/orders')} activeOpacity={0.75}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.orderTopRow}>
                      <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusText, { color: sc.text }]}>{getStatusLabel(order.status)}</Text>
                      </View>
                    </View>
                    <View style={styles.orderBottomRow}>
                      <Text style={styles.orderMeta}>
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''} · {new Date(order.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                      <Text style={styles.orderTotal}>R{(order.total || 0).toFixed(2)}</Text>
                    </View>
                  </View>
                  <ChevronRight color="#d1d5db" size={16} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Account nav */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account</Text>
          <NavRow icon={<Package color="#3b82f6" size={20} />}  label="My Orders"        subtitle="Track and view all your orders"  onPress={() => router.push('/orders')} />
          <NavRow icon={<Heart color="#ef4444" size={20} />}    label="Wishlist"          subtitle="Your saved items"                onPress={() => router.push('/wishlist')} />
          <NavRow icon={<Tag color="#8b5cf6" size={20} />}      label="Specials & Deals"  subtitle="Browse current promotions"      onPress={() => router.push('/(tabs)/shop')} />
          <NavRow icon={<Settings color="#6b7280" size={20} />} label="Account Settings"  subtitle="Update your profile details"    onPress={() => router.push('/login')} />
        </View>

        {/* Support */}
        <View style={[styles.sectionCard, styles.supportCard]}>
          <Text style={styles.supportTitle}>Need Help?</Text>
          <Text style={styles.supportSub}>Our team is ready to assist you with any questions or concerns.</Text>
          <View style={styles.supportRow}>
            <TouchableOpacity style={styles.supportBtn}>
              <Mail color="#FF6B35" size={16} />
              <Text style={styles.supportBtnText}>Email Us</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.supportBtn}>
              <Phone color="#FF6B35" size={16} />
              <Text style={styles.supportBtnText}>Call Us</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign out + Delete account */}
        <View style={styles.sectionCard}>
          <NavRow icon={<LogOut color="#ef4444" size={20} />} label="Sign Out" onPress={handleLogout} danger />
        </View>

        <TouchableOpacity
          style={[styles.deleteBtn, deleting && { opacity: 0.5 }]}
          onPress={handleDeleteAccount}
          disabled={deleting}
        >
          {deleting
            ? <ActivityIndicator color="#ef4444" size="small" />
            : <Trash2 color="#ef4444" size={16} />
          }
          <Text style={styles.deleteBtnText}>{deleting ? 'Deleting account…' : 'Delete Account'}</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f9fafb' },
  scroll:       { padding: 16, paddingTop: Platform.OS === 'ios' ? 60 : 24 },
  guestContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f9fafb' },
  guestIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff7f3', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#fed7aa' },
  guestTitle:   { fontSize: 22, fontWeight: '800', color: '#1f2937', marginBottom: 8 },
  guestSub:     { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  signInBtn:    { backgroundColor: '#FF6B35', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, width: '100%', alignItems: 'center', marginBottom: 12 },
  signInBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  registerBtn:  { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, width: '100%', alignItems: 'center', borderWidth: 1.5, borderColor: '#e5e7eb' },
  registerBtnText: { color: '#374151', fontWeight: '700', fontSize: 16 },
  heroCard:     { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  avatarWrap:   { marginBottom: 14 },
  avatar:       { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FF6B35', alignItems: 'center', justifyContent: 'center', shadowColor: '#FF6B35', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  avatarText:   { color: '#fff', fontSize: 30, fontWeight: '800' },
  heroName:     { fontSize: 20, fontWeight: '800', color: '#1f2937', marginBottom: 6 },
  heroMetaRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  heroMeta:     { fontSize: 13, color: '#6b7280' },
  statsLoading: { paddingVertical: 20, alignItems: 'center' },
  statsRow:     { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard:     { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  statIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  statIconWrapAccent: { backgroundColor: '#f0fdf4' },
  statValue:    { fontSize: 18, fontWeight: '800', color: '#1f2937' },
  statLabel:    { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  sectionCard:  { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  sectionLink:  { fontSize: 13, color: '#FF6B35', fontWeight: '600' },
  emptyOrders:  { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyOrdersText: { fontSize: 14, color: '#9ca3af' },
  emptyOrdersLink: { fontSize: 13, color: '#FF6B35', fontWeight: '600' },
  orderRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  orderTopRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  orderNumber:  { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  statusBadge:  { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:   { fontSize: 11, fontWeight: '700' },
  orderBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderMeta:    { fontSize: 12, color: '#9ca3af' },
  orderTotal:   { fontSize: 14, fontWeight: '700', color: '#FF6B35' },
  navRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  navRowDanger: { borderBottomWidth: 0 },
  navIconWrap:  { width: 38, height: 38, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  navIconWrapDanger: { backgroundColor: '#fee2e2' },
  navLabel:     { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  navLabelDanger: { color: '#ef4444' },
  navSubtitle:  { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  supportCard:  { backgroundColor: '#fff7f3', borderWidth: 1, borderColor: '#fed7aa' },
  supportTitle: { fontSize: 16, fontWeight: '800', color: '#1f2937', marginBottom: 6 },
  supportSub:   { fontSize: 13, color: '#6b7280', lineHeight: 20, marginBottom: 14 },
  supportRow:   { flexDirection: 'row', gap: 12 },
  supportBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#fed7aa' },
  supportBtnText: { fontSize: 14, fontWeight: '600', color: '#FF6B35' },

  // Delete account — subtle, at the very bottom, clearly destructive
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: 8, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#fecaca',
    backgroundColor: '#fff',
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
});
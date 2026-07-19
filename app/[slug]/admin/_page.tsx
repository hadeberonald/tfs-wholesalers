'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Package, Users, ShoppingBag, DollarSign, TrendingUp, TrendingDown,
  Clock, CheckCircle, XCircle, Truck, ArrowRight, AlertTriangle,
  FileText, ClipboardCheck, Tag, Gift, BarChart2, ShieldCheck,
} from 'lucide-react';
import { useBranch } from '@/lib/branch-context';
import { useAuth } from '@/lib/auth-context';
import BusinessIntelligenceSection from './BusinessIntelligenceSection';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  totalCustomers: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  outForDelivery: number;
  revenueGrowth: number;
  ordersGrowth: number;
  purchaseOrders?: {
    total: number;
    pendingApproval: number;
    confirmed: number;
    sent: number;
    awaitingReceiving: number;
    totalValue: number;
    recentActivity: number;
  };
  inventory?: {
    lowStockCount: number;
    pendingStockTakes: number;
    overdueStockTakes: number;
    completedStockTakes: number;
  };
  resolutions?: {
    open: number;
    highPriority: number;
  };
  specials?: { active: number; total: number };
  combos?: { active: number; total: number };
  nps?: { averageScore: number; totalResponses: number };
}
interface RecentOrder {
  _id: string;
  orderNumber: string;
  customerInfo: { name: string; email: string };
  total: number;
  status: string;
  createdAt: string;
}
interface OrderResolution {
  _id: string;
  orderNumber: string;
  type: string;
  description: string;
  priority: string;
  createdAt: string;
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-ZA', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
const getStatusColor = (status: string) => {
  switch ((status || '').toLowerCase()) {
    case 'completed': case 'delivered': return 'bg-green-100 text-green-800';
    case 'pending':                      return 'bg-yellow-100 text-yellow-800';
    case 'processing': case 'out for delivery': return 'bg-blue-100 text-blue-800';
    case 'cancelled':                    return 'bg-red-100 text-red-800';
    default:                             return 'bg-gray-100 text-gray-800';
  }
};
const getPriorityColor = (priority: string) => ({
  high:   'bg-red-100 text-red-800',
  medium: 'bg-orange-100 text-orange-800',
  low:    'bg-yellow-100 text-yellow-800',
}[priority] ?? 'bg-gray-100 text-gray-800');
// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const params = useParams();
  const slug = params.slug as string;
  const { branch, loading: branchLoading } = useBranch();
  const { user, can } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0, totalRevenue: 0, totalProducts: 0, totalCustomers: 0,
    pendingOrders: 0, completedOrders: 0, cancelledOrders: 0, outForDelivery: 0,
    revenueGrowth: 0, ordersGrowth: 0,
  });
  const [recentOrders, setRecentOrders]       = useState<RecentOrder[]>([]);
  const [openResolutions, setOpenResolutions] = useState<OrderResolution[]>([]);
  const [loading, setLoading]                 = useState(true);
  // Derive what this user can see once auth is ready
  const isSuperAdmin  = user?.role === 'super-admin';
  const isFullAccess  = isSuperAdmin || (user?.permissions ?? []).length > 10;
  const canOrders     = can('orders:read');
  const canProducts   = can('products:read');
  const canRevenue    = can('revenue:read');
  const canResolutions = can('resolutions:read');
  const canPurchaseOrders = can('purchase-orders:read');
  const canStockTakes = can('stock-takes:read');
  const canSpecials   = can('specials:read');
  const canCombos     = can('combos:read');
  const canNps        = can('nps:read');
  const canCustomers  = can('wholesale-customers:read');
  // Business Intelligence — gated on its own permission (Full Access Admin
  // role + super-admin), independent of the isFullAccess heuristic above.
  const canAnalytics  = can('analytics:read');
  useEffect(() => {
    if (!branchLoading && branch && user) {
      fetchDashboardData();
    }
  }, [branchLoading, branch, user]);
  const fetchDashboardData = async () => {
    try {
      const fetches: Promise<any>[] = [];
      // Always fetch stats — the API returns only what the user can access
      fetches.push(
        fetch('/api/admin/stats').then(r => r.ok ? r.json() : null)
      );
      if (canOrders) {
        fetches.push(
          fetch('/api/orders?all=true').then(r => r.ok ? r.json() : null)
        );
      } else {
        fetches.push(Promise.resolve(null));
      }
      if (canResolutions) {
        fetches.push(
          fetch('/api/order-resolutions?status=open').then(r => r.ok ? r.json() : null)
        );
      } else {
        fetches.push(Promise.resolve(null));
      }
      const [statsData, ordersData, resData] = await Promise.all(fetches);
      if (statsData?.stats) setStats(statsData.stats);
      if (ordersData?.orders) setRecentOrders(ordersData.orders.slice(0, 5));
      if (resData?.resolutions) setOpenResolutions(resData.resolutions);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  if (branchLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange" />
      </div>
    );
  }
  if (!branch) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Branch Not Found</h1>
          <p className="text-gray-600">The requested branch could not be found.</p>
        </div>
      </div>
    );
  }
  // ── Role name for greeting ────────────────────────────────────────────────
  const roleName = isSuperAdmin ? 'Super Admin' : (user?.adminRoleName ?? 'Admin');
  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-brand-black mb-1">
            Welcome, {user?.name?.split(' ')[0]}
          </h1>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full border border-orange-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              {roleName}
            </span>
            <p className="text-gray-500 text-sm">{branch.displayName}</p>
          </div>
        </div>

        {/* ── Business Intelligence — full-access admins & super-admins only ── */}
        {(isSuperAdmin || canAnalytics) && <BusinessIntelligenceSection />}

        {/* ── Alert cards — only shown if user has relevant permissions ── */}
        <div className="space-y-4 mb-8">
          {canResolutions && stats.resolutions && stats.resolutions.open > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <div>
                    <h3 className="text-lg font-bold text-red-900">
                      {stats.resolutions.open} Order Resolution{stats.resolutions.open !== 1 ? 's' : ''} Required
                    </h3>
                    {stats.resolutions.highPriority > 0 && (
                      <p className="text-sm text-red-700">
                        {stats.resolutions.highPriority} high priority
                      </p>
                    )}
                  </div>
                </div>
                <Link href={`/${slug}/admin/resolutions`} className="text-red-600 hover:text-red-700 text-sm font-medium">
                  View All →
                </Link>
              </div>
              {openResolutions.length > 0 && (
                <div className="space-y-2">
                  {openResolutions.slice(0, 3).map((res) => (
                    <div key={res._id} className="bg-white p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-gray-900">{res.orderNumber}</p>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(res.priority)}`}>
                          {res.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{res.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(res.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {canProducts && stats.inventory && stats.inventory.lowStockCount > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Package className="w-6 h-6 text-orange-600" />
                  <div>
                    <h3 className="text-lg font-bold text-orange-900">
                      {stats.inventory.lowStockCount} Product{stats.inventory.lowStockCount !== 1 ? 's' : ''} Low on Stock
                    </h3>
                    <p className="text-sm text-orange-700">These products need reordering</p>
                  </div>
                </div>
                <Link href={`/${slug}/admin/products?filter=low-stock`} className="text-orange-600 hover:text-orange-700 text-sm font-medium">
                  Review →
                </Link>
              </div>
            </div>
          )}
          {canStockTakes && stats.inventory && stats.inventory.overdueStockTakes > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ClipboardCheck className="w-6 h-6 text-yellow-600" />
                  <div>
                    <h3 className="text-lg font-bold text-yellow-900">
                      {stats.inventory.overdueStockTakes} Overdue Stock Take{stats.inventory.overdueStockTakes !== 1 ? 's' : ''}
                    </h3>
                    <p className="text-sm text-yellow-700">Inventory counts are past their scheduled date</p>
                  </div>
                </div>
                <Link href={`/${slug}/admin/stock-takes?filter=overdue`} className="text-yellow-600 hover:text-yellow-700 text-sm font-medium">
                  Complete →
                </Link>
              </div>
            </div>
          )}
          {canPurchaseOrders && stats.purchaseOrders && stats.purchaseOrders.pendingApproval > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-bold text-blue-900">
                      {stats.purchaseOrders.pendingApproval} Purchase Order{stats.purchaseOrders.pendingApproval !== 1 ? 's' : ''} Awaiting Approval
                    </h3>
                    <p className="text-sm text-blue-700">Review and confirm purchase orders</p>
                  </div>
                </div>
                <Link href={`/${slug}/admin/purchase-orders?status=pending_approval`} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Review →
                </Link>
              </div>
            </div>
          )}
        </div>
        {/* ── Full-access stats grid (revenue, orders, products, customers) ── */}
        {isFullAccess && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {canRevenue && (
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 shadow-lg text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl"><DollarSign className="w-6 h-6" /></div>
                  {stats.revenueGrowth !== 0 && (
                    <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-full">
                      {stats.revenueGrowth > 0
                        ? <TrendingUp className="w-4 h-4" />
                        : <TrendingDown className="w-4 h-4" />}
                      <span className="text-xs font-bold">{stats.revenueGrowth > 0 ? '+' : ''}{stats.revenueGrowth}%</span>
                    </div>
                  )}
                </div>
                <p className="text-white/80 text-sm mb-1">Total Revenue</p>
                <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-white/60 text-xs mt-2">All time</p>
              </div>
            )}
            {canOrders && (
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 shadow-lg text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl"><ShoppingBag className="w-6 h-6" /></div>
                  {stats.ordersGrowth > 0 && (
                    <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-full">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-bold">+{stats.ordersGrowth}%</span>
                    </div>
                  )}
                </div>
                <p className="text-white/80 text-sm mb-1">Total Orders</p>
                <p className="text-3xl font-bold">{stats.totalOrders}</p>
                <p className="text-white/60 text-xs mt-2">All time</p>
              </div>
            )}
            {canProducts && (
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 shadow-lg text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl"><Package className="w-6 h-6" /></div>
                </div>
                <p className="text-white/80 text-sm mb-1">Products</p>
                <p className="text-3xl font-bold">{stats.totalProducts}</p>
                <p className="text-white/60 text-xs mt-2">In catalog</p>
              </div>
            )}
            {canCustomers && (
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 shadow-lg text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl"><Users className="w-6 h-6" /></div>
                </div>
                <p className="text-white/80 text-sm mb-1">Customers</p>
                <p className="text-3xl font-bold">{stats.totalCustomers}</p>
                <p className="text-white/60 text-xs mt-2">Registered</p>
              </div>
            )}
          </div>
        )}
        {/* ── Order status row — only if user can see orders ── */}
        {canOrders && isFullAccess && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Pending',          value: stats.pendingOrders,   color: 'border-yellow-500', Icon: Clock },
              { label: 'Out for Delivery', value: stats.outForDelivery,  color: 'border-blue-500',   Icon: Truck },
              { label: 'Completed',        value: stats.completedOrders, color: 'border-green-500',  Icon: CheckCircle },
              { label: 'Cancelled',        value: stats.cancelledOrders, color: 'border-red-500',    Icon: XCircle },
            ].map(({ label, value, color, Icon }) => (
              <div key={label} className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${color}`}>
                <div className="flex items-center space-x-3 mb-2">
                  <Icon className="w-5 h-5 text-gray-500" />
                  <p className="text-sm text-gray-600 font-medium">{label}</p>
                </div>
                <p className="text-2xl font-bold text-brand-black">{value}</p>
              </div>
            ))}
          </div>
        )}
        {/* ── Quick access — shows only pages this role can reach ── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
          <h2 className="text-xl font-bold text-brand-black mb-4">Quick Access</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {canOrders && (
              <Link href={`/${slug}/admin/orders`} className="p-4 bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-xl transition-all">
                <ShoppingBag className="w-7 h-7 text-green-600 mb-2" />
                <p className="font-semibold text-brand-black text-sm">Orders</p>
              </Link>
            )}
            {canProducts && (
              <Link href={`/${slug}/admin/products`} className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl transition-all">
                <Package className="w-7 h-7 text-blue-600 mb-2" />
                <p className="font-semibold text-brand-black text-sm">Products</p>
              </Link>
            )}
            {canPurchaseOrders && (
              <Link href={`/${slug}/admin/purchase-orders`} className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl transition-all">
                <FileText className="w-7 h-7 text-purple-600 mb-2" />
                <p className="font-semibold text-brand-black text-sm">Purchase Orders</p>
              </Link>
            )}
            {canStockTakes && (
              <Link href={`/${slug}/admin/stock-takes`} className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-xl transition-all">
                <ClipboardCheck className="w-7 h-7 text-orange-600 mb-2" />
                <p className="font-semibold text-brand-black text-sm">Stock Takes</p>
              </Link>
            )}
            {canSpecials && (
              <Link href={`/${slug}/admin/specials`} className="p-4 bg-gradient-to-br from-pink-50 to-pink-100 hover:from-pink-100 hover:to-pink-200 rounded-xl transition-all">
                <Tag className="w-7 h-7 text-pink-600 mb-2" />
                <p className="font-semibold text-brand-black text-sm">Specials</p>
              </Link>
            )}
            {canCombos && (
              <Link href={`/${slug}/admin/combos`} className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 rounded-xl transition-all">
                <Gift className="w-7 h-7 text-indigo-600 mb-2" />
                <p className="font-semibold text-brand-black text-sm">Combos</p>
              </Link>
            )}
            {canNps && (
              <Link href={`/${slug}/admin/nps`} className="p-4 bg-gradient-to-br from-teal-50 to-teal-100 hover:from-teal-100 hover:to-teal-200 rounded-xl transition-all">
                <BarChart2 className="w-7 h-7 text-teal-600 mb-2" />
                <p className="font-semibold text-brand-black text-sm">NPS</p>
              </Link>
            )}
            {canResolutions && (
              <Link href={`/${slug}/admin/resolutions`} className="p-4 bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 rounded-xl transition-all">
                <AlertTriangle className="w-7 h-7 text-red-600 mb-2" />
                <p className="font-semibold text-brand-black text-sm">Resolutions</p>
              </Link>
            )}
          </div>
          {/* Edge case: user has no permissions at all */}
          {!canOrders && !canProducts && !canSpecials && !canCombos && !canNps && !canResolutions && !canPurchaseOrders && !canStockTakes && (
            <div className="text-center py-8 text-gray-400">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No pages have been assigned to your role yet.</p>
              <p className="text-xs mt-1">Contact your administrator.</p>
            </div>
          )}
        </div>
        {/* ── Recent orders — only if user can see orders ── */}
        {canOrders && recentOrders.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-brand-black">Recent Orders</h2>
              <Link href={`/${slug}/admin/orders`} className="text-brand-orange hover:text-orange-600 text-sm font-medium flex items-center gap-1">
                <span>View All</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order._id} className="p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-brand-black">{order.orderNumber}</p>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(order.status)}`}>
                      {order.status || 'Pending'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{order.customerInfo?.name}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                    <p className="text-sm font-bold text-brand-orange">{formatCurrency(order.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
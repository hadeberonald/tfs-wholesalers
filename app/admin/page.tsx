'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Package, 
  Users, 
  ShoppingBag, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  ArrowRight
} from 'lucide-react';

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
}

interface RecentOrder {
  _id: string;
  orderNumber: string;
  customerInfo: {
    name: string;
    email: string;
  };
  total: number;
  status: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalCustomers: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    outForDelivery: 0,
    revenueGrowth: 0,
    ordersGrowth: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats || stats);
      }

      // Fetch recent orders
      const ordersRes = await fetch('/api/orders?limit=5&sort=-createdAt');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setRecentOrders(ordersData.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-ZA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
      case 'out for delivery':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-brand-black mb-2">Dashboard</h1>
          <p className="text-gray-600">Overview of your wholesale platform</p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          {/* Total Revenue */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 shadow-lg text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              {stats.revenueGrowth > 0 ? (
                <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-full">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-bold">+{stats.revenueGrowth}%</span>
                </div>
              ) : stats.revenueGrowth < 0 ? (
                <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-full">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-xs font-bold">{stats.revenueGrowth}%</span>
                </div>
              ) : null}
            </div>
            <p className="text-white/80 text-sm mb-1">Total Revenue</p>
            <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-white/60 text-xs mt-2">All time</p>
          </div>

          {/* Total Orders */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 shadow-lg text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <ShoppingBag className="w-6 h-6" />
              </div>
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

          {/* Total Products */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 shadow-lg text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Package className="w-6 h-6" />
              </div>
            </div>
            <p className="text-white/80 text-sm mb-1">Products</p>
            <p className="text-3xl font-bold">{stats.totalProducts}</p>
            <p className="text-white/60 text-xs mt-2">In catalog</p>
          </div>

          {/* Total Customers */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 shadow-lg text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <p className="text-white/80 text-sm mb-1">Customers</p>
            <p className="text-3xl font-bold">{stats.totalCustomers}</p>
            <p className="text-white/60 text-xs mt-2">Registered</p>
          </div>
        </div>

        {/* Order Status Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-yellow-500">
            <div className="flex items-center space-x-3 mb-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <p className="text-sm text-gray-600 font-medium">Pending</p>
            </div>
            <p className="text-2xl font-bold text-brand-black">{stats.pendingOrders}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
            <div className="flex items-center space-x-3 mb-2">
              <Truck className="w-5 h-5 text-blue-500" />
              <p className="text-sm text-gray-600 font-medium">Out for Delivery</p>
            </div>
            <p className="text-2xl font-bold text-brand-black">{stats.outForDelivery}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500">
            <div className="flex items-center space-x-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <p className="text-sm text-gray-600 font-medium">Completed</p>
            </div>
            <p className="text-2xl font-bold text-brand-black">{stats.completedOrders}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-500">
            <div className="flex items-center space-x-3 mb-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-gray-600 font-medium">Cancelled</p>
            </div>
            <p className="text-2xl font-bold text-brand-black">{stats.cancelledOrders}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Orders */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-brand-black">Recent Orders</h2>
              <Link href="/admin/orders" className="text-brand-orange hover:text-orange-600 text-sm font-medium flex items-center space-x-1">
                <span>View All</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="space-y-3">
              {recentOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No orders yet</p>
              ) : (
                recentOrders.map((order) => (
                  <Link
                    key={order._id}
                    href={`/admin/orders/${order._id}`}
                    className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-brand-black">{order.orderNumber}</p>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(order.status || 'pending')}`}>
                        {order.status || 'Pending'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{order.customerInfo.name}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                      <p className="text-sm font-bold text-brand-orange">{formatCurrency(order.total)}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-brand-black mb-6">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/admin/products/new" className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl transition-all group">
                <Package className="w-8 h-8 text-blue-600 mb-2" />
                <p className="font-semibold text-brand-black text-sm">Add Product</p>
              </Link>

              <Link href="/admin/orders" className="p-4 bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-xl transition-all group">
                <ShoppingBag className="w-8 h-8 text-green-600 mb-2" />
                <p className="font-semibold text-brand-black text-sm">View Orders</p>
              </Link>

              <Link href="/admin/categories" className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl transition-all group">
                <Package className="w-8 h-8 text-purple-600 mb-2" />
                <p className="font-semibold text-brand-black text-sm">Categories</p>
              </Link>

              <Link href="/admin/settings" className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-xl transition-all group">
                <Users className="w-8 h-8 text-orange-600 mb-2" />
                <p className="font-semibold text-brand-black text-sm">Settings</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
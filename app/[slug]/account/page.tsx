'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  User, 
  Package, 
  CreditCard, 
  MapPin, 
  Settings, 
  LogOut,
  ChevronRight,
  ShoppingBag,
  Clock,
  Loader2
} from 'lucide-react';

interface Order {
  _id: string;
  orderNumber: string;
  items: any[];
  total: number;
  status: string;
  createdAt: string;
}

export default function AccountPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalSpent: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/account');
    } else if (user) {
      fetchAccountData();
    }
  }, [user, authLoading, router]);

  const fetchAccountData = async () => {
    try {
      const res = await fetch(`/api/orders?userId=${user?.id}`);
      if (res.ok) {
        const data = await res.json();
        const orders = data.orders || [];
        
        // Get recent 3 orders
        setRecentOrders(orders.slice(0, 3));
        
        // Calculate stats
        setStats({
          totalOrders: orders.length,
          pendingOrders: orders.filter((o: Order) => o.status === 'pending' || o.status === 'processing').length,
          totalSpent: orders.reduce((sum: number, o: Order) => sum + o.total, 0),
        });
      }
    } catch (error) {
      console.error('Failed to fetch account data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-orange animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-brand-black mb-2">My Account</h1>
          <p className="text-gray-600">Welcome back, {user.name}!</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
              {/* User Info */}
              <div className="text-center pb-6 border-b mb-6">
                <div className="w-20 h-20 bg-brand-orange rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-3xl font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-brand-black mb-1">{user.name}</h2>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>

              {/* Quick Stats */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Orders</p>
                      <p className="font-bold text-brand-black">{stats.totalOrders}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Pending</p>
                      <p className="font-bold text-brand-black">{stats.pendingOrders}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Spent</p>
                      <p className="font-bold text-brand-orange">R{stats.totalSpent.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="space-y-2">
                <Link
                  href="/account/orders"
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <Package className="w-5 h-5 text-gray-600 group-hover:text-brand-orange" />
                    <span className="font-medium text-gray-900">My Orders</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-orange" />
                </Link>

                <Link
                  href="/account/addresses"
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-5 h-5 text-gray-600 group-hover:text-brand-orange" />
                    <span className="font-medium text-gray-900">Addresses</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-orange" />
                </Link>

                <Link
                  href="/account/payment-methods"
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-5 h-5 text-gray-600 group-hover:text-brand-orange" />
                    <span className="font-medium text-gray-900">Payment Methods</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-orange" />
                </Link>

                <Link
                  href="/account/settings"
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <Settings className="w-5 h-5 text-gray-600 group-hover:text-brand-orange" />
                    <span className="font-medium text-gray-900">Account Settings</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-orange" />
                </Link>

                <button
                  onClick={() => logout()}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-red-50 transition-colors group text-left"
                >
                  <div className="flex items-center space-x-3">
                    <LogOut className="w-5 h-5 text-gray-600 group-hover:text-red-600" />
                    <span className="font-medium text-gray-900 group-hover:text-red-600">Logout</span>
                  </div>
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Recent Orders */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-brand-black">Recent Orders</h2>
                <Link href="/account/orders" className="text-brand-orange hover:text-orange-600 font-semibold text-sm flex items-center space-x-1">
                  <span>View All</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {recentOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders yet</h3>
                  <p className="text-gray-600 mb-6">Start shopping to see your orders here</p>
                  <Link href="/products" className="btn-primary inline-block">
                    Browse Products
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div key={order._id} className="border border-gray-200 rounded-xl p-4 hover:border-brand-orange transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-brand-black">{order.orderNumber}</p>
                          <p className="text-sm text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {order.items.slice(0, 3).map((item: any, index: number) => (
                            <div key={index} className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden">
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {order.items.length > 3 && (
                            <div className="text-xs text-gray-600">+{order.items.length - 3} more</div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Total</p>
                          <p className="font-bold text-brand-orange">R{order.total.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Account Settings Card */}
              <Link href="/account/settings" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-brand-orange transition-colors">
                    <User className="w-6 h-6 text-blue-600 group-hover:text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-brand-black">Account Settings</h3>
                    <p className="text-sm text-gray-600">Manage your profile</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Update your name, email, password and notification preferences
                </p>
                <div className="flex items-center text-brand-orange group-hover:text-orange-600 text-sm font-semibold">
                  <span>Manage Settings</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </Link>

              {/* Payment Methods Card */}
              <Link href="/account/payment-methods" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-brand-orange transition-colors">
                    <CreditCard className="w-6 h-6 text-green-600 group-hover:text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-brand-black">Payment Methods</h3>
                    <p className="text-sm text-gray-600">Saved cards</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Save your payment methods for faster checkout
                </p>
                <div className="flex items-center text-brand-orange group-hover:text-orange-600 text-sm font-semibold">
                  <span>Manage Cards</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </Link>
            </div>

            {/* Support Section */}
            <div className="bg-gradient-to-br from-brand-orange to-orange-600 rounded-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-2">Need Help?</h3>
              <p className="mb-6 opacity-90">
                Our customer support team is here to assist you with any questions or concerns.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="mailto:support@tfswholesalers.co.za" className="bg-white text-brand-orange px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors text-center">
                  Email Support
                </a>
                <a href="tel:+27123456789" className="bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/30 transition-colors text-center">
                  Call Us
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
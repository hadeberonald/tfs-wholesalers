'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Users, ShoppingBag, DollarSign, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalCustomers: 0,
  });

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl text-brand-black mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage your wholesale platform</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-gray-600 text-sm mb-1">Total Orders</p>
            <p className="text-3xl font-bold text-brand-black">{stats.totalOrders}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-gray-600 text-sm mb-1">Revenue</p>
            <p className="text-3xl font-bold text-brand-black">R{stats.totalRevenue.toFixed(2)}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-1">Products</p>
            <p className="text-3xl font-bold text-brand-black">{stats.totalProducts}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-xl">
                <Users className="w-6 h-6 text-brand-orange" />
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-1">Customers</p>
            <p className="text-3xl font-bold text-brand-black">{stats.totalCustomers}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/admin/products" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
            <Package className="w-8 h-8 text-brand-orange mb-4" />
            <h3 className="font-semibold text-xl text-brand-black mb-2">Products</h3>
            <p className="text-gray-600">Manage your product catalog</p>
          </Link>

          <Link href="/admin/orders" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
            <ShoppingBag className="w-8 h-8 text-brand-orange mb-4" />
            <h3 className="font-semibold text-xl text-brand-black mb-2">Orders</h3>
            <p className="text-gray-600">View and manage orders</p>
          </Link>

          <Link href="/admin/users" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
            <Users className="w-8 h-8 text-brand-orange mb-4" />
            <h3 className="font-semibold text-xl text-brand-black mb-2">Users</h3>
            <p className="text-gray-600">Manage customers and pickers</p>
          </Link>

          <Link href="/admin/categories" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
            <Package className="w-8 h-8 text-brand-orange mb-4" />
            <h3 className="font-semibold text-xl text-brand-black mb-2">Categories</h3>
            <p className="text-gray-600">Organize your products</p>
          </Link>

          <Link href="/admin/hero-banners" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
            <Package className="w-8 h-8 text-brand-orange mb-4" />
            <h3 className="font-semibold text-xl text-brand-black mb-2">Hero Banners</h3>
            <p className="text-gray-600">Manage homepage banners</p>
          </Link>

          <Link href="/admin/settings" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
            <Package className="w-8 h-8 text-brand-orange mb-4" />
            <h3 className="font-semibold text-xl text-brand-black mb-2">Settings</h3>
            <p className="text-gray-600">Delivery pricing and more</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

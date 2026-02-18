'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Users, 
  FolderTree, 
  Settings, 
  LogOut,
  Menu,
  X,
  ChevronRight,
  Tag,
  Gift,
  FileText,
  ClipboardCheck,
  Truck,
  Store,
  UserCheck,
  BoxIcon
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function AdminHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const slug = useMemo(() => {
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length > 1 && pathParts[1] === 'admin') {
      return pathParts[0];
    }
    return null;
  }, [pathname]);

  const adminNavItems = useMemo(() => {
    const basePrefix = slug ? `/${slug}` : '';
    return [
      { 
        label: 'Main', 
        items: [
          { href: `${basePrefix}/admin`, label: 'Dashboard', icon: LayoutDashboard },
          { href: `${basePrefix}/admin/products`, label: 'Products', icon: Package },
          { href: `${basePrefix}/admin/orders`, label: 'Orders', icon: ShoppingBag },
        ]
      },
      { 
        label: 'Wholesale', 
        items: [
          { href: `${basePrefix}/admin/wholesale/customers`, label: 'W. Customers', icon: UserCheck },
          { href: `${basePrefix}/admin/wholesale/products`, label: 'W. Products', icon: BoxIcon },
          { href: `${basePrefix}/admin/wholesale/orders`, label: 'W. Orders', icon: FileText },
        ]
      },
      { 
        label: 'Inventory', 
        items: [
          { href: `${basePrefix}/admin/purchase-orders`, label: 'POs', icon: FileText },
          { href: `${basePrefix}/admin/suppliers`, label: 'Suppliers', icon: Truck },
          { href: `${basePrefix}/admin/stock-takes`, label: 'Stock', icon: ClipboardCheck },
        ]
      },
      { 
        label: 'Marketing', 
        items: [
          { href: `${basePrefix}/admin/specials`, label: 'Specials', icon: Tag },
          { href: `${basePrefix}/admin/combos`, label: 'Combos', icon: Gift },
        ]
      },
      { 
        label: 'System', 
        items: [
          { href: `${basePrefix}/admin/users`, label: 'Users', icon: Users },
          { href: `${basePrefix}/admin/categories`, label: 'Categories', icon: FolderTree },
          { href: `${basePrefix}/admin/settings`, label: 'Settings', icon: Settings },
        ]
      },
    ];
  }, [slug]);

  const isActive = (href: string) => {
    if (href.endsWith('/admin')) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const storeUrl = slug ? `/${slug}` : '/';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-gray-900 to-gray-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4">
          {/* Top Bar */}
          <div className="flex items-center justify-between h-14 border-b border-white/10">
            {/* Logo & Title */}
            <Link href={`${slug}/admin`} className="flex items-center space-x-2 group">
              <div className="w-8 h-8 flex items-center justify-center">
                <img src="/logo.png" alt="TFS Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-white font-bold text-base">Admin Portal</h1>
                <p className="text-gray-400 text-xs hidden sm:block">TFS Wholesalers</p>
              </div>
            </Link>

            {/* Right Actions */}
            <div className="flex items-center space-x-2">
              {/* User Info - Desktop */}
              <div className="hidden lg:flex items-center space-x-2">
                <div className="text-right">
                  <p className="text-white text-xs font-medium">{user?.name}</p>
                  <p className="text-gray-400 text-[10px]">{user?.email}</p>
                </div>
                <div className="w-8 h-8 bg-brand-orange rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xs">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Back to Store */}
              <Link
                href={storeUrl}
                className="hidden md:flex items-center space-x-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white text-xs"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Store</span>
              </Link>

              {/* Logout */}
              <button
                onClick={logout}
                className="hidden md:flex items-center space-x-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors text-white text-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-white" />
                ) : (
                  <Menu className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Desktop Navigation - Grouped */}
          <nav className="hidden md:block py-2">
            <div className="grid grid-cols-5 gap-3">
              {adminNavItems.map((group, groupIndex) => (
                <div key={groupIndex} className="space-y-1">
                  <p className="text-gray-400 text-[10px] uppercase font-semibold tracking-wider px-2 mb-1">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center space-x-2 px-2 py-1.5 rounded-lg transition-all text-xs ${
                          active
                            ? 'bg-brand-orange text-white shadow-lg'
                            : 'text-gray-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="font-medium truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </nav>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-gray-800 border-t border-white/10 max-h-[calc(100vh-56px)] overflow-y-auto">
            <nav className="max-w-7xl mx-auto px-4 py-4">
              {adminNavItems.map((group, groupIndex) => (
                <div key={groupIndex} className="mb-4">
                  <p className="text-gray-400 text-xs uppercase font-semibold tracking-wider px-2 mb-2">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all ${
                            active
                              ? 'bg-brand-orange text-white'
                              : 'text-gray-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="pt-4 mt-4 border-t border-white/10 space-y-2">
                <Link
                  href={storeUrl}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center space-x-3 px-4 py-2.5 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-all"
                >
                  <Store className="w-5 h-5" />
                  <span className="font-medium">Back to Store</span>
                </Link>
                
                <button
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-white transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>
      
      {/* Spacer to prevent content from going under fixed header */}
      <div className="h-[112px] md:h-[120px]" />
    </>
  );
}
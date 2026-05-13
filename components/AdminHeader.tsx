'use client';

/**
 * components/AdminHeader.tsx  (UPDATED — Dynamic RBAC version)
 *
 * Nav items are now driven entirely by:
 *   1. ROUTE_MANIFEST  — the static list of all admin pages
 *   2. user.permissions — the user's resolved permission strings
 *
 * Adding a new page = one line in route-manifest.ts. No other changes needed.
 */

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LogOut, Menu, X, Store, ChevronDown, ChevronUp, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getVisibleRoutes, groupRoutes, MANIFEST_GROUPS } from '@/lib/route-manifest';

export default function AdminHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNavExpanded, setIsNavExpanded] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('adminNavExpanded');
    if (saved !== null) setIsNavExpanded(saved === 'true');
  }, []);

  const toggleNav = () => {
    const next = !isNavExpanded;
    setIsNavExpanded(next);
    localStorage.setItem('adminNavExpanded', String(next));
  };

  // Branch slug from URL
  const slug = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    return parts.length > 1 && parts[1] === 'admin' ? parts[0] : null;
  }, [pathname]);

  // Derive visible routes from permissions
  const visibleRoutes = useMemo(() => {
    const isSuperAdmin = user?.role === 'super-admin';
    const permissions = user?.permissions ?? [];
    return getVisibleRoutes(permissions, isSuperAdmin);
  }, [user]);

  // Group them
  const groupedRoutes = useMemo(() => groupRoutes(visibleRoutes), [visibleRoutes]);

  // Groups that actually have visible routes, preserving manifest order
  const activeGroups = useMemo(
    () => MANIFEST_GROUPS.filter((g) => (groupedRoutes[g]?.length ?? 0) > 0),
    [groupedRoutes]
  );

  const isActive = (href: string) => {
    const full = slug ? `/${slug}${href}` : href;
    if (href === '/admin') return pathname === full;
    return pathname.startsWith(full);
  };

  const storeUrl = slug ? `/${slug}` : '/';

  const handleLogout = () => {
    logout();
    router.push(slug ? `/${slug}/login` : '/select-branch');
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-gray-900 to-gray-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4">

          {/* ── Top bar ── */}
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href={slug ? `/${slug}/admin` : '/admin'} className="flex items-center space-x-2">
              <div className="w-8 h-8 flex items-center justify-center">
                <img src="/logo.png" alt="TFS Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-white font-bold text-base">Admin Portal</h1>
                <p className="text-gray-400 text-xs hidden sm:block">TFS Wholesalers</p>
              </div>
            </Link>

            {/* Right side */}
            <div className="flex items-center space-x-2">
              {/* User info + role badge */}
              <div className="hidden lg:flex items-center space-x-2 mr-2">
                <div className="text-right">
                  <p className="text-white text-xs font-medium">{user?.name}</p>
                  <p className="text-gray-400 text-[10px]">
                    {user?.role === 'super-admin'
                      ? 'Super Admin'
                      : user?.adminRoleName ?? user?.email}
                  </p>
                </div>
                <div className="w-8 h-8 bg-brand-orange rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xs">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Role badge (desktop) */}
              {user?.adminRoleName && user.role !== 'super-admin' && (
                <span className="hidden lg:inline-flex items-center gap-1 px-2 py-1 bg-orange-500/20 border border-orange-400/30 text-orange-300 text-xs font-semibold rounded-lg">
                  <ShieldCheck className="w-3 h-3" />
                  {user.adminRoleName}
                </span>
              )}

              <Link
                href={storeUrl}
                className="hidden md:flex items-center space-x-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white text-xs"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Store</span>
              </Link>

              <button
                onClick={handleLogout}
                className="hidden md:flex items-center space-x-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors text-white text-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>

              <button
                onClick={toggleNav}
                className="hidden md:flex items-center space-x-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white text-xs border border-white/20"
                title={isNavExpanded ? 'Collapse navigation' : 'Expand navigation'}
              >
                {isNavExpanded
                  ? <><ChevronUp className="w-3.5 h-3.5" /><span>Hide Nav</span></>
                  : <><ChevronDown className="w-3.5 h-3.5" /><span>Show Nav</span></>}
              </button>

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {isMobileMenuOpen
                  ? <X className="w-5 h-5 text-white" />
                  : <Menu className="w-5 h-5 text-white" />}
              </button>
            </div>
          </div>

          {/* ── Desktop nav — collapsible ── */}
          <div
            className={`hidden md:block overflow-hidden transition-all duration-300 ease-in-out ${
              isNavExpanded ? 'max-h-48 opacity-100 py-2' : 'max-h-0 opacity-0 py-0'
            }`}
          >
            {activeGroups.length > 0 ? (
              <div
                className="grid gap-3 border-t border-white/10 pt-2"
                style={{ gridTemplateColumns: `repeat(${Math.min(activeGroups.length, 6)}, minmax(0, 1fr))` }}
              >
                {activeGroups.map((group) => (
                  <div key={group} className="space-y-0.5">
                    <p className="text-gray-400 text-[10px] uppercase font-semibold tracking-wider px-2 mb-1">
                      {group}
                    </p>
                    {groupedRoutes[group].map((route) => {
                      const href = slug ? `/${slug}${route.href}` : route.href;
                      const active = isActive(route.href);
                      const Icon = route.icon;
                      return (
                        <Link
                          key={route.key}
                          href={href}
                          className={`flex items-center space-x-2 px-2 py-1.5 rounded-lg transition-all text-xs ${
                            active
                              ? 'bg-brand-orange text-white shadow-lg'
                              : 'text-gray-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="font-medium truncate">{route.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-t border-white/10 pt-2 text-center text-gray-500 text-xs py-2">
                No pages assigned to your role yet. Contact your administrator.
              </div>
            )}
          </div>

          {/* Collapsed indicator */}
          {!isNavExpanded && (
            <div className="hidden md:flex items-center justify-center py-1 border-t border-white/10">
              <button
                onClick={toggleNav}
                className="flex items-center space-x-2 text-gray-400 hover:text-white text-xs transition-colors"
              >
                <ChevronDown className="w-3 h-3" />
                <span>Expand navigation</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* ── Mobile menu ── */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-gray-800 border-t border-white/10 max-h-[calc(100vh-56px)] overflow-y-auto">
            <nav className="max-w-7xl mx-auto px-4 py-4">
              {/* Role badge (mobile) */}
              {user?.adminRoleName && (
                <div className="mb-4 px-2 py-2 bg-orange-500/20 border border-orange-400/30 rounded-xl">
                  <div className="flex items-center gap-2 text-orange-300 text-xs font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    {user.adminRoleName}
                  </div>
                </div>
              )}

              {activeGroups.map((group) => (
                <div key={group} className="mb-4">
                  <p className="text-gray-400 text-xs uppercase font-semibold tracking-wider px-2 mb-2">
                    {group}
                  </p>
                  <div className="space-y-1">
                    {groupedRoutes[group].map((route) => {
                      const href = slug ? `/${slug}${route.href}` : route.href;
                      const active = isActive(route.href);
                      const Icon = route.icon;
                      return (
                        <Link
                          key={route.key}
                          href={href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all ${
                            active
                              ? 'bg-brand-orange text-white'
                              : 'text-gray-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{route.label}</span>
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
                  onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
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

      {/* Dynamic spacer */}
      <div className={`transition-all duration-300 ${isNavExpanded ? 'h-[120px] md:h-[128px]' : 'h-[62px] md:h-[68px]'}`} />
    </>
  );
}

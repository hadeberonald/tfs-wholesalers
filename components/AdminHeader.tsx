'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LogOut, Menu, X, Store, ChevronDown, ChevronUp, ShieldCheck, Loader2,
  Settings, Lock, Eye, EyeOff, CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getVisibleRoutes, groupRoutes, MANIFEST_GROUPS } from '@/lib/route-manifest';
import toast from 'react-hot-toast';

// ── Change Password Modal ─────────────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [current, setCurrent]       = useState('');
  const [next, setNext]             = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]         = useState(false);

  const valid = current && next.length >= 6 && next === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !user) return;

    setSaving(true);
    try {
      // Use the user's own id to PATCH their password.
      // The endpoint already handles password hashing when password is in the body.
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, password: next }),
      });
      if (res.ok) {
        toast.success('Password updated successfully');
        onClose();
      } else {
        const d = await res.json();
        toast.error(d.error ?? 'Failed to update password');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
              <Lock className="w-4 h-4 text-orange-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Change Password</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Enter current password"
                value={current}
                onChange={e => setCurrent(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNext ? 'text' : 'password'}
                required
                minLength={6}
                className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="At least 6 characters"
                value={next}
                onChange={e => setNext(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowNext(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {next && next.length < 6 && (
              <p className="text-xs text-red-500 mt-1">Must be at least 6 characters</p>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Repeat new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {confirm && next && (
                <div className="absolute right-9 top-1/2 -translate-y-1/2">
                  {next === confirm
                    ? <CheckCircle className="w-4 h-4 text-green-500" />
                    : <X className="w-4 h-4 text-red-400" />}
                </div>
              )}
            </div>
            {confirm && next !== confirm && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid || saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Lock className="w-4 h-4" /> Update Password</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── AdminHeader ───────────────────────────────────────────────────────────────

export default function AdminHeader() {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNavExpanded, setIsNavExpanded]       = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('adminNavExpanded');
      if (saved !== null) setIsNavExpanded(saved === 'true');
    } catch {}
  }, []);

  const toggleNav = () => {
    const next = !isNavExpanded;
    setIsNavExpanded(next);
    try { localStorage.setItem('adminNavExpanded', String(next)); } catch {}
  };

  const slug = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[1] === 'admin') return parts[0];
    return null;
  }, [pathname]);

  const visibleRoutes = useMemo(() => {
    if (loading || !user) return [];
    const isSuperAdmin = user.role === 'super-admin';
    const permissions  = user.permissions ?? [];
    return getVisibleRoutes(permissions, isSuperAdmin);
  }, [user, loading]);

  const groupedRoutes = useMemo(() => groupRoutes(visibleRoutes), [visibleRoutes]);

  const activeGroups = useMemo(
    () => MANIFEST_GROUPS.filter(g => (groupedRoutes[g]?.length ?? 0) > 0),
    [groupedRoutes],
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
      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}

      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-gray-900 to-gray-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4">

          {/* ── Top bar ── */}
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link
              href={slug ? `/${slug}/admin` : '/admin'}
              className="flex items-center space-x-2 shrink-0"
            >
              <div className="w-8 h-8 flex items-center justify-center">
                <img src="/logo.png" alt="TFS Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-white font-bold text-base leading-tight">Admin Portal</h1>
                <p className="text-gray-400 text-xs hidden sm:block">TFS Wholesalers</p>
              </div>
            </Link>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {loading ? (
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              ) : (
                <>
                  <div className="hidden lg:flex items-center gap-2 mr-1">
                    <div className="text-right">
                      <p className="text-white text-xs font-medium leading-tight">{user?.name}</p>
                      <p className="text-gray-400 text-[10px] leading-tight">
                        {user?.role === 'super-admin'
                          ? 'Super Admin'
                          : (user?.adminRoleName ?? user?.email)}
                      </p>
                    </div>

                    {/* Avatar + gear cog */}
                    <div className="relative group">
                      <div className="w-8 h-8 bg-brand-orange rounded-full flex items-center justify-center shrink-0 cursor-pointer">
                        <span className="text-white font-bold text-xs">
                          {user?.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {/* Gear cog — appears on hover, positioned bottom-right of avatar */}
                      <button
                        onClick={() => setShowPasswordModal(true)}
                        title="Change password"
                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-700 hover:bg-orange-500 border border-gray-600 rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Settings className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  </div>

                  {user?.adminRoleName && user.role !== 'super-admin' && (
                    <span className="hidden lg:inline-flex items-center gap-1 px-2 py-1 bg-orange-500/20 border border-orange-400/30 text-orange-300 text-xs font-semibold rounded-lg">
                      <ShieldCheck className="w-3 h-3" />
                      {user.adminRoleName}
                    </span>
                  )}
                </>
              )}

              <Link
                href={storeUrl}
                className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white text-xs"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Store</span>
              </Link>

              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors text-white text-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>

              <button
                onClick={toggleNav}
                className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white text-xs border border-white/20"
                title={isNavExpanded ? 'Collapse navigation' : 'Expand navigation'}
              >
                {isNavExpanded
                  ? <><ChevronUp className="w-3.5 h-3.5" /><span>Hide Nav</span></>
                  : <><ChevronDown className="w-3.5 h-3.5" /><span>Show Nav</span></>}
              </button>

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen
                  ? <X className="w-5 h-5 text-white" />
                  : <Menu className="w-5 h-5 text-white" />}
              </button>
            </div>
          </div>

          {/* ── Desktop nav ── */}
          {!loading && activeGroups.length > 0 && (
            <div
              className={`hidden md:block overflow-hidden transition-all duration-200 ease-in-out border-t border-white/10 ${
                isNavExpanded ? 'max-h-40 py-2 opacity-100' : 'max-h-0 py-0 opacity-0'
              }`}
            >
              <div
                className="grid gap-x-4 gap-y-0.5"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(activeGroups.length, 7)}, minmax(0, 1fr))`,
                }}
              >
                {activeGroups.map(group => (
                  <div key={group}>
                    <p className="text-gray-400 text-[10px] uppercase font-semibold tracking-wider px-2 mb-1">
                      {group}
                    </p>
                    {groupedRoutes[group].map(route => {
                      const href   = slug ? `/${slug}${route.href}` : route.href;
                      const active = isActive(route.href);
                      const Icon   = route.icon;
                      return (
                        <Link
                          key={route.key}
                          href={href}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-xs mb-0.5 ${
                            active
                              ? 'bg-brand-orange text-white shadow'
                              : 'text-gray-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-medium truncate">{route.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collapsed hint */}
          {!loading && !isNavExpanded && (
            <div className="hidden md:flex items-center justify-center py-0.5 border-t border-white/10">
              <button
                onClick={toggleNav}
                className="flex items-center gap-1 text-gray-500 hover:text-white text-xs transition-colors py-0.5"
              >
                <ChevronDown className="w-3 h-3" />
                <span>Show navigation</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* ── Mobile menu ── */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-gray-800 border-t border-white/10 max-h-[calc(100vh-56px)] overflow-y-auto">
            <nav className="max-w-7xl mx-auto px-4 py-4">
              {user?.adminRoleName && (
                <div className="mb-4 px-3 py-2 bg-orange-500/20 border border-orange-400/30 rounded-xl flex items-center gap-2 text-orange-300 text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  {user.adminRoleName}
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : activeGroups.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  No pages assigned to your role yet.
                </p>
              ) : (
                activeGroups.map(group => (
                  <div key={group} className="mb-4">
                    <p className="text-gray-400 text-xs uppercase font-semibold tracking-wider px-2 mb-2">
                      {group}
                    </p>
                    <div className="space-y-1">
                      {groupedRoutes[group].map(route => {
                        const href   = slug ? `/${slug}${route.href}` : route.href;
                        const active = isActive(route.href);
                        const Icon   = route.icon;
                        return (
                          <Link
                            key={route.key}
                            href={href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
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
                ))
              )}

              <div className="pt-4 mt-2 border-t border-white/10 space-y-2">
                {/* Change password in mobile menu */}
                <button
                  onClick={() => { setIsMobileMenuOpen(false); setShowPasswordModal(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-all"
                >
                  <Settings className="w-5 h-5" />
                  <span className="font-medium">Change Password</span>
                </button>

                <Link
                  href={storeUrl}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-all"
                >
                  <Store className="w-5 h-5" />
                  <span className="font-medium">Back to Store</span>
                </Link>

                <button
                  onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-white transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
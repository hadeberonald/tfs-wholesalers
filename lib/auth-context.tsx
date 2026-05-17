'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin' | 'picker' | 'super-admin';
  permissions: string[];
  adminRoleId?: string | null;
  adminRoleName?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  can: (permission: string) => boolean;
  login: (email: string, password: string, slug?: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const can = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'super-admin') return true;
    const perms = user.permissions ?? [];
    return (
      perms.includes(permission) ||
      (permission.endsWith(':read') &&
        perms.includes(permission.replace(':read', ':write')))
    );
  };

  const login = async (email: string, password: string, slug?: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await res.json();

    // ── Key fix: set the full user WITH permissions before navigating ─────
    // The login response must return the same shape as /api/auth/me including
    // permissions and adminRoleName. This means when the admin page mounts
    // after router.push, user is already populated — no second checkAuth
    // cycle, no empty-permissions flash, no refresh needed.
    setUser(data.user);

    // Brief yield so React flushes the state update before navigation
    await new Promise((r) => setTimeout(r, 0));

    if (data.user.role === 'super-admin') {
      router.push('/super-admin');
    } else if (data.user.role === 'admin') {
      router.push(slug ? `/${slug}/admin` : '/admin');
    } else if (data.user.role === 'picker') {
      router.push('/picker');
    } else {
      router.push(slug ? `/${slug}/account` : '/account');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role: 'customer' }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data = await res.json();
    setUser(data.user);
  };

  // ── Block rendering until we know the auth state ───────────────────────────
  // Without this, every page that reads user/permissions gets null on first
  // render and caches stale empty values before checkAuth() resolves.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, can, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
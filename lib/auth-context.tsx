'use client';

/**
 * lib/auth-context.tsx  (UPDATED — Dynamic RBAC version)
 *
 * User object now carries `permissions: string[]` so any client component
 * can gate UI without an extra fetch.
 *
 * /api/auth/me MUST be updated to return `permissions` — see note at bottom.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin' | 'picker' | 'super-admin';
  /** Resolved permission strings for admin users. Empty array for non-admins. */
  permissions: string[];
  /** The ObjectId string of the assigned admin_roles document */
  adminRoleId?: string | null;
  /** Human-readable role name, e.g. "Marketing" */
  adminRoleName?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Returns true if the current user has the given permission (or is super-admin) */
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

  /**
   * Check if the current user has a permission.
   * Super-admins (role === 'super-admin') always return true.
   * Having :write implicitly grants :read.
   */
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
    setUser(data.user);

    if (data.user.role === 'super-admin') {
      router.push('/super-admin');
    } else if (data.user.role === 'admin') {
      router.push('/admin');
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

/**
 * ─── REQUIRED CHANGE TO /api/auth/me ────────────────────────────────────────
 *
 * Your /api/auth/me route must now:
 *  1. Look up the user's adminRoleId
 *  2. Fetch the role doc to get permissions
 *  3. Return them in the response
 *
 * Replace the return statement in that route with this:
 *
 *   import { getUserPermissions } from '@/lib/admin-roles-db';
 *
 *   const user = await db.collection('users').findOne(
 *     { _id: new ObjectId(userId) },
 *     { projection: { password: 0 } }
 *   );
 *
 *   const permissions = user?.adminRoleId
 *     ? await getUserPermissions(user.adminRoleId)
 *     : [];
 *
 *   // Optionally fetch role name for display
 *   let adminRoleName = null;
 *   if (user?.adminRoleId) {
 *     const roleDoc = await getRoleById(user.adminRoleId);
 *     adminRoleName = roleDoc?.name ?? null;
 *   }
 *
 *   return NextResponse.json({
 *     user: {
 *       id: user._id.toString(),
 *       email: user.email,
 *       name: user.name,
 *       role: user.role,
 *       permissions: permissions ?? [],
 *       adminRoleId: user.adminRoleId?.toString() ?? null,
 *       adminRoleName,
 *     }
 *   });
 */

'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// ✅ FIXED: Added 'super-admin' to role union
interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin' | 'picker' | 'super-admin';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, slug?: string) => Promise<void>;
  logout: (slug?: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
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
    
    // ✅ FIXED: Added super-admin routing
    if (data.user.role === 'super-admin') {
      router.push('/super-admin');
    } else if (data.user.role === 'admin') {
      router.push('/admin');
    } else if (data.user.role === 'picker') {
      router.push('/picker');
    } else {
      // Customer - redirect to branch account page if slug provided
      if (slug) {
        router.push(`/${slug}/account`);
      } else {
        router.push('/account');
      }
    }
  };

  const logout = async (slug?: string) => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    
    // Redirect to branch login if slug provided
    if (slug) {
      router.push(`/${slug}/login`);
    } else {
      router.push('/login');
    }
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
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
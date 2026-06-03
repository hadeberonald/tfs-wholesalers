// src/stores/authStore.ts

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = 'https://tfs-wholesalers-ifad.onrender.com';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Branch {
  _id: string;
  id?: string;
  name: string;
  slug: string;
  address?: string;
  city?: string;
  province?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  activeBranch: Branch | null;
  expoPushToken: string | null;
  loading: boolean;
  // True once loadUser() has finished reading AsyncStorage.
  // App.tsx gates the navigator behind this so we never render with stale
  // (null) activeBranch when a branch was already persisted.
  appReady: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setActiveBranch: (branch: Branch) => Promise<void>;
  clearBranch: () => Promise<void>;
  setExpoPushToken: (token: string) => void;
}

const ALLOWED_ROLES = ['picker', 'delivery', 'admin'];

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  activeBranch: null,
  expoPushToken: null,
  loading: false,
  appReady: false,   // ← gates the navigator in App.tsx

  // ── Login ──────────────────────────────────────────────────────────────────
  login: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const response = await axios.post(`${API_URL}/api/auth/mobile-login`, {
        email,
        password,
      });

      const { user, token } = response.data;

      if (!token) throw new Error('No authentication token received from server');
      if (!user)  throw new Error('No user data received from server');

      if (!ALLOWED_ROLES.includes(user.role)) {
        throw new Error('Access denied. This app is for pickers and delivery staff only.');
      }

      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      const pushToken = get().expoPushToken;
      if (pushToken) {
        try {
          await axios.post(
            `${API_URL}/api/auth/push-token`,
            { token: pushToken },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch {
          // non-fatal
        }
      }

      set({ user, token, loading: false });
    } catch (error: any) {
      set({ loading: false });
      console.error('Login error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw error;
    }
  },

  // ── Logout ─────────────────────────────────────────────────────────────────
  logout: async () => {
    await AsyncStorage.multiRemove(['auth_token', 'user', 'active_branch']);
    set({ user: null, token: null, activeBranch: null });
  },

  // ── Restore session ────────────────────────────────────────────────────────
  // Sets appReady=true when done so App.tsx can show the navigator.
  loadUser: async () => {
    try {
      const [tokenEntry, userEntry, branchEntry] = await AsyncStorage.multiGet([
        'auth_token',
        'user',
        'active_branch',
      ]);

      const tokenVal  = tokenEntry[1];
      const userVal   = userEntry[1];
      const branchVal = branchEntry[1];

      if (tokenVal && userVal) {
        set({
          token:        tokenVal,
          user:         JSON.parse(userVal),
          activeBranch: branchVal ? JSON.parse(branchVal) : null,
        });
      }
    } catch (error) {
      console.error('Failed to load user from storage:', error);
    } finally {
      // Always mark ready — even on error we need to unblock the navigator.
      set({ appReady: true });
    }
  },

  // ── Branch selection ───────────────────────────────────────────────────────
  setActiveBranch: async (branch: Branch) => {
    await AsyncStorage.setItem('active_branch', JSON.stringify(branch));

    const token = get().token;
    if (token) {
      try {
        await axios.post(
          `${API_URL}/api/auth/set-branch`,
          { branchId: branch._id || branch.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch {
        // non-fatal
      }
    }

    set({ activeBranch: branch });
  },

  clearBranch: async () => {
    await AsyncStorage.removeItem('active_branch');
    set({ activeBranch: null });
  },

  // ── Push token ─────────────────────────────────────────────────────────────
  setExpoPushToken: (token: string) => {
    set({ expoPushToken: token });

    const authToken = useAuthStore.getState().token;
    if (authToken) {
      axios
        .post(
          `${API_URL}/api/auth/push-token`,
          { token },
          { headers: { Authorization: `Bearer ${authToken}` } }
        )
        .catch(() => {});
    }
  },
}));
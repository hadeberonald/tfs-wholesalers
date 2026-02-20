// src/stores/authStore.ts
// Multibranch-aware auth store for the TFS Picker App.
// Changes from original:
//   - Added Branch type + activeBranch state
//   - login() no longer auto-selects a branch
//   - setActiveBranch() persists to AsyncStorage
//   - expoPushToken stored here so notifications can be registered after login
//   - loadUser() restores branch too

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = 'https://tfs-wholesalers.onrender.com';

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
  // roles the user is allowed to see in this app
  // picker | delivery | admin — all allowed, others rejected
}

interface AuthState {
  user: User | null;
  token: string | null;
  activeBranch: Branch | null;
  expoPushToken: string | null;
  loading: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setActiveBranch: (branch: Branch) => Promise<void>;
  clearBranch: () => Promise<void>;
  setExpoPushToken: (token: string) => void;
}

// Roles that are allowed to use this picker/delivery app
const ALLOWED_ROLES = ['picker', 'delivery', 'admin'];

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  activeBranch: null,
  expoPushToken: null,
  loading: false,

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
        throw new Error(
          'Access denied. This app is for pickers and delivery staff only.'
        );
      }

      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      // Register push token with server if we already have one
      const pushToken = get().expoPushToken;
      if (pushToken) {
        try {
          await axios.post(
            `${API_URL}/api/auth/push-token`,
            { token: pushToken },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch {
          // Non-fatal — push token registration can be retried later
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

  // ── Restore session on app start ───────────────────────────────────────────
  loadUser: async () => {
    try {
      const [token, userStr, branchStr] = await AsyncStorage.multiGet([
        'auth_token',
        'user',
        'active_branch',
      ]);

      const tokenVal  = token[1];
      const userVal   = userStr[1];
      const branchVal = branchStr[1];

      if (tokenVal && userVal) {
        set({
          token: tokenVal,
          user: JSON.parse(userVal),
          activeBranch: branchVal ? JSON.parse(branchVal) : null,
        });
      }
    } catch (error) {
      console.error('Failed to load user from storage:', error);
    }
  },

  // ── Branch selection ───────────────────────────────────────────────────────
  setActiveBranch: async (branch: Branch) => {
    await AsyncStorage.setItem('active_branch', JSON.stringify(branch));

    // Tell the server which branch this picker is working at (so the server
    // can scope order queries and push notifications correctly)
    const token = get().token;
    if (token) {
      try {
        await axios.post(
          `${API_URL}/api/auth/set-branch`,
          { branchId: branch._id || branch.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch {
        // Non-fatal
      }
    }

    set({ activeBranch: branch });
  },

  clearBranch: async () => {
    await AsyncStorage.removeItem('active_branch');
    set({ activeBranch: null });
  },

  // ── Push token (called by NotificationService after registration) ──────────
  setExpoPushToken: (token: string) => {
    set({ expoPushToken: token });

    // If already logged in, register the token with the server now
    const authToken = useAuthStore.getState().token;
    if (authToken) {
      axios
        .post(
          `${API_URL}/api/auth/push-token`,
          { token },
          { headers: { Authorization: `Bearer ${authToken}` } }
        )
        .catch(() => {
          // Non-fatal
        });
    }
  },
}));
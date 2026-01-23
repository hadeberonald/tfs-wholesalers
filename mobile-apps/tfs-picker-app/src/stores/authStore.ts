import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = 'https://tfs-wholesalers.onrender.com';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: false,

  login: async (email: string, password: string) => {
    try {
      set({ loading: true });
      
      // Use the mobile-auth endpoint which returns a token
      const response = await axios.post(`${API_URL}/api/mobile-auth/login`, {
        email,
        password,
      });

      const { user, token } = response.data;
      
      // Validate that we received the required data
      if (!token) {
        throw new Error('No authentication token received from server');
      }
      
      if (!user) {
        throw new Error('No user data received from server');
      }
      
      // Only allow pickers to log in
      if (user.role !== 'picker') {
        throw new Error('This app is only for pickers. Please use the correct app for your role.');
      }

      // Store the token and user data
      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      
      set({ user, token, loading: false });
    } catch (error: any) {
      set({ loading: false });
      
      // Log the full error for debugging
      console.error('Login error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      throw error;
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user');
    set({ user: null, token: null });
  },

  loadUser: async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const userStr = await AsyncStorage.getItem('user');
      
      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ user, token });
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  },
}));
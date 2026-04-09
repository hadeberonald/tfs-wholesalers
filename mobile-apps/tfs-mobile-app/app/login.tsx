import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '@/lib/store';
import api from '@/lib/api';
import { linkPushTokenAfterLogin } from '@/lib/notificationService';

export default function LoginScreen() {
  const router  = useRouter();
  const setUser = useStore((state) => state.setUser);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', {
        email:    email.toLowerCase().trim(),
        password,
      });

      if (response.data.user && response.data.token) {
        await AsyncStorage.setItem('user',       JSON.stringify(response.data.user));
        await AsyncStorage.setItem('auth_token', response.data.token);

        setUser(response.data.user);

        // Link any existing push token to this user account
        if (response.data.user?.id) {
          linkPushTokenAfterLogin(response.data.user.id).catch(() => {});
        }

        Alert.alert('Success', 'Welcome back!');
        router.back();
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const message = error.response?.data?.error || 'Login failed. Please try again.';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>TFS</Text>
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotButton}
            onPress={() => Alert.alert('Forgot Password', 'Contact support to reset your password')}
          >
            <Text style={styles.forgotButtonText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.registerLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent:        { flexGrow: 1, padding: 20 },
  header:               { paddingTop: 40, marginBottom: 20 },
  backButton:           { alignSelf: 'flex-start' },
  backButtonText:       { fontSize: 16, color: '#FF6B35', fontWeight: '600' },
  logoContainer:        { alignItems: 'center', marginBottom: 40 },
  logo:                 { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF6B35', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText:             { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  title:                { fontSize: 28, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 },
  subtitle:             { fontSize: 16, color: '#6b7280' },
  form:                 { marginBottom: 24 },
  inputGroup:           { marginBottom: 20 },
  label:                { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  input:                { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1f2937' },
  loginButton:          { backgroundColor: '#FF6B35', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  loginButtonDisabled:  { opacity: 0.6 },
  loginButtonText:      { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  forgotButton:         { alignItems: 'center', marginTop: 16 },
  forgotButtonText:     { fontSize: 14, color: '#FF6B35', fontWeight: '600' },
  registerContainer:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  registerText:         { fontSize: 14, color: '#6b7280' },
  registerLink:         { fontSize: 14, color: '#FF6B35', fontWeight: '600' },
});
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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '@/lib/store';
import api from '@/lib/api';

export default function RegisterScreen() {
  const router  = useRouter();
  const setUser = useStore((state) => state.setUser);

  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/register', {
        name:     name.trim(),
        email:    email.toLowerCase().trim(),
        password,
        role:     'customer',
      });

      if (response.data.user) {
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        setUser(response.data.user);

        // Branch is already selected — just drop into the app
        router.replace('/(tabs)');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error('Register error:', error);
      Alert.alert('Registration Failed', error.response?.data?.error || 'Registration failed. Please try again.');
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
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join TFS Wholesalers today</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              editable={!loading}
            />
          </View>

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
              placeholder="Minimum 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={[
                styles.input,
                confirmPassword.length > 0 && password !== confirmPassword ? styles.inputError : null,
              ]}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
              editable={!loading}
            />
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.registerButtonText}>Create Account</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:               { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent:           { flexGrow: 1, padding: 20 },
  header:                  { paddingTop: 40, marginBottom: 20 },
  backButton:              { alignSelf: 'flex-start' },
  backButtonText:          { fontSize: 16, color: '#FF6B35', fontWeight: '600' },
  logoContainer:           { alignItems: 'center', marginBottom: 40 },
  logo:                    { width: 160, height: 80, marginBottom: 16 },
  title:                   { fontSize: 28, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 },
  subtitle:                { fontSize: 16, color: '#6b7280' },
  form:                    { marginBottom: 24 },
  inputGroup:              { marginBottom: 20 },
  label:                   { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  input:                   { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1f2937' },
  inputError:              { borderColor: '#ef4444' },
  errorText:               { fontSize: 12, color: '#ef4444', marginTop: 4, marginLeft: 4 },
  registerButton:          { backgroundColor: '#FF6B35', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  registerButtonDisabled:  { opacity: 0.6 },
  registerButtonText:      { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loginContainer:          { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 20 },
  loginText:               { fontSize: 14, color: '#6b7280' },
  loginLink:               { fontSize: 14, color: '#FF6B35', fontWeight: '600' },
});
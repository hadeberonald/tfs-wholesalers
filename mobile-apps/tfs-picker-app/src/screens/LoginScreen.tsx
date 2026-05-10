// src/screens/LoginScreen.tsx
// Alert.alert calls replaced with useAppModal() to prevent iOS stacking alerts.

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { registerForPushNotifications } from '../services/NotificationService';
import { useAppModal } from '../components/AppModal';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const { login, loadUser, loading } = useAuthStore();
  const { showModal } = useAppModal();

  useEffect(() => { loadUser(); }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showModal({ title: 'Missing Fields', message: 'Please enter your email and password.', buttons: [{ text: 'OK' }] });
      return;
    }
    try {
      await login(email.trim().toLowerCase(), password);
      registerForPushNotifications().catch(() => {});
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Invalid credentials. Please try again.';
      showModal({ title: 'Login Failed', message: msg, buttons: [{ text: 'OK' }] });
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>TFS Picker App</Text>
          <Text style={styles.subtitle}>Sign in to start picking & delivering orders</Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your.email@example.com"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#aaa"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              This app is for <Text style={styles.noteBold}>pickers</Text>,{' '}
              <Text style={styles.noteBold}>delivery staff</Text>, and{' '}
              <Text style={styles.noteBold}>admins</Text> only.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll:    { flexGrow: 1 },
  content:   { flex: 1, justifyContent: 'center', padding: 24, paddingTop: 60, paddingBottom: 40 },
  logo:      { width: 100, height: 100, alignSelf: 'center', marginBottom: 24 },
  title:     { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, color: '#1a1a1a' },
  subtitle:  { fontSize: 15, textAlign: 'center', color: '#666', marginBottom: 36, lineHeight: 22 },
  form:           { gap: 16 },
  inputContainer: { gap: 8 },
  label:  { fontSize: 14, fontWeight: '600', color: '#333' },
  input:  { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, fontSize: 16, color: '#1a1a1a' },
  button:         { backgroundColor: '#FF6B35', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8, shadowColor: '#FF6B35', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  buttonDisabled: { opacity: 0.6, shadowOpacity: 0 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  noteBox:  { marginTop: 32, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  noteText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },
  noteBold: { color: '#FF6B35', fontWeight: '700' },
});
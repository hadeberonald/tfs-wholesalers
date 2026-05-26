import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Modal, TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import {
  Lock, Eye, EyeOff, X, CheckCircle, ArrowRight, RefreshCw, Mail,
} from 'lucide-react-native';
import api from '@/lib/api';

type PasswordStep = 'request' | 'verify';

interface Props {
  visible:    boolean;
  onClose:    () => void;
  userEmail:  string;
}

export default function PasswordResetModal({ visible, onClose, userEmail }: Props) {
  const [step,        setStep]        = useState<PasswordStep>('request');
  const [code,        setCode]        = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [resending,   setResending]   = useState(false);
  const [cooldown,    setCooldown]    = useState(0);
  const [done,        setDone]        = useState(false);

  const cooldownRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const resetModal = () => {
    setStep('request');
    setCode('');
    setNewPassword('');
    setConfirmPw('');
    setShowPw(false);
    setShowConfirm(false);
    setSubmitting(false);
    setResending(false);
    setCooldown(0);
    setDone(false);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  };

  const handleClose = () => { resetModal(); onClose(); };

  const startCooldown = () => {
    setCooldown(60);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async (isResend = false) => {
    isResend ? setResending(true) : setSubmitting(true);
    try {
      await api.post('/api/auth/password-reset/request', { email: userEmail });
      if (!isResend) setStep('verify');
      startCooldown();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to send code. Please try again.');
    } finally {
      isResend ? setResending(false) : setSubmitting(false);
    }
  };

  const handleVerifyAndChange = async () => {
    if (code.trim().length < 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code sent to your email.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPw) {
      Alert.alert("Passwords Don't Match", 'Please make sure both passwords are the same.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/auth/password-reset/verify', {
        email: userEmail,
        code:  code.trim(),
        newPassword,
      });
      setDone(true);
    } catch (err: any) {
      Alert.alert('Failed', err.response?.data?.error || 'Invalid or expired code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.container}>

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.headerIcon}><Lock color="#FF6B35" size={20} /></View>
              <View>
                <Text style={s.headerTitle}>Reset Password</Text>
                <Text style={s.headerSub}>Secure your account</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
              <X color="#6b7280" size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">

            {/* ── Done ── */}
            {done ? (
              <View style={s.doneWrap}>
                <View style={s.doneIcon}><CheckCircle color="#10b981" size={48} /></View>
                <Text style={s.doneTitle}>Password Changed!</Text>
                <Text style={s.doneSub}>Your password has been updated successfully.</Text>
                <TouchableOpacity style={s.primaryBtn} onPress={handleClose}>
                  <Text style={s.primaryBtnText}>Done</Text>
                </TouchableOpacity>
              </View>

            ) : step === 'request' ? (
              /* ── Step 1 ── */
              <View>
                <View style={s.stepRow}>
                  <View style={[s.stepDot, s.stepDotActive]} />
                  <View style={[s.stepLine, s.stepLineInactive]} />
                  <View style={[s.stepDot, s.stepDotInactive]} />
                </View>

                <Text style={s.stepTitle}>Verify your identity</Text>
                <Text style={s.stepDesc}>
                  We'll send a 6-digit code to{'\n'}
                  <Text style={s.emailHL}>{userEmail}</Text>
                </Text>

                <View style={s.emailBox}>
                  <Mail color="#FF6B35" size={16} />
                  <Text style={s.emailBoxText} numberOfLines={1}>{userEmail}</Text>
                </View>

                <TouchableOpacity
                  style={[s.primaryBtn, submitting && s.primaryBtnDisabled]}
                  onPress={() => handleSendCode(false)}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <><Text style={s.primaryBtnText}>Send Code</Text><ArrowRight color="#fff" size={18} /></>
                  }
                </TouchableOpacity>

                <Text style={s.footerNote}>Check your spam folder if you don't see it within a minute.</Text>
              </View>

            ) : (
              /* ── Step 2 ── */
              <View>
                <View style={s.stepRow}>
                  <View style={[s.stepDot, s.stepDotDone]}><CheckCircle color="#fff" size={10} /></View>
                  <View style={[s.stepLine, s.stepLineActive]} />
                  <View style={[s.stepDot, s.stepDotActive]} />
                </View>

                <Text style={s.stepTitle}>Enter your code</Text>
                <Text style={s.stepDesc}>
                  Sent to <Text style={s.emailHL}>{userEmail}</Text>
                </Text>

                <View style={s.fieldWrap}>
                  <Text style={s.fieldLabel}>Verification Code</Text>
                  <TextInput
                    style={s.codeInput}
                    value={code}
                    onChangeText={setCode}
                    placeholder="_ _ _ _ _ _"
                    placeholderTextColor="#d1d5db"
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    textAlign="center"
                  />
                </View>

                <TouchableOpacity
                  style={[s.resendRow, (cooldown > 0 || resending) && { opacity: 0.5 }]}
                  onPress={() => handleSendCode(true)}
                  disabled={cooldown > 0 || resending}
                >
                  {resending
                    ? <ActivityIndicator color="#FF6B35" size="small" />
                    : <RefreshCw color="#FF6B35" size={14} />
                  }
                  <Text style={s.resendText}>
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                  </Text>
                </TouchableOpacity>

                <View style={s.fieldWrap}>
                  <Text style={s.fieldLabel}>New Password</Text>
                  <View style={s.pwRow}>
                    <TextInput
                      style={s.pwInput}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="At least 8 characters"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry={!showPw}
                    />
                    <TouchableOpacity onPress={() => setShowPw(v => !v)} style={s.eyeBtn}>
                      {showPw ? <EyeOff color="#9ca3af" size={18} /> : <Eye color="#9ca3af" size={18} />}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.fieldWrap}>
                  <Text style={s.fieldLabel}>Confirm New Password</Text>
                  <View style={[s.pwRow, confirmPw.length > 0 && newPassword !== confirmPw && s.pwRowError]}>
                    <TextInput
                      style={s.pwInput}
                      value={confirmPw}
                      onChangeText={setConfirmPw}
                      placeholder="Repeat your new password"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry={!showConfirm}
                    />
                    <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={s.eyeBtn}>
                      {showConfirm ? <EyeOff color="#9ca3af" size={18} /> : <Eye color="#9ca3af" size={18} />}
                    </TouchableOpacity>
                  </View>
                  {confirmPw.length > 0 && newPassword !== confirmPw && (
                    <Text style={s.errorText}>Passwords don't match</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[s.primaryBtn, submitting && s.primaryBtnDisabled]}
                  onPress={handleVerifyAndChange}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <><Lock color="#fff" size={16} /><Text style={s.primaryBtnText}>Change Password</Text></>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={s.backBtn} onPress={() => setStep('request')}>
                  <Text style={s.backBtnText}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#f9fafb' },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 20 : 16, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerLeft:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon:         { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff7f3', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fed7aa' },
  headerTitle:        { fontSize: 16, fontWeight: '800', color: '#1f2937' },
  headerSub:          { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  closeBtn:           { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  body:               { padding: 24, paddingBottom: 48 },
  stepRow:            { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  stepDot:            { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepDotActive:      { backgroundColor: '#FF6B35' },
  stepDotInactive:    { backgroundColor: '#e5e7eb' },
  stepDotDone:        { backgroundColor: '#10b981' },
  stepLine:           { flex: 1, height: 2, marginHorizontal: 6 },
  stepLineActive:     { backgroundColor: '#10b981' },
  stepLineInactive:   { backgroundColor: '#e5e7eb' },
  stepTitle:          { fontSize: 22, fontWeight: '800', color: '#1f2937', marginBottom: 8 },
  stepDesc:           { fontSize: 14, color: '#6b7280', lineHeight: 22, marginBottom: 24 },
  emailHL:            { color: '#FF6B35', fontWeight: '700' },
  emailBox:           { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff7f3', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fed7aa', marginBottom: 28 },
  emailBoxText:       { flex: 1, fontSize: 14, color: '#374151', fontWeight: '600' },
  primaryBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FF6B35', borderRadius: 14, paddingVertical: 16, marginBottom: 16 },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  footerNote:         { fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 18 },
  fieldWrap:          { marginBottom: 18 },
  fieldLabel:         { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  codeInput:          { backgroundColor: '#fff', borderWidth: 2, borderColor: '#FF6B35', borderRadius: 14, paddingVertical: 18, fontSize: 28, fontWeight: '800', color: '#1f2937', letterSpacing: 12 },
  resendRow:          { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 24 },
  resendText:         { fontSize: 13, color: '#FF6B35', fontWeight: '600' },
  pwRow:              { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14 },
  pwRowError:         { borderColor: '#ef4444' },
  pwInput:            { flex: 1, paddingVertical: 14, fontSize: 15, color: '#1f2937' },
  eyeBtn:             { padding: 6 },
  errorText:          { fontSize: 12, color: '#ef4444', marginTop: 4 },
  backBtn:            { alignItems: 'center', paddingVertical: 12 },
  backBtnText:        { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  doneWrap:           { alignItems: 'center', paddingTop: 40, gap: 16 },
  doneIcon:           { width: 96, height: 96, borderRadius: 48, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  doneTitle:          { fontSize: 24, fontWeight: '800', color: '#1f2937' },
  doneSub:            { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
});
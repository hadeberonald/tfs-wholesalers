// app/DeliveryNpsModal.tsx
// Pops up on app open when a pending delivery review is detected.
// Focused purely on the online / delivery experience.

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, TextInput, Animated, Easing, Platform,
  KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Star, CheckCircle, Package, Truck, ThumbsUp,
  MessageSquare, ChevronRight, X,
} from 'lucide-react-native';
import api from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PendingReview {
  orderId: string;
  orderNumber: string;
  branchSlug: string;
  deliveredAt: string;
}

interface Props {
  pendingReview: PendingReview | null;
  onDismiss: () => void;
}

type Step = 'delivery' | 'items' | 'overall' | 'comments' | 'done';

// ─── Star picker ───────────────────────────────────────────────────────────────

function StarPicker({
  value, onChange, label,
}: {
  value: number; onChange: (n: number) => void; label: string;
}) {
  const labels = ['', 'Very Poor', 'Poor', 'Average', 'Good', 'Excellent'];
  return (
    <View style={s.starGroup}>
      <Text style={s.starLabel}>{label}</Text>
      <View style={s.starRow}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity key={n} onPress={() => onChange(n)} style={s.starTouch}>
            <Star
              size={36}
              color={n <= value ? '#f59e0b' : '#e5e7eb'}
              fill={n <= value ? '#f59e0b' : 'transparent'}
            />
          </TouchableOpacity>
        ))}
      </View>
      {value > 0 && (
        <Text style={s.starValueLabel}>{labels[value]}</Text>
      )}
    </View>
  );
}

// ─── Yes/No/Partial picker ─────────────────────────────────────────────────────

function OptionPicker({
  label, options, value, onChange,
}: {
  label: string;
  options: { label: string; value: string; color?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.optionGroup}>
      <Text style={s.starLabel}>{label}</Text>
      <View style={s.optionRow}>
        {options.map(opt => {
          const active = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[
                s.optionBtn,
                active && { backgroundColor: opt.color || '#FF6B35', borderColor: opt.color || '#FF6B35' },
              ]}
            >
              <Text style={[s.optionBtnText, active && s.optionBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Progress dots ─────────────────────────────────────────────────────────────

const STEPS: Step[] = ['delivery', 'items', 'overall', 'comments'];

function ProgressDots({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  return (
    <View style={s.dotsRow}>
      {STEPS.map((_, i) => (
        <View
          key={i}
          style={[
            s.dot,
            i <= idx && s.dotActive,
            i < idx && s.dotDone,
          ]}
        />
      ))}
    </View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function DeliveryNpsModal({ pendingReview, onDismiss }: Props) {
  const [step, setStep] = useState<Step>('delivery');
  const [submitting, setSubmitting] = useState(false);

  // Ratings
  const [deliverySpeed, setDeliverySpeed]       = useState(0);
  const [driverFriendly, setDriverFriendly]     = useState(0);
  const [packagingQuality, setPackagingQuality] = useState(0);
  const [itemsReceived, setItemsReceived]       = useState('');  // Yes / Partially / No
  const [itemCondition, setItemCondition]       = useState('');  // Good / Damaged
  const [overallSatisfaction, setOverallSatisfaction] = useState(0);
  const [wouldReorder, setWouldReorder]         = useState(''); // Yes / No
  const [comments, setComments]                 = useState('');

  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (pendingReview) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [pendingReview]);

  const animateStep = (cb: () => void) => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -20, duration: 150, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0,   duration: 100, useNativeDriver: true }),
    ]).start(() => {
      cb();
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const next = (to: Step) => animateStep(() => setStep(to));

  const submit = async () => {
    if (!pendingReview) return;
    setSubmitting(true);
    try {
      await api.post('/api/nps/delivery', {
        orderId:     pendingReview.orderId,
        orderNumber: pendingReview.orderNumber,
        branchSlug:  pendingReview.branchSlug,
        delivery: {
          speed:      deliverySpeed,
          driverFriendliness: driverFriendly,
          packagingQuality,
          itemsReceived,
          itemCondition,
        },
        overall: {
          satisfaction: overallSatisfaction,
          wouldReorder,
          comments: comments.trim(),
        },
        submittedAt: new Date().toISOString(),
      });
      animateStep(() => setStep('done'));
    } catch (err) {
      console.error('[DeliveryNPS] submit failed:', err);
      // Still dismiss so we don't trap the user
      animateStep(() => setStep('done'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!pendingReview) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[s.overlay, { opacity: step === 'done' ? fadeAnim : 1 }]}>
          <Animated.View style={[s.sheet, { transform: [{ scale: step === 'done' ? 1 : scaleAnim }] }]}>

            {/* ── Done screen ──────────────────────────────────────────── */}
            {step === 'done' && (
              <View style={s.doneWrap}>
                <View style={s.doneIconWrap}>
                  <CheckCircle color="#22c55e" size={56} />
                </View>
                <Text style={s.doneTitle}>Thank you! 🙏</Text>
                <Text style={s.doneSub}>
                  Your feedback helps us improve every delivery.
                </Text>
                <TouchableOpacity style={s.doneBtn} onPress={onDismiss}>
                  <Text style={s.doneBtnText}>Continue Shopping</Text>
                </TouchableOpacity>
              </View>
            )}

            {step !== 'done' && (
              <>
                {/* Header */}
                <View style={s.sheetHeader}>
                  <View style={s.sheetHeaderLeft}>
                    <Truck color="#FF6B35" size={20} />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={s.sheetTitle}>Rate Your Delivery</Text>
                      <Text style={s.sheetSub}>Order #{pendingReview.orderNumber}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={onDismiss} style={s.closeBtn}>
                    <X color="#9ca3af" size={20} />
                  </TouchableOpacity>
                </View>

                <ProgressDots current={step} />

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={s.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

                    {/* ── Step 1: Delivery Experience ─────────────────────── */}
                    {step === 'delivery' && (
                      <View>
                        <View style={s.stepBadge}>
                          <Truck color="#FF6B35" size={16} />
                          <Text style={s.stepBadgeText}>Delivery Experience</Text>
                        </View>

                        <StarPicker
                          label="How was your delivery speed?"
                          value={deliverySpeed}
                          onChange={setDeliverySpeed}
                        />
                        <StarPicker
                          label="How friendly was your driver?"
                          value={driverFriendly}
                          onChange={setDriverFriendly}
                        />
                        <StarPicker
                          label="How well was your order packaged?"
                          value={packagingQuality}
                          onChange={setPackagingQuality}
                        />

                        <TouchableOpacity
                          style={[s.nextBtn, (!deliverySpeed || !driverFriendly || !packagingQuality) && s.nextBtnDisabled]}
                          onPress={() => next('items')}
                          disabled={!deliverySpeed || !driverFriendly || !packagingQuality}
                        >
                          <Text style={s.nextBtnText}>Next</Text>
                          <ChevronRight color="#fff" size={18} />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* ── Step 2: Items received ───────────────────────────── */}
                    {step === 'items' && (
                      <View>
                        <View style={s.stepBadge}>
                          <Package color="#6366f1" size={16} />
                          <Text style={[s.stepBadgeText, { color: '#6366f1' }]}>Your Items</Text>
                        </View>

                        <OptionPicker
                          label="Did you receive all your items?"
                          options={[
                            { label: '✅ Yes, all items', value: 'Yes',       color: '#10b981' },
                            { label: '⚠️ Missing some',   value: 'Partially', color: '#f59e0b' },
                            { label: '❌ No, items missing', value: 'No',     color: '#ef4444' },
                          ]}
                          value={itemsReceived}
                          onChange={setItemsReceived}
                        />

                        <OptionPicker
                          label="Were your items in good condition?"
                          options={[
                            { label: '👍 Good condition', value: 'Good',    color: '#10b981' },
                            { label: '😟 Some were damaged', value: 'Damaged', color: '#ef4444' },
                          ]}
                          value={itemCondition}
                          onChange={setItemCondition}
                        />

                        <TouchableOpacity
                          style={[s.nextBtn, (!itemsReceived || !itemCondition) && s.nextBtnDisabled]}
                          onPress={() => next('overall')}
                          disabled={!itemsReceived || !itemCondition}
                        >
                          <Text style={s.nextBtnText}>Next</Text>
                          <ChevronRight color="#fff" size={18} />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* ── Step 3: Overall ──────────────────────────────────── */}
                    {step === 'overall' && (
                      <View>
                        <View style={s.stepBadge}>
                          <ThumbsUp color="#22c55e" size={16} />
                          <Text style={[s.stepBadgeText, { color: '#22c55e' }]}>Overall Experience</Text>
                        </View>

                        <StarPicker
                          label="Overall, how satisfied are you with your order?"
                          value={overallSatisfaction}
                          onChange={setOverallSatisfaction}
                        />

                        <OptionPicker
                          label="Would you order from TFS again?"
                          options={[
                            { label: '🙌 Definitely yes', value: 'Yes', color: '#10b981' },
                            { label: '🤔 Not sure',       value: 'Maybe', color: '#f59e0b' },
                            { label: '😔 Probably not',   value: 'No',  color: '#ef4444' },
                          ]}
                          value={wouldReorder}
                          onChange={setWouldReorder}
                        />

                        <TouchableOpacity
                          style={[s.nextBtn, (!overallSatisfaction || !wouldReorder) && s.nextBtnDisabled]}
                          onPress={() => next('comments')}
                          disabled={!overallSatisfaction || !wouldReorder}
                        >
                          <Text style={s.nextBtnText}>Next</Text>
                          <ChevronRight color="#fff" size={18} />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* ── Step 4: Comments ─────────────────────────────────── */}
                    {step === 'comments' && (
                      <View>
                        <View style={s.stepBadge}>
                          <MessageSquare color="#8b5cf6" size={16} />
                          <Text style={[s.stepBadgeText, { color: '#8b5cf6' }]}>Any Comments?</Text>
                        </View>

                        <Text style={s.starLabel}>
                          Anything you'd like to tell us? (optional)
                        </Text>
                        <TextInput
                          value={comments}
                          onChangeText={setComments}
                          placeholder="Tell us what went well or what we can improve…"
                          placeholderTextColor="#9ca3af"
                          multiline
                          numberOfLines={4}
                          style={s.commentInput}
                          textAlignVertical="top"
                        />

                        <TouchableOpacity
                          style={[s.nextBtn, submitting && s.nextBtnDisabled]}
                          onPress={submit}
                          disabled={submitting}
                        >
                          {submitting
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={s.nextBtnText}>Submit Feedback</Text>
                          }
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.skipBtn}
                          onPress={submit}
                          disabled={submitting}
                        >
                          <Text style={s.skipBtnText}>Skip & Submit</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                  </Animated.View>
                </ScrollView>
              </>
            )}

          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#1f2937' },
  sheetSub:   { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  dot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' },
  dotActive:{ width: 22, backgroundColor: '#FF6B35' },
  dotDone:  { width: 8, backgroundColor: '#fcd34d' },

  scrollContent: { paddingHorizontal: 22, paddingBottom: 36 },

  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff7f3',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  stepBadgeText: { fontSize: 14, fontWeight: '700', color: '#FF6B35' },

  // Stars
  starGroup:     { marginBottom: 22 },
  starLabel:     { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12, lineHeight: 20 },
  starRow:       { flexDirection: 'row', gap: 8 },
  starTouch:     { padding: 4 },
  starValueLabel:{ marginTop: 8, fontSize: 13, fontWeight: '600', color: '#f59e0b', textAlign: 'center' },

  // Options
  optionGroup: { marginBottom: 22 },
  optionRow:   { flexDirection: 'column', gap: 10 },
  optionBtn: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  optionBtnText:       { fontSize: 14, fontWeight: '600', color: '#4b5563', textAlign: 'center' },
  optionBtnTextActive: { color: '#fff' },

  // Comment
  commentInput: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14,
    padding: 14, fontSize: 14, color: '#1f2937',
    backgroundColor: '#f9fafb', minHeight: 100,
    marginBottom: 20,
  },

  // Buttons
  nextBtn: {
    backgroundColor: '#FF6B35', borderRadius: 16, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#FF6B35', shadowOpacity: 0.35, shadowRadius: 12, elevation: 5,
  },
  nextBtnDisabled: { backgroundColor: '#d1d5db', shadowOpacity: 0 },
  nextBtnText:     { color: '#fff', fontSize: 16, fontWeight: '800' },

  skipBtn:     { marginTop: 14, alignItems: 'center', paddingVertical: 12 },
  skipBtnText: { color: '#9ca3af', fontSize: 14, fontWeight: '500' },

  // Done
  doneWrap: { padding: 36, alignItems: 'center' },
  doneIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#f0fdf4',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 22,
    borderWidth: 2, borderColor: '#bbf7d0',
  },
  doneTitle: { fontSize: 28, fontWeight: '800', color: '#1f2937', marginBottom: 10 },
  doneSub:   { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  doneBtn: {
    backgroundColor: '#FF6B35', borderRadius: 16, paddingHorizontal: 40, paddingVertical: 16,
    shadowColor: '#FF6B35', shadowOpacity: 0.35, shadowRadius: 12, elevation: 5,
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── types ──────────────────────────────────────────────────────────────────
export type OrderStatus =
  | 'pending'
  | 'picking'
  | 'packaging'
  | 'collecting'
  | 'out_for_delivery'
  | 'delivered';

export const STATUS_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'picking', label: 'Picking' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'collecting', label: 'Collecting' },
  { key: 'out_for_delivery', label: 'Delivering' },
  { key: 'delivered', label: 'Delivered' },
];

export function getStatusIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

// ─── component ──────────────────────────────────────────────────────────────
export default function StatusStepper({ currentStatus }: { currentStatus: string }) {
  const currentIndex = getStatusIndex(currentStatus);

  return (
    <View style={styles.container}>
      {STATUS_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <View key={step.key} style={styles.stepWrapper}>
            {/* connector line drawn before every step except the first */}
            {index > 0 && (
              <View
                style={[
                  styles.connector,
                  index <= currentIndex ? styles.connectorActive : styles.connectorInactive,
                ]}
              />
            )}

            {/* circle */}
            <View
              style={[
                styles.circle,
                isCompleted && styles.circleCompleted,
                isCurrent && styles.circleCurrent,
                !isCompleted && !isCurrent && styles.circleFuture,
              ]}
            >
              {isCompleted ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Text
                  style={[styles.circleText, isCurrent && styles.circleTextCurrent]}
                >
                  {index + 1}
                </Text>
              )}
            </View>

            {/* label */}
            <Text
              style={[
                styles.label,
                isCurrent && styles.labelCurrent,
                isCompleted && styles.labelCompleted,
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  stepWrapper: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  connector: {
    width: 24,
    height: 2,
    marginBottom: 18, // vertical centre-aligns with the 28-px circle
  },
  connectorActive: { backgroundColor: '#10B981' },
  connectorInactive: { backgroundColor: '#e0e0e0' },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCompleted: { backgroundColor: '#10B981' },
  circleCurrent: { backgroundColor: '#FF6B35' },
  circleFuture: { backgroundColor: '#e0e0e0' },
  circleText: { fontSize: 13, fontWeight: '700', color: '#999' },
  circleTextCurrent: { color: '#fff' },
  label: {
    width: '100%',
    textAlign: 'center',
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  labelCurrent: { color: '#FF6B35', fontWeight: '700' },
  labelCompleted: { color: '#10B981', fontWeight: '600' },
});
// src/components/AppModal.tsx
// Drop-in replacement for Alert.alert — avoids iOS stacking-alert issues.
// Usage:
//   const { showModal } = useAppModal();
//   showModal({ title: 'Hi', message: 'Done', buttons: [{ text: 'OK' }] });

import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModalButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface ModalOptions {
  title: string;
  message?: string;
  buttons?: ModalButton[];
}

interface ModalContextValue {
  showModal: (opts: ModalOptions) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ModalContext = createContext<ModalContextValue>({
  showModal: () => {},
});

export function useAppModal() {
  return useContext(ModalContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppModalProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible]   = useState(false);
  const [options, setOptions]   = useState<ModalOptions>({ title: '' });
  // Queue so rapid calls don't clobber each other
  const queue = React.useRef<ModalOptions[]>([]);

  const dismiss = useCallback(() => {
    setVisible(false);
    // Slight delay so dismiss animation plays before next modal appears
    setTimeout(() => {
      if (queue.current.length > 0) {
        const next = queue.current.shift()!;
        setOptions(next);
        setVisible(true);
      }
    }, 250);
  }, []);

  const showModal = useCallback((opts: ModalOptions) => {
    if (visible) {
      queue.current.push(opts);
      return;
    }
    setOptions(opts);
    setVisible(true);
  }, [visible]);

  const buttons: ModalButton[] = options.buttons?.length
    ? options.buttons
    : [{ text: 'OK' }];

  return (
    <ModalContext.Provider value={{ showModal }}>
      {children}
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          // Allow back-button dismiss (Android) only if there's a cancel button
          const cancel = buttons.find(b => b.style === 'cancel');
          if (cancel) { cancel.onPress?.(); dismiss(); }
        }}
      >
        <View style={s.backdrop}>
          <View style={s.card}>
            <Text style={s.title}>{options.title}</Text>
            {!!options.message && <Text style={s.message}>{options.message}</Text>}

            <View style={[s.btnRow, buttons.length > 2 && s.btnCol]}>
              {buttons.map((btn, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    s.btn,
                    buttons.length <= 2 && s.btnFlex,
                    btn.style === 'cancel'      && s.btnCancel,
                    btn.style === 'destructive' && s.btnDestructive,
                    idx === buttons.length - 1 && btn.style !== 'cancel' && btn.style !== 'destructive' && s.btnPrimary,
                  ]}
                  onPress={() => { btn.onPress?.(); dismiss(); }}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    s.btnText,
                    btn.style === 'cancel'      && s.btnTextCancel,
                    btn.style === 'destructive' && s.btnTextDestructive,
                    idx === buttons.length - 1 && btn.style !== 'cancel' && btn.style !== 'destructive' && s.btnTextPrimary,
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </ModalContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  btnCol: {
    flexDirection: 'column',
  },
  btnFlex: {
    flex: 1,
  },
  btn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  btnCancel: {
    backgroundColor: '#f3f4f6',
  },
  btnDestructive: {
    backgroundColor: '#fee2e2',
  },
  btnPrimary: {
    backgroundColor: '#FF6B35',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  btnTextCancel: {
    color: '#6b7280',
  },
  btnTextDestructive: {
    color: '#dc2626',
  },
  btnTextPrimary: {
    color: '#fff',
  },
});

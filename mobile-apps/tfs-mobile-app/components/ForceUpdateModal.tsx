import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Download } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DOWNLOAD_URL = 'https://tfswholesalers.com/download';

export default function ForceUpdateModal() {
  const handleUpdate = () => {
    Linking.openURL(DOWNLOAD_URL).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={['#FF6B35', '#FF8C5A']} style={styles.iconWrap}>
        <Download color="#fff" size={40} />
      </LinearGradient>

      <Text style={styles.title}>We've updated the app!</Text>
      <Text style={styles.subtitle}>
        For the best experience, please download the latest version of the
        TFS Wholesalers app. It only takes a minute.
      </Text>

      <TouchableOpacity style={styles.updateButton} onPress={handleUpdate} activeOpacity={0.85}>
        <Text style={styles.updateButtonText}>Update Now</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  updateButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
  },
  updateButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
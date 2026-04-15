import { useEffect } from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    checkBranchSelection();
  }, []);

  const checkBranchSelection = async () => {
    try {
      const savedBranch = await AsyncStorage.getItem('selectedBranch');
      setTimeout(() => {
        if (savedBranch) {
          router.replace('/(tabs)');
        } else {
          router.replace('/branch-select');
        }
      }, 1500);
    } catch (error) {
      console.error('Failed to check branch:', error);
      router.replace('/branch-select');
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator size="large" color="#FF6B35" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 100,
  },
  loader: {
    marginTop: 40,
  },
});
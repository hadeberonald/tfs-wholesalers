import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
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
      <Text style={styles.logo}>TFS</Text>
      <Text style={styles.title}>Wholesalers</Text>
      <ActivityIndicator size="large" color="#FF6B35" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    color: '#fff',
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  },
});

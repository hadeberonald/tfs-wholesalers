import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';

export default function MenuScreen() {
  const router          = useRouter();
  const user            = useStore((state) => state.user);
  const branch          = useStore((state) => state.branch);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const logout          = useStore((state) => state.logout);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            // Replace the entire stack so the user can't swipe back into an
            // authenticated screen. Branch-select will fetch fresh data on mount.
            router.replace('/branch-select');
          },
        },
      ]
    );
  };

  const handleChangeBranch = () => {
    Alert.alert(
      'Change Branch',
      'This will clear your cart. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => router.push('/branch-select') },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
      </View>

      {/* Profile Section */}
      <View style={styles.section}>
        {isAuthenticated && user ? (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.signInCard}
            onPress={() => router.push('/login')}
            activeOpacity={0.7}
          >
            <View style={styles.signInIcon}>
              <Text style={styles.signInIconText}>👤</Text>
            </View>
            <View style={styles.signInInfo}>
              <Text style={styles.signInTitle}>Sign In</Text>
              <Text style={styles.signInSubtitle}>Access your account and orders</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Branch Info */}
      {branch && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Branch</Text>
          <View style={styles.branchCard}>
            <View style={styles.branchIcon}>
              <Text style={styles.branchIconText}>🏪</Text>
            </View>
            <View style={styles.branchInfo}>
              <Text style={styles.branchName}>{branch.displayName}</Text>
              {branch.settings?.storeLocation?.address && (
                <Text style={styles.branchAddress} numberOfLines={1}>
                  {branch.settings.storeLocation.address}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.changeBranchButton} onPress={handleChangeBranch}>
            <Text style={styles.changeBranchText}>Change Branch</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Account Menu */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        {isAuthenticated ? (
          <>
            <MenuItem icon="📦" title="My Orders"        subtitle="View order history"       onPress={() => router.push('/orders')} />
            <MenuItem icon="👤" title="Profile Settings" subtitle="Manage your account"      onPress={() => router.push('/profile')} />
            <MenuItem icon="📍" title="Addresses"        subtitle="Manage delivery addresses" onPress={() => router.push('/addresses')} />
          </>
        ) : (
          <View style={styles.signInPrompt}>
            <Text style={styles.signInPromptText}>Sign in to access your orders and profile</Text>
            <TouchableOpacity style={styles.signInPromptButton} onPress={() => router.push('/login')}>
              <Text style={styles.signInPromptButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <MenuItem
          icon="❓"
          title="Help Center"
          subtitle="Get help and support"
          onPress={() => Alert.alert('Help', 'Contact support at support@tfswholesalers.com')}
        />
        <MenuItem
          icon="ℹ️"
          title="About"
          subtitle="App version 1.0.0"
          onPress={() => Alert.alert('About', 'TFS Wholesalers Mobile App v1.0.0')}
        />
      </View>

      {/* Sign Out */}
      {isAuthenticated && (
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function MenuItem({
  icon, title, subtitle, onPress,
}: {
  icon: string; title: string; subtitle: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuItemIcon}>
        <Text style={styles.menuItemIconText}>{icon}</Text>
      </View>
      <View style={styles.menuItemContent}>
        <Text style={styles.menuItemTitle}>{title}</Text>
        <Text style={styles.menuItemSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.menuItemArrow}>→</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:               { flex: 1, backgroundColor: '#f9fafb' },
  header:                  { backgroundColor: '#fff', padding: 16, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title:                   { fontSize: 28, fontWeight: 'bold', color: '#1f2937' },
  section:                 { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle:            { fontSize: 16, fontWeight: '600', color: '#6b7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  profileCard:             { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' },
  avatar:                  { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FF6B35', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  avatarText:              { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  profileInfo:             { flex: 1 },
  profileName:             { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  profileEmail:            { fontSize: 14, color: '#6b7280' },
  signInCard:              { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' },
  signInIcon:              { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fef3e9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  signInIconText:          { fontSize: 24 },
  signInInfo:              { flex: 1 },
  signInTitle:             { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  signInSubtitle:          { fontSize: 14, color: '#6b7280' },
  arrow:                   { fontSize: 24, color: '#FF6B35' },
  branchCard:              { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  branchIcon:              { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fef3e9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  branchIconText:          { fontSize: 24 },
  branchInfo:              { flex: 1 },
  branchName:              { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  branchAddress:           { fontSize: 14, color: '#6b7280' },
  changeBranchButton:      { backgroundColor: '#f3f4f6', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  changeBranchText:        { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  menuItem:                { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  menuItemIcon:            { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fef3e9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuItemIconText:        { fontSize: 20 },
  menuItemContent:         { flex: 1 },
  menuItemTitle:           { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  menuItemSubtitle:        { fontSize: 14, color: '#6b7280' },
  menuItemArrow:           { fontSize: 20, color: '#9ca3af' },
  signInPrompt:            { backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center' },
  signInPromptText:        { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 16 },
  signInPromptButton:      { backgroundColor: '#FF6B35', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  signInPromptButtonText:  { color: '#fff', fontSize: 14, fontWeight: '600' },
  signOutButton:           { backgroundColor: '#fff', borderWidth: 2, borderColor: '#ef4444', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  signOutButtonText:       { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
});
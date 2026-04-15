import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Animated,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ShoppingCart,
  ArrowLeft,
  Home,
  ShoppingBag,
  Tag,
  Heart,
  LogOut,
  Store,
  ChevronDown,
  ChevronRight,
  User,
  Package,
} from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HeaderProps {
  showBack?: boolean;
  title?: string;
}

export default function Header({ showBack, title }: HeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const items  = useStore((state) => state.items);
  const user   = useStore((state) => state.user);
  const branch = useStore((state) => state.branch);
  const logout = useStore((state) => state.logout);

  const isAuthenticated = !!user;

  const [menuOpen,        setMenuOpen]        = useState(false);
  const [shopExpanded,    setShopExpanded]    = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);

  const menuAnim    = useRef(new Animated.Value(0)).current;
  const bar2Opacity = useRef(new Animated.Value(1)).current;
  const bar1Y       = useRef(new Animated.Value(0)).current;
  const bar3Y       = useRef(new Animated.Value(0)).current;
  const bar1Rot     = useRef(new Animated.Value(0)).current;
  const bar3Rot     = useRef(new Animated.Value(0)).current;

  const cartItemCount = items.reduce(
    (sum, item) => (item.autoAdded ? sum : sum + item.quantity),
    0,
  );

  const openMenu = () => {
    setMenuOpen(true);
    Animated.parallel([
      Animated.spring(menuAnim,    { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 200 }),
      Animated.timing(bar2Opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(bar1Y,       { toValue: 7,  duration: 200, useNativeDriver: true }),
      Animated.timing(bar3Y,       { toValue: -7, duration: 200, useNativeDriver: true }),
      Animated.timing(bar1Rot,     { toValue: 1, duration: 250, delay: 150, useNativeDriver: true }),
      Animated.timing(bar3Rot,     { toValue: 1, duration: 250, delay: 150, useNativeDriver: true }),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.spring(menuAnim,    { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
      Animated.timing(bar2Opacity, { toValue: 1, duration: 150, delay: 150, useNativeDriver: true }),
      Animated.timing(bar1Rot,     { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(bar3Rot,     { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(bar1Y,       { toValue: 0, duration: 250, delay: 150, useNativeDriver: true }),
      Animated.timing(bar3Y,       { toValue: 0, duration: 250, delay: 150, useNativeDriver: true }),
    ]).start(() => setMenuOpen(false));
  };

  const toggleMenu = () => (menuOpen ? closeMenu() : openMenu());

  const navigate = (path: any) => {
    closeMenu();
    setTimeout(() => router.push(path), 150);
  };

  const handleLogout = async () => {
    closeMenu();
    await logout();
    setTimeout(() => router.replace('/branch-select'), 200);
  };

  const animBar1 = {
    transform: [
      { translateY: bar1Y },
      { rotate: bar1Rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) },
    ],
  };
  const animBar3 = {
    transform: [
      { translateY: bar3Y },
      { rotate: bar3Rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-45deg'] }) },
    ],
  };

  const menuTranslateY = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });

  return (
    <View style={styles.outerWrap}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          {/* Left */}
          <View style={styles.left}>
            {showBack ? (
              <TouchableOpacity
                onPress={() => (router.canGoBack() ? router.back() : router.push('/(tabs)'))}
                style={styles.iconBtn}
              >
                <ArrowLeft color="#1f2937" size={24} />
              </TouchableOpacity>
            ) : (
              <Image source={require('@/assets/logo.png')} style={styles.logo} resizeMode="contain" />
            )}
            {title && <Text style={styles.titleText}>{title}</Text>}
          </View>

          {/* Right */}
          <View style={styles.right}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/cart')} style={styles.iconBtn}>
              <ShoppingCart color="#1f2937" size={22} />
              {cartItemCount > 0 && <Badge count={cartItemCount} />}
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleMenu} style={styles.iconBtn}>
              <View style={styles.hamburgerWrap}>
                <Animated.View style={[styles.hamburgerBar, animBar1]} />
                <Animated.View style={[styles.hamburgerBar, { opacity: bar2Opacity }]} />
                <Animated.View style={[styles.hamburgerBar, animBar3]} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Slide-down menu */}
      {menuOpen && (
        <>
          <Pressable style={styles.backdrop} onPress={closeMenu} />

          <Animated.View
            style={[
              styles.menuPanel,
              { opacity: menuAnim, transform: [{ translateY: menuTranslateY }] },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ paddingTop: 8 }}
            >
              {/* Profile / sign-in */}
              {isAuthenticated && user ? (
                <TouchableOpacity style={styles.profileRow} onPress={() => navigate('/profile')}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{user.name}</Text>
                    <Text style={styles.profileEmail}>{user.email}</Text>
                  </View>
                  <ChevronRight color="#d1d5db" size={16} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.signInRow} onPress={() => navigate('/login')}>
                  <View style={styles.signInIconWrap}>
                    <User color="#FF6B35" size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.signInTitle}>Sign In</Text>
                    <Text style={styles.signInSub}>Access your account</Text>
                  </View>
                  <ChevronRight color="#FF6B35" size={18} />
                </TouchableOpacity>
              )}

              {/* Branch pill */}
              {branch && (
                <View style={styles.branchPill}>
                  <Store color="#FF6B35" size={15} />
                  <Text style={styles.branchPillText} numberOfLines={1}>
                    {branch.displayName}
                  </Text>
                </View>
              )}

              <View style={styles.divider} />

              {/* Shop accordion */}
              <AccordionSection
                label="SHOP"
                icon={<ShoppingBag color="#9ca3af" size={15} />}
                expanded={shopExpanded}
                onToggle={() => setShopExpanded(!shopExpanded)}
              >
                <MenuRow
                  icon={<Home color="#FF6B35" size={18} />}
                  label="Home"
                  onPress={() => navigate('/(tabs)')}
                />
                <MenuRow
                  icon={<ShoppingBag color="#FF6B35" size={18} />}
                  label="All Products"
                  onPress={() => navigate('/(tabs)/shop')}
                />
                {/* Specials → navigates to shop screen, specials tab is selected via param */}
                <MenuRow
                  icon={<Tag color="#FF6B35" size={18} />}
                  label="Specials & Combos"
                  onPress={() => navigate({ pathname: '/(tabs)/shop', params: { tab: 'specials' } })}
                />
              </AccordionSection>

              {/* Account accordion — only shown when signed in */}
              {isAuthenticated && (
                <AccordionSection
                  label="ACCOUNT"
                  icon={<User color="#9ca3af" size={15} />}
                  expanded={accountExpanded}
                  onToggle={() => setAccountExpanded(!accountExpanded)}
                >
                  <MenuRow
                    icon={<User color="#FF6B35" size={18} />}
                    label="Profile"
                    onPress={() => navigate('/profile')}
                  />
                  <MenuRow
                    icon={<Package color="#FF6B35" size={18} />}
                    label="My Orders"
                    onPress={() => navigate('/orders')}
                  />
                  <MenuRow
                    icon={<Heart color="#FF6B35" size={18} />}
                    label="Wishlist"
                    onPress={() => navigate('/wishlist')}
                  />
                </AccordionSection>
              )}

              <View style={styles.divider} />

              {branch && (
                <MenuRow
                  icon={<Store color="#6b7280" size={18} />}
                  label="Change Branch"
                  onPress={() => navigate('/branch-select')}
                />
              )}

              {isAuthenticated && (
                <MenuRow
                  icon={<LogOut color="#ef4444" size={18} />}
                  label="Sign Out"
                  onPress={handleLogout}
                  danger
                />
              )}

              <View style={{ height: 12 }} />
            </ScrollView>
          </Animated.View>
        </>
      )}
    </View>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────────

function Badge({ count }: { count: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

// ── Accordion section ──────────────────────────────────────────────────────────

function AccordionSection({
  label, icon, expanded, onToggle, children,
}: {
  label: string; icon: React.ReactNode; expanded: boolean;
  onToggle: () => void; children: React.ReactNode;
}) {
  const rotAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Animated.timing(rotAnim, {
      toValue: expanded ? 0 : 1, duration: 200, useNativeDriver: true,
    }).start();
    onToggle();
  };

  const chevronRot = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View>
      <TouchableOpacity style={styles.accordionHeader} onPress={toggle} activeOpacity={0.7}>
        <View style={styles.accordionLeft}>
          {icon}
          <Text style={styles.accordionLabel}>{label}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRot }] }}>
          <ChevronDown color="#9ca3af" size={16} />
        </Animated.View>
      </TouchableOpacity>
      {expanded && <View>{children}</View>}
    </View>
  );
}

// ── Menu row ───────────────────────────────────────────────────────────────────

function MenuRow({
  icon, label, onPress, danger = false,
}: {
  icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuRowIcon}>{icon}</View>
      <Text style={[styles.menuRowLabel, danger && { color: '#ef4444' }]}>{label}</Text>
      {!danger && <ChevronRight color="#d1d5db" size={16} />}
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerWrap:       { zIndex: 100 },
  container:       { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12 },
  left:            { flexDirection: 'row', alignItems: 'center' },
  right:           { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logo:            { width: 120, height: 40 },
  titleText:       { fontSize: 18, fontWeight: '600', color: '#1f2937', marginLeft: 12 },
  iconBtn:         { position: 'relative', padding: 8 },
  hamburgerWrap:   { width: 22, height: 16, justifyContent: 'space-between' },
  hamburgerBar:    { height: 2, width: 22, backgroundColor: '#1f2937', borderRadius: 2 },
  badge:           { position: 'absolute', top: 2, right: 2, backgroundColor: '#FF6B35', borderRadius: 9, minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:       { color: '#fff', fontSize: 10, fontWeight: '700' },
  backdrop:        { position: 'absolute', top: '100%', left: 0, right: 0, height: 2000, zIndex: 99 },
  menuPanel:       { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, marginHorizontal: 12, backgroundColor: '#fff', borderRadius: 16, maxHeight: 520, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 12, zIndex: 100, overflow: 'hidden' },
  profileRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 14 },
  avatar:          { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF6B35', alignItems: 'center', justifyContent: 'center' },
  avatarText:      { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  profileName:     { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  profileEmail:    { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  signInRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  signInIconWrap:  { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fef3e9', alignItems: 'center', justifyContent: 'center' },
  signInTitle:     { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  signInSub:       { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  branchPill:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 12, backgroundColor: '#fef3e9', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  branchPillText:  { fontSize: 13, fontWeight: '600', color: '#1f2937', flex: 1 },
  divider:         { height: 1, backgroundColor: '#f3f4f6', marginVertical: 4 },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 13 },
  accordionLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accordionLabel:  { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.8 },
  menuRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13, gap: 14 },
  menuRowIcon:     { width: 28, alignItems: 'center' },
  menuRowLabel:    { flex: 1, fontSize: 15, fontWeight: '500', color: '#1f2937' },
});
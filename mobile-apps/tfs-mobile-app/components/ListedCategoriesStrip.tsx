// tfs-wholesalers/mobile-apps/tfs-mobile-app/components/ListedCategoriesStrip.tsx
// Compact horizontally-scrollable category nav tiles for the React Native app.
// Placed directly under the hero carousel — no heading, no intro copy.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import api from '@/lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TILE_SIZE  = 60;  // circle diameter
const TILE_WIDTH = 76;  // total tile width including label area
const TILE_GAP   = 8;

interface ListedCategory {
  _id: string;
  name: string;
  image?: string;
  icon?: string; // dedicated icon image — preferred over image
}

interface Props {
  branchId: string;
}

export default function ListedCategoriesStrip({ branchId }: Props) {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const [categories,    setCategories]    = useState<ListedCategory[]>([]);
  const [scrollIndex,   setScrollIndex]   = useState(0);

  useEffect(() => {
    if (!branchId) return;
    api
      .get(`/api/categories?branchId=${branchId}&listed=true`)
      .then(r => setCategories(r.data.categories || []))
      .catch(console.error);
  }, [branchId]);

  if (!categories.length) return null;

  // How many full tiles fit in the viewport at once
  const visibleCount = Math.floor(SCREEN_WIDTH / (TILE_WIDTH + TILE_GAP));
  const canScrollLeft  = scrollIndex > 0;
  const canScrollRight = scrollIndex + visibleCount < categories.length;

  const scrollBy = (dir: 'left' | 'right') => {
    const next =
      dir === 'left'
        ? Math.max(0, scrollIndex - visibleCount)
        : Math.min(categories.length - visibleCount, scrollIndex + visibleCount);

    flatListRef.current?.scrollToIndex({ index: Math.max(0, next), animated: true });
    setScrollIndex(Math.max(0, next));
  };

  const renderTile = ({ item }: { item: ListedCategory }) => {
    // Prefer dedicated icon, fall back to category image
    const imgSrc = item.icon || item.image;

    return (
      <TouchableOpacity
        style={styles.tile}
        onPress={() =>
          router.push({ pathname: '/(tabs)/shop', params: { categoryId: item._id } })
        }
        activeOpacity={0.75}
      >
        {/* Circle */}
        <View style={styles.tileCircle}>
          {imgSrc ? (
            <Image source={{ uri: imgSrc }} style={styles.tileImage} />
          ) : (
            <Text style={styles.tileLetter}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        {/* Label always shown */}
        <Text style={styles.tileLabel} numberOfLines={2}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* Left chevron — invisible (not gone) when disabled so layout stays stable */}
      <TouchableOpacity
        onPress={() => scrollBy('left')}
        style={[styles.chevron, !canScrollLeft && styles.chevronHidden]}
        disabled={!canScrollLeft}
        activeOpacity={0.7}
      >
        <ChevronLeft size={16} color="#FF6B35" />
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={categories}
        renderItem={renderTile}
        keyExtractor={item => item._id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={TILE_WIDTH + TILE_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onScrollToIndexFailed={() => {}}
        style={styles.list}
        onScroll={e => {
          const x = e.nativeEvent.contentOffset.x;
          setScrollIndex(Math.round(x / (TILE_WIDTH + TILE_GAP)));
        }}
        scrollEventThrottle={32}
      />

      {/* Right chevron */}
      <TouchableOpacity
        onPress={() => scrollBy('right')}
        style={[styles.chevron, !canScrollRight && styles.chevronHidden]}
        disabled={!canScrollRight}
        activeOpacity={0.7}
      >
        <ChevronRight size={16} color="#FF6B35" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: '#fff',
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 4,
    gap: TILE_GAP,
    alignItems: 'flex-start',
  },

  // ── Chevrons ──────────────────────────────────────────────────────────────
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 1,
  },
  chevronHidden: { opacity: 0 },

  // ── Tile ──────────────────────────────────────────────────────────────────
  tile: {
    width: TILE_WIDTH,
    alignItems: 'center',
    gap: 5,
  },
  tileCircle: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: TILE_SIZE / 2,
    backgroundColor: '#fff7f3',
    borderWidth: 2,
    borderColor: '#fed7aa',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileLetter: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 13,
  },
});
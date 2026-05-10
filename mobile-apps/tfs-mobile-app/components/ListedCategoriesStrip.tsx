// tfs-wholesalers/mobile-apps/tfs-mobile-app/components/ListedCategoriesStrip.tsx
// Shows up to 8 listed categories as a centred 4-column × 2-row grid.
// No scroll, no chevrons — all tiles always visible.
// Placed directly under the hero carousel with no heading or intro copy.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '@/lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 4 tiles per row with equal spacing
const COLUMNS    = 4;
const TILE_SIZE  = 56; // circle diameter
// Tile takes up an equal share of screen width
const TILE_WIDTH = Math.floor(SCREEN_WIDTH / COLUMNS);

interface ListedCategory {
  _id: string;
  name: string;
  image?: string;
  icon?: string;
}

interface Props {
  branchId: string;
}

export default function ListedCategoriesStrip({ branchId }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<ListedCategory[]>([]);

  useEffect(() => {
    if (!branchId) return;
    api
      .get(`/api/categories?branchId=${branchId}&listed=true`)
      // Hard cap at 8 — fills exactly 2 rows of 4
      .then(r => setCategories((r.data.categories || []).slice(0, 8)))
      .catch(console.error);
  }, [branchId]);

  if (!categories.length) return null;

  return (
    <View style={styles.wrapper}>
      {/* Flex-wrap produces the 4×2 grid naturally */}
      <View style={styles.grid}>
        {categories.map(item => {
          const imgSrc = item.icon || item.image;
          return (
            <TouchableOpacity
              key={item._id}
              style={styles.tile}
              onPress={() =>
                router.push({ pathname: '/(tabs)/shop', params: { categoryId: item._id } })
              }
              activeOpacity={0.75}
            >
              <View style={styles.tileCircle}>
                {imgSrc ? (
                  <Image source={{ uri: imgSrc }} style={styles.tileImage} />
                ) : (
                  <Text style={styles.tileLetter}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={styles.tileLabel} numberOfLines={2}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 12,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  tile: {
    width: TILE_WIDTH,
    alignItems: 'center',
    paddingVertical: 8,
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
    paddingHorizontal: 4,
  },
});
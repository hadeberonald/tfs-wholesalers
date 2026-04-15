/**
 * cardStyles.ts
 *
 * KEY DESIGN DECISION: No minHeight on any content block.
 * Cards size to their content naturally. If a card has a banner it takes
 * that space. If it doesn't, that space doesn't exist — no whitespace hole.
 *
 * Description gets numberOfLines={3} so it fills space when there's no
 * banner below it, rather than leaving a gap.
 */

import { Dimensions, StyleSheet } from 'react-native';

export const SCREEN_WIDTH = Dimensions.get('window').width;
export const CARD_WIDTH   = (SCREEN_WIDTH - 40) / 2;

export const shared = StyleSheet.create({

  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
    backgroundColor: '#f3f4f6',
  },
  image:       { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef3e9' },

  badgesContainer: { position: 'absolute', top: 8, left: 8, gap: 4 },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, gap: 3,
  },
  badgeRed:    { backgroundColor: '#ef4444' },
  badgeOrange: { backgroundColor: '#FF6B35' },
  badgePurple: { backgroundColor: '#8b5cf6' },
  badgeYellow: { backgroundColor: '#eab308' },
  badgeText:   { color: '#fff', fontSize: 9, fontWeight: 'bold' },

  wishlistButton: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, padding: 6,
  },

  stockWarning: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: '#eab308', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
  },
  stockWarningText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },

  content: { padding: 10 },

  name: { fontSize: 13, fontWeight: '600', color: '#1f2937', marginBottom: 3 },
  unitText: { fontSize: 10, color: '#6b7280', marginBottom: 2 },

  // Description: no fixed height — just clamp lines. More lines = fills space naturally.
  description: { fontSize: 10, color: '#6b7280', marginBottom: 6, lineHeight: 14 },

  // Banners: only rendered when there IS content. No spacer twins.
  infoBannerBlue: {
    backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#93c5fd',
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5, marginBottom: 6,
  },
  infoBannerPurple: {
    backgroundColor: '#f3e8ff', borderWidth: 1, borderColor: '#d8b4fe',
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5, marginBottom: 6,
  },
  infoBannerTextBlue:   { fontSize: 10, color: '#1e40af', fontWeight: '600' },
  infoBannerTextPurple: { fontSize: 10, color: '#7c3aed', fontWeight: '600' },

  priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  price:    { fontSize: 17, fontWeight: 'bold', color: '#FF6B35' },
  oldPrice: { fontSize: 11, color: '#9ca3af', textDecorationLine: 'line-through' },
  savingsText: { fontSize: 10, color: '#10b981', fontWeight: '600', marginBottom: 4 },

  cartActions: { flexDirection: 'row', gap: 6, marginTop: 6 },
  quantityControl: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
  },
  quantityButton: { padding: 7 },
  quantityText: { fontSize: 13, fontWeight: '600', color: '#1f2937', paddingHorizontal: 6 },
  addButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FF6B35', paddingVertical: 8, borderRadius: 8, gap: 4,
  },
  outOfStock: {
    backgroundColor: '#e5e7eb', paddingVertical: 8,
    borderRadius: 8, alignItems: 'center', marginTop: 6,
  },
  outOfStockText: { color: '#6b7280', fontSize: 11, fontWeight: '600' },

  loadingContainer: { height: 60, alignItems: 'center', justifyContent: 'center' },
});
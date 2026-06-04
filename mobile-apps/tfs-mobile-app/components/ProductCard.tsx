import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Alert, Modal, FlatList, TouchableWithoutFeedback, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingCart, Plus, Minus, Package, Tag, Heart, ChevronDown, Check } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { shared } from './cardStyles';
import type { Product } from '@/lib/types';

interface ProductCardProps { product: Product; }

interface VariantOption {
  value: string;
  label: string;
  sublabel?: string;
  outOfStock: boolean;
}

function VariantPickerModal({
  options, value, onChange,
}: {
  options: VariantOption[];
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value) ?? options[0];

  return (
    <>
      <TouchableOpacity style={pickerStyles.trigger} onPress={e => { e.stopPropagation(); setOpen(true); }} activeOpacity={0.7}>
        <Text style={[pickerStyles.triggerText, selected.outOfStock && pickerStyles.triggerTextMuted]} numberOfLines={1}>{selected.label}</Text>
        <ChevronDown color="#9ca3af" size={13} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}><View style={pickerStyles.backdrop} /></TouchableWithoutFeedback>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.handle} />
          <Text style={pickerStyles.sheetTitle}>Select an option</Text>
          <FlatList
            data={options}
            keyExtractor={o => o.value}
            style={pickerStyles.list}
            renderItem={({ item: opt }) => {
              const isSelected = opt.value === value;
              return (
                <Pressable onPress={() => { if (!opt.outOfStock) { onChange(opt.value); setOpen(false); } }}
                  style={[pickerStyles.option, isSelected && pickerStyles.optionSelected, opt.outOfStock && pickerStyles.optionDisabled]}
                >
                  <View style={pickerStyles.optionText}>
                    <Text style={[pickerStyles.optionLabel, isSelected && pickerStyles.optionLabelSelected, opt.outOfStock && pickerStyles.optionLabelMuted]} numberOfLines={2}>{opt.label}</Text>
                    {opt.sublabel ? <Text style={[pickerStyles.optionSub, isSelected && pickerStyles.optionSubSelected]}>{opt.sublabel}</Text> : null}
                    {opt.outOfStock ? <Text style={pickerStyles.outOfStockLabel}>Out of stock</Text> : null}
                  </View>
                  {isSelected && !opt.outOfStock && <View style={pickerStyles.checkCircle}><Check color="#fff" size={12} strokeWidth={3} /></View>}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={pickerStyles.separator} />}
          />
          <TouchableOpacity style={pickerStyles.closeBtn} onPress={() => setOpen(false)}>
            <Text style={pickerStyles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const pickerStyles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6 },
  triggerText: { flex: 1, fontSize: 12, color: '#374151', fontWeight: '500', marginRight: 4 },
  triggerTextMuted: { color: '#9ca3af' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, maxHeight: '75%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d1d5db', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: '#111827', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  list: { flexGrow: 0 },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff' },
  optionSelected: { backgroundColor: '#fff7ed' },
  optionDisabled: { opacity: 0.5 },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  optionLabelSelected: { color: '#ea580c' },
  optionLabelMuted: { color: '#9ca3af' },
  optionSub: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  optionSubSelected: { color: '#fb923c' },
  outOfStockLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  separator: { height: 1, backgroundColor: '#f9fafb', marginHorizontal: 20 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  closeBtn: { marginHorizontal: 20, marginTop: 12, backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
});

export default function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const addToCart          = useStore((s) => s.addToCart);
  const addToWishlist      = useStore((s) => s.addToWishlist);
  const removeFromWishlist = useStore((s) => s.removeFromWishlist);
  const wishlist           = useStore((s) => s.wishlist);
  const user               = useStore((s) => s.user);
  const isAuthenticated    = !!user;

  const [quantity, setQuantity]                   = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  const threshold      = (product as any).lowStockThreshold ?? 0;
  const activeVariants = product.variants?.filter((v: any) => v.active) ?? [];
  const selectedVariant = activeVariants.find((v: any) => v._id === selectedVariantId) ?? undefined;
  const hasVariants    = product.hasVariants && activeVariants.length > 0;

  const effectiveVariant = (() => {
    if (selectedVariantId) return selectedVariant;
    if ((product.stockLevel ?? 0) > threshold) return undefined;
    return activeVariants.find((v: any) => v.stockLevel > threshold) ?? undefined;
  })();

  const displayPrice = effectiveVariant
    ? (effectiveVariant.specialPrice || effectiveVariant.price || product.price)
    : (product.specialPrice || product.price);

  const comparePrice = effectiveVariant
    ? (effectiveVariant.compareAtPrice || product.compareAtPrice)
    : product.compareAtPrice;

  const hasDiscount     = !!(comparePrice && comparePrice > displayPrice);
  const discountPercent = hasDiscount ? Math.round(((comparePrice! - displayPrice) / comparePrice!) * 100) : 0;

  const primaryImage = effectiveVariant?.images?.length ? effectiveVariant.images[0] : (product.images?.[0] || '');

  const stock    = effectiveVariant ? effectiveVariant.stockLevel : (product.stockLevel ?? 0);
  const inStock  = stock > threshold;
  const lowStock = stock > threshold && stock <= (threshold + 10);

  const isInWishlist = wishlist.some((item: any) =>
    effectiveVariant
      ? item.id === product._id && item.variantId === effectiveVariant._id
      : item.id === product._id && !item.variantId,
  );

  const toggleWishlist = (e: any) => {
    e.stopPropagation();
    if (!isAuthenticated) { Alert.alert('Sign In Required', 'Please sign in to use the wishlist feature'); return; }
    if (isInWishlist) { removeFromWishlist(product._id, effectiveVariant?._id); }
    else { addToWishlist({ id: product._id, variantId: effectiveVariant?._id, name: product.name, variantName: effectiveVariant?.name, price: displayPrice, image: primaryImage || '', sku: effectiveVariant?.sku || product.sku || product.slug, slug: product.slug }); }
  };

  const handleAddToCart = (e: any) => {
    e.stopPropagation();
    addToCart({ id: product._id, variantId: effectiveVariant?._id, name: product.name, variantName: effectiveVariant?.name, price: displayPrice, image: primaryImage || '', quantity });
    Alert.alert('Added to Cart', `${quantity} × ${product.name}${effectiveVariant ? ` (${effectiveVariant.name})` : ''} added to your cart`);
    setQuantity(1);
  };

  const increment = (e: any) => { e.stopPropagation(); if (quantity < stock) setQuantity(q => q + 1); };
  const decrement = (e: any) => { e.stopPropagation(); if (quantity > 1) setQuantity(q => q - 1); };

  const handleVariantChange = (val: string) => { setSelectedVariantId(val); setQuantity(1); };

  const variantOptions: VariantOption[] = [
    {
      value: '',
      label: product.name,
      sublabel: `R${product.price.toFixed(2)}${(product.stockLevel ?? 0) <= threshold ? ' · Out of stock' : ''}`,
      outOfStock: (product.stockLevel ?? 0) <= threshold,
    },
    ...activeVariants.map((v: any) => ({
      value: v._id,
      label: v.name,
      sublabel: v.price ? `R${(v.specialPrice || v.price).toFixed(2)}` : undefined,
      outOfStock: v.stockLevel <= threshold,
    })),
  ];

  const descLines = hasVariants ? 2 : 3;

  return (
    <TouchableOpacity style={shared.card} onPress={() => router.push(`/product/${product.slug}`)} activeOpacity={0.7}>
      <View style={shared.imageContainer}>
        {primaryImage ? <Image source={{ uri: primaryImage }} style={shared.image} /> : <View style={[shared.image, shared.placeholder]}><Package color="#9ca3af" size={40} /></View>}
        <View style={shared.badgesContainer}>
          {product.onSpecial && <View style={[shared.badge, shared.badgeRed]}><Tag color="#fff" size={10} /><Text style={shared.badgeText}>SPECIAL</Text></View>}
          {hasDiscount && <View style={[shared.badge, shared.badgeOrange]}><Text style={shared.badgeText}>{discountPercent}% OFF</Text></View>}
          {hasVariants && <View style={[shared.badge, shared.badgePurple]}><Text style={shared.badgeText}>{activeVariants.length + 1} OPTIONS</Text></View>}
        </View>
        {isAuthenticated && (
          <TouchableOpacity style={shared.wishlistButton} onPress={toggleWishlist}>
            <Heart color={isInWishlist ? '#ef4444' : '#fff'} fill={isInWishlist ? '#ef4444' : 'none'} size={20} />
          </TouchableOpacity>
        )}
        {lowStock && <View style={shared.stockWarning}><Text style={shared.stockWarningText}>{stock} left</Text></View>}
      </View>

      <View style={shared.content}>
        <Text style={shared.name} numberOfLines={2}>{product.name}</Text>
        {product.unitQuantity && product.unit && <Text style={shared.unitText}>{product.unitQuantity}{product.unit}</Text>}
        {!!product.description && <Text style={shared.description} numberOfLines={descLines}>{product.description}</Text>}

        {hasVariants && (
          <View onStartShouldSetResponder={() => true}>
            <VariantPickerModal options={variantOptions} value={effectiveVariant?._id ?? selectedVariantId} onChange={handleVariantChange} />
          </View>
        )}

        <View style={shared.priceContainer}>
          <Text style={shared.price}>R{displayPrice.toFixed(2)}</Text>
          {hasDiscount && <Text style={shared.oldPrice}>R{comparePrice!.toFixed(2)}</Text>}
        </View>
        {hasDiscount && <Text style={shared.savingsText}>Save R{(comparePrice! - displayPrice).toFixed(2)}</Text>}

        {inStock ? (
          <View style={shared.cartActions} onStartShouldSetResponder={() => true}>
            <View style={shared.quantityControl}>
              <TouchableOpacity style={shared.quantityButton} onPress={decrement} disabled={quantity <= 1}><Minus color={quantity <= 1 ? '#d1d5db' : '#6b7280'} size={16} /></TouchableOpacity>
              <Text style={shared.quantityText}>{quantity}</Text>
              <TouchableOpacity style={shared.quantityButton} onPress={increment} disabled={quantity >= stock}><Plus color={quantity >= stock ? '#d1d5db' : '#6b7280'} size={16} /></TouchableOpacity>
            </View>
            <TouchableOpacity style={shared.addButton} onPress={handleAddToCart}><ShoppingCart color="#fff" size={16} /></TouchableOpacity>
          </View>
        ) : (
          <View style={shared.outOfStock}><Text style={shared.outOfStockText}>Out of Stock</Text></View>
        )}
      </View>
    </TouchableOpacity>
  );
}
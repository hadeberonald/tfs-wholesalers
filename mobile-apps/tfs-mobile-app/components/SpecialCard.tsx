import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Alert, Modal, FlatList, TouchableWithoutFeedback, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ShoppingCart, Plus, Minus, Tag, Star, Heart,
  ChevronDown, Check, CheckCircle, XCircle,
} from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { shared } from './cardStyles';
import type { Special, Product } from '@/lib/types';

interface SpecialCardProps { special: Special; }

interface VariantOption {
  value: string;
  label: string;
  sublabel?: string;
  outOfStock: boolean;
}

function VariantPickerModal({ options, value, onChange }: { options: VariantOption[]; value: string; onChange: (val: string) => void; }) {
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
            data={options} keyExtractor={o => o.value} style={pickerStyles.list}
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
          <TouchableOpacity style={pickerStyles.closeBtn} onPress={() => setOpen(false)}><Text style={pickerStyles.closeBtnText}>Close</Text></TouchableOpacity>
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

export default function SpecialCard({ special }: SpecialCardProps) {
  const router             = useRouter();
  const addToCart          = useStore((s) => s.addToCart);
  const addToWishlist      = useStore((s) => s.addToWishlist);
  const removeFromWishlist = useStore((s) => s.removeFromWishlist);
  const wishlist           = useStore((s) => s.wishlist || []);
  const user               = useStore((s) => s.user);
  const isAuthenticated    = !!user;

  const product = (special.product ?? null) as Product | null;
  const threshold = (product as any)?.lowStockThreshold ?? 0;

  // Guard: hide if product missing, inactive, or at/below threshold with no in-stock variant
  if (!product || !product.active) return null;

  const activeVariants = product.variants?.filter((v) => v.active) ?? [];
  const hasVariants    = !!(product.hasVariants && activeVariants.length > 0);

  const hasAnyStock = (product.stockLevel ?? 0) > threshold ||
    activeVariants.some((v) => v.stockLevel > threshold);
  if (!hasAnyStock) return null;

  const [bundleQty,         setBundleQty]        = useState(1);
  const [quantity,          setQuantity]          = useState(1);
  const [showAddonModal,    setShowAddonModal]    = useState(false);
  const [addonProduct,      setAddonProduct]      = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  useEffect(() => {
    if (special.type === 'conditional_add_on_price' && special.conditions?.targetProductId) {
      fetch(`/api/products/${special.conditions.targetProductId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.product?.active) setAddonProduct(d.product); })
        .catch(() => null);
    }
  }, [special._id]);

  const targetRef =
    special.variantId      || special.conditions?.variantId      ||
    special.variantSku     || special.conditions?.variantSku     ||
    special.variantBarcode || special.conditions?.variantBarcode || null;

  const selectedVariant = (() => {
    if (selectedVariantId) return activeVariants.find((v) => v._id === selectedVariantId);
    if (targetRef) {
      return (
        activeVariants.find((v) => v._id?.toString() === targetRef.toString()) ||
        activeVariants.find((v) => v.sku              === targetRef) ||
        activeVariants.find((v) => v.barcode          === targetRef)
      );
    }
    if ((product.stockLevel ?? 0) <= threshold) return activeVariants.find((v) => v.stockLevel > threshold);
    return undefined;
  })();

  const basePrice = selectedVariant ? (selectedVariant.price ?? product.price) : product.price;

  const getDisplayPrice = (): number => {
    switch (special.type) {
      case 'percentage_off': { const off = (basePrice * (special.conditions.discountPercentage || 0)) / 100; return basePrice - Math.min(off, special.conditions.maximumDiscount ?? Infinity); }
      case 'amount_off':               return Math.max(0, basePrice - (special.conditions.discountAmount || 0));
      case 'fixed_price':              return special.conditions.newPrice ?? basePrice;
      case 'multibuy':                 return special.conditions.specialPrice ?? basePrice;
      case 'buy_x_get_y':              return basePrice;
      case 'bundle':                   return special.conditions.bundlePrice ?? basePrice;
      case 'conditional_add_on_price': return special.conditions.triggerPrice ?? basePrice;
      default: return selectedVariant ? (selectedVariant.specialPrice || selectedVariant.price || basePrice) : (product.specialPrice || basePrice);
    }
  };

  const getCartUnitPrice = (): number => {
    if (special.type === 'multibuy') return special.conditions.specialPrice ? (special.conditions.specialPrice / (special.conditions.requiredQuantity || 1)) : basePrice;
    return getDisplayPrice();
  };

  const displayPrice = getDisplayPrice();

  const savings = (() => {
    if (special.type === 'multibuy') return Math.max(0, basePrice * (special.conditions.requiredQuantity || 1) - (special.conditions.specialPrice ?? basePrice));
    if (special.type === 'buy_x_get_y') return 0;
    if (special.type === 'conditional_add_on_price') return special.conditions.triggerPrice != null ? Math.max(0, basePrice - special.conditions.triggerPrice) : 0;
    return Math.max(0, basePrice - displayPrice);
  })();

  const getSpecialBadge = (): string => {
    if (special.badgeText) return special.badgeText;
    switch (special.type) {
      case 'percentage_off':           return `${special.conditions.discountPercentage}% OFF`;
      case 'amount_off':               return `R${special.conditions.discountAmount} OFF`;
      case 'fixed_price':              return `NOW R${special.conditions.newPrice}`;
      case 'multibuy':                 return `${special.conditions.requiredQuantity} FOR R${special.conditions.specialPrice}`;
      case 'buy_x_get_y':              return `BUY ${special.conditions.buyQuantity} GET ${special.conditions.getQuantity}`;
      case 'bundle':                   return 'BUNDLE DEAL';
      case 'conditional_add_on_price': return `UNLOCK @ R${special.conditions.overridePrice ?? 0}`;
      default:                         return 'SPECIAL';
    }
  };

  const isMultibuy  = special.type === 'multibuy';
  const isAddonDeal = special.type === 'conditional_add_on_price';
  const bundleSize  = isMultibuy ? (special.conditions.requiredQuantity || 1) : 1;
  const actualQty   = isMultibuy ? bundleQty * bundleSize : quantity;

  const stock    = selectedVariant ? selectedVariant.stockLevel : (product.stockLevel ?? 0);
  const inStock  = stock > threshold;
  const lowStock = stock > threshold && stock <= (threshold + 10);

  const displayImage = selectedVariant?.images?.length ? selectedVariant.images[0] : (special.images?.[0] || product.images?.[0]);
  const isPosSpecial = special.source === 'pos_ftp_sync';
  const displayDescription = special.description?.trim() ? special.description : isPosSpecial ? (product.description?.trim() || '') : '';

  const bannerText = (() => {
    switch (special.type) {
      case 'buy_x_get_y': return `Buy ${special.conditions.buyQuantity}, Get ${special.conditions.getQuantity}${special.conditions.getDiscount === 100 ? ' FREE!' : ` at ${special.conditions.getDiscount}% off`}`;
      case 'multibuy':    return `Buy ${special.conditions.requiredQuantity} for R${special.conditions.specialPrice}`;
      case 'bundle':      return savings > 0 ? `Bundle Deal — Save R${savings.toFixed(2)}!` : null;
      case 'conditional_add_on_price': return `🔓 Unlocks add-on @ R${special.conditions.overridePrice ?? 0}`;
      default: return null;
    }
  })();

  const bannerVariant = special.type === 'bundle' ? 'purple' : special.type === 'conditional_add_on_price' ? 'amber' : 'blue';
  const isInWishlist = wishlist.some((item: any) => item.id === product._id);

  const variantOptions: VariantOption[] = [
    {
      value:      '',
      label:      product.name,
      sublabel:   `R${product.price.toFixed(2)}${(product.stockLevel ?? 0) <= threshold ? ' · Out of stock' : ''}`,
      outOfStock: (product.stockLevel ?? 0) <= threshold,
    },
    ...activeVariants.map((v) => ({
      value:      v._id,
      label:      v.name,
      sublabel:   v.price ? `R${(v.specialPrice || v.price).toFixed(2)}` : undefined,
      outOfStock: v.stockLevel <= threshold,
    })),
  ];

  const handleVariantChange = (val: string) => { setSelectedVariantId(val); setQuantity(1); setBundleQty(1); };

  const toggleWishlist = (e: any) => {
    e.stopPropagation();
    if (!isAuthenticated) { Alert.alert('Sign In Required', 'Please sign in to add items to your wishlist'); return; }
    if (isInWishlist) { removeFromWishlist(product._id); }
    else { addToWishlist({ id: product._id, name: selectedVariant ? selectedVariant.name : product.name, price: getCartUnitPrice(), image: displayImage || '', sku: selectedVariant?.sku || product.sku || '', slug: product.slug }); }
  };

  const increment = (e: any) => {
    e.stopPropagation();
    if (isMultibuy) { if ((bundleQty + 1) * bundleSize <= stock) setBundleQty(q => q + 1); }
    else            { if (quantity < stock) setQuantity(q => q + 1); }
  };

  const decrement = (e: any) => {
    e.stopPropagation();
    if (isMultibuy) { if (bundleQty > 1) setBundleQty(q => q - 1); }
    else            { if (quantity  > 1) setQuantity(q => q - 1); }
  };

  const handleAddToCart = (e: any) => {
    e.stopPropagation();
    addToCart({ id: product._id, variantId: selectedVariant?._id, name: selectedVariant ? selectedVariant.name : product.name, variantName: selectedVariant?.name, price: getCartUnitPrice(), image: displayImage || '', quantity: actualQty, sku: selectedVariant?.sku || product.sku || '', appliedSpecialId: special._id, originalPrice: basePrice });
    if (isAddonDeal && addonProduct) { setShowAddonModal(true); }
    else { Alert.alert('Added to Cart', isMultibuy ? `${bundleQty} bundle${bundleQty > 1 ? 's' : ''} (${actualQty} items) added to your cart` : `${actualQty} × ${selectedVariant?.name || product.name} added to your cart`); isMultibuy ? setBundleQty(1) : setQuantity(1); }
  };

  const handleAcceptAddon = () => {
    if (!addonProduct) return;
    const overridePrice = special.conditions.overridePrice ?? 0;
    addToCart({ id: addonProduct._id, name: addonProduct.name, price: overridePrice, image: addonProduct.images?.[0] || '', quantity: special.conditions.targetQuantity || 1, sku: addonProduct.sku || '', appliedSpecialId: special._id, originalPrice: addonProduct.price });
    setShowAddonModal(false); setQuantity(1);
    Alert.alert('Added to Cart', `${addonProduct.name} added at R${overridePrice.toFixed(2)}!`);
  };

  const handleDeclineAddon = () => { setShowAddonModal(false); setQuantity(1); };

  return (
    <>
      <TouchableOpacity style={shared.card} onPress={() => router.push(`/special/${special.slug}`)} activeOpacity={0.7}>
        <View style={shared.imageContainer}>
          {displayImage ? <Image source={{ uri: displayImage }} style={shared.image} /> : <View style={[shared.image, shared.placeholder]}><Tag color="#FF6B35" size={40} /></View>}
          <View style={shared.badgesContainer}>
            <View style={[shared.badge, shared.badgeRed]}><Tag color="#fff" size={10} /><Text style={shared.badgeText}>{getSpecialBadge()}</Text></View>
            {special.featured && <View style={[shared.badge, shared.badgeYellow]}><Star color="#fff" size={10} fill="#fff" /><Text style={shared.badgeText}>FEATURED</Text></View>}
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
          <Text style={shared.name} numberOfLines={2}>{special.name}</Text>
          {!!displayDescription && <Text style={shared.description} numberOfLines={bannerText ? 2 : 3}>{displayDescription}</Text>}

          {hasVariants && (
            <View onStartShouldSetResponder={() => true}>
              <VariantPickerModal options={variantOptions} value={selectedVariant?._id ?? selectedVariantId} onChange={handleVariantChange} />
            </View>
          )}

          {bannerText && (
            bannerVariant === 'purple' ? (
              <View style={shared.infoBannerPurple}><Text style={shared.infoBannerTextPurple} numberOfLines={2}>{bannerText}</Text></View>
            ) : bannerVariant === 'amber' ? (
              <View style={cardStyles.infoBannerAmber}><Text style={cardStyles.infoBannerTextAmber} numberOfLines={2}>{bannerText}</Text></View>
            ) : (
              <View style={shared.infoBannerBlue}><Text style={shared.infoBannerTextBlue} numberOfLines={2}>{bannerText}</Text></View>
            )
          )}

          <View style={shared.priceContainer}>
            <Text style={shared.price}>R{displayPrice.toFixed(2)}</Text>
            {savings > 0 && special.type !== 'buy_x_get_y' && <Text style={shared.oldPrice}>R{basePrice.toFixed(2)}</Text>}
          </View>
          {savings > 0 && special.type !== 'buy_x_get_y' && <Text style={shared.savingsText}>Save R{savings.toFixed(2)}</Text>}

          {inStock ? (
            <View style={shared.cartActions} onStartShouldSetResponder={() => true}>
              <View style={shared.quantityControl}>
                <TouchableOpacity style={shared.quantityButton} onPress={decrement} disabled={isMultibuy ? bundleQty <= 1 : quantity <= 1}><Minus color={(isMultibuy ? bundleQty <= 1 : quantity <= 1) ? '#d1d5db' : '#6b7280'} size={16} /></TouchableOpacity>
                <Text style={shared.quantityText}>{isMultibuy ? bundleQty : quantity}</Text>
                <TouchableOpacity style={shared.quantityButton} onPress={increment} disabled={isMultibuy ? (bundleQty + 1) * bundleSize > stock : quantity >= stock}><Plus color={(isMultibuy ? (bundleQty + 1) * bundleSize > stock : quantity >= stock) ? '#d1d5db' : '#6b7280'} size={16} /></TouchableOpacity>
              </View>
              <TouchableOpacity style={shared.addButton} onPress={handleAddToCart}><ShoppingCart color="#fff" size={16} /></TouchableOpacity>
            </View>
          ) : (
            <View style={shared.outOfStock}><Text style={shared.outOfStockText}>Out of Stock</Text></View>
          )}
        </View>
      </TouchableOpacity>

      <Modal visible={showAddonModal} transparent animationType="slide" statusBarTranslucent onRequestClose={handleDeclineAddon}>
        <TouchableWithoutFeedback onPress={handleDeclineAddon}><View style={cardStyles.modalBackdrop} /></TouchableWithoutFeedback>
        <View style={cardStyles.modalSheet}>
          <View style={cardStyles.modalHeader}>
            <View><Text style={cardStyles.modalEyebrow}>🔓 Special Unlocked!</Text><Text style={cardStyles.modalTitle}>Would you like to add this?</Text></View>
            <TouchableOpacity onPress={handleDeclineAddon}><XCircle color="#9ca3af" size={22} /></TouchableOpacity>
          </View>
          <View style={cardStyles.modalBody}>
            {addonProduct?.images?.[0] ? <Image source={{ uri: addonProduct.images[0] }} style={cardStyles.addonImage} /> : <View style={[cardStyles.addonImage, cardStyles.addonImagePlaceholder]}><Tag color="#f59e0b" size={24} /></View>}
            <View style={cardStyles.addonInfo}>
              <Text style={cardStyles.addonEyebrow}>Add-On Product</Text>
              <Text style={cardStyles.addonName} numberOfLines={2}>{addonProduct?.name}</Text>
              <View style={cardStyles.addonPriceRow}>
                <Text style={cardStyles.addonPrice}>R{(special.conditions.overridePrice ?? 0).toFixed(2)}</Text>
                {addonProduct && addonProduct.price > (special.conditions.overridePrice ?? 0) && <Text style={cardStyles.addonOldPrice}>R{addonProduct.price.toFixed(2)}</Text>}
              </View>
              {addonProduct && addonProduct.price > (special.conditions.overridePrice ?? 0) && <Text style={cardStyles.addonSavings}>Save R{(addonProduct.price - (special.conditions.overridePrice ?? 0)).toFixed(2)}!</Text>}
            </View>
          </View>
          <View style={cardStyles.modalActions}>
            <TouchableOpacity style={cardStyles.acceptBtn} onPress={handleAcceptAddon}><CheckCircle color="#fff" size={16} /><Text style={cardStyles.acceptBtnText}>Yes, add for R{(special.conditions.overridePrice ?? 0).toFixed(2)}!</Text></TouchableOpacity>
            <TouchableOpacity style={cardStyles.declineBtn} onPress={handleDeclineAddon}><Text style={cardStyles.declineBtnText}>No thanks</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const cardStyles = StyleSheet.create({
  infoBannerAmber: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6 },
  infoBannerTextAmber: { fontSize: 10, color: '#92400e', fontWeight: '600' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', backgroundColor: '#fffbeb', borderBottomWidth: 1, borderBottomColor: '#fcd34d', paddingHorizontal: 20, paddingVertical: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalEyebrow: { fontSize: 11, fontWeight: '700', color: '#b45309', textTransform: 'uppercase', marginBottom: 2 },
  modalTitle:   { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalBody:    { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  addonImage:   { width: 64, height: 64, borderRadius: 12, borderWidth: 2, borderColor: '#fcd34d' },
  addonImagePlaceholder: { backgroundColor: '#fffbeb', alignItems: 'center', justifyContent: 'center' },
  addonInfo:    { flex: 1 },
  addonEyebrow: { fontSize: 10, fontWeight: '700', color: '#b45309', textTransform: 'uppercase', marginBottom: 2 },
  addonName:    { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  addonPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  addonPrice:   { fontSize: 20, fontWeight: '800', color: '#f97316' },
  addonOldPrice: { fontSize: 13, color: '#9ca3af', textDecorationLine: 'line-through' },
  addonSavings: { fontSize: 12, color: '#16a34a', fontWeight: '600', marginTop: 2 },
  modalActions: { paddingHorizontal: 20, gap: 8 },
  acceptBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 14 },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  declineBtn:   { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: 14, paddingVertical: 14 },
  declineBtnText: { color: '#374151', fontWeight: '600', fontSize: 15 },
});
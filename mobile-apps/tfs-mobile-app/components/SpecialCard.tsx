import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingCart, Plus, Minus, Tag, Star, Heart } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { shared } from './cardStyles';
import api from '@/lib/api';
import type { Special, Product } from '@/lib/types';

interface SpecialCardProps { special: Special; }

export default function SpecialCard({ special }: SpecialCardProps) {
  const router          = useRouter();
  const addToCart       = useStore((s) => s.addToCart);
  const addToWishlist   = useStore((s) => s.addToWishlist);
  const removeFromWishlist = useStore((s) => s.removeFromWishlist);
  const wishlist        = useStore((s) => s.wishlist || []);
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  const [product,   setProduct]   = useState<Product | null>(null);
  const [bundleQty, setBundleQty] = useState(1);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => { fetchProduct(); }, [special]);

  const fetchProduct = async () => {
    try {
      let productId = special.productId || special.productIds?.[0];
      if (special.type === 'buy_x_get_y' && special.conditions.buyProductId) {
        productId = special.conditions.buyProductId;
      }
      if (productId) {
        const res = await api.get(`/api/products/${productId}`);
        if (res.data.product) setProduct(res.data.product);
      }
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  };

  const getDisplayPrice = (): number => {
    if (!product) return 0;
    switch (special.type) {
      case 'percentage_off': {
        const off = (product.price * (special.conditions.discountPercentage || 0)) / 100;
        return product.price - Math.min(off, special.conditions.maximumDiscount || Infinity);
      }
      case 'amount_off':  return Math.max(0, product.price - (special.conditions.discountAmount || 0));
      case 'fixed_price': return special.conditions.newPrice || product.price;
      case 'multibuy':    return special.conditions.specialPrice || product.price;
      case 'buy_x_get_y': return product.price;
      case 'bundle':      return special.conditions.bundlePrice || product.price;
      default:            return product.specialPrice || product.price;
    }
  };

  const getCartUnitPrice = (): number => {
    if (!product) return 0;
    switch (special.type) {
      case 'percentage_off': {
        const off = (product.price * (special.conditions.discountPercentage || 0)) / 100;
        return product.price - Math.min(off, special.conditions.maximumDiscount || Infinity);
      }
      case 'amount_off':  return Math.max(0, product.price - (special.conditions.discountAmount || 0));
      case 'fixed_price': return special.conditions.newPrice || product.price;
      case 'multibuy':    return (special.conditions.specialPrice || product.price) / (special.conditions.requiredQuantity || 1);
      case 'buy_x_get_y': return product.price;
      case 'bundle':      return special.conditions.bundlePrice || product.price;
      default:            return product.specialPrice || product.price;
    }
  };

  const getSpecialBadge = (): string => {
    if (special.badgeText) return special.badgeText;
    switch (special.type) {
      case 'percentage_off': return `${special.conditions.discountPercentage}% OFF`;
      case 'amount_off':     return `R${special.conditions.discountAmount} OFF`;
      case 'fixed_price':    return `NOW R${special.conditions.newPrice}`;
      case 'multibuy':       return `${special.conditions.requiredQuantity} FOR R${special.conditions.specialPrice}`;
      case 'buy_x_get_y':   return `BUY ${special.conditions.buyQuantity} GET ${special.conditions.getQuantity}`;
      case 'bundle':         return 'BUNDLE DEAL';
      default:               return 'SPECIAL';
    }
  };

  const isMultibuy   = special.type === 'multibuy';
  const bundleSize   = isMultibuy ? (special.conditions.requiredQuantity || 1) : 1;
  const actualQty    = isMultibuy ? bundleQty * bundleSize : bundleQty;
  const displayPrice = getDisplayPrice();
  const displayImage = special.images?.[0] || product?.images[0];
  const inStock      = product ? product.stockLevel > 0 : false;
  const lowStock     = product ? (product.stockLevel > 0 && product.stockLevel <= 10) : false;

  const savings = (() => {
    if (!product) return 0;
    if (special.type === 'multibuy') {
      return Math.max(0, product.price * (special.conditions.requiredQuantity || 1) - (special.conditions.specialPrice || product.price));
    }
    if (special.type === 'buy_x_get_y') return 0;
    return Math.max(0, product.price - displayPrice);
  })();

  // Banner text — only defined when there's actually something to say
  const bannerText = (() => {
    switch (special.type) {
      case 'buy_x_get_y':
        return `Buy ${special.conditions.buyQuantity}, Get ${special.conditions.getQuantity}${special.conditions.getDiscount === 100 ? ' FREE!' : ` ${special.conditions.getDiscount}% off`}`;
      case 'multibuy':
        return `Buy ${special.conditions.requiredQuantity} for R${special.conditions.specialPrice}`;
      case 'bundle':
        return savings > 0 ? `Bundle Deal - Save R${savings.toFixed(2)}!` : null;
      default:
        return null;
    }
  })();
  const bannerVariant = special.type === 'bundle' ? 'purple' : 'blue';

  const isInWishlist = product && wishlist.some((item: any) => item.id === product._id);

  const toggleWishlist = (e: any) => {
    e.stopPropagation();
    if (!isAuthenticated) { Alert.alert('Sign In Required', 'Please sign in to add items to your wishlist'); return; }
    if (!product) return;
    if (isInWishlist) { removeFromWishlist(product._id); }
    else { addToWishlist({ id: product._id, name: product.name, price: getCartUnitPrice(), image: displayImage || '', sku: product.sku || '', slug: product.slug }); }
  };

  const increment = (e: any) => {
    e.stopPropagation();
    if (!product) return;
    if ((bundleQty + 1) * bundleSize <= product.stockLevel) setBundleQty(q => q + 1);
  };
  const decrement = (e: any) => { e.stopPropagation(); if (bundleQty > 1) setBundleQty(q => q - 1); };

  const handleAddToCart = (e: any) => {
    e.stopPropagation();
    if (!product) return;
    addToCart({ id: product._id, name: product.name, price: getCartUnitPrice(), image: displayImage || '', quantity: actualQty, sku: product.sku || '', appliedSpecialId: special._id, originalPrice: product.price });
    Alert.alert('Added to Cart', isMultibuy ? `${bundleQty} bundle${bundleQty > 1 ? 's' : ''} (${actualQty} items) added to your cart` : `${actualQty} ${product.name} added to your cart`);
    setBundleQty(1);
  };

  return (
    <TouchableOpacity style={shared.card} onPress={() => router.push(`/special/${special.slug}`)} activeOpacity={0.7}>

      <View style={shared.imageContainer}>
        {displayImage
          ? <Image source={{ uri: displayImage }} style={shared.image} />
          : <View style={[shared.image, shared.placeholder]}><Tag color="#FF6B35" size={40} /></View>
        }
        <View style={shared.badgesContainer}>
          <View style={[shared.badge, shared.badgeRed]}>
            <Tag color="#fff" size={10} />
            <Text style={shared.badgeText}>{getSpecialBadge()}</Text>
          </View>
          {special.featured && (
            <View style={[shared.badge, shared.badgeYellow]}>
              <Star color="#fff" size={10} fill="#fff" />
              <Text style={shared.badgeText}>FEATURED</Text>
            </View>
          )}
        </View>
        {isAuthenticated && product && (
          <TouchableOpacity style={shared.wishlistButton} onPress={toggleWishlist}>
            <Heart color={isInWishlist ? '#ef4444' : '#fff'} fill={isInWishlist ? '#ef4444' : 'none'} size={20} />
          </TouchableOpacity>
        )}
        {lowStock && (
          <View style={shared.stockWarning}>
            <Text style={shared.stockWarningText}>{product!.stockLevel} left</Text>
          </View>
        )}
      </View>

      <View style={shared.content}>
        <Text style={shared.name} numberOfLines={2}>{special.name}</Text>

        {/* Description: more lines when no banner below it */}
        <Text style={shared.description} numberOfLines={bannerText ? 2 : 3}>
          {special.description || ''}
        </Text>

        {loading ? (
          <View style={shared.loadingContainer}>
            <ActivityIndicator size="small" color="#FF6B35" />
          </View>
        ) : product ? (
          <>
            {/* Banner only renders when there IS one — zero whitespace otherwise */}
            {bannerText && (
              bannerVariant === 'purple' ? (
                <View style={shared.infoBannerPurple}>
                  <Text style={shared.infoBannerTextPurple} numberOfLines={2}>{bannerText}</Text>
                </View>
              ) : (
                <View style={shared.infoBannerBlue}>
                  <Text style={shared.infoBannerTextBlue} numberOfLines={2}>{bannerText}</Text>
                </View>
              )
            )}

            <View style={shared.priceContainer}>
              <Text style={shared.price}>R{displayPrice.toFixed(2)}</Text>
            </View>

            {savings > 0 && special.type !== 'buy_x_get_y' && (
              <Text style={shared.savingsText}>Save R{savings.toFixed(2)}</Text>
            )}

            {inStock ? (
              <View style={shared.cartActions} onStartShouldSetResponder={() => true}>
                <View style={shared.quantityControl}>
                  <TouchableOpacity style={shared.quantityButton} onPress={decrement} disabled={bundleQty <= 1}>
                    <Minus color={bundleQty <= 1 ? '#d1d5db' : '#6b7280'} size={16} />
                  </TouchableOpacity>
                  <Text style={shared.quantityText}>{bundleQty}</Text>
                  <TouchableOpacity style={shared.quantityButton} onPress={increment} disabled={(bundleQty + 1) * bundleSize > product.stockLevel}>
                    <Plus color={(bundleQty + 1) * bundleSize > product.stockLevel ? '#d1d5db' : '#6b7280'} size={16} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={shared.addButton} onPress={handleAddToCart}>
                  <ShoppingCart color="#fff" size={16} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={shared.outOfStock}>
                <Text style={shared.outOfStockText}>Out of Stock</Text>
              </View>
            )}
          </>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
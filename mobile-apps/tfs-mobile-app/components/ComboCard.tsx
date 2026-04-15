import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingCart, Plus, Minus, Package } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { shared } from './cardStyles';

interface ComboItem { productId: string; variantId?: string; quantity: number; }
interface Combo {
  _id: string; name: string; slug: string; description: string;
  images?: string[]; items: ComboItem[];
  comboPrice: number; regularPrice: number; stockLevel: number; active: boolean;
}
interface ComboCardProps { combo: Combo; }

export default function ComboCard({ combo }: ComboCardProps) {
  const router    = useRouter();
  const addToCart = useStore((s) => s.addToCart);
  const [quantity, setQuantity] = useState(1);

  const savings        = combo.regularPrice - combo.comboPrice;
  const savingsPercent = Math.round((savings / combo.regularPrice) * 100);
  const isInStock      = combo.stockLevel > 0;
  const lowStock       = combo.stockLevel > 0 && combo.stockLevel <= 10;

  const increment = (e: any) => { e.stopPropagation(); if (quantity < combo.stockLevel) setQuantity(q => q + 1); };
  const decrement = (e: any) => { e.stopPropagation(); if (quantity > 1) setQuantity(q => q - 1); };

  const handleAddToCart = (e: any) => {
    e.stopPropagation();
    if (!isInStock) return;
    addToCart({ id: combo._id, name: combo.name, price: combo.comboPrice, image: combo.images?.[0] || '', quantity, sku: combo.slug });
    Alert.alert('Added to Cart', `${quantity} ${combo.name} added to your cart`);
    setQuantity(1);
  };

  return (
    <TouchableOpacity style={shared.card} onPress={() => router.push(`/combo/${combo.slug}`)} activeOpacity={0.7}>

      <View style={shared.imageContainer}>
        {combo.images?.length
          ? <Image source={{ uri: combo.images[0] }} style={shared.image} />
          : <View style={[shared.image, shared.placeholder]}><Package color="#FF6B35" size={40} /></View>
        }
        <View style={shared.badgesContainer}>
          <View style={[shared.badge, shared.badgePurple]}>
            <Text style={shared.badgeText}>COMBO</Text>
          </View>
          {savingsPercent > 0 && (
            <View style={[shared.badge, shared.badgeRed]}>
              <Text style={shared.badgeText}>-{savingsPercent}%</Text>
            </View>
          )}
        </View>
        {lowStock && (
          <View style={shared.stockWarning}>
            <Text style={shared.stockWarningText}>{combo.stockLevel} left</Text>
          </View>
        )}
      </View>

      <View style={shared.content}>
        <Text style={shared.name} numberOfLines={2}>{combo.name}</Text>

        {/* Description: more lines when no savings banner below */}
        <Text style={shared.description} numberOfLines={savings > 0 ? 2 : 3}>
          {combo.description || ''}
        </Text>

        {/* Banner only renders when there ARE savings */}
        {savings > 0 && (
          <View style={shared.infoBannerPurple}>
            <Text style={shared.infoBannerTextPurple} numberOfLines={2}>
              Bundle Deal - Save R{savings.toFixed(2)}!
            </Text>
          </View>
        )}

        <View style={shared.priceContainer}>
          <Text style={shared.price}>R{combo.comboPrice.toFixed(2)}</Text>
        </View>

        {savings > 0 && (
          <Text style={shared.savingsText}>Save R{savings.toFixed(2)}</Text>
        )}

        {isInStock ? (
          <View style={shared.cartActions} onStartShouldSetResponder={() => true}>
            <View style={shared.quantityControl}>
              <TouchableOpacity style={shared.quantityButton} onPress={decrement} disabled={quantity <= 1}>
                <Minus color={quantity <= 1 ? '#d1d5db' : '#6b7280'} size={16} />
              </TouchableOpacity>
              <Text style={shared.quantityText}>{quantity}</Text>
              <TouchableOpacity style={shared.quantityButton} onPress={increment} disabled={quantity >= combo.stockLevel}>
                <Plus color={quantity >= combo.stockLevel ? '#d1d5db' : '#6b7280'} size={16} />
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
      </View>
    </TouchableOpacity>
  );
}
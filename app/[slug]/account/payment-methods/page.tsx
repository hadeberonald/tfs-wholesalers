'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Plus, Trash2, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface PaymentMethod {
  id: string;
  cardNumber: string;
  cardHolder: string;
  expiryDate: string;
  cardType: string;
  isDefault: boolean;
}

export default function PaymentMethodsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cards, setCards] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newCard, setNewCard] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryDate: '',
    cvv: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/account/payment-methods');
    } else if (user) {
      fetchPaymentMethods();
    }
  }, [user, authLoading, router]);

  const fetchPaymentMethods = async () => {
    // TODO: Implement API call when payment integration is ready
    // For now, mock data
    setTimeout(() => {
      setCards([
        {
          id: '1',
          cardNumber: '**** **** **** 4242',
          cardHolder: user?.name || 'John Doe',
          expiryDate: '12/25',
          cardType: 'visa',
          isDefault: true,
        },
      ]);
      setLoading(false);
    }, 500);
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.slice(0, 2) + '/' + v.slice(2, 4);
    }
    return v;
  };

  const getCardType = (number: string) => {
    const cleaned = number.replace(/\s/g, '');
    if (/^4/.test(cleaned)) return 'visa';
    if (/^5[1-5]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    return 'unknown';
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Mock save - replace with actual API call
    setTimeout(() => {
      const cardType = getCardType(newCard.cardNumber);
      const lastFour = newCard.cardNumber.replace(/\s/g, '').slice(-4);
      
      const newCardData: PaymentMethod = {
        id: Date.now().toString(),
        cardNumber: `**** **** **** ${lastFour}`,
        cardHolder: newCard.cardHolder,
        expiryDate: newCard.expiryDate,
        cardType,
        isDefault: cards.length === 0,
      };

      setCards([...cards, newCardData]);
      setNewCard({ cardNumber: '', cardHolder: '', expiryDate: '', cvv: '' });
      setShowAddModal(false);
      setSaving(false);
      toast.success('Card added successfully');
    }, 1000);
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Are you sure you want to remove this card?')) return;
    
    setCards(cards.filter(c => c.id !== cardId));
    toast.success('Card removed');
  };

  const handleSetDefault = async (cardId: string) => {
    setCards(cards.map(c => ({
      ...c,
      isDefault: c.id === cardId
    })));
    toast.success('Default card updated');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-orange animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/account"
          className="inline-flex items-center text-brand-orange hover:text-orange-600 mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Account
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-brand-black mb-2">Payment Methods</h1>
          <p className="text-gray-600">Manage your saved payment methods for faster checkout</p>
        </div>

        {/* Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Coming Soon:</strong> Full payment integration is being implemented. 
            For now, you can add cards but they will be used for demo purposes only.
          </p>
        </div>

        {/* Add Card Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary mb-6 flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Card</span>
        </button>

        {/* Cards List */}
        {cards.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No saved cards</h3>
            <p className="text-gray-600 mb-6">Add a payment method for faster checkout</p>
            <button onClick={() => setShowAddModal(true)} className="btn-primary">
              Add Card
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map((card) => (
              <div key={card.id} className="bg-white rounded-2xl p-6 shadow-sm border-2 border-gray-200 hover:border-brand-orange transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-semibold text-brand-black text-lg">{card.cardNumber}</p>
                        {card.isDefault && (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-1">{card.cardHolder}</p>
                      <p className="text-sm text-gray-500">Expires {card.expiryDate}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!card.isDefault && (
                      <button
                        onClick={() => handleSetDefault(card.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="Set as default"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Remove card"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Card Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-8">
              <h2 className="text-2xl font-bold text-brand-black mb-6">Add New Card</h2>

              <form onSubmit={handleAddCard} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Card Number *
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="1234 5678 9012 3456"
                    value={newCard.cardNumber}
                    onChange={(e) => setNewCard({ 
                      ...newCard, 
                      cardNumber: formatCardNumber(e.target.value) 
                    })}
                    maxLength={19}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cardholder Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="JOHN DOE"
                    value={newCard.cardHolder}
                    onChange={(e) => setNewCard({ 
                      ...newCard, 
                      cardHolder: e.target.value.toUpperCase() 
                    })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expiry Date *
                    </label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="MM/YY"
                      value={newCard.expiryDate}
                      onChange={(e) => setNewCard({ 
                        ...newCard, 
                        expiryDate: formatExpiryDate(e.target.value) 
                      })}
                      maxLength={5}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CVV *
                    </label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="123"
                      value={newCard.cvv}
                      onChange={(e) => setNewCard({ 
                        ...newCard, 
                        cvv: e.target.value.replace(/\D/g, '') 
                      })}
                      maxLength={4}
                    />
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-600">
                    Your card information is securely encrypted and stored. We will never share your payment details.
                  </p>
                </div>

                <div className="flex items-center space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setNewCard({ cardNumber: '', cardHolder: '', expiryDate: '', cvv: '' });
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary flex-1"
                  >
                    {saving ? 'Saving...' : 'Add Card'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Trash2, Save, X, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';

interface Supplier {
  _id: string;
  name: string;
  email: string;
  phone?: string;
}

interface Product {
  _id: string;
  name: string;
  sku: string;
  price: number;
  costPrice?: number;
  variants?: Array<{
    _id: string;
    name: string;
    sku: string;
    price?: number;
  }>;
}

interface POItem {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  quantityOrdered: number;
  unitPrice: number;
  total: number;
}

export default function CreatePOPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { branch, loading: branchLoading } = useBranch();
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [items, setItems] = useState<POItem[]>([]);
  const [notes, setNotes] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!branchLoading && branch) {
      fetchSuppliers();
      fetchProducts();
    }
  }, [branchLoading, branch]);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers?all=true');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error('Failed to fetch suppliers');
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?all=true');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch products');
    }
  };

  const addProduct = (product: Product, variant?: any) => {
    const newItem: POItem = {
      productId: product._id,
      variantId: variant?._id,
      productName: product.name,
      variantName: variant?.name,
      sku: variant?.sku || product.sku,
      quantityOrdered: 1,
      unitPrice: product.costPrice || variant?.price || product.price,
      total: product.costPrice || variant?.price || product.price,
    };
    
    setItems([...items, newItem]);
    setShowProductSearch(false);
    setSearchTerm('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'quantityOrdered' || field === 'unitPrice') {
      updatedItems[index].total = updatedItems[index].quantityOrdered * updatedItems[index].unitPrice;
    }
    
    setItems(updatedItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.15; // 15% VAT
    const total = subtotal + tax;
    
    return { subtotal, tax, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSupplier) {
      toast.error('Please select a supplier');
      return;
    }
    
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    
    setSaving(true);
    
    try {
      const { subtotal, tax, total } = calculateTotals();
      
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplier,
          items,
          subtotal,
          tax,
          total,
          notes,
          expectedDeliveryDate: expectedDeliveryDate || undefined,
          status: 'draft',
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success('Purchase order created!');
        router.push(`/${slug}/admin/purchase-orders/${data.id}`);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to create purchase order');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  if (branchLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Branch Not Found</h1>
          <p className="text-gray-600">The requested branch could not be found.</p>
        </div>
      </div>
    );
  }

  const { subtotal, tax, total } = calculateTotals();

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-brand-black mb-2">Create Purchase Order</h1>
          <p className="text-gray-600">Create a new PO for {branch.displayName}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Selection */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-brand-black mb-4">Supplier Details</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier *
                </label>
                <select
                  required
                  className="input-field"
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                >
                  <option value="">Select a supplier...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.name} ({supplier.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                rows={3}
                className="input-field"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions or notes..."
              />
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-brand-black">Items</h2>
              <button
                type="button"
                onClick={() => setShowProductSearch(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Add Item</span>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-600 mb-4">No items added yet</p>
                <button
                  type="button"
                  onClick={() => setShowProductSearch(true)}
                  className="btn-secondary"
                >
                  Add First Item
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{item.productName}</p>
                        {item.variantName && (
                          <p className="text-sm text-gray-600">{item.variantName}</p>
                        )}
                        <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          className="input-field"
                          value={item.quantityOrdered}
                          onChange={(e) => updateItem(index, 'quantityOrdered', parseInt(e.target.value) || 1)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Unit Price (R)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          className="input-field"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Total
                        </label>
                        <input
                          type="text"
                          disabled
                          className="input-field bg-gray-50"
                          value={formatCurrency(item.total)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          {items.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-brand-black mb-4">Summary</h2>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-gray-600">Subtotal</p>
                  <p className="font-semibold">{formatCurrency(subtotal)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-gray-600">VAT (15%)</p>
                  <p className="font-semibold">{formatCurrency(tax)}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-lg font-bold text-brand-black">Total</p>
                  <p className="text-lg font-bold text-brand-orange">{formatCurrency(total)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Creating...' : 'Create Purchase Order'}</span>
            </button>
          </div>
        </form>

        {/* Product Search Modal */}
        {showProductSearch && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-brand-black">Add Product</h2>
                  <button
                    onClick={() => {
                      setShowProductSearch(false);
                      setSearchTerm('');
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    className="input-field pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="overflow-y-auto max-h-[60vh] p-6">
                {filteredProducts.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No products found</p>
                ) : (
                  <div className="space-y-2">
                    {filteredProducts.map((product) => (
                      <div key={product._id}>
                        <button
                          type="button"
                          onClick={() => addProduct(product)}
                          className="w-full text-left p-4 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <p className="font-semibold text-gray-900">{product.name}</p>
                          <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                          <p className="text-sm text-brand-orange">
                            Cost: {formatCurrency(product.costPrice || product.price)}
                          </p>
                        </button>

                        {product.variants && product.variants.length > 0 && (
                          <div className="ml-4 mt-2 space-y-1">
                            {product.variants.map((variant) => (
                              <button
                                key={variant._id}
                                type="button"
                                onClick={() => addProduct(product, variant)}
                                className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors border-l-2 border-gray-200"
                              >
                                <p className="font-medium text-gray-900 text-sm">
                                  {product.name} - {variant.name}
                                </p>
                                <p className="text-xs text-gray-600">SKU: {variant.sku}</p>
                                <p className="text-xs text-brand-orange">
                                  Cost: {formatCurrency(variant.price || product.price)}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Search, DollarSign, Box } from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  images: string[];
  price: number;
  hasVariants: boolean;
  variants?: Array<{
    _id: string;
    name: string;
    sku: string;
    price: number;
    wholesale: any;
  }>;
  wholesale: {
    moq: number;
    moqUnit: string;
    unitsPerBox: number;
    pricePerBox: number;
    active: boolean;
  } | null;
}

export default function AdminWholesaleProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingVariant, setEditingVariant] = useState<any>(null);

  // Form states
  const [moq, setMoq] = useState(1);
  const [moqUnit, setMoqUnit] = useState('box');
  const [unitsPerBox, setUnitsPerBox] = useState(1);
  const [pricePerBox, setPricePerBox] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/wholesale/products?all=true');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (product: Product, variant?: any) => {
    setSelectedProduct(product);
    setEditingVariant(variant);

    const config = variant?.wholesale || product.wholesale;
    if (config) {
      setMoq(config.moq);
      setMoqUnit(config.moqUnit);
      setUnitsPerBox(config.unitsPerBox);
      setPricePerBox(config.pricePerBox);
      setIsActive(config.active);
    } else {
      // Set defaults
      setMoq(1);
      setMoqUnit('box');
      setUnitsPerBox(1);
      setPricePerBox(0);
      setIsActive(true);
    }

    setShowModal(true);
  };

  const handleSave = async () => {
    if (!selectedProduct) return;

    try {
      const wholesaleData = {
        productId: selectedProduct._id,
        variantId: editingVariant?._id || null,
        moq,
        moqUnit,
        unitsPerBox,
        pricePerBox,
        active: isActive,
      };

      const res = await fetch('/api/wholesale/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wholesaleData),
      });

      if (res.ok) {
        toast.success('Wholesale config saved');
        fetchProducts();
        setShowModal(false);
      } else {
        toast.error('Failed to save config');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save config');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const wholesaleCount = products.filter(p => p.wholesale?.active).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-brand-black mb-2">
            Wholesale Products
          </h1>
          <p className="text-gray-600">
            Configure wholesale pricing and MOQ for products
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600">Total Products</p>
              <Package className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-brand-black">{products.length}</p>
          </div>

          <div className="bg-green-50 rounded-xl p-6 shadow-sm border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-green-800">Wholesale Enabled</p>
              <Box className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900">{wholesaleCount}</p>
          </div>

          <div className="bg-blue-50 rounded-xl p-6 shadow-sm border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-blue-800">Not Configured</p>
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-900">{products.length - wholesaleCount}</p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Retail Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Wholesale Config
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No products found
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {product.images[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-brand-black">
                              {product.name}
                            </p>
                            <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                            {product.hasVariants && (
                              <p className="text-xs text-blue-600">
                                {product.variants?.length} variants
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-semibold text-brand-black">
                          R{product.price.toFixed(2)}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        {product.wholesale ? (
                          <div className="text-sm">
                            <p className="font-semibold text-brand-black">
                              R{product.wholesale.pricePerBox.toFixed(2)}/{product.wholesale.moqUnit}
                            </p>
                            <p className="text-gray-600">
                              {product.wholesale.unitsPerBox} units/box
                            </p>
                            <p className="text-gray-600">
                              MOQ: {product.wholesale.moq}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Not configured</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {product.wholesale?.active ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openEditModal(product)}
                          className="text-brand-orange hover:text-orange-600 font-medium text-sm inline-flex items-center space-x-1"
                        >
                          {product.wholesale ? (
                            <>
                              <Edit className="w-4 h-4" />
                              <span>Edit</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              <span>Configure</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Config Modal */}
      {showModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-brand-black">
                Configure Wholesale Pricing
              </h2>
              <p className="text-gray-600 mt-1">
                {selectedProduct.name}
                {editingVariant && ` - ${editingVariant.name}`}
              </p>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    MOQ (Minimum Order Quantity) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={moq}
                    onChange={(e) => setMoq(parseInt(e.target.value) || 1)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    MOQ Unit *
                  </label>
                  <select
                    value={moqUnit}
                    onChange={(e) => setMoqUnit(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="box">Box</option>
                    <option value="case">Case</option>
                    <option value="carton">Carton</option>
                    <option value="pack">Pack</option>
                    <option value="pallet">Pallet</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Units Per Box *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={unitsPerBox}
                    onChange={(e) => setUnitsPerBox(parseInt(e.target.value) || 1)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    How many individual units in one {moqUnit}?
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Per Box *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      R
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricePerBox}
                      onChange={(e) => setPricePerBox(parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Price per {moqUnit}
                  </p>
                </div>
              </div>

              {/* Calculations */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Pricing Breakdown</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-800">Price per unit:</span>
                    <span className="font-semibold text-blue-900">
                      R{unitsPerBox > 0 ? (pricePerBox / unitsPerBox).toFixed(2) : '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-800">Minimum order value:</span>
                    <span className="font-semibold text-blue-900">
                      R{(pricePerBox * moq).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-800">Minimum total units:</span>
                    <span className="font-semibold text-blue-900">
                      {moq * unitsPerBox} units
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-semibold text-brand-black">Active</p>
                  <p className="text-sm text-gray-600">
                    Enable wholesale purchasing for this product
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-orange peer-focus:ring-opacity-20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-orange"></div>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 btn-primary"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
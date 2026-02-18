'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  ClipboardCheck, 
  Search, 
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  X,
  Plus,
  Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '@/lib/branch-context';

interface StockTake {
  _id: string;
  productId: string;
  productName: string;
  variantId?: string; // ✅ ADD THIS LINE
  variantName?: string;
  sku: string;
  expectedStock: number;
  countedStock: number;
  variance: number;
  status: string;
  scheduledDate: string;
  completedDate?: string;
  autoScheduleInterval?: string;
  nextScheduledDate?: string;
}

interface Product {
  _id: string;
  name: string;
  sku: string;
  stockLevel: number;
  lowStockThreshold: number;
  hasVariants: boolean;
  variants?: Array<{
    _id: string;
    name: string;
    sku: string;
    stockLevel: number;
  }>;
}

export default function StockTakesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { branch, loading: branchLoading } = useBranch();
  
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStockTake, setSelectedStockTake] = useState<StockTake | null>(null);
  const [countedStock, setCountedStock] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Create stock take form
  const [createForm, setCreateForm] = useState({
    productId: '',
    variantId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    autoScheduleInterval: 'monthly' as 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'never',
    notes: ''
  });

  useEffect(() => {
    if (!branchLoading && branch) {
      fetchStockTakes();
      fetchProducts();
    }
  }, [branchLoading, branch, statusFilter]);

  const fetchStockTakes = async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'all' 
        ? '/api/stock-takes?all=true'
        : `/api/stock-takes?status=${statusFilter}&all=true`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStockTakes(data.stockTakes || []);
      } else {
        toast.error('Failed to load stock takes');
      }
    } catch (error) {
      toast.error('Failed to load stock takes');
    } finally {
      setLoading(false);
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

  const handleCompleteStockTake = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStockTake) return;

    try {
      const res = await fetch(`/api/stock-takes/${selectedStockTake._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countedStock: parseInt(countedStock),
          notes,
          status: 'completed',
        }),
      });

      if (res.ok) {
        toast.success('Stock take completed');
        setShowCompleteModal(false);
        setSelectedStockTake(null);
        setCountedStock('');
        setNotes('');
        fetchStockTakes();
        fetchProducts(); // Refresh products to update stock levels
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to complete stock take');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleCreateStockTake = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch('/api/stock-takes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      if (res.ok) {
        toast.success('Stock take scheduled');
        setShowCreateModal(false);
        setCreateForm({
          productId: '',
          variantId: '',
          scheduledDate: new Date().toISOString().split('T')[0],
          autoScheduleInterval: 'monthly',
          notes: ''
        });
        fetchStockTakes();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create stock take');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-ZA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <ClipboardCheck className="w-4 h-4" />;
    }
  };

  const isOverdue = (scheduledDate: string, status: string) => {
    return status === 'pending' && new Date(scheduledDate) < new Date();
  };

  const isLowStock = (product: Product, variant?: any) => {
    const stock = variant ? variant.stockLevel : product.stockLevel;
    return stock <= product.lowStockThreshold;
  };

  const needsStockTake = (productId: string, variantId?: string) => {
    return !stockTakes.some(st => 
      st.productId === productId && 
      st.variantId === variantId &&
      (st.status === 'pending' || st.status === 'in_progress')
    );
  };

  // Get low stock products
  const lowStockProducts = products.filter(p => {
    if (p.hasVariants && p.variants) {
      return p.variants.some(v => isLowStock(p, v));
    }
    return isLowStock(p);
  });

  // Get products needing stock takes
  const productsNeedingStockTake = products.filter(p => {
    if (p.hasVariants && p.variants) {
      return p.variants.some(v => needsStockTake(p._id, v._id));
    }
    return needsStockTake(p._id);
  });

  const filteredStockTakes = stockTakes
    .filter(st =>
      st.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      st.sku.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .map(st => ({
      ...st,
      status: isOverdue(st.scheduledDate, st.status) ? 'overdue' : st.status
    }));

  const stats = {
    total: stockTakes.length,
    pending: stockTakes.filter(st => st.status === 'pending').length,
    overdue: stockTakes.filter(st => isOverdue(st.scheduledDate, st.status)).length,
    completed: stockTakes.filter(st => st.status === 'completed').length,
    lowStock: lowStockProducts.length,
  };

  const selectedProduct = products.find(p => p._id === createForm.productId);
  const selectedVariant = selectedProduct?.variants?.find(v => v._id === createForm.variantId);

  if (branchLoading || loading) {
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

  return (
    <div className="min-h-screen bg-gray-50 pt-32 md:pt-28">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-brand-black">Stock Takes</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Schedule Stock Take</span>
            </button>
          </div>
          <p className="text-gray-600">Manage inventory counts for {branch.displayName}</p>
        </div>

        {/* Alerts */}
        {stats.lowStock > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="text-lg font-bold text-red-900">
                  {stats.lowStock} Product{stats.lowStock !== 1 ? 's' : ''} Below Low Stock Threshold
                </h3>
                <p className="text-sm text-red-700">
                  These products need immediate attention and stock takes
                </p>
              </div>
            </div>
            <div className="mt-4 max-h-48 overflow-y-auto space-y-2">
              {lowStockProducts.slice(0, 10).map(product => {
                if (product.hasVariants && product.variants) {
                  return product.variants
                    .filter(v => isLowStock(product, v))
                    .map(variant => (
                      <div key={`${product._id}-${variant._id}`} className="bg-white p-3 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{product.name} - {variant.name}</p>
                          <p className="text-xs text-gray-600">SKU: {variant.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-600">{variant.stockLevel} units</p>
                          <p className="text-xs text-gray-500">Threshold: {product.lowStockThreshold}</p>
                        </div>
                      </div>
                    ));
                }
                return (
                  <div key={product._id} className="bg-white p-3 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-600">SKU: {product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{product.stockLevel} units</p>
                      <p className="text-xs text-gray-500">Threshold: {product.lowStockThreshold}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">Total</p>
            <p className="text-2xl font-bold text-brand-black">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600 mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-500">
            <p className="text-sm text-gray-600 mb-1">Overdue</p>
            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-500">
            <p className="text-sm text-gray-600 mb-1">Low Stock</p>
            <p className="text-2xl font-bold text-orange-600">{stats.lowStock}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product or SKU..."
              className="input-field pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="input-field w-full sm:w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Stock Takes List */}
        {filteredStockTakes.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <ClipboardCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No stock takes found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'Try a different search term' : 'Schedule stock takes to track inventory accuracy'}
            </p>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              Schedule Stock Take
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Product</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">SKU</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Expected</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Counted</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Variance</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Scheduled</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStockTakes.map((st) => (
                    <tr key={st._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{st.productName}</p>
                          {st.variantName && (
                            <p className="text-xs text-gray-500">{st.variantName}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{st.sku}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {st.expectedStock} units
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {st.status === 'completed' ? `${st.countedStock} units` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {st.status === 'completed' && (
                          <div className="flex items-center space-x-1">
                            {st.variance > 0 ? (
                              <>
                                <TrendingUp className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-medium text-green-600">+{st.variance}</span>
                              </>
                            ) : st.variance < 0 ? (
                              <>
                                <TrendingDown className="w-4 h-4 text-red-600" />
                                <span className="text-sm font-medium text-red-600">{st.variance}</span>
                              </>
                            ) : (
                              <span className="text-sm text-gray-500">0</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(st.scheduledDate)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(st.status)}`}>
                          {getStatusIcon(st.status)}
                          <span>{st.status.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end">
                          {(st.status === 'pending' || st.status === 'overdue') && (
                            <button
                              onClick={() => {
                                setSelectedStockTake(st);
                                setCountedStock(st.expectedStock.toString());
                                setShowCompleteModal(true);
                              }}
                              className="btn-secondary text-sm"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Complete Modal */}
        {showCompleteModal && selectedStockTake && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-brand-black">Complete Stock Take</h2>
                <button
                  onClick={() => {
                    setShowCompleteModal(false);
                    setSelectedStockTake(null);
                    setCountedStock('');
                    setNotes('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="font-semibold text-gray-900">{selectedStockTake.productName}</p>
                {selectedStockTake.variantName && (
                  <p className="text-sm text-gray-600">{selectedStockTake.variantName}</p>
                )}
                <p className="text-sm text-gray-500 mt-1">SKU: {selectedStockTake.sku}</p>
                <p className="text-sm text-gray-600 mt-2">
                  Expected: <span className="font-semibold">{selectedStockTake.expectedStock} units</span>
                </p>
              </div>

              <form onSubmit={handleCompleteStockTake} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Counted Stock *
                  </label>
                  <input
                    type="number"
                    required
                    className="input-field"
                    value={countedStock}
                    onChange={(e) => setCountedStock(e.target.value)}
                    placeholder="Enter counted quantity"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    className="input-field"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any observations or notes..."
                  />
                </div>

                {countedStock && parseInt(countedStock) !== selectedStockTake.expectedStock && (
                  <div className={`p-3 rounded-lg ${
                    parseInt(countedStock) > selectedStockTake.expectedStock 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <p className="text-sm font-medium">
                      Variance: {parseInt(countedStock) - selectedStockTake.expectedStock} units
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompleteModal(false);
                      setSelectedStockTake(null);
                      setCountedStock('');
                      setNotes('');
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary flex-1">
                    Complete
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Stock Take Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 my-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-brand-black">Schedule Stock Take</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateForm({
                      productId: '',
                      variantId: '',
                      scheduledDate: new Date().toISOString().split('T')[0],
                      autoScheduleInterval: 'monthly',
                      notes: ''
                    });
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateStockTake} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product *
                  </label>
                  <select
                    required
                    className="input-field"
                    value={createForm.productId}
                    onChange={(e) => setCreateForm({ ...createForm, productId: e.target.value, variantId: '' })}
                  >
                    <option value="">Select a product...</option>
                    {products.map(product => (
                      <option key={product._id} value={product._id}>
                        {product.name} ({product.sku}) - {product.stockLevel} units
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProduct?.hasVariants && selectedProduct.variants && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Variant
                    </label>
                    <select
                      className="input-field"
                      value={createForm.variantId}
                      onChange={(e) => setCreateForm({ ...createForm, variantId: e.target.value })}
                    >
                      <option value="">Base Product</option>
                      {selectedProduct.variants.map(variant => (
                        <option key={variant._id} value={variant._id}>
                          {variant.name} ({variant.sku}) - {variant.stockLevel} units
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    className="input-field"
                    value={createForm.scheduledDate}
                    onChange={(e) => setCreateForm({ ...createForm, scheduledDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Auto-Schedule Interval
                  </label>
                  <select
                    className="input-field"
                    value={createForm.autoScheduleInterval}
                    onChange={(e) => setCreateForm({ ...createForm, autoScheduleInterval: e.target.value as any })}
                  >
                    <option value="never">Never (One-time only)</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly (Every 2 weeks)</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly (Every 3 months)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    className="input-field"
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    placeholder="Optional notes or instructions..."
                  />
                </div>

                <div className="flex items-center space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreateForm({
                        productId: '',
                        variantId: '',
                        scheduledDate: new Date().toISOString().split('T')[0],
                        autoScheduleInterval: 'monthly',
                        notes: ''
                      });
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={creating}
                    className="btn-primary flex-1"
                  >
                    {creating ? 'Scheduling...' : 'Schedule'}
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
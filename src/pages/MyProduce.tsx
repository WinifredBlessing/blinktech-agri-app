import React, { useState, useMemo } from 'react';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Filter, Edit2, Trash2, TrendingUp, AlertCircle, Save, X, ImageIcon, Sprout, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { FarmerHeader } from '../components/FarmerHeader';
import { motion, AnimatePresence } from 'motion/react';

export const MyProduce = () => {
  const { produceList, loadingProduce, deleteProduce, updateProduce } = useMarketplace();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // Quick Edit State
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [actionError, setActionError] = useState<string | null>(null);

  // Synchronously compute current farmer's produce so cards remain stable during background sync
  const farmerProducts = useMemo(() => {
    if (!user?.id) return [];
    return produceList.filter(p => p.farmerId === user.id);
  }, [user?.id, produceList]);

  const filteredProducts = useMemo(() => {
    return farmerProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === '' || p.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [farmerProducts, searchTerm, filterCategory]);

  const isInitialLoading = loadingProduce && produceList.length === 0;

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await deleteProduce(id);
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error('Failed to delete produce:', err);
      setActionError(err?.message || 'Failed to delete produce. Please try again.');
    }
  };

  const startQuickEdit = (produce: any) => {
    setQuickEditId(produce.id);
    setEditPrice(produce.price);
    setEditQuantity(produce.availableQuantity);
  };

  const saveQuickEdit = async (id: string) => {
    setActionError(null);
    try {
      await updateProduce(id, {
        price: editPrice,
        availableQuantity: editQuantity
      });
      setQuickEditId(null);
    } catch (err: any) {
      console.error('Failed to update produce:', err);
      setActionError(err?.message || 'Failed to update produce. Please try again.');
    }
  };

  const cancelQuickEdit = () => {
    setQuickEditId(null);
  };

  const categories = Array.from(new Set(farmerProducts.map(p => p.category)));
  const totalValue = farmerProducts.reduce((sum, p) => sum + (p.price * p.availableQuantity), 0);
  const activeListings = farmerProducts.filter(p => p.status === 'Available').length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      <FarmerHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-slate-950">My Produce Listings</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">Manage your active harvest inventory, stock availability, and commercial prices.</p>
          </div>
          <Link
            to="/farmer/produce/add"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#15803d] hover:bg-[#166534] text-white transition-all shadow-xs"
          >
            <Plus size={16} />
            <span>Add New Listing</span>
          </Link>
        </div>

        {/* Action Error Alert */}
        {actionError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700 font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-red-500 hover:text-red-700 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Listings</span>
              <div className="w-8 h-8 bg-emerald-50 text-[#15803d] rounded-lg flex items-center justify-center">
                <Sprout size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-sans font-bold text-slate-950">{farmerProducts.length}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active in Stock</span>
              <div className="w-8 h-8 bg-blue-50 text-[#0057b8] rounded-lg flex items-center justify-center">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-sans font-bold text-slate-950">{activeListings}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estimated Value</span>
              <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                <TrendingUp size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-sans font-bold text-slate-950">₦{totalValue.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters and List */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-5 sm:p-6 mb-8">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center mb-6">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search produce name or category..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]"
              />
            </div>
            
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
              <button
                onClick={() => setFilterCategory('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  filterCategory === '' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat as string)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    filterCategory === cat ? 'bg-[#15803d] text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat as string}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          {isInitialLoading ? (
            <div className="py-16 flex justify-center">
              <div className="w-8 h-8 border-3 border-slate-200 border-t-[#15803d] rounded-full animate-spin"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Sprout size={32} className="text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">No produce found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                {searchTerm || filterCategory 
                  ? "No produce listings match your active filters."
                  : "You haven't listed any produce yet. Add your first harvest to receive purchase requests."}
              </p>
              {(searchTerm || filterCategory) ? (
                <button
                  onClick={() => { setSearchTerm(''); setFilterCategory(''); }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              ) : (
                <Link
                  to="/farmer/produce/add"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#15803d] text-white rounded-lg text-xs font-semibold"
                >
                  <Plus size={15} /> Add First Listing
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <AnimatePresence>
                {filteredProducts.map((produce) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    key={produce.id}
                    className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden flex flex-col shadow-xs hover:border-slate-300 transition-all group"
                  >
                    <div className="h-44 bg-slate-50 relative overflow-hidden">
                      {produce.images && produce.images.length > 0 ? (
                        <img 
                          src={produce.images[0]} 
                          alt={produce.name} 
                          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300" 
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon size={28} className="mb-1 opacity-40" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40">No Image</span>
                        </div>
                      )}
                      
                      {/* Status Badge */}
                      <div className="absolute top-2.5 right-2.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shadow-xs ${
                          produce.status === 'Available' ? 'bg-emerald-50 text-[#15803d] border border-emerald-200' :
                          produce.status === 'Limited' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                          'bg-red-50 text-red-800 border border-red-200'
                        }`}>
                          {produce.status}
                        </span>
                      </div>
                      
                      {/* Category Badge */}
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-900/80 text-white backdrop-blur-xs">
                          {produce.category}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold font-sans text-base text-slate-900 tracking-tight mb-1 group-hover:text-[#15803d] transition-colors">
                          {produce.name}
                        </h3>
                        {produce.location && <p className="text-xs text-slate-500 font-normal truncate">{produce.location}</p>}
                      </div>
                      
                      {quickEditId === produce.id ? (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="my-3 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Stock ({produce.unit || 'kg'})
                              </label>
                              <input 
                                type="number"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(Number(e.target.value))}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                                min="0"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Price (₦)
                              </label>
                              <input 
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(Number(e.target.value))}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                                min="0"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={cancelQuickEdit}
                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => saveQuickEdit(produce.id)}
                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[#15803d] text-white hover:bg-[#166534]"
                            >
                              Save
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="my-3 bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Price</p>
                            <div className="font-bold text-slate-900">
                              ₦{produce.price.toLocaleString()} <span className="font-normal text-slate-500">/ {produce.unit || 'kg'}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Stock</p>
                            <p className="font-bold text-slate-900">{produce.availableQuantity.toLocaleString()} {produce.unit || 'kg'}</p>
                          </div>
                        </div>
                      )}
                      
                      {quickEditId !== produce.id && (
                        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
                          <button 
                            onClick={() => startQuickEdit(produce)}
                            className="py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
                          >
                            Quick Edit
                          </button>
                          <button 
                            onClick={() => navigate(`/farmer/produce/${produce.id}/edit`)}
                            className="flex items-center justify-center gap-1 py-1.5 bg-white text-slate-700 hover:bg-slate-50 rounded-lg font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button 
                            onClick={() => setDeleteConfirm(produce.id)}
                            className="flex items-center justify-center gap-1 py-1.5 bg-white text-red-600 hover:bg-red-50 rounded-lg font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
        
        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
                onClick={() => setDeleteConfirm(null)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl relative z-10 border border-slate-200"
              >
                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4 border border-red-100">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-base font-sans font-bold text-slate-900 mb-1">Delete produce listing?</h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">This produce item will be permanently removed from the public marketplace.</p>
                <div className="flex gap-2.5">
                  <button 
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleDelete(deleteConfirm)}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold"
                  >
                    Confirm Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
      </main>
    </div>
  );
};

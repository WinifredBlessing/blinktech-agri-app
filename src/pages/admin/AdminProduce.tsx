import React, { useState } from 'react';
import { useMarketplace } from '../../context/MarketplaceContext';
import { Produce } from '../../types';
import { Search, Trash2, Edit2, X, AlertCircle, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AdminProduce = () => {
  const { produceList, updateProduce, deleteProduce } = useMarketplace();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Modals
  const [selectedProduce, setSelectedProduce] = useState<Produce | null>(null);
  const [editingProduce, setEditingProduce] = useState<Produce | null>(null);
  const [deleteConfirmProduce, setDeleteConfirmProduce] = useState<Produce | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<'Available' | 'Limited' | 'Low Stock' | 'Out of Stock'>('Available');

  const categories = ['All', ...Array.from(new Set(produceList.map(p => p.category)))];

  const [adminError, setAdminError] = useState<string | null>(null);

  const filtered = produceList.filter(p => {
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.farmerName && p.farmerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.location && p.location.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const handleToggleAvailability = async (produce: Produce) => {
    setAdminError(null);
    try {
      const nextStatus = produce.status === 'Out of Stock' ? 'Available' : 'Out of Stock';
      await updateProduce(produce.id, { status: nextStatus });
    } catch (err: any) {
      console.error('AdminProduce toggle error:', err);
      setAdminError(err?.message || 'Failed to update produce status.');
    }
  };

  const openEditModal = (p: Produce) => {
    setEditingProduce(p);
    setEditName(p.name);
    setEditPrice(p.price);
    setEditQuantity(p.availableQuantity);
    setEditStatus(p.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduce) return;
    setAdminError(null);

    try {
      await updateProduce(editingProduce.id, {
        name: editName,
        price: editPrice,
        availableQuantity: editQuantity,
        status: editStatus
      });
      setEditingProduce(null);
    } catch (err: any) {
      console.error('AdminProduce save edit error:', err);
      setAdminError(err?.message || 'Failed to save produce modifications.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmProduce) return;
    setAdminError(null);
    try {
      await deleteProduce(deleteConfirmProduce.id);
      setDeleteConfirmProduce(null);
    } catch (err: any) {
      console.error('AdminProduce delete error:', err);
      setAdminError(err?.message || 'Failed to delete produce.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-body text-slate-900">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 font-sans tracking-tight">Produce Catalog Management</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-normal">
          Moderate listings, audit bulk inventories, and adjust produce pricing across regional farms.
        </p>
      </div>

      {/* Admin Error Alert */}
      {adminError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700 font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{adminError}</span>
          </div>
          <button
            onClick={() => setAdminError(null)}
            className="text-red-500 hover:text-red-700 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by crop, farmer, or region..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto">
            {categories.slice(0, 5).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-white border-b border-slate-100 uppercase tracking-wider text-slate-400 font-bold text-[10px]">
                <th className="px-5 py-3">Produce</th>
                <th className="px-5 py-3">Farmer / Farm</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Price & Inventory</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                            <Package size={18} />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900 text-xs">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">#{item.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">{item.farmerName || 'Musa Ibrahim'}</p>
                      <p className="text-[10px] text-slate-400">ID: {item.farmerId.slice(0, 8)}...</p>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                        {item.category}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-900">₦{item.price.toLocaleString()} /{item.unit || 'kg'}</p>
                      <p className="text-slate-500 font-normal">{item.availableQuantity.toLocaleString()} {item.unit || 'kg'}</p>
                    </td>

                    <td className="px-5 py-3.5 text-slate-600 font-normal">
                      {item.location || 'Kano, Nigeria'}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.status === 'Available'
                            ? 'bg-emerald-50 text-[#15803d] border border-emerald-200'
                            : item.status === 'Limited'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleAvailability(item)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
                        >
                          {item.status === 'Out of Stock' ? 'Set Available' : 'Out of Stock'}
                        </button>
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Produce"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmProduce(item)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove Listing"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-xs">
                    No produce listings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingProduce && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setEditingProduce(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative z-10 border border-slate-200"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-base font-sans font-bold text-slate-900">Edit Produce Listing</h3>
                <button onClick={() => setEditingProduce(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Crop / Commodity Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₦ / {editingProduce.unit || 'kg'})</label>
                  <input
                    type="number"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Available Quantity ({editingProduce.unit || 'kg'})</label>
                  <input
                    type="number"
                    required
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Availability</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  >
                    <option value="Available">Available</option>
                    <option value="Limited">Limited Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                  </select>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingProduce(null)}
                    className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmProduce && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setDeleteConfirmProduce(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl relative z-10 border border-slate-200"
            >
              <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-3 border border-red-200">
                <AlertCircle size={20} />
              </div>
              <h3 className="text-base font-sans font-bold text-slate-900 mb-1">Delete produce listing?</h3>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                Are you sure you want to permanently remove <strong>{deleteConfirmProduce.name}</strong> from the national marketplace?
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setDeleteConfirmProduce(null)}
                  className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

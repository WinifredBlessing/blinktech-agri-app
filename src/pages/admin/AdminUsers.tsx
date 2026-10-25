import React, { useState, useEffect, useCallback } from 'react';
import { useMarketplace } from '../../context/MarketplaceContext';
import { authService } from '../../services/authService';
import { User } from '../../types';
import { Search, Edit2, X, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminUsersProps {
  roleFilter?: 'Farmer' | 'Buyer';
}

export const AdminUsers = ({ roleFilter }: AdminUsersProps) => {
  const { produceList, requests, orders } = useMarketplace();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Suspended'>('All');

  // Modals
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [suspendModalUser, setSuspendModalUser] = useState<User | null>(null);

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editOrgOrFarm, setEditOrgOrFarm] = useState('');

  // Per-operation loading and error state (keyed by user ID + action)
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);

  const showFeedback = (msg: string, type: 'error' | 'success') => {
    if (type === 'error') {
      setOperationError(msg);
      setOperationSuccess(null);
    } else {
      setOperationSuccess(msg);
      setOperationError(null);
    }
    // Auto-clear after 6 seconds
    setTimeout(() => {
      setOperationError(null);
      setOperationSuccess(null);
    }, 6000);
  };

  const loadUsers = useCallback(async () => {
    try {
      const live = await authService.fetchAllProfiles();
      if (live && live.length > 0) {
        setUsers(live);
        return;
      }
      const stored = localStorage.getItem('agrilink_users');
      if (stored) {
        setUsers(JSON.parse(stored));
      }
    } catch {
      // fallback silently
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    loadUsers();

    // 1. Realtime subscription to profiles table
    const unsubscribe = authService.subscribeToProfiles((updated) => {
      if (mounted && updated && updated.length > 0) {
        setUsers(updated);
      }
    });

    // 2. Fallback polling every 5 seconds
    const interval = setInterval(() => {
      authService.fetchAllProfiles().then((live) => {
        if (mounted && live && live.length > 0) {
          setUsers(live);
        }
      });
    }, 5000);

    const onFocus = () => loadUsers();
    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadUsers]);

  /**
   * Toggle user suspension status.
   * - Calls authService.adminUpdateUserStatus which awaits DB confirmation.
   * - UI state is ONLY updated after the database write succeeds.
   * - Displays a clear error message if the DB write is rejected.
   */
  const handleToggleSuspend = async (user: User) => {
    const isSuspended = user.accountStatus === 'Suspended' || user.status === 'Suspended';
    const nextStatus: 'Active' | 'Suspended' = isSuspended ? 'Active' : 'Suspended';
    const actionKey = `${user.id}-suspend`;

    setOperationLoading(actionKey);
    setOperationError(null);
    setOperationSuccess(null);
    setSuspendModalUser(null);

    try {
      const confirmedUser = await authService.adminUpdateUserStatus(user.id, nextStatus);
      // Only update UI after DB confirms
      setUsers(prev =>
        prev.map(u => u.id === confirmedUser.id ? confirmedUser : u)
      );
      showFeedback(
        `${confirmedUser.name} has been ${nextStatus === 'Suspended' ? 'suspended' : 'reactivated'} successfully.`,
        'success'
      );
    } catch (err: any) {
      showFeedback(
        err?.message || 'Failed to update account status. Please apply the admin moderation migration in Supabase.',
        'error'
      );
    } finally {
      setOperationLoading(null);
    }
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditPhone(u.phone || '');
    setEditLocation(u.location || '');
    setEditOrgOrFarm(u.farmName || u.organization || '');
    setOperationError(null);
    setOperationSuccess(null);
  };

  /**
   * Save admin edit of user profile fields.
   * - Calls authService.adminUpdateUserProfile which awaits DB confirmation.
   * - UI state is ONLY updated after the database write succeeds.
   * - Displays a clear error message if the DB write is rejected.
   */
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const isFarmer = editingUser.role?.toLowerCase() === 'farmer';
    const actionKey = `${editingUser.id}-edit`;

    setOperationLoading(actionKey);
    setOperationError(null);
    setOperationSuccess(null);

    try {
      const confirmedUser = await authService.adminUpdateUserProfile(editingUser.id, {
        fullName: editName,
        phone: editPhone,
        location: editLocation,
        farmName: isFarmer ? editOrgOrFarm : undefined,
        organization: !isFarmer ? editOrgOrFarm : undefined,
      });
      // Only update UI after DB confirms
      setUsers(prev =>
        prev.map(u => u.id === confirmedUser.id ? confirmedUser : u)
      );
      setEditingUser(null);
      showFeedback(`${confirmedUser.name}'s profile has been updated successfully.`, 'success');
    } catch (err: any) {
      // Keep modal open so admin can retry or cancel
      setOperationError(
        err?.message || 'Failed to save profile changes. Please apply the admin moderation migration in Supabase.'
      );
    } finally {
      setOperationLoading(null);
    }
  };

  const filteredUsers = users.filter(user => {
    if (roleFilter && user.role?.toLowerCase() !== roleFilter.toLowerCase()) return false;

    const currentStatus = user.accountStatus || user.status || 'Active';
    if (statusFilter !== 'All' && currentStatus !== statusFilter) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        (user.name || '').toLowerCase().includes(query) ||
        (user.email || '').toLowerCase().includes(query) ||
        (user.phone || '').toLowerCase().includes(query) ||
        (user.farmName || '').toLowerCase().includes(query) ||
        (user.organization || '').toLowerCase().includes(query) ||
        (user.location || '').toLowerCase().includes(query)
      );
    }

    return true;
  });

  const getStatusBadge = (status?: string) => {
    if (status === 'Suspended') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
          Suspended
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#15803d] border border-emerald-200">
        Active
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-body text-slate-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 font-sans tracking-tight">
            {roleFilter === 'Farmer'
              ? 'Farmer Directory & Verification'
              : roleFilter === 'Buyer'
              ? 'Buyer Enterprise Directory'
              : 'User Management'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-normal">
            Manage {roleFilter ? `${roleFilter.toLowerCase()} accounts` : 'registered platform accounts'}, KYC status, and permissions.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
          {['All', 'Active', 'Suspended'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as 'All' | 'Active' | 'Suspended')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                statusFilter === status
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Global feedback banner */}
      <AnimatePresence>
        {operationError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold text-red-900 text-xs mb-0.5">Operation Failed</p>
              <p className="text-xs leading-relaxed">{operationError}</p>
            </div>
            <button
              onClick={() => setOperationError(null)}
              className="ml-auto p-1 text-red-400 hover:text-red-700 rounded"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
        {operationSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800"
          >
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            <p className="text-xs leading-relaxed">{operationSuccess}</p>
            <button
              onClick={() => setOperationSuccess(null)}
              className="ml-auto p-1 text-emerald-400 hover:text-emerald-700 rounded"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, organization, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium hidden sm:block">
            {filteredUsers.length} total records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-white border-b border-slate-100 uppercase tracking-wider text-slate-400 font-bold text-[10px]">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">{roleFilter === 'Farmer' ? 'Farm Enterprise' : roleFilter === 'Buyer' ? 'Organization' : 'Role / Affiliation'}</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Activity</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date Joined</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const produceCount = produceList.filter(p => p.farmerId === u.id).length;
                  const requestCount = requests.filter(r => r.buyerId === u.id).length;
                  const orderCount = orders.filter(o => o.buyerId === u.id || o.farmerId === u.id).length;
                  const isSuspendLoading = operationLoading === `${u.id}-suspend`;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {u.name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-xs">{u.name}</p>
                            <p className="text-[10px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">
                          {u.farmName || u.organization || (u.role === 'Admin' ? 'Platform Administrator' : 'Independent')}
                        </p>
                        <p className="text-[10px] text-slate-400">{u.role}</p>
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 font-normal">
                        {u.location || 'Nigeria'}
                      </td>

                      <td className="px-5 py-3.5 text-slate-600">
                        {u.role === 'Farmer' ? (
                          <span>{produceCount} produce • {orderCount} orders</span>
                        ) : u.role === 'Buyer' ? (
                          <span>{requestCount} requests • {orderCount} orders</span>
                        ) : (
                          <span>Full admin privileges</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        {getStatusBadge(u.accountStatus || u.status)}
                      </td>

                      <td className="px-5 py-3.5 text-slate-400">
                        {u.dateJoined || '2026-02-10'}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            View
                          </button>
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit User"
                          >
                            <Edit2 size={13} />
                          </button>
                          {u.role !== 'Admin' && (
                            <button
                              onClick={() => setSuspendModalUser(u)}
                              disabled={isSuspendLoading}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                                u.accountStatus === 'Suspended' || u.status === 'Suspended'
                                  ? 'bg-emerald-50 text-[#15803d] border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              }`}
                            >
                              {isSuspendLoading ? (
                                <Loader2 size={11} className="inline animate-spin mr-1" />
                              ) : null}
                              {u.accountStatus === 'Suspended' || u.status === 'Suspended' ? 'Reactivate' : 'Suspend'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-xs">
                    No records found matching current query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View User Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setSelectedUser(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative z-10 border border-slate-200"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-base font-sans font-bold text-slate-900">{selectedUser.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedUser.email}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 mb-5 text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex justify-between">
                  <span className="text-slate-500">Role:</span>
                  <span className="font-semibold text-slate-900">{selectedUser.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-semibold text-slate-900">{selectedUser.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Location:</span>
                  <span className="font-semibold text-slate-900">{selectedUser.location || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-semibold text-slate-900">{selectedUser.accountStatus || selectedUser.status}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs cursor-pointer"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => { setEditingUser(null); setOperationError(null); }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative z-10 border border-slate-200"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-base font-sans font-bold text-slate-900">Edit Profile</h3>
                  <p className="text-xs text-slate-500">{editingUser.email}</p>
                </div>
                <button
                  onClick={() => { setEditingUser(null); setOperationError(null); }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Error inside modal so admin can see it and retry */}
              <AnimatePresence>
                {operationError && operationLoading === null && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                    <span>{operationError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSaveEdit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingUser.role === 'Farmer' ? 'Farm Name' : 'Organization Name'}
                  </label>
                  <input
                    type="text"
                    value={editOrgOrFarm}
                    onChange={(e) => setEditOrgOrFarm(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => { setEditingUser(null); setOperationError(null); }}
                    className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={operationLoading === `${editingUser.id}-edit`}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {operationLoading === `${editingUser.id}-edit` ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Saving…
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Suspend Confirmation Modal */}
      <AnimatePresence>
        {suspendModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setSuspendModalUser(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl relative z-10 border border-slate-200"
            >
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-3 border border-amber-200">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-sans font-bold text-slate-900 mb-1">
                {suspendModalUser.accountStatus === 'Suspended' || suspendModalUser.status === 'Suspended'
                  ? 'Reactivate Account?'
                  : 'Suspend Account?'}
              </h3>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                {suspendModalUser.accountStatus === 'Suspended' || suspendModalUser.status === 'Suspended'
                  ? `Reactivating will restore marketplace trading permissions for ${suspendModalUser.name}.`
                  : `Suspending will temporarily freeze marketplace access for ${suspendModalUser.name}.`}
              </p>
              <p className="text-[10px] text-slate-400 mb-4 leading-relaxed bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                This action will be saved to the database. If it fails, you will see an error and no change will be made.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setSuspendModalUser(null)}
                  className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleToggleSuspend(suspendModalUser)}
                  disabled={operationLoading === `${suspendModalUser.id}-suspend`}
                  className={`flex-1 py-2 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 ${
                    suspendModalUser.accountStatus === 'Suspended' || suspendModalUser.status === 'Suspended'
                      ? 'bg-[#15803d] hover:bg-[#166534]'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {operationLoading === `${suspendModalUser.id}-suspend` ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Confirm'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

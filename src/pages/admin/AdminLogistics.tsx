import React, { useState } from 'react';
import { useMarketplace } from '../../context/MarketplaceContext';
import { LogisticsRequest, LogisticsStatus, getAllowedLogisticsNextStatuses } from '../../types';
import { DEMO_LOGISTICS_PROVIDERS, DEMO_DRIVERS } from '../../services/logisticsService';
import { Search, Truck, MapPin, CheckCircle2, User, Phone, Edit2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AdminLogistics = () => {
  const { logisticsRequests, loadingLogistics, logisticsError, updateLogisticsStatus } = useMarketplace();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | LogisticsStatus>('All');
  const [selectedLogistics, setSelectedLogistics] = useState<LogisticsRequest | null>(null);

  // Modal edit state
  const [editStatus, setEditStatus] = useState<LogisticsStatus>('Requested');
  const [editProvider, setEditProvider] = useState('AgriMove Logistics');
  const [editDriver, setEditDriver] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const filteredLogistics = logisticsRequests.filter(l => {
    const matchesStatus = statusFilter === 'All' || l.status === statusFilter;
    const matchesSearch =
      l.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.produceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.pickupLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.deliveryLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.buyerName && l.buyerName.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  const openManageModal = (log: LogisticsRequest) => {
    setSelectedLogistics(log);
    const allowed = getAllowedLogisticsNextStatuses(log.status);
    setEditStatus(allowed.length > 0 ? allowed[0] : log.status);
    setEditProvider(log.provider || 'AgriMove Logistics');
    setEditDriver(log.driver || 'Chinedu Okafor');
    setEditDriverPhone(log.driverPhone || '0803 234 5678');
    setUpdateError('');
  };

  const handleSave = async () => {
    if (!selectedLogistics) return;
    const isTerminal = selectedLogistics.status === 'Delivered' || selectedLogistics.status === 'Cancelled';
    if (isTerminal || editStatus === selectedLogistics.status) return;

    setIsSaving(true);
    setUpdateError('');
    try {
      await updateLogisticsStatus(
        selectedLogistics.id,
        editStatus,
        editProvider,
        editDriver,
        editDriverPhone
      );
      setSelectedLogistics(null);
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update logistics status.');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: LogisticsStatus) => {
    switch (status) {
      case 'Delivered':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#15803d] border border-emerald-200">Delivered</span>;
      case 'In Transit':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#0057b8] border border-blue-200">In Transit</span>;
      case 'Picked Up':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">Picked Up</span>;
      case 'Assigned':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">Assigned</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">Cancelled</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">Requested</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-body text-slate-900">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 font-sans tracking-tight">Logistics & Fleet Dispatch</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-normal">
            Assign transport operators, drivers, and update farm-to-destination haulage milestones.
          </p>
        </div>

        {logisticsError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs" role="alert">
            {logisticsError}
          </div>
        )}

        {/* Status Filters */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-xs overflow-x-auto">
            {['All', 'Requested', 'Assigned', 'Picked Up', 'In Transit', 'Delivered', 'Cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by ID, produce, route or buyer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium hidden sm:block">
            {filteredLogistics.length} active consignments
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-white border-b border-slate-100 uppercase tracking-wider text-slate-400 font-bold text-[10px]">
                <th className="px-5 py-3">Shipment</th>
                <th className="px-5 py-3">Produce & Qty</th>
                <th className="px-5 py-3">Haulage Route</th>
                <th className="px-5 py-3">Carrier & Driver</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingLogistics ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-xs">Loading logistics requests...</td></tr>
              ) : filteredLogistics.length > 0 ? (
                filteredLogistics.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-mono font-semibold text-slate-900">#{log.id.slice(0, 8)}</p>
                      <p className="text-[10px] text-slate-400">Order: #{log.orderId.slice(0, 8)}</p>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900 text-xs">{log.produceName}</p>
                      <p className="text-slate-500 font-normal">{log.quantity.toLocaleString()} {log.unit || 'kg'}</p>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{log.pickupLocation}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-900 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#15803d] shrink-0" />
                          <span className="truncate max-w-[140px]">{log.deliveryLocation}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900">{log.provider || 'AgriMove Logistics'}</p>
                      <p className="text-[10px] text-slate-500">{log.driver ? `${log.driver} (${log.driverPhone || ''})` : 'Driver Unassigned'}</p>
                    </td>

                    <td className="px-5 py-3.5">
                      {getStatusBadge(log.status)}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openManageModal(log)}
                        className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-xs">
                    <Truck size={28} className="mx-auto mb-1 text-slate-300" />
                    No haulage requests found matching current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manage Dispatch Modal */}
      <AnimatePresence>
        {selectedLogistics && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setSelectedLogistics(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative z-10 border border-slate-200"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-base font-sans font-bold text-slate-900">Manage Shipment #{selectedLogistics.id.slice(0, 8)}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedLogistics.produceName} • {selectedLogistics.quantity} {selectedLogistics.unit || 'kg'}</p>
                </div>
                <button onClick={() => setSelectedLogistics(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3.5">
                {updateError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs" role="alert">
                    {updateError}
                  </div>
                )}
                {(selectedLogistics.status === 'Delivered' || selectedLogistics.status === 'Cancelled') && (
                  <div className="p-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs">
                    This consignment is in a terminal status ({selectedLogistics.status}) and cannot be transitioned further.
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Transit Status</label>
                  {selectedLogistics.status === 'Delivered' || selectedLogistics.status === 'Cancelled' ? (
                    <input
                      type="text"
                      disabled
                      value={`${selectedLogistics.status} (Terminal State)`}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium text-slate-500 cursor-not-allowed"
                    />
                  ) : (
                    <select
                      value={editStatus}
                      disabled={isSaving}
                      onChange={(e) => setEditStatus(e.target.value as LogisticsStatus)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                    >
                      {getAllowedLogisticsNextStatuses(selectedLogistics.status).map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Haulage Provider</label>
                  <select
                    value={editProvider}
                    disabled={isSaving || selectedLogistics.status === 'Delivered' || selectedLogistics.status === 'Cancelled'}
                    onChange={(e) => setEditProvider(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  >
                    {DEMO_LOGISTICS_PROVIDERS.map((prov) => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Driver</label>
                  <input
                    type="text"
                    value={editDriver}
                    disabled={isSaving || selectedLogistics.status === 'Delivered' || selectedLogistics.status === 'Cancelled'}
                    onChange={(e) => setEditDriver(e.target.value)}
                    placeholder="Driver Full Name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Driver Phone Number</label>
                  <input
                    type="tel"
                    value={editDriverPhone}
                    disabled={isSaving || selectedLogistics.status === 'Delivered' || selectedLogistics.status === 'Cancelled'}
                    onChange={(e) => setEditDriverPhone(e.target.value)}
                    placeholder="0803..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLogistics(null)}
                    className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={
                      isSaving ||
                      selectedLogistics.status === 'Delivered' ||
                      selectedLogistics.status === 'Cancelled' ||
                      editStatus === selectedLogistics.status
                    }
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

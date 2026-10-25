import React, { useState } from 'react';
import { useMarketplace } from '../../context/MarketplaceContext';
import { Request } from '../../types';
import { Search, Eye, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AdminRequests = () => {
  const { requests } = useMarketplace();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  const filteredRequests = requests.filter(r => {
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    const matchesSearch =
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.produceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.buyerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.deliveryLocation && r.deliveryLocation.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Accepted':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#15803d] border border-emerald-200">Accepted</span>;
      case 'Declined':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">Declined</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">Cancelled</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">Pending</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-body text-slate-900">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 font-sans tracking-tight">Marketplace Requests</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-normal">
            Monitor commercial purchase requests between buyers and farmers across Nigeria.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-xs overflow-x-auto">
          {['All', 'Pending', 'Accepted', 'Declined', 'Cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
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

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by ID, crop, or buyer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium hidden sm:block">
            {filteredRequests.length} total records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-white border-b border-slate-100 uppercase tracking-wider text-slate-400 font-bold text-[10px]">
                <th className="px-5 py-3">Request ID</th>
                <th className="px-5 py-3">Produce</th>
                <th className="px-5 py-3">Buyer & Farmer</th>
                <th className="px-5 py-3">Quantity & Amount</th>
                <th className="px-5 py-3">Destination</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-slate-900">
                      #{request.id.slice(0, 8)}
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900 text-xs">{request.produceName}</p>
                      <p className="text-slate-500">₦{request.price.toLocaleString()} /{request.unit || 'kg'}</p>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">Buyer: {request.buyerName}</p>
                      <p className="text-[10px] text-slate-400">Farmer ID: {request.farmerId.slice(0, 8)}...</p>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{request.quantity.toLocaleString()} {request.unit || 'kg'}</p>
                      <p className="text-[#0057b8] font-bold">₦{request.totalAmount.toLocaleString()}</p>
                    </td>

                    <td className="px-5 py-3.5 text-slate-600 truncate max-w-[150px]">
                      {request.deliveryLocation}
                    </td>

                    <td className="px-5 py-3.5">
                      {getStatusBadge(request.status)}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-xs">
                    <FileText size={28} className="mx-auto mb-1 text-slate-300" />
                    No buyer requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setSelectedRequest(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative z-10 border border-slate-200"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-base font-sans font-bold text-slate-900">Request Information</h3>
                  <p className="text-xs text-slate-500 font-mono">#{selectedRequest.id.slice(0, 8)}</p>
                </div>
                <button onClick={() => setSelectedRequest(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 mb-4 text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex justify-between">
                  <span className="text-slate-500">Produce:</span>
                  <span className="font-semibold text-slate-900">{selectedRequest.produceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Volume:</span>
                  <span className="font-semibold text-slate-900">{selectedRequest.quantity.toLocaleString()} {selectedRequest.unit || 'kg'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Value:</span>
                  <span className="font-bold text-[#0057b8]">₦{selectedRequest.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Buyer:</span>
                  <span className="font-semibold text-slate-900">{selectedRequest.buyerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destination:</span>
                  <span className="font-medium text-slate-800">{selectedRequest.deliveryLocation}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Status:</span>
                  <span>{getStatusBadge(selectedRequest.status)}</span>
                </div>
              </div>

              {selectedRequest.message && (
                <div className="mb-4 p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Buyer Note:</span> "{selectedRequest.message}"
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs cursor-pointer"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

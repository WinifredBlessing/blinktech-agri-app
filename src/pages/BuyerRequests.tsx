import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { FileText, Clock, CheckCircle2, XCircle, Search, Eye, MapPin, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BuyerHeader } from '../components/BuyerHeader';
import { motion, AnimatePresence } from 'motion/react';

export const BuyerRequests = () => {
  const { user } = useAuth();
  const { requests, cancelRequest, loadingRequests } = useMarketplace();
  
  const myRequests = requests.filter(r => r.buyerId === user?.id).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const [filter, setFilter] = useState<'All' | 'Pending' | 'Accepted' | 'Declined' | 'Cancelled'>('All');
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const handleCancel = async (id: string) => {
    setIsCancelling(true);
    setCancelError('');
    try {
      await cancelRequest(id);
      setSelectedReq(null);
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel request.');
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredRequests = myRequests.filter(r => filter === 'All' ? true : r.status === filter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">Pending Review</span>;
      case 'Accepted':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#15803d] border border-emerald-200">Accepted</span>;
      case 'Declined':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">Declined</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">Cancelled</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      <BuyerHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-slate-950">
            My Purchase Requests
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
            Track your commercial sourcing requests submitted to farmers across Nigeria.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-6 hide-scrollbar">
          {['All', 'Pending', 'Accepted', 'Declined', 'Cancelled'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === f 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/90'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Requests List */}
        <div>
          {filteredRequests.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs max-w-lg mx-auto">
              <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">No requests found</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
                {filter === 'All' 
                  ? "You haven't submitted any purchase requests yet. Browse the marketplace and request harvest stock."
                  : `No requests currently marked as '${filter}'.`
                }
              </p>
              {filter === 'All' && (
                <Link 
                  to="/buyer-dashboard"
                  className="inline-flex items-center gap-1.5 bg-[#0057b8] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#003e8a] transition-colors"
                >
                  <Search size={14} /> Browse Marketplace
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map(req => (
                <div key={req.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all p-5 sm:p-6 flex flex-col md:flex-row justify-between gap-5">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        #{req.id.slice(0, 8)}
                      </span>
                      {getStatusBadge(req.status)}
                      <span className="text-xs text-slate-400">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-sans font-bold text-slate-900">{req.produceName}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Destination: {req.deliveryLocation}</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantity</p>
                        <p className="font-bold text-slate-900">{req.quantity.toLocaleString()} {req.unit || 'kg'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit Price</p>
                        <p className="font-bold text-slate-900">₦{req.price?.toLocaleString() || '0'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subtotal</p>
                        <p className="font-bold text-[#0057b8]">₦{req.totalAmount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex md:flex-col justify-end items-center md:items-end gap-2 md:border-l md:border-slate-100 md:pl-6 shrink-0">
                    <button 
                      onClick={() => setSelectedReq(req)}
                      className="flex-1 md:w-36 flex justify-center items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
                    >
                      <Eye size={14} /> View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Request Details Modal */}
      <AnimatePresence>
        {selectedReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setSelectedReq(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 border border-slate-200 relative z-10"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="mb-1.5">{getStatusBadge(selectedReq.status)}</div>
                  <h2 className="text-lg font-sans font-bold text-slate-900">Request Details</h2>
                  <p className="text-xs text-slate-500">Submitted on {new Date(selectedReq.createdAt).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={() => setSelectedReq(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Produce:</span>
                    <span className="font-semibold text-slate-900">{selectedReq.produceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Volume:</span>
                    <span className="font-semibold text-slate-900">{selectedReq.quantity.toLocaleString()} {selectedReq.unit || 'kg'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Unit Price:</span>
                    <span className="font-semibold text-slate-900">₦{selectedReq.price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-200 mt-1.5 font-bold">
                    <span className="text-slate-700">Estimated Total:</span>
                    <span className="text-[#0057b8] text-sm">₦{selectedReq.totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                {selectedReq.message && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Your Message</p>
                    <p className="text-slate-700 font-normal italic">"{selectedReq.message}"</p>
                  </div>
                )}

                {selectedReq.farmerResponse && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
                    <p className="text-[10px] font-bold text-[#15803d] uppercase tracking-wider mb-1">Farmer's Response</p>
                    <p className="text-slate-800 font-medium">"{selectedReq.farmerResponse}"</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Delivery Destination</p>
                    <p className="font-semibold text-slate-900 truncate">{selectedReq.deliveryLocation}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Preferred Date</p>
                    <p className="font-semibold text-slate-900">{new Date(selectedReq.preferredDate).toLocaleDateString()}</p>
                  </div>
                </div>

                {cancelError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
                    {cancelError}
                  </div>
                )}

                {/* Cancel Action */}
                {selectedReq.status === 'Pending' && (
                  <button 
                    disabled={isCancelling}
                    onClick={() => handleCancel(selectedReq.id)}
                    className="w-full py-2.5 text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-colors border border-red-200 text-xs cursor-pointer disabled:opacity-50"
                  >
                    {isCancelling ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                )}
                
                {selectedReq.status === 'Accepted' && (
                  <Link 
                    to="/buyer/orders"
                    className="w-full py-2.5 bg-slate-900 text-white font-semibold hover:bg-slate-800 rounded-xl text-center block text-xs cursor-pointer"
                  >
                    View in Orders
                  </Link>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

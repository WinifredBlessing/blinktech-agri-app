import React, { useState } from 'react';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import { FarmerHeader } from '../components/FarmerHeader';
import { Request } from '../types';
import { FileText, CheckCircle2, XCircle, MapPin, Calendar, Package, ArrowRight, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const FarmerRequests = () => {
  const { user } = useAuth();
  const { requests, acceptRequest, declineRequest, produceList } = useMarketplace();

  const myRequests = requests.filter(r => r.farmerId === user?.id).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const [filter, setFilter] = useState<'All' | 'Pending' | 'Accepted' | 'Declined' | 'Cancelled'>('All');
  const [selectedReq, setSelectedReq] = useState<Request | null>(null);
  const [responseMsg, setResponseMsg] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [actionType, setActionType] = useState<'accept' | 'decline' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const selectedProduce = selectedReq ? produceList.find(p => p.id === selectedReq.produceId) : null;
  const selectedProduceStock = selectedProduce ? selectedProduce.availableQuantity : 0;
  const isStockInsufficient = !!selectedReq && selectedProduceStock < selectedReq.quantity;

  const filtered = myRequests.filter(r => (filter === 'All' ? true : r.status === filter));

  const handleConfirmAction = async () => {
    if (!selectedReq || !actionType || isProcessing) return;
    setIsProcessing(true);
    setActionError('');
    setActionSuccess(null);

    const targetReq = selectedReq;
    const targetAction = actionType;

    try {
      if (targetAction === 'accept') {
        await acceptRequest(targetReq.id, responseMsg || 'Request accepted. Preparing your order.');
        setActionSuccess(`Request #${targetReq.id.slice(0, 8)} for ${targetReq.produceName} was accepted successfully! A confirmed commercial order has been generated and inventory adjusted.`);
      } else {
        await declineRequest(targetReq.id, declineReason || 'Cannot fulfill requested quantity at this time.');
        setActionSuccess(`Request #${targetReq.id.slice(0, 8)} for ${targetReq.produceName} was declined.`);
      }

      setSelectedReq(null);
      setActionType(null);
      setResponseMsg('');
      setDeclineReason('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to update request.');
    } finally {
      setIsProcessing(false);
    }
  };

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
      <FarmerHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-slate-950">
            Buyer Purchase Requests
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
            Review incoming wholesale requests. Accepting creates confirmed farm orders and adjusts your stock inventory.
          </p>
        </motion.div>

        {/* Action Success Feedback */}
        {actionSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-[#15803d] rounded-2xl text-xs font-medium flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} className="shrink-0 text-[#15803d]" />
              <span className="font-semibold">{actionSuccess}</span>
            </div>
            <button
              onClick={() => setActionSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg cursor-pointer"
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-6 hide-scrollbar">
          {['All', 'Pending', 'Accepted', 'Declined', 'Cancelled'].map((f) => (
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

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs max-w-lg mx-auto">
            <FileText size={32} className="mx-auto mb-2 text-slate-300" />
            <h3 className="text-sm font-bold text-slate-900 mb-1">No requests found</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {filter === 'All'
                ? 'You do not have any incoming purchase requests yet.'
                : `No requests currently with status '${filter}'.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((req) => {
              const matchedProduce = produceList.find(p => p.id === req.produceId);
              const currentStock = matchedProduce ? matchedProduce.availableQuantity : 0;
              const hasEnoughStock = currentStock >= req.quantity;

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row justify-between gap-5 hover:border-slate-300 transition-all"
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        #{req.id.slice(0, 8)}
                      </span>
                      {getStatusBadge(req.status)}
                      <span className="text-xs text-slate-400 font-normal">
                        Received {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-sans font-bold text-slate-900">{req.produceName}</h3>
                      <p className="text-xs text-slate-500 font-normal mt-0.5">
                        Buyer: <strong className="text-slate-900 font-semibold">{req.buyerName}</strong>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Qty</p>
                        <p className="font-bold text-slate-900">{req.quantity.toLocaleString()} {req.unit || 'kg'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inventory Stock</p>
                        <p className={`font-bold ${hasEnoughStock ? 'text-[#15803d]' : 'text-amber-700'}`}>
                          {currentStock.toLocaleString()} {req.unit || 'kg'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order Value</p>
                        <p className="font-bold text-[#15803d]">₦{req.totalAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destination</p>
                        <p className="font-medium text-slate-700 truncate">{req.deliveryLocation}</p>
                      </div>
                    </div>

                    {req.message && (
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/60 text-xs text-slate-600 italic">
                        "{req.message}"
                      </div>
                    )}
                  </div>

                  {/* Actions for Pending Requests */}
                  {req.status === 'Pending' && (
                    <div className="flex md:flex-col justify-end items-center gap-2 md:border-l md:border-slate-100 md:pl-6 shrink-0">
                      <button
                        disabled={isProcessing}
                        onClick={() => {
                          setSelectedReq(req);
                          setActionType('accept');
                          setActionError('');
                        }}
                        className="flex-1 md:w-36 py-2 bg-[#15803d] hover:bg-[#166534] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Accept Request
                      </button>
                      <button
                        disabled={isProcessing}
                        onClick={() => {
                          setSelectedReq(req);
                          setActionType('decline');
                          setActionError('');
                        }}
                        className="flex-1 md:w-36 py-2 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 border border-red-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Accept / Decline Modal */}
      <AnimatePresence>
        {selectedReq && actionType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => !isProcessing && setSelectedReq(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative z-10 border border-slate-200"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-base font-sans font-bold text-slate-900">
                  {actionType === 'accept' ? 'Accept Purchase Request' : 'Decline Purchase Request'}
                </h3>
                <button
                  disabled={isProcessing}
                  onClick={() => !isProcessing && setSelectedReq(null)}
                  className={`p-1 rounded-lg transition-colors ${
                    isProcessing ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600 cursor-pointer'
                  }`}
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              </div>

              {actionError && (
                <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 mb-4 text-xs text-slate-700 space-y-1">
                <p><strong>Produce:</strong> {selectedReq.produceName}</p>
                <p><strong>Quantity:</strong> {selectedReq.quantity.toLocaleString()} {selectedReq.unit || 'kg'}</p>
                <p><strong>Available Stock:</strong> {selectedProduceStock.toLocaleString()} {selectedReq.unit || 'kg'}</p>
                <p><strong>Total Amount:</strong> ₦{selectedReq.totalAmount.toLocaleString()}</p>
                <p><strong>Buyer:</strong> {selectedReq.buyerName}</p>
              </div>

              {actionType === 'accept' ? (
                <div className="space-y-3 mb-5">
                  {isStockInsufficient ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                      <AlertCircle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-bold">Insufficient Inventory Stock</p>
                        <p className="mt-0.5 text-amber-800">
                          This request requires <strong>{selectedReq.quantity} {selectedReq.unit || 'kg'}</strong>, but your inventory only has <strong>{selectedProduceStock} {selectedReq.unit || 'kg'}</strong> available. Please decline or restock your produce listing first.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-[#15803d]">
                      Accepting will deduct <strong>{selectedReq.quantity} {selectedReq.unit || 'kg'}</strong> from your stock and create a confirmed commercial order.
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Response Message to Buyer (Optional)
                    </label>
                    <textarea
                      rows={2}
                      disabled={isProcessing}
                      value={responseMsg}
                      onChange={(e) => setResponseMsg(e.target.value)}
                      placeholder="e.g. Harvest ready for haulage pickup."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] resize-none disabled:opacity-60"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Reason for Declining
                    </label>
                    <textarea
                      rows={2}
                      disabled={isProcessing}
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder="e.g. Insufficient harvest volume available."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none disabled:opacity-60"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => !isProcessing && setSelectedReq(null)}
                  className={`flex-1 py-2.5 border border-slate-200 rounded-xl font-semibold text-xs text-slate-700 transition-colors ${
                    isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessing || (actionType === 'accept' && isStockInsufficient)}
                  onClick={handleConfirmAction}
                  className={`flex-1 py-2.5 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                    isProcessing || (actionType === 'accept' && isStockInsufficient)
                      ? 'opacity-60 cursor-not-allowed'
                      : 'cursor-pointer'
                  } ${
                    actionType === 'accept' ? 'bg-[#15803d] hover:bg-[#166534]' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : actionType === 'accept' ? (
                    'Confirm Acceptance'
                  ) : (
                    'Decline Request'
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

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { FarmerHeader } from '../components/FarmerHeader';
import { Order, OrderStatus, getAllowedFarmerNextStatuses } from '../types';
import { Package, Truck, CheckCircle2, Clock, MapPin, X, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export const FarmerOrders = () => {
  const { user } = useAuth();
  const { orders, loadingOrders, updateOrderStatus, logisticsRequests } = useMarketplace();

  const myOrders = orders
    .filter(o => o.farmerId === user?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const [filter, setFilter] = useState<'All' | OrderStatus>('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const filteredOrders = myOrders.filter(o => (filter === 'All' ? true : o.status === filter));

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Confirmed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#0057b8] border border-blue-200">Confirmed</span>;
      case 'Processing':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">Processing</span>;
      case 'Ready for Delivery':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">Ready for Delivery</span>;
      case 'In Transit':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">In Transit</span>;
      case 'Delivered':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">Delivered</span>;
      case 'Completed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#15803d] border border-emerald-200">Completed</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">Cancelled</span>;
    }
  };

  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    setIsUpdating(true);
    setUpdateError('');
    try {
      await updateOrderStatus(orderId, nextStatus);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: nextStatus });
      }
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update order status.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      <FarmerHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-slate-950">
            Farm Orders Fulfillment
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
            Track confirmed wholesale sales, prepare produce for haulage pickup, and update fulfillment milestones.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-6 hide-scrollbar">
          {[
            'All',
            'Confirmed',
            'Processing',
            'Ready for Delivery',
            'In Transit',
            'Delivered',
            'Completed',
            'Cancelled'
          ].map((f) => (
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

        {loadingOrders ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs max-w-lg mx-auto">
            <Package size={32} className="mx-auto mb-2 text-slate-300 animate-spin" />
            <p className="text-xs text-slate-500">Loading farm orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs max-w-lg mx-auto">
            <Package size={32} className="mx-auto mb-2 text-slate-300" />
            <h3 className="text-sm font-bold text-slate-900 mb-1">No orders found</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
              {filter === 'All'
                ? 'You do not have any confirmed orders yet. Accepting buyer requests will generate active orders here.'
                : `No orders currently marked as '${filter}'.`}
            </p>
            <Link
              to="/farmer/requests"
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
            >
              View Incoming Requests
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const matchedLogistics = logisticsRequests.find(l => l.orderId === order.id);

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row justify-between gap-5 hover:border-slate-300 transition-all"
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        #{order.orderNumber || order.id.slice(0, 8)}
                      </span>
                      {getStatusBadge(order.status)}
                      {matchedLogistics && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#0057b8] border border-blue-200 flex items-center gap-1">
                          <Truck size={12} /> Logistics: {matchedLogistics.status}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-sans font-bold text-slate-900">{order.produceName}</h3>
                      <p className="text-xs text-slate-500 font-normal mt-0.5">
                        Customer: <strong className="text-slate-900 font-semibold">{order.buyerName}</strong>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantity</p>
                        <p className="font-bold text-slate-900">{order.quantity.toLocaleString()} {order.unit || 'kg'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Amount</p>
                        <p className="font-bold text-[#15803d]">₦{order.totalAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destination</p>
                        <p className="font-medium text-slate-700 truncate">{order.deliveryLocation}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order Date</p>
                        <p className="font-medium text-slate-700">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex md:flex-col justify-end items-center md:items-end gap-2 md:border-l md:border-slate-100 md:pl-6 shrink-0">
                    <button
                      onClick={() => {
                        setUpdateError('');
                        setSelectedOrder(order);
                      }}
                      className="flex-1 md:w-36 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {order.status === 'Completed' || order.status === 'Cancelled' ? 'View Details' : 'Manage Fulfillment'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Manage Order Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setSelectedOrder(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative z-10 border border-slate-200"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-base font-sans font-bold text-slate-900">
                    Order #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}
                  </h3>
                  <p className="text-xs text-slate-500">Customer: {selectedOrder.buyerName}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {updateError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{updateError}</span>
                </div>
              )}

              <div className="space-y-3 mb-5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Produce:</span>
                    <span className="font-semibold text-slate-900">{selectedOrder.produceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Volume:</span>
                    <span className="font-semibold text-slate-900">{selectedOrder.quantity.toLocaleString()} {selectedOrder.unit || 'kg'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Value:</span>
                    <span className="font-bold text-[#15803d]">₦{selectedOrder.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destination:</span>
                    <span className="font-medium text-slate-800">{selectedOrder.deliveryLocation}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                    <span className="text-slate-500">Current Status:</span>
                    <span>{getStatusBadge(selectedOrder.status)}</span>
                  </div>
                </div>

                {selectedOrder.status === 'Completed' || selectedOrder.status === 'Cancelled' ? (
                  <div className="p-3 bg-slate-100 text-slate-600 rounded-xl text-xs">
                    This order is in terminal status <strong>{selectedOrder.status}</strong> and cannot be further modified.
                  </div>
                ) : selectedOrder.status === 'Delivered' ? (
                  <div className="p-3 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-teal-600 shrink-0" />
                    <span>
                      Order marked <strong>Delivered</strong>. Delivery receipt confirmation is pending from the buyer to finalize.
                    </span>
                  </div>
                ) : selectedOrder.status === 'In Transit' ? (
                  <div className="p-3 bg-sky-50 border border-sky-200 text-sky-800 rounded-xl text-xs flex items-center gap-2">
                    <Truck size={16} className="text-sky-600 shrink-0" />
                    <span>
                      Order is in transit with the logistics carrier. Delivery milestone updates are managed exclusively by the logistics workflow.
                    </span>
                  </div>
                ) : selectedOrder.status === 'Ready for Delivery' ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2">
                      <Clock size={16} className="text-amber-600 shrink-0" />
                      <span>
                        Produce is packaged and marked ready for delivery. Haulage dispatch and transit milestones are controlled exclusively by the logistics workflow.
                      </span>
                    </div>
                    {(() => {
                      const matchedLog = logisticsRequests.find(l => l.orderId === selectedOrder.id);
                      const isCollected = matchedLog && ['Picked Up', 'In Transit', 'Delivered'].includes(matchedLog.status);
                      if (isCollected) {
                        return (
                          <p className="text-[11px] text-slate-500 italic">
                            Consignment has already been collected by carrier and can no longer be cancelled.
                          </p>
                        );
                      }
                      return (
                        <div className="pt-1">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => {
                              if (window.confirm('Are you sure you want to cancel this order?')) {
                                handleStatusChange(selectedOrder.id, 'Cancelled');
                              }
                            }}
                            className="w-full py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Cancel Order
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Advance Fulfillment Milestone
                    </label>
                    <select
                      disabled={isUpdating}
                      value={selectedOrder.status}
                      onChange={(e) => {
                        const nextSt = e.target.value as OrderStatus;
                        if (nextSt === 'Cancelled') {
                          if (window.confirm('Are you sure you want to cancel this order?')) {
                            handleStatusChange(selectedOrder.id, 'Cancelled');
                          }
                        } else {
                          handleStatusChange(selectedOrder.id, nextSt);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]"
                    >
                      <option value={selectedOrder.status} disabled>
                        {selectedOrder.status} (Current Stage)
                      </option>
                      {getAllowedFarmerNextStatuses(selectedOrder.status).map((nextSt) => (
                        <option key={nextSt} value={nextSt}>
                          {nextSt === 'Processing'
                            ? 'Advance to: Processing / Harvesting'
                            : nextSt === 'Ready for Delivery'
                            ? 'Advance to: Ready for Haulage / Pickup'
                            : nextSt === 'Cancelled'
                            ? 'Cancel Order'
                            : `Advance to: ${nextSt}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

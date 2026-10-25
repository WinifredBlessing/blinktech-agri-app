import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { BuyerHeader } from '../components/BuyerHeader';
import { Order, OrderStatus } from '../types';
import { Package, Truck, Search, Eye, MapPin, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export const BuyerOrders = () => {
  const { user } = useAuth();
  const { orders, logisticsRequests, confirmDelivery } = useMarketplace();
  const navigate = useNavigate();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const handleConfirmDelivery = async (orderId: string) => {
    setConfirmError(null);
    setConfirmingId(orderId);
    try {
      await confirmDelivery(orderId);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: 'Completed' } : null);
      }
    } catch (err: any) {
      setConfirmError(err.message || 'Error confirming delivery');
    } finally {
      setConfirmingId(null);
    }
  };

  const myOrders = orders
    .filter(o => o.buyerId === user?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const [filter, setFilter] = useState<'All' | OrderStatus>('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-50 text-cyan-700 border border-cyan-200">In Transit</span>;
      case 'Delivered':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">Delivered</span>;
      case 'Completed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-50 text-[#15803d] border border-green-200">Completed</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">Cancelled</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      <BuyerHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-slate-950">My Purchase Orders</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">Track your confirmed purchases and book haulage deliveries across Nigeria.</p>
          </div>
          <Link
            to="/logistics"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200/90 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 shadow-xs"
          >
            <Truck size={14} />
            <span>Track All Shipments</span>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-6 hide-scrollbar">
          {(['All', 'Confirmed', 'Processing', 'Ready for Delivery', 'In Transit', 'Delivered', 'Completed', 'Cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
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

        {/* Global Action Error */}
        {confirmError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span>{confirmError}</span>
            </div>
            <button onClick={() => setConfirmError(null)} className="text-red-500 hover:text-red-700">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Orders List */}
        <div>
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs max-w-lg mx-auto">
              <Package size={32} className="mx-auto mb-2 text-slate-300" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">No orders found</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
                {filter === 'All'
                  ? 'You have not placed any orders yet. Browse the marketplace or use Smart Matching to purchase produce.'
                  : `You have no orders currently in '${filter}' status.`}
              </p>
              <Link
                to="/buyer-dashboard"
                className="inline-flex items-center gap-1.5 bg-[#0057b8] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#003e8a] transition-colors"
              >
                <Search size={14} /> Explore Marketplace
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const existingLogistics = logisticsRequests.find(
                  logistics => logistics.orderId === order.id && logistics.status !== 'Cancelled'
                );

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all p-5 sm:p-6"
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-5">
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                            {order.orderNumber || `#${order.id.slice(0, 8)}`}
                          </span>
                          {getStatusBadge(order.status)}
                          {existingLogistics && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#0057b8] border border-blue-200 flex items-center gap-1">
                              <Truck size={12} /> Delivery: {existingLogistics.status}
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-base sm:text-lg font-sans font-bold text-slate-900">{order.produceName}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Farmer: <span className="font-semibold text-slate-700">{order.farmerName || 'Registered Farmer'}</span>
                            <span className="font-mono text-slate-400 ml-1.5">({order.farmerId.slice(0, 8)}...)</span>
                          </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order Date</p>
                            <p className="font-semibold text-slate-800">{new Date(order.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantity</p>
                            <p className="font-semibold text-slate-800">{order.quantity.toLocaleString()} {order.unit || 'kg'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Amount</p>
                            <p className="font-bold text-[#0057b8]">₦{order.totalAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destination</p>
                            <p className="font-medium text-slate-700 truncate">{order.deliveryLocation}</p>
                          </div>
                        </div>

                        {order.status === 'Delivered' && (
                          <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-medium">
                              <CheckCircle size={14} className="text-emerald-600" />
                              Produce has been marked Delivered. Please verify receipt!
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex sm:flex-col justify-end items-center sm:items-end gap-2 sm:border-l sm:border-slate-100 sm:pl-6 shrink-0">
                        {order.status === 'Delivered' && (
                          <button
                            onClick={() => handleConfirmDelivery(order.id)}
                            disabled={confirmingId === order.id}
                            className="w-full sm:w-36 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle size={14} />
                            <span>{confirmingId === order.id ? 'Confirming...' : 'Confirm Delivery'}</span>
                          </button>
                        )}

                        {existingLogistics ? (
                          <Link to="/logistics" className="w-full sm:w-36">
                            <button className="w-full py-2 bg-[#0057b8] hover:bg-[#003e8a] text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                              <Truck size={14} /> Track Delivery
                            </button>
                          </Link>
                        ) : order.status !== 'Cancelled' && order.status !== 'Completed' && order.status !== 'Delivered' ? (
                          <Link to={`/logistics/request?orderId=${order.id}`} className="w-full sm:w-36">
                            <button className="w-full py-2 bg-[#15803d] hover:bg-[#166534] text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                              <Truck size={14} /> Request Haulage
                            </button>
                          </Link>
                        ) : null}

                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="w-full sm:w-36 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Eye size={14} /> Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Order Details Modal */}
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
              className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 border border-slate-200 relative z-10"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="mb-1">{getStatusBadge(selectedOrder.status)}</div>
                  <h3 className="text-lg font-sans font-bold text-slate-900">
                    Order {selectedOrder.orderNumber || `#${selectedOrder.id.slice(0, 8)}`}
                  </h3>
                  <p className="text-xs text-slate-500">Placed on {new Date(selectedOrder.createdAt).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 mb-5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Produce:</span>
                    <span className="font-semibold text-slate-900">{selectedOrder.produceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Farmer:</span>
                    <span className="font-semibold text-slate-900">{selectedOrder.farmerName || 'Registered Farmer'}</span>
                  </div>
                  {selectedOrder.farmerPhone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Farmer Contact:</span>
                      <span className="font-semibold text-slate-900">{selectedOrder.farmerPhone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Volume:</span>
                    <span className="font-semibold text-slate-900">{selectedOrder.quantity.toLocaleString()} {selectedOrder.unit || 'kg'}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 mt-1 font-bold">
                    <span className="text-slate-700">Total Amount:</span>
                    <span className="font-bold text-[#0057b8] text-sm">₦{selectedOrder.totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200/80 rounded-xl text-xs space-y-1">
                  <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <MapPin size={13} className="text-[#0057b8]" /> Delivery Destination:
                  </p>
                  <p className="text-slate-700 pl-4.5">{selectedOrder.deliveryLocation}</p>
                </div>

                {selectedOrder.fulfillmentNotes && (
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1">
                    <p className="font-semibold text-slate-900">Fulfillment / Dispatch Notes:</p>
                    <p className="text-slate-600">{selectedOrder.fulfillmentNotes}</p>
                  </div>
                )}

                {selectedOrder.status === 'Delivered' && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      <CheckCircle size={15} className="text-emerald-600" />
                      Produce has been delivered!
                    </div>
                    <p className="text-emerald-700">
                      Please confirm that you have received your order in good condition. This will finalize the transaction and mark the order as Completed.
                    </p>
                    <button
                      type="button"
                      disabled={confirmingId === selectedOrder.id}
                      onClick={() => handleConfirmDelivery(selectedOrder.id)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle size={14} />
                      <span>{confirmingId === selectedOrder.id ? 'Confirming Receipt...' : 'Confirm Delivery Receipt'}</span>
                    </button>
                  </div>
                )}

                {selectedOrder.status === 'Completed' && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-600 shrink-0" />
                    <span>This order has been completed and confirmed delivered.</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl font-semibold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                {!logisticsRequests.some(l => l.orderId === selectedOrder.id && l.status !== 'Cancelled') && selectedOrder.status !== 'Cancelled' && selectedOrder.status !== 'Completed' && selectedOrder.status !== 'Delivered' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrder(null);
                      navigate(`/logistics/request?orderId=${selectedOrder.id}`);
                    }}
                    className="flex-1 py-2.5 bg-[#0057b8] hover:bg-[#003e8a] text-white rounded-xl font-semibold text-xs shadow-xs cursor-pointer"
                  >
                    Request Delivery
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

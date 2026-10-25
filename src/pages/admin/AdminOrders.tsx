import React, { useState } from 'react';
import { useMarketplace } from '../../context/MarketplaceContext';
import { Order, OrderStatus } from '../../types';
import { Search, Eye, X, ShoppingCart, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AdminOrders = () => {
  const { orders, logisticsRequests } = useMarketplace();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filteredOrders = orders.filter(o => {
    const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (o.orderNumber && o.orderNumber.toLowerCase().includes(term)) ||
      o.id.toLowerCase().includes(term) ||
      o.produceName.toLowerCase().includes(term) ||
      (o.buyerName && o.buyerName.toLowerCase().includes(term)) ||
      (o.farmerName && o.farmerName.toLowerCase().includes(term)) ||
      (o.deliveryLocation && o.deliveryLocation.toLowerCase().includes(term));

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Confirmed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#0057b8] border border-blue-200">Confirmed</span>;
      case 'Processing':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">Processing</span>;
      case 'Ready for Delivery':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">Ready for Delivery</span>;
      case 'In Transit':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-50 text-cyan-700 border border-cyan-200">In Transit</span>;
      case 'Delivered':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">Delivered</span>;
      case 'Completed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-50 text-[#15803d] border border-green-200">Completed</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">Cancelled</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-body text-slate-900">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 font-sans tracking-tight">Master Order Ledger</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-normal">
            Monitor real-time commercial trade transactions and shipment fulfillment milestones.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-xs overflow-x-auto max-w-full">
          {['All', 'Confirmed', 'Processing', 'Ready for Delivery', 'In Transit', 'Delivered', 'Completed', 'Cancelled'].map((st) => (
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
            {filteredOrders.length} total orders
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-white border-b border-slate-100 uppercase tracking-wider text-slate-400 font-bold text-[10px]">
                <th className="px-5 py-3">Order ID</th>
                <th className="px-5 py-3">Produce</th>
                <th className="px-5 py-3">Buyer & Farmer</th>
                <th className="px-5 py-3">Quantity & Amount</th>
                <th className="px-5 py-3">Destination</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const matchedLogistics = logisticsRequests.find(l => l.orderId === order.id);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-semibold text-slate-900">
                        {order.orderNumber || `#${order.id.slice(0, 8)}`}
                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </td>

                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900 text-xs">{order.produceName}</p>
                        {matchedLogistics && (
                          <span className="text-[9px] font-semibold text-[#0057b8] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 inline-flex items-center gap-1 mt-0.5">
                            <Truck size={10} /> {matchedLogistics.status}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">Buyer: {order.buyerName}</p>
                        <p className="text-[10px] text-slate-400">
                          Farmer: {order.farmerName || `${order.farmerId.slice(0, 8)}...`}
                        </p>
                      </td>

                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900">{order.quantity.toLocaleString()} {order.unit || 'kg'}</p>
                        <p className="text-[#15803d] font-bold">₦{order.totalAmount.toLocaleString()}</p>
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 truncate max-w-[150px]">
                        {order.deliveryLocation}
                      </td>

                      <td className="px-5 py-3.5">
                        {getStatusBadge(order.status)}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                        >
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-xs">
                    <ShoppingCart size={28} className="mx-auto mb-1 text-slate-300" />
                    No orders recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
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
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative z-10 border border-slate-200"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-base font-sans font-bold text-slate-900">
                    Order {selectedOrder.orderNumber || `#${selectedOrder.id.slice(0, 8)}`}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">UUID: {selectedOrder.id}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 mb-5 text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
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
                  <span className="text-slate-500">Buyer:</span>
                  <span className="font-semibold text-slate-900">{selectedOrder.buyerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Farmer:</span>
                  <span className="font-semibold text-slate-900">{selectedOrder.farmerName || `${selectedOrder.farmerId.slice(0, 8)}...`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Delivery Address:</span>
                  <span className="font-medium text-slate-800">{selectedOrder.deliveryLocation}</span>
                </div>
                {selectedOrder.fulfillmentNotes && (
                  <div className="flex flex-col pt-1 border-t border-slate-200">
                    <span className="text-slate-500">Fulfillment Notes:</span>
                    <span className="text-slate-800">{selectedOrder.fulfillmentNotes}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Status:</span>
                  <span>{getStatusBadge(selectedOrder.status)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
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

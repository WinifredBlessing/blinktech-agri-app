import React, { useState, useEffect } from 'react';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import { BuyerHeader } from '../components/BuyerHeader';
import { FarmerHeader } from '../components/FarmerHeader';
import { LogisticsRequest, LogisticsStatus } from '../types';
import { Truck, MapPin, Calendar, Package, Plus, CheckCircle2, Clock, Phone, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

export const LogisticsPage = () => {
  const { user } = useAuth();
  const { logisticsRequests, loadingLogistics, logisticsError } = useMarketplace();

  const normalizedRole = (user?.role || '').toLowerCase();
  const isFarmer = normalizedRole === 'farmer';
  const isBuyer = normalizedRole === 'buyer';
  const isAdmin = normalizedRole === 'admin';

  // Filter requests by current user (administrators see all requests)
  const userLogistics = logisticsRequests.filter(l => {
    if (isFarmer) return l.farmerId === user?.id;
    if (isBuyer) return l.buyerId === user?.id;
    if (isAdmin) return true;
    return l.buyerId === user?.id || l.farmerId === user?.id;
  });

  const [selectedLogistics, setSelectedLogistics] = useState<LogisticsRequest | null>(
    userLogistics.length > 0 ? userLogistics[0] : null
  );

  useEffect(() => {
    if (!selectedLogistics && userLogistics.length > 0) {
      setSelectedLogistics(userLogistics[0]);
    } else if (selectedLogistics) {
      const refreshed = userLogistics.find((l) => l.id === selectedLogistics.id);
      if (refreshed && refreshed !== selectedLogistics) {
        setSelectedLogistics(refreshed);
      }
    }
  }, [userLogistics, selectedLogistics]);

  const statusSteps: LogisticsStatus[] = ['Requested', 'Assigned', 'Picked Up', 'In Transit', 'Delivered'];

  const getStatusIndex = (status: LogisticsStatus) => statusSteps.indexOf(status);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      {isFarmer ? <FarmerHeader /> : <BuyerHeader />}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#0057b8] text-xs font-semibold mb-2">
              <Truck size={13} /> Integrated Farm Haulage
            </div>
            <h1 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-slate-950">
              Logistics & Delivery Tracking
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
              Track real-time produce transit across regional aggregation centers and delivery routes.
            </p>
          </div>

          {isBuyer && (
            <Link
              to="/logistics/request"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#0057b8] hover:bg-[#003e8a] text-white transition-all shadow-xs active:scale-98"
            >
              <Plus size={16} />
              <span>Request Delivery</span>
            </Link>
          )}
        </div>

        {logisticsError && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs" role="alert">
            {logisticsError}
          </div>
        )}

        {loadingLogistics ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs max-w-lg mx-auto">
            <Truck size={32} className="mx-auto mb-2 text-slate-300 animate-pulse" />
            <p className="text-xs text-slate-500">Loading shipments...</p>
          </div>
        ) : userLogistics.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs max-w-lg mx-auto">
            <Truck size={36} className="mx-auto mb-2 text-slate-300" />
            <h3 className="text-sm font-bold text-slate-900 mb-1">No delivery requests found</h3>
            <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
              {isBuyer
                ? 'Request haulage for any confirmed order to have produce dispatched by our logistics partners.'
                : 'No delivery shipments have been requested for your farm orders yet.'}
            </p>
            {isBuyer && (
              <Link
                to="/buyer/orders"
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                View Confirmed Orders
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left list */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                Shipments ({userLogistics.length})
              </h2>

              {userLogistics.map((log) => {
                const isSelected = selectedLogistics?.id === log.id;

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLogistics(log)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white border-[#0057b8] ring-2 ring-[#0057b8]/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        #{log.id.slice(0, 8)}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          log.status === 'Cancelled'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : log.status === 'Delivered'
                            ? 'bg-emerald-50 text-[#15803d] border border-emerald-200'
                            : log.status === 'In Transit'
                            ? 'bg-blue-50 text-[#0057b8] border border-blue-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 mb-0.5">{log.produceName}</h4>
                    <p className="text-xs text-slate-500 font-normal mb-2">
                      Order: <span className="font-mono font-medium text-slate-700">{log.orderId.slice(0, 8)}</span> • {log.quantity} {log.unit || 'kg'}
                    </p>

                    <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
                        <span className="truncate">{log.pickupLocation}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#15803d] shrink-0"></span>
                        <span className="truncate font-medium text-slate-900">{log.deliveryLocation}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Detailed Timeline Panel */}
            {selectedLogistics && (
              <div className="lg:col-span-2 space-y-6">
                
                {/* Visual Timeline Card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shipment Details</span>
                      <h3 className="text-lg font-sans font-bold text-slate-900 mt-0.5">
                        Shipment #{selectedLogistics.id.slice(0, 8)}
                      </h3>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">
                        Provider: <strong className="text-slate-900">{selectedLogistics.provider || 'AgriMove Logistics'}</strong>
                      </span>
                    </div>
                  </div>

                  {/* 5-Step Progress Timeline */}
                  <div className="mb-8">
                    <div className="overflow-x-auto hide-scrollbar">
                      <div className="grid grid-cols-5 gap-1 text-center min-w-[300px]">
                        {statusSteps.map((step, idx) => {
                          const currentIdx = getStatusIndex(selectedLogistics.status);
                          const isDone = idx <= currentIdx;
                          const isCurrent = idx === currentIdx;

                          return (
                            <div key={step} className="flex flex-col items-center">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 text-xs font-bold transition-all ${
                                  isDone
                                    ? 'bg-[#15803d] text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-400'
                                } ${isCurrent ? 'ring-3 ring-[#15803d]/20' : ''}`}
                              >
                                {isDone ? <CheckCircle2 size={16} /> : idx + 1}
                              </div>
                              <span className={`text-[9px] sm:text-[10px] font-semibold uppercase tracking-tight sm:tracking-wider leading-tight px-0.5 ${
                                isCurrent ? 'text-[#15803d]' : isDone ? 'text-slate-800' : 'text-slate-400'
                              }`}>
                                {step}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Shipment Info Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                      <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Pickup Origin</p>
                      <p className="font-semibold text-slate-800">{selectedLogistics.pickupLocation}</p>
                      <p className="text-slate-500">{selectedLogistics.pickupAddress || 'Farm aggregation center'}</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                      <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Delivery Destination</p>
                      <p className="font-semibold text-slate-800">{selectedLogistics.deliveryLocation}</p>
                      <p className="text-slate-500">{selectedLogistics.deliveryAddress || 'Commercial warehouse facility'}</p>
                    </div>
                  </div>

                  {/* Driver / Dispatcher info */}
                  {selectedLogistics.driver && (
                    <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Truck size={16} className="text-[#15803d]" />
                        <div>
                          <p className="font-bold text-[#15803d]">{selectedLogistics.driver}</p>
                          <p className="text-slate-600">Assigned Transit Driver</p>
                        </div>
                      </div>
                      {selectedLogistics.driverPhone && (
                        <a
                          href={`tel:${selectedLogistics.driverPhone}`}
                          className="flex items-center gap-1 font-semibold text-[#0057b8] hover:underline"
                        >
                          <Phone size={13} /> {selectedLogistics.driverPhone}
                        </a>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

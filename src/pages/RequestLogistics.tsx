import React, { useState, useEffect } from 'react';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import { BuyerHeader } from '../components/BuyerHeader';
import { Truck, MapPin, Calendar, Package, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

export const RequestLogistics = () => {
  const { orders, createLogisticsRequest, logisticsRequests, loadingLogistics, logisticsError } = useMarketplace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderParamId = searchParams.get('orderId');

  const eligibleOrders = orders.filter(
    o => o.buyerId === user?.id && o.status !== 'Cancelled' && o.status !== 'Completed'
  );

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    orderParamId || (eligibleOrders.length > 0 ? eligibleOrders[0].id : '')
  );

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [instructions, setInstructions] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (selectedOrder) {
      setPickupLocation(selectedOrder.pickupLocation || 'Kano, Nigeria');
      setPickupAddress(`Farm Aggregation Center, Agricultural Hub, ${selectedOrder.pickupLocation || 'Kano'}`);
      setDeliveryLocation(selectedOrder.deliveryLocation || user?.location || 'Abuja, Nigeria');
      setDeliveryAddress(user?.address || `Commercial Warehouse, ${selectedOrder.deliveryLocation || 'Abuja'}`);
      setPreferredDate(selectedOrder.deliveryDate || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]);
    }
  }, [selectedOrderId, selectedOrder, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !user) return;

    const existingLog = logisticsRequests.find(
      logistics => logistics.orderId === selectedOrder.id && logistics.status !== 'Cancelled'
    );
    if (existingLog) {
      setError(`Delivery has already been requested for order #${selectedOrder.id.slice(0, 8)}.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createLogisticsRequest({
        orderId: selectedOrder.id,
        buyerId: user.id,
        buyerName: user.name,
        farmerId: selectedOrder.farmerId,
        farmerName: selectedOrder.farmerName,
        produceName: selectedOrder.produceName,
        quantity: selectedOrder.quantity,
        unit: selectedOrder.unit || 'kg',
        pickupLocation,
        pickupAddress,
        deliveryLocation,
        deliveryAddress,
        preferredDate,
        instructions,
        provider: 'AgriMove Logistics'
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/logistics');
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to request delivery.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      <BuyerHeader />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
        <div className="mb-6">
          <Link to="/logistics" className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 transition-colors">
            <ArrowLeft size={14} className="mr-1" /> Back to Logistics
          </Link>
          <h1 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-slate-950">
            Request Produce Haulage
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
            Book certified temperature-monitored agricultural transit for your confirmed purchase order.
          </p>
        </div>

        {eligibleOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
            <Package size={32} className="text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900 mb-1">No eligible confirmed orders</h3>
            <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
              You need a confirmed order with a farmer before requesting haulage delivery.
            </p>
            <Link
              to="/buyer-dashboard"
              className="px-4 py-2 bg-[#0057b8] text-white rounded-lg text-xs font-semibold hover:bg-[#003e8a]"
            >
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {logisticsError && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium" role="alert">
                {logisticsError}
              </div>
            )}
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle size={15} /> {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-[#15803d] rounded-xl text-xs font-medium flex items-center gap-2">
                <CheckCircle2 size={16} /> Haulage requested successfully! Redirecting to shipments view...
              </div>
            )}

            {/* Select Order */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/90 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Select Confirmed Purchase Order
              </label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
              >
                {eligibleOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.id.slice(0, 8)} — {o.produceName} ({o.quantity} {o.unit || 'kg'}) — ₦{o.totalAmount.toLocaleString()}
                  </option>
                ))}
              </select>

              {selectedOrder && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Produce:</span>
                    <span className="font-semibold text-slate-900">{selectedOrder.produceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Volume:</span>
                    <span className="font-semibold text-slate-900">{selectedOrder.quantity.toLocaleString()} {selectedOrder.unit || 'kg'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Pickup and Delivery details */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/90 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transit Locations</h3>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pickup Region / State</label>
                  <input
                    type="text"
                    required
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pickup Hub Address</label>
                  <input
                    type="text"
                    required
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Region / State</label>
                  <input
                    type="text"
                    required
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Address</label>
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Pickup Date</label>
                <input
                  type="date"
                  required
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full sm:w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Haulage Handling Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Tarpaulin cover required, warehouse gate clearance notes..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8] resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => navigate('/logistics')}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || loadingLogistics}
                className="px-6 py-2.5 bg-[#0057b8] hover:bg-[#003e8a] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
              >
                {loading ? 'Submitting...' : loadingLogistics ? 'Loading shipments...' : 'Confirm Delivery Booking'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};

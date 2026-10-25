import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import { BuyerHeader } from '../components/BuyerHeader';
import {
  ArrowLeft,
  MapPin,
  Package,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { produceService } from '../services/produceService';

export const ProduceDetails = () => {
  const { id } = useParams();
  const { produceList, farmers, loadingProduce, createRequest } = useMarketplace();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [produce, setProduce] = useState<any>(null);
  const [farmer, setFarmer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Request Form State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestQty, setRequestQty] = useState<number>(500);
  const [deliveryLoc, setDeliveryLoc] = useState(user?.location || 'Abuja, Nigeria');
  const [prefDate, setPrefDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    // Check produceList first for fast in-memory render
    const found = produceList.find((p) => p.id === id);
    if (found) {
      setProduce(found);
      const f = farmers.find((farm) => farm.id === found.farmerId);
      if (f) setFarmer(f);
      setIsLoading(false);
      setNotFound(false);
    }

    // Authoritative direct fetch from Supabase by ID (cross-device/direct URL)
    produceService
      .fetchProduceById(id)
      .then((res) => {
        if (!mounted) return;
        if (res?.produce) {
          setProduce(res.produce);
          if (res.farmer) setFarmer(res.farmer);
          setIsLoading(false);
          setNotFound(false);
          setFetchError(null);
        } else if (res?.error) {
          // If a query/network error occurred, keep in-memory produce if present, otherwise show retry
          if (!found) {
            setIsLoading(false);
            setFetchError(res.error);
          }
        } else if (!found && !loadingProduce) {
          // Authoritatively absent or inaccessible under active RLS policies
          setIsLoading(false);
          setNotFound(true);
        }
      })
      .catch((err) => {
        console.error('ProduceDetails direct fetch error:', err);
        if (mounted && !found && !loadingProduce) {
          setIsLoading(false);
          setNotFound(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [id, produceList, farmers, loadingProduce]);

  if (fetchError && !produce) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-body">
        <BuyerHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Unable to Load Produce Listing</h2>
          <p className="text-xs text-slate-500 max-w-sm mb-6">
            A network or connection issue prevented loading this produce listing. Please check your connection and try again.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#0057b8] text-white rounded-xl text-xs font-semibold hover:bg-[#003e8a] transition-colors cursor-pointer"
            >
              Retry
            </button>
            <Link
              to="/buyer-dashboard"
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              ← Return to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-body">
        <BuyerHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200">
            <Package size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Produce Listing Not Found</h2>
          <p className="text-xs text-slate-500 max-w-sm mb-6">
            This produce listing is currently unavailable, has been completed by the farmer, or does not exist.
          </p>
          <Link
            to="/buyer-dashboard"
            className="px-5 py-2.5 bg-[#0057b8] text-white rounded-xl text-xs font-semibold hover:bg-[#003e8a] transition-colors"
          >
            ← Return to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading && !produce) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-body">
        <BuyerHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-[#0057b8] rounded-full animate-spin mb-3"></div>
          <p className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Loading Produce Details...</p>
        </div>
      </div>
    );
  }

  const isOutOfStock = produce.status === 'Out of Stock' || produce.availableQuantity <= 0;
  const estimatedTotal = (Number(requestQty) || 0) * produce.price;
  const relatedProduce = produceList.filter((p) => p.id !== produce.id && p.category === produce.category).slice(0, 3);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }

    if ((user.role || '').toLowerCase() !== 'buyer') {
      setError('Only registered buyers can submit purchase requests. Please sign in with a buyer account.');
      return;
    }

    if (isOutOfStock) {
      setError('This produce is currently out of stock and cannot receive new requests.');
      return;
    }

    if (requestQty > produce.availableQuantity) {
      setError(`Cannot request more than available inventory (${produce.availableQuantity.toLocaleString()} ${produce.unit || 'kg'}).`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await createRequest({
        buyerId: user.id,
        buyerName: user.name,
        farmerId: produce.farmerId,
        farmerName: produce.farmerName || farmer?.name,
        produceId: produce.id,
        produceName: produce.name,
        quantity: Number(requestQty),
        unit: produce.unit || 'kg',
        price: produce.price,
        totalAmount: estimatedTotal,
        deliveryLocation: deliveryLoc,
        preferredDate: prefDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        preferredDeliveryDate: prefDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        message: notes,
        buyerNote: notes
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setShowRequestModal(false);
        navigate('/buyer/requests');
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to submit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      <BuyerHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-6">
          <Link to="/buyer-dashboard" className="hover:text-slate-900 transition-colors flex items-center gap-1">
            <ArrowLeft size={14} /> Marketplace
          </Link>
          <ChevronRight size={13} className="text-slate-300" />
          <span className="text-[#0057b8]">{produce.category}</span>
          <ChevronRight size={13} className="text-slate-300" />
          <span className="text-slate-900 truncate max-w-[200px]">{produce.name}</span>
        </div>

        {/* Main Product Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          
          {/* Left Column: Big Image & Visuals (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs aspect-[4/3] relative">
              {produce.image ? (
                <img
                  src={produce.image}
                  alt={produce.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Package size={56} />
                </div>
              )}

              <div className="absolute top-3 left-3 flex gap-2">
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-white/95 text-[#15803d] shadow-xs">
                  {produce.status}
                </span>
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-900/90 text-white shadow-xs">
                  {produce.category}
                </span>
              </div>
            </div>

            {/* Farm Story & Quality Details */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <h3 className="text-sm font-sans font-bold text-slate-900 uppercase tracking-wider">
                Crop Specifications & Harvest Notes
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                {produce.description || 'Certified fresh agricultural produce cultivated under verified agronomic practices. Available for bulk wholesale supply and direct commercial haulage.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Harvest Origin</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{produce.location || 'Kano, Nigeria'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit Packaging</p>
                  <p className="font-semibold text-slate-900 mt-0.5">Standard {produce.unit || 'kg'} Bag</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Harvest Status</p>
                  <p className="font-semibold text-slate-900 mt-0.5">Fresh Harvest</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quality Validation</p>
                  <p className="font-semibold text-[#15803d] flex items-center gap-1 mt-0.5">
                    <ShieldCheck size={14} /> Certified
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Pricing, Ordering & Farmer Profile (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Purchase Order Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0057b8]">Direct Wholesale</span>
                <h1 className="text-2xl font-sans font-bold text-slate-950 mt-0.5">{produce.name}</h1>
                <p className="text-xs text-slate-500 font-normal flex items-center gap-1 mt-1">
                  <MapPin size={13} className="text-slate-400" /> Origin: {produce.location || 'Kano'}, Nigeria
                </p>
              </div>

              {/* Price Banner */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit Price</span>
                  <p className="text-2xl font-sans font-black text-slate-950">
                    ₦{produce.price.toLocaleString()}
                    <span className="text-xs font-normal text-slate-500"> /{produce.unit || 'kg'}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available Stock</span>
                  <p className={`font-bold text-sm ${isOutOfStock ? 'text-red-600' : 'text-[#15803d]'}`}>
                    {produce.availableQuantity.toLocaleString()} {produce.unit || 'kg'}
                  </p>
                </div>
              </div>

              {/* Volume Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Desired Sourcing Volume ({produce.unit || 'kg'})
                </label>
                <input
                  type="number"
                  min="1"
                  max={produce.availableQuantity}
                  value={requestQty}
                  onChange={(e) => setRequestQty(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                />
              </div>

              {/* Cost Calculation Summary */}
              <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500 text-[11px]">Estimated Produce Subtotal:</span>
                  <p className="text-lg font-sans font-bold text-[#0057b8]">
                    ₦{estimatedTotal.toLocaleString()}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Haulage calculated at order</span>
              </div>

              {/* Request Action Button */}
              <button
                disabled={isOutOfStock}
                onClick={() => setShowRequestModal(true)}
                className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isOutOfStock
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#0057b8] hover:bg-[#003e8a] text-white shadow-xs active:scale-98'
                }`}
              >
                <Package size={16} /> {isOutOfStock ? 'Currently Out of Stock' : 'Request Purchase from Farmer'}
              </button>
            </div>

            {/* Farmer Profile Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-3.5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-[#15803d] flex items-center justify-center font-bold text-base shrink-0">
                  {farmer?.name?.charAt(0) || produce.farmerName?.charAt(0) || 'M'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-sm text-slate-950 font-sans truncate">
                      {produce.farmerName || farmer?.name || 'Musa Ibrahim'}
                    </h4>
                    <ShieldCheck size={15} className="text-[#15803d] shrink-0" />
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {farmer?.farmName || `${produce.farmerName || 'Musa Ibrahim'}'s Farm`}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Farm Location</span>
                  <span className="font-medium text-slate-800">{farmer?.city || 'Kano'}, {farmer?.state || 'Kano State'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Experience</span>
                  <span className="font-medium text-slate-800">{farmer?.experience || '8 years'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Verification</span>
                  <span className="font-semibold text-[#15803d]">Verified Agricultural Producer</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Related Produce in Same Category */}
        {relatedProduce.length > 0 && (
          <div className="pt-8 border-t border-slate-200">
            <h3 className="text-lg font-sans font-bold text-slate-950 mb-5">More in {produce.category}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {relatedProduce.map((item) => (
                <Link
                  key={item.id}
                  to={`/produce/${item.id}`}
                  className="bg-white rounded-xl p-3.5 border border-slate-200/90 hover:border-slate-300 hover:shadow-xs transition-all flex items-center gap-3 group"
                >
                  <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold text-[#0057b8] uppercase tracking-wider">{item.category}</span>
                    <h4 className="font-bold text-xs text-slate-900 line-clamp-1 group-hover:text-[#0057b8] transition-colors">{item.name}</h4>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">₦{item.price.toLocaleString()}/{item.unit || 'kg'}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Direct Request Modal */}
      <AnimatePresence>
        {showRequestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => !isSubmitting && setShowRequestModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-xl relative z-10 border border-slate-200"
            >
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="text-lg font-sans font-bold text-slate-900">Request {produce.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    From {produce.farmerName || farmer?.farmName || 'Verified Farm Partner'}
                  </p>
                </div>
                <button
                  onClick={() => !isSubmitting && setShowRequestModal(false)}
                  disabled={isSubmitting}
                  aria-disabled={isSubmitting}
                  className={`p-1 rounded-lg transition-colors ${
                    isSubmitting
                      ? 'text-slate-200 cursor-not-allowed'
                      : 'text-slate-400 hover:text-slate-600 cursor-pointer'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              {success ? (
                <div className="text-center py-6">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-2" />
                  <h4 className="text-base font-bold text-slate-900">Request Submitted Successfully</h4>
                  <p className="text-xs text-slate-500 mt-1">Redirecting to your active requests view...</p>
                </div>
              ) : (
                <form onSubmit={handleRequestSubmit} className="space-y-4">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Volume:</span>
                      <span className="font-semibold text-slate-900">{requestQty} {produce.unit || 'kg'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Unit Price:</span>
                      <span className="font-semibold text-slate-900">₦{produce.price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-200/80 mt-1.5">
                      <span className="font-bold text-slate-700">Estimated Total:</span>
                      <span className="font-bold text-[#0057b8] text-sm">₦{estimatedTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Delivery Destination (City / State)
                    </label>
                    <input
                      type="text"
                      required
                      value={deliveryLoc}
                      onChange={(e) => setDeliveryLoc(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Preferred Delivery Date
                    </label>
                    <input
                      type="date"
                      required
                      value={prefDate}
                      onChange={(e) => setPrefDate(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Special Delivery Instructions (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Specify packaging or access requirements..."
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8] resize-none"
                    />
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowRequestModal(false)}
                      className="flex-1 py-2.5 border border-slate-200 rounded-xl font-semibold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 bg-[#0057b8] hover:bg-[#003e8a] text-white rounded-xl font-semibold text-xs shadow-xs cursor-pointer"
                    >
                      {isSubmitting ? 'Submitting...' : 'Confirm Request'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

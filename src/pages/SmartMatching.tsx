import React, { useState, useEffect } from 'react';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import { matchingService } from '../services/matchingService';
import { SmartMatchResult, SmartMatchCriteria } from '../types';
import { BuyerHeader } from '../components/BuyerHeader';
import { Search, MapPin, Package, DollarSign, Sparkles, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export const SmartMatching = () => {
  const { produceList, farmers, createRequest } = useMarketplace();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Search Criteria State
  const [produceQuery, setProduceQuery] = useState('Maize');
  const [quantity, setQuantity] = useState<number>(500);
  const [deliveryLocation, setDeliveryLocation] = useState(user?.location || 'Abuja, Nigeria');
  const [preferredPrice, setPreferredPrice] = useState<number | ''>(1000);
  const [deliveryRequired, setDeliveryRequired] = useState(true);

  const [matches, setMatches] = useState<SmartMatchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  // Request Modal State
  const [selectedMatch, setSelectedMatch] = useState<SmartMatchResult | null>(null);
  const [prefDate, setPrefDate] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reqSuccess, setReqSuccess] = useState(false);

  const performMatch = (criteria: SmartMatchCriteria) => {
    setLoading(true);
    setHasSearched(true);

    setTimeout(() => {
      const results = matchingService.findMatches(criteria, produceList, farmers);
      setMatches(results);
      setLoading(false);
    }, 250);
  };

  useEffect(() => {
    performMatch({
      produceQuery,
      quantity,
      deliveryLocation,
      preferredPrice: preferredPrice ? Number(preferredPrice) : undefined,
      deliveryRequired
    });
  }, [produceList, farmers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performMatch({
      produceQuery,
      quantity: Number(quantity) || 1,
      deliveryLocation,
      preferredPrice: preferredPrice ? Number(preferredPrice) : undefined,
      deliveryRequired
    });
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatch || !user) return;

    setIsSubmitting(true);
    const prod = selectedMatch.produce;

    try {
      await createRequest({
        buyerId: user.id,
        buyerName: user.name,
        farmerId: prod.farmerId,
        farmerName: prod.farmerName || selectedMatch.farmer?.name,
        produceId: prod.id,
        produceName: prod.name,
        quantity: Number(quantity),
        unit: prod.unit || 'kg',
        price: prod.price,
        totalAmount: prod.price * Number(quantity),
        deliveryLocation: deliveryLocation,
        preferredDate: prefDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        preferredDeliveryDate: prefDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        message: requestMessage,
        buyerNote: requestMessage
      });

      setReqSuccess(true);
      setTimeout(() => {
        setReqSuccess(false);
        setSelectedMatch(null);
        navigate('/buyer/requests');
      }, 1200);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      <BuyerHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
        
        {/* Header Title */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#0057b8] text-xs font-semibold mb-2">
            <Sparkles size={13} />
            <span>Automated Sourcing Matcher</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-slate-950">
            Find the Best Farmer Match
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal max-w-2xl mt-0.5">
            Specify crop requirements, target volume, and destination to get transparently scored farmer listings.
          </p>
        </motion.div>

        {/* Search Criteria Box */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/90 mb-8"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Produce Crop */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Produce Commodity
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={produceQuery}
                    onChange={(e) => setProduceQuery(e.target.value)}
                    placeholder="e.g. Maize, Rice, Tomatoes"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Volume (kg/units)
                </label>
                <div className="relative">
                  <Package size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    placeholder="e.g. 500"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>
              </div>

              {/* Destination */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Delivery Destination
                </label>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    placeholder="e.g. Abuja, Kano, Lagos"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>
              </div>

              {/* Max Budget Price */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Target Price (₦/unit)
                </label>
                <div className="relative">
                  <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="number"
                    value={preferredPrice}
                    onChange={(e) => setPreferredPrice(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g. 1000"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#15803d]" />
                <span>Matches scored automatically by crop availability, volume threshold, proximity, and price.</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#0057b8] hover:bg-[#003e8a] text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
              >
                {loading ? 'Evaluating Matches...' : 'Run Smart Match'}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Results Section */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-sans font-bold text-slate-900 flex items-center gap-2">
              <span>Scored Farmer Matches</span>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {matches.length} found
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 animate-pulse">
                  <div className="h-5 w-20 bg-slate-100 rounded mb-3"></div>
                  <div className="h-6 w-3/4 bg-slate-100 rounded mb-2"></div>
                  <div className="h-4 w-1/2 bg-slate-100 rounded mb-4"></div>
                  <div className="h-10 bg-slate-100 rounded-xl"></div>
                </div>
              ))}
            </div>
          ) : matches.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-lg mx-auto">
              <Search size={32} className="text-slate-300 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-900 mb-1">No matches found for criteria</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                Try widening your produce search query or adjusting your target price.
              </p>
              <button
                onClick={() => {
                  setProduceQuery('Maize');
                  setQuantity(500);
                  setDeliveryLocation('Abuja');
                  setPreferredPrice(1000);
                }}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Reset Default Search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {matches.map((match) => {
                const prod = match.produce;
                const farmer = match.farmer;
                const farmerName = prod.farmerName || farmer?.name || 'Verified Farmer';
                const farmName = farmer?.farmName || `${farmerName}'s Farm`;

                const scoreColor =
                  match.totalScore >= 90
                    ? 'bg-emerald-50 text-[#15803d] border-emerald-200'
                    : match.totalScore >= 75
                    ? 'bg-blue-50 text-[#0057b8] border-blue-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200';

                return (
                  <motion.div
                    key={prod.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Score Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2.5 py-0.5 rounded-md border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${scoreColor}`}>
                          <Sparkles size={12} /> {match.totalScore}% Match
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {prod.category}
                        </span>
                      </div>

                      {/* Produce & Farm Info */}
                      <h3 className="text-base font-sans font-bold text-slate-900 mb-1 group-hover:text-[#0057b8] transition-colors">
                        {prod.name}
                      </h3>
                      
                      <div className="mb-3.5">
                        <p className="font-semibold text-xs text-slate-800">{farmName}</p>
                        <p className="text-xs text-slate-500 font-normal">{farmerName}</p>
                        <p className="text-xs text-slate-500 font-normal flex items-center gap-1 mt-0.5">
                          <MapPin size={12} className="text-slate-400" />
                          {prod.location}
                        </p>
                      </div>

                      {/* Price & Stock info */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 flex items-center justify-between mb-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Price</p>
                          <p className="font-bold text-sm text-slate-900">
                            ₦{prod.price.toLocaleString()} <span className="text-xs font-normal text-slate-500">/{prod.unit || 'kg'}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available</p>
                          <p className="font-bold text-sm text-slate-800">
                            {prod.availableQuantity.toLocaleString()} {prod.unit || 'kg'}
                          </p>
                        </div>
                      </div>

                      {/* Reasons */}
                      <div className="mb-4 space-y-1">
                        {match.reasons.slice(0, 3).map((r, ri) => (
                          <div key={ri} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <CheckCircle2 size={13} className="text-[#15803d] shrink-0" />
                            <span className="text-[11px] truncate">{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedMatch(match)}
                      className="w-full py-2.5 bg-[#0057b8] hover:bg-[#003e8a] text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span>Request from this Farmer</span>
                      <ArrowRight size={14} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

      </main>

      {/* Match Request Modal */}
      <AnimatePresence>
        {selectedMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => !isSubmitting && setSelectedMatch(null)}
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
                    Confirm Purchase Request
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedMatch.produce.name} from {selectedMatch.farmer?.farmName || selectedMatch.produce.farmerName || 'Farmer'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {reqSuccess ? (
                <div className="text-center py-6">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-2" />
                  <h4 className="text-base font-bold text-slate-900">Request Sent Successfully!</h4>
                  <p className="text-xs text-slate-500 mt-1">Redirecting to your active requests view...</p>
                </div>
              ) : (
                <form onSubmit={handleRequestSubmit} className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Volume:</span>
                      <span className="font-semibold text-slate-900">{quantity} {selectedMatch.produce.unit || 'kg'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Unit Price:</span>
                      <span className="font-semibold text-slate-900">₦{selectedMatch.produce.price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200/80 mt-1 font-bold">
                      <span className="text-slate-700">Estimated Total:</span>
                      <span className="text-[#0057b8] text-sm">₦{(selectedMatch.produce.price * quantity).toLocaleString()}</span>
                    </div>
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Message / Haulage Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      placeholder="Specify access or delivery timeframe..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8] resize-none"
                    />
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMatch(null)}
                      className="flex-1 py-2.5 border border-slate-200 rounded-xl font-semibold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 bg-[#0057b8] hover:bg-[#003e8a] text-white rounded-xl font-semibold text-xs shadow-xs cursor-pointer"
                    >
                      {isSubmitting ? 'Sending...' : 'Confirm Request'}
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

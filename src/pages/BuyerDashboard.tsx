import React, { useState, useMemo } from 'react';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  MapPin,
  Package,
  Filter,
  X,
  Leaf,
  Sparkles,
  ShoppingBag,
  FileText,
  Truck,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { BuyerHeader } from '../components/BuyerHeader';
import { ProduceCard } from '../components/ProduceCard';
import { motion, AnimatePresence } from 'motion/react';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';

export const BuyerDashboard = () => {
  const { produceList, loadingProduce, requests, orders, getFarmerById } = useMarketplace();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [locationFilter, setLocationFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const myRequests = requests.filter(r => r.buyerId === user?.id);
  const pendingRequests = myRequests.filter(r => r.status === 'Pending');
  const myOrders = orders.filter(o => o.buyerId === user?.id);
  const activeOrders = myOrders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled');
  const completedOrders = myOrders.filter(o => o.status === 'Completed');
  const availableProduceList = produceList.filter(p => p.status !== 'Out of Stock' && p.availableQuantity > 0);

  const categories = Array.from(new Set(availableProduceList.map(p => p.category)));
  const locations = Array.from(new Set(availableProduceList.map(p => p.location).filter(Boolean)));

  const kpis = [
    { label: 'Available Produce', value: availableProduceList.length, icon: Package, color: 'text-[#0057b8]', bg: 'bg-blue-50' },
    { label: 'Pending Requests', value: pendingRequests.length, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50', link: '/buyer/requests' },
    { label: 'Active Orders', value: activeOrders.length, icon: ShoppingBag, color: 'text-[#15803d]', bg: 'bg-emerald-50', link: '/buyer/orders' },
    { label: 'Completed Orders', value: completedOrders.length, icon: Leaf, color: 'text-teal-600', bg: 'bg-teal-50', link: '/buyer/orders' }
  ];

  // Synchronously compute filtered produce so cards remain visible and stable during background data sync
  const filteredProduce = useMemo(() => {
    let result = produceList.filter(p => p.status !== 'Out of Stock' && p.availableQuantity > 0);

      if (searchQuery) {
        result = result.filter(p =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }

      if (selectedCategory) {
        result = result.filter(p => p.category === selectedCategory);
      }

      if (locationFilter) {
        result = result.filter(p => p.location === locationFilter);
      }

      if (minPrice) {
        result = result.filter(p => p.price >= Number(minPrice));
      }

      if (maxPrice) {
        result = result.filter(p => p.price <= Number(maxPrice));
      }

      switch (sortBy) {
        case 'price-low':
          result.sort((a, b) => a.price - b.price);
          break;
        case 'price-high':
          result.sort((a, b) => b.price - a.price);
          break;
        case 'availability':
          result.sort((a, b) => b.availableQuantity - a.availableQuantity);
          break;
        default:
          result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      }

      return result;
  }, [searchQuery, selectedCategory, locationFilter, minPrice, maxPrice, sortBy, produceList]);

  // Only show skeleton placeholders on initial load when no produce is loaded yet
  const isInitialLoading = loadingProduce && produceList.length === 0;

  const clearFilters = () => {
    setLocationFilter('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
    setSearchQuery('');
    setSelectedCategory(null);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      <BuyerHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold uppercase tracking-wider text-slate-500 shadow-xs">
                Buyer Sourcing Hub
              </span>
              <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 rounded-md text-[11px] font-bold uppercase tracking-wider text-[#0057b8]">
                {user?.organization || 'Commercial Buyer'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-slate-950">
              Fresh Produce Marketplace
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
              Source certified agricultural commodities directly from verified Nigerian farmers
            </p>
          </div>

          <Link
            to="/matching"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#0057b8] hover:bg-[#003e8a] text-white transition-all shadow-xs active:scale-98"
          >
            <Sparkles size={16} />
            <span>Launch Smart Matcher</span>
          </Link>
        </motion.div>

        {/* Quick KPI Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
          {kpis.map((kpi, idx) => (
            <div
              key={idx}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between"
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{kpi.label}</p>
                <div className="text-2xl font-sans font-bold text-slate-950">
                  <AnimatedNumber value={kpi.value} />
                </div>
              </div>
              <div className={`w-10 h-10 ${kpi.bg} ${kpi.color} rounded-xl flex items-center justify-center`}>
                <kpi.icon size={19} />
              </div>
            </div>
          ))}
        </div>

        {/* Smart Matching Banner */}
        <div className="mb-8 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xs">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-2.5">
                <Sparkles size={12} /> Algorithmic Sourcing
              </div>
              <h3 className="text-xl sm:text-2xl font-sans font-bold mb-1 tracking-tight">
                Try Smart Matching for Instant Procurement
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
                Specify your crop requirements, volume, and destination to automatically match with available farmers scored by distance, pricing, and fulfillment speed.
              </p>
            </div>

            <Link
              to="/matching"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-950 hover:bg-slate-100 transition-colors shrink-0"
            >
              <span>Run Smart Matcher</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <section className="mb-6 relative z-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search produce name, category, farmer or state..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8] transition-all text-slate-900 text-sm shadow-xs font-normal"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs border cursor-pointer ${
                showFilters || locationFilter || minPrice || maxPrice || sortBy !== 'newest'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter size={15} />
              <span>Filters</span>
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-3"
              >
                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/90 relative">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-900 font-sans text-xs uppercase tracking-wider">
                      Advanced Sourcing Filters
                    </h3>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Origin / State</label>
                      <select
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 py-2 px-3 rounded-lg text-xs"
                      >
                        <option value="">All States</option>
                        {locations.map((loc) => (
                          <option key={loc as string} value={loc as string}>{loc as string}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Sort Order</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 py-2 px-3 rounded-lg text-xs"
                      >
                        <option value="newest">Newest First</option>
                        <option value="price-low">Price: Low to High</option>
                        <option value="price-high">Price: High to Low</option>
                        <option value="availability">Highest Available Stock</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Price Range (₦)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="Min ₦"
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-900 py-2 px-3 rounded-lg text-xs"
                        />
                        <span className="text-slate-400 font-semibold">-</span>
                        <input
                          type="number"
                          placeholder="Max ₦"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-900 py-2 px-3 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={clearFilters}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      Reset all filters
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Category Filter Pills */}
        <section className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === null
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/90'
              }`}
            >
              All Categories
            </button>
            {categories.map((category) => (
              <button
                key={category as string}
                onClick={() => setSelectedCategory(category as string)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === category
                    ? 'bg-[#0057b8] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/90'
                }`}
              >
                {category as string}
              </button>
            ))}
          </div>
        </section>

        {/* Results Grid */}
        <section>
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-sm sm:text-base font-sans font-bold text-slate-900">
              {searchQuery || showFilters || selectedCategory ? 'Filtered Produce Results' : 'Available Harvest Listings'}
            </h2>
            <span className="text-slate-500 font-semibold text-xs bg-slate-100 px-2.5 py-0.5 rounded-full">
              {filteredProduce.length} listings
            </span>
          </div>

          {isInitialLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse">
                  <div className="h-40 bg-slate-100 rounded-xl mb-3"></div>
                  <div className="h-3.5 bg-slate-100 rounded w-1/2 mb-2"></div>
                  <div className="h-5 bg-slate-100 rounded w-3/4 mb-3"></div>
                  <div className="h-8 bg-slate-100 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredProduce.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredProduce.map((product) => {
                const farmer = product.farmerId ? getFarmerById(product.farmerId) : null;
                const enrichedProduct = {
                  ...product,
                  farmerName: product.farmerName || farmer?.farmName || farmer?.name || 'Verified Farm'
                };
                return (
                  <ProduceCard key={product.id} produce={enrichedProduct} />
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-md mx-auto">
              <Package size={36} className="text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">No produce found</h3>
              <p className="text-xs text-slate-500 mb-4">Try adjusting your filters or search keywords.</p>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Clear Filters
              </button>
            </div>
          )}
        </section>

      </main>
    </div>
  );
};

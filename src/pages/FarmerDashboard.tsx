import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import {
  Leaf,
  Plus,
  Package,
  AlertCircle,
  TrendingUp,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  FileText,
  ListOrdered,
  Truck,
  User,
  ShoppingBag
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { FarmerHeader } from '../components/FarmerHeader';
import { motion } from 'motion/react';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';

export const FarmerDashboard = () => {
  const { user } = useAuth();
  const { produceList, requests, orders } = useMarketplace();

  const myProduce = produceList.filter(p => p.farmerId === user?.id);
  const myRequests = requests.filter(r => r.farmerId === user?.id);
  const pendingRequests = myRequests.filter(r => r.status === 'Pending');
  const myOrders = orders.filter(o => o.farmerId === user?.id);
  const activeOrders = myOrders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled');
  const completedOrders = myOrders.filter(o => o.status === 'Completed');
  const lowStockProduce = myProduce.filter(p => p.status === 'Limited' || p.availableQuantity <= 20);

  const totalValue = myProduce.reduce((sum, p) => sum + p.price * p.availableQuantity, 0);

  const stats = [
    {
      label: 'Listed Produce',
      value: myProduce.length,
      icon: Package,
      color: 'text-[#15803d]',
      bg: 'bg-emerald-50',
      link: '/farmer/produce'
    },
    {
      label: 'Pending Requests',
      value: pendingRequests.length,
      icon: FileText,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      badge: pendingRequests.length > 0 ? 'Needs Review' : undefined,
      link: '/farmer/requests'
    },
    {
      label: 'Active Orders',
      value: activeOrders.length,
      icon: ShoppingBag,
      color: 'text-[#0057b8]',
      bg: 'bg-blue-50',
      link: '/farmer/orders'
    },
    {
      label: 'Completed Orders',
      value: completedOrders.length,
      icon: CheckCircle2,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      link: '/farmer/orders'
    }
  ];

  const quickActions = [
    { label: 'Add Produce', icon: Plus, path: '/farmer/produce/new', primary: true },
    { label: 'My Produce', icon: Package, path: '/farmer/produce' },
    { label: 'Buyer Requests', icon: FileText, path: '/farmer/requests', badge: pendingRequests.length },
    { label: 'Manage Orders', icon: ListOrdered, path: '/farmer/orders' },
    { label: 'Logistics', icon: Truck, path: '/logistics' },
    { label: 'Farm Profile', icon: User, path: '/farmer/profile' },
  ];

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const staggerItem: any = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      <FarmerHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
        
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8"
        >
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold uppercase tracking-wider text-slate-500 shadow-xs">
                Farmer Workspace
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded-md text-[11px] font-bold uppercase tracking-wider text-[#15803d] flex items-center gap-1">
                <CheckCircle2 size={13} /> {user?.farmName || 'Green Harvest Farm'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-slate-950">
              Welcome back, {user?.name || 'Farmer'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
              {user?.location || 'Kano, Nigeria'} • Overview of your produce inventory and trade requests
            </p>
          </div>

          <Link
            to="/farmer/produce/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#15803d] hover:bg-[#166534] text-white transition-all shadow-xs active:scale-98"
          >
            <Plus size={16} />
            <span>Add New Produce</span>
          </Link>
        </motion.div>

        {/* Quick Actions Bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((qa, i) => {
              const Icon = qa.icon;
              return (
                <Link
                  key={i}
                  to={qa.path}
                  className={`p-3.5 rounded-xl border flex flex-col items-center text-center justify-center transition-all relative ${
                    qa.primary
                      ? 'border-[#15803d] bg-emerald-50/60 text-[#15803d] hover:bg-emerald-100/60 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-xs'
                  }`}
                >
                  <Icon size={18} className="mb-1.5" />
                  <span className="text-xs font-bold leading-tight">{qa.label}</span>
                  {qa.badge ? (
                    <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {qa.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </motion.div>

        {/* KPI Stats Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-10"
        >
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              variants={staggerItem}
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col relative group hover:border-slate-300 transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center`}>
                  <stat.icon size={19} />
                </div>
                {stat.badge ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                    {stat.badge}
                  </span>
                ) : (
                  <ArrowUpRight size={15} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                )}
              </div>

              <div className="mt-auto">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{stat.label}</p>
                <div className="text-2xl sm:text-3xl font-sans font-bold text-slate-950 tracking-tight">
                  <AnimatedNumber value={stat.value} />
                </div>
              </div>

              <Link to={stat.link} className="absolute inset-0 z-20" aria-label={stat.label} />
            </motion.div>
          ))}
        </motion.div>

        {/* Main Content: Produce Listings & Pending Requests */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Main Produce List */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-sm font-sans font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Leaf size={16} className="text-[#15803d]" /> Current Produce Listings
                </h2>
                {myProduce.length > 0 && (
                  <Link
                    to="/farmer/produce"
                    className="text-xs font-bold text-[#15803d] hover:underline flex items-center gap-1"
                  >
                    View all ({myProduce.length}) <ArrowRight size={13} />
                  </Link>
                )}
              </div>

              <div className="p-6">
                {myProduce.length === 0 ? (
                  <div className="text-center py-10 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <Package size={28} className="mx-auto text-slate-400 mb-2" />
                    <h3 className="text-sm font-bold text-slate-900 mb-0.5">No produce listed yet</h3>
                    <p className="text-slate-500 text-xs mb-4">
                      Add your first harvest to receive purchase requests directly from buyers.
                    </p>
                    <Link
                      to="/farmer/produce/new"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#15803d] text-white"
                    >
                      <Plus size={14} /> Create Listing
                    </Link>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {myProduce.slice(0, 4).map((produce) => (
                      <Link
                        key={produce.id}
                        to="/farmer/produce"
                        className="bg-slate-50/50 rounded-xl p-4 border border-slate-200/70 hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-[#0057b8] uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded">
                              {produce.category}
                            </span>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                produce.status === 'Available'
                                  ? 'bg-emerald-50 text-[#15803d]'
                                  : produce.status === 'Limited'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {produce.status}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 group-hover:text-[#15803d] transition-colors">
                            {produce.name}
                          </h4>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex justify-between items-end text-xs">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Price</p>
                            <p className="font-bold text-slate-900">
                              ₦{produce.price.toLocaleString()} <span className="font-normal text-slate-500">/{produce.unit || 'kg'}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stock</p>
                            <p className="font-bold text-slate-800">
                              {produce.availableQuantity.toLocaleString()} {produce.unit || 'kg'}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Right Column: Pending Requests & Stock Alerts */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Pending Buyer Requests Card */}
            <div className="bg-slate-900 rounded-2xl p-5 text-white relative overflow-hidden shadow-sm">
              <div className="flex justify-between items-center mb-4 relative z-10">
                <h3 className="text-sm font-sans font-bold flex items-center gap-2">
                  <FileText size={16} className="text-blue-400" /> Pending Buyer Requests
                </h3>
                <span className="bg-[#15803d] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {pendingRequests.length}
                </span>
              </div>

              <div className="space-y-2.5 relative z-10">
                {pendingRequests.length > 0 ? (
                  pendingRequests.slice(0, 3).map((req) => (
                    <div
                      key={req.id}
                      className="p-3 bg-white/10 rounded-xl border border-white/10 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-xs">{req.produceName}</p>
                        <p className="text-[11px] text-slate-300">
                          {req.quantity.toLocaleString()} {req.unit || 'kg'} • {req.buyerName}
                        </p>
                        <p className="text-[10px] text-emerald-300 font-bold mt-0.5">₦{req.totalAmount.toLocaleString()}</p>
                      </div>
                      <Link
                        to="/farmer/requests"
                        className="px-3 py-1.5 bg-[#0057b8] hover:bg-[#003e8a] text-white rounded-lg text-xs font-bold transition-colors shrink-0"
                      >
                        Review
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <CheckCircle2 size={26} className="mx-auto text-emerald-400 mb-2" />
                    <p className="text-xs text-slate-300">No pending buyer requests right now.</p>
                  </div>
                )}
              </div>

              {pendingRequests.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10 text-center relative z-10">
                  <Link to="/farmer/requests" className="text-xs font-bold text-emerald-400 hover:underline">
                    View all requests ({pendingRequests.length}) →
                  </Link>
                </div>
              )}
            </div>

            {/* Low Stock Alerts */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <AlertCircle size={14} className="text-amber-500" /> Inventory Stock Alerts
              </h3>

              {lowStockProduce.length > 0 ? (
                <div className="space-y-2.5">
                  {lowStockProduce.map((p) => (
                    <div key={p.id} className="flex justify-between items-center p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/70">
                      <div>
                        <p className="font-bold text-xs text-slate-900">{p.name}</p>
                        <p className="text-[11px] text-amber-700">
                          Low stock: {p.availableQuantity} {p.unit || 'kg'} remaining
                        </p>
                      </div>
                      <Link
                        to="/farmer/produce"
                        className="text-[11px] font-bold text-slate-700 hover:text-[#15803d] underline"
                      >
                        Update
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3 text-xs text-slate-500 flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={15} className="text-[#15803d]" /> All crop stock levels healthy.
                </div>
              )}
            </div>

          </motion.div>
        </div>
      </main>
    </div>
  );
};

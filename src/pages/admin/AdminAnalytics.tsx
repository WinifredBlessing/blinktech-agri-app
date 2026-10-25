import React, { useState, useEffect } from 'react';
import { useMarketplace } from '../../context/MarketplaceContext';
import { authService } from '../../services/authService';
import { analyticsService, NIGERIAN_STATES, AnalyticsFilter } from '../../services/analyticsService';
import { User } from '../../types';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  CheckCircle2,
  FileText,
  Users,
  Tractor,
  DollarSign,
  BarChart3,
  PieChart,
  Calendar,
  MapPin
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart as RechartsPie,
  Pie,
  Cell
} from 'recharts';

export const AdminAnalytics = () => {
  const { produceList, orders, requests, logisticsRequests } = useMarketplace();
  const [usersList, setUsersList] = useState<User[]>(() => {
    try {
      const stored = localStorage.getItem('agrilink_users');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let mounted = true;

    const loadLiveUsers = async () => {
      try {
        const live = await authService.fetchAllProfiles();
        if (mounted && live && live.length > 0) {
          setUsersList(live);
        }
      } catch (err) {
        console.warn('AdminAnalytics loadLiveUsers error:', err);
      }
    };

    loadLiveUsers();

    const unsubscribe = authService.subscribeToProfiles((updated) => {
      if (mounted && updated && updated.length > 0) {
        setUsersList(updated);
      }
    });

    const interval = setInterval(loadLiveUsers, 3000);
    const onFocus = () => loadLiveUsers();
    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const [filter, setFilter] = useState<AnalyticsFilter>({
    timePeriod: '30d',
    state: 'All States'
  });

  const data = analyticsService.calculateAnalytics(
    produceList,
    orders,
    requests,
    logisticsRequests,
    usersList,
    filter
  );

  const formatNaira = (val: number) => {
    if (val >= 1000000) {
      return `₦${(val / 1000000).toFixed(1)}M`;
    }
    return `₦${val.toLocaleString()}`;
  };

  const kpis = [
    { label: 'Total Produce', value: data.totalProduce, icon: Package, color: 'text-[#15803d]', bg: 'bg-emerald-50' },
    { label: 'Total Orders', value: data.totalOrders, icon: ShoppingCart, color: 'text-[#0057b8]', bg: 'bg-blue-50' },
    { label: 'Completed Orders', value: data.completedOrders, icon: CheckCircle2, color: 'text-[#15803d]', bg: 'bg-emerald-50' },
    { label: 'Pending Requests', value: data.pendingRequests, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Active Farmers', value: data.activeFarmers, icon: Tractor, color: 'text-[#15803d]', bg: 'bg-emerald-50' },
    { label: 'Active Buyers', value: data.activeBuyers, icon: Users, color: 'text-[#0057b8]', bg: 'bg-blue-50' },
    { label: 'Marketplace Value', value: formatNaira(data.marketplaceValue), isString: true, icon: DollarSign, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  const COLORS = ['#15803d', '#0057b8', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b'];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 font-body text-slate-900">
      {/* Header & Interactive Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 font-sans tracking-tight">
            Marketplace Analytics & Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-normal">
            Real-time supply, demand, and transaction analysis across regional Nigerian agricultural belts.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2.5 bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-xs">
          {/* Time Period Filter */}
          <div className="flex items-center gap-1">
            <Calendar size={13} className="text-slate-400 ml-1.5" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Period:</span>
            {[
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: '3m', label: '3M' },
              { id: '12m', label: '12M' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setFilter({ ...filter, timePeriod: p.id as any })}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filter.timePeriod === p.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>

          {/* State Filter */}
          <div className="flex items-center gap-1">
            <MapPin size={13} className="text-slate-400" />
            <select
              value={filter.state}
              onChange={(e) => setFilter({ ...filter, state: e.target.value })}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
            >
              {NIGERIAN_STATES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between"
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2.5 ${kpi.bg} ${kpi.color}`}>
              <kpi.icon size={15} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                {kpi.label}
              </p>
              <p className="text-lg font-sans font-bold text-slate-950 tracking-tight">
                {kpi.isString ? kpi.value : Number(kpi.value).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Orders Over Time */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-sm font-bold font-sans text-slate-950">Orders & Growth Velocity</h3>
              <p className="text-xs text-slate-500 font-normal">Weekly completed orders and trading volume</p>
            </div>
            <TrendingUp size={16} className="text-[#15803d]" />
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.ordersOverTime}>
                <defs>
                  <linearGradient id="orderGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#15803d" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#15803d" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="orders" stroke="#15803d" strokeWidth={2.5} fillOpacity={1} fill="url(#orderGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Most Demanded Produce (Requests) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-sm font-bold font-sans text-slate-950">Most Requested Produce (Demand)</h3>
              <p className="text-xs text-slate-500 font-normal">Purchase request frequency by commodity</p>
            </div>
            <BarChart3 size={16} className="text-[#0057b8]" />
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.mostRequestedProduce}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                />
                <Bar dataKey="requests" fill="#0057b8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Top Categories Distribution */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-sm font-bold font-sans text-slate-950">Produce Volume by Category</h3>
              <p className="text-xs text-slate-500 font-normal">Listings distribution across agro-sectors</p>
            </div>
            <PieChart size={16} className="text-[#15803d]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={data.produceByCategories}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {data.produceByCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5">
              {data.produceByCategories.map((cat, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                    <span className="font-semibold text-slate-700">{cat.name}</span>
                  </div>
                  <span className="text-slate-500">{cat.count.toLocaleString()} listings</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 4: Orders by Status */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-sm font-bold font-sans text-slate-950">Fulfillment Status Breakdown</h3>
              <p className="text-xs text-slate-500 font-normal">Order volume distribution across operational stages</p>
            </div>
            <CheckCircle2 size={16} className="text-[#0057b8]" />
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ordersByStatus} layout="vertical">
                <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis dataKey="status" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                />
                <Bar dataKey="count" fill="#15803d" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};

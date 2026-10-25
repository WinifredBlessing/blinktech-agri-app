import React, { useState, useEffect } from 'react';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { analyticsService } from '../../services/analyticsService';
import { User } from '../../types';
import {
  Users,
  Tractor,
  ShoppingCart,
  Package,
  CheckCircle2,
  FileText,
  Truck,
  TrendingUp,
  ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const { produceList, requests, orders, logisticsRequests } = useMarketplace();

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
        console.warn('AdminDashboard loadLiveUsers error:', err);
      }
    };

    // Initial query
    loadLiveUsers();

    // 1. Listen for Supabase Realtime changes on public.profiles
    const unsubscribe = authService.subscribeToProfiles((updated) => {
      if (mounted && updated && updated.length > 0) {
        setUsersList(updated);
      }
    });

    // 2. Poll every 3 seconds to guarantee automatic update across all tabs and devices
    const interval = setInterval(loadLiveUsers, 3000);

    // 3. Tab focus listener
    const onFocus = () => loadLiveUsers();
    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const analytics = analyticsService.calculateAnalytics(
    produceList,
    orders,
    requests,
    logisticsRequests,
    usersList,
    { timePeriod: '30d', state: 'All' }
  );

  const formatNaira = (val: number) => {
    if (val >= 1000000) {
      return `₦${(val / 1000000).toFixed(1)}M`;
    }
    return `₦${val.toLocaleString()}`;
  };

  const overviewStats = [
    {
      label: 'Active Farmers',
      value: analytics.activeFarmers,
      icon: Tractor,
      color: 'text-[#15803d]',
      bg: 'bg-emerald-50',
      link: '/admin/farmers'
    },
    {
      label: 'Active Buyers',
      value: analytics.activeBuyers,
      icon: Users,
      color: 'text-[#0057b8]',
      bg: 'bg-blue-50',
      link: '/admin/buyers'
    },
    {
      label: 'Listed Produce',
      value: analytics.totalProduce,
      icon: Package,
      color: 'text-[#15803d]',
      bg: 'bg-emerald-50',
      link: '/admin/produce'
    },
    {
      label: 'Total Orders',
      value: analytics.totalOrders,
      icon: ShoppingCart,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      link: '/admin/orders'
    },
    {
      label: 'Completed Orders',
      value: analytics.completedOrders,
      icon: CheckCircle2,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      link: '/admin/orders'
    },
    {
      label: 'Pending Requests',
      value: analytics.pendingRequests,
      icon: FileText,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      link: '/admin/requests'
    },
    {
      label: 'Active Haulage',
      value: logisticsRequests.filter(l => l.status !== 'Delivered' && l.status !== 'Cancelled').length,
      icon: Truck,
      color: 'text-[#0057b8]',
      bg: 'bg-blue-50',
      link: '/admin/logistics'
    },
    {
      label: 'Marketplace Volume',
      value: analytics.marketplaceValue,
      isCurrency: true,
      icon: TrendingUp,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      link: '/admin/analytics'
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-body text-slate-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold uppercase tracking-wider text-slate-700">
              Platform Administration
            </span>
            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[10px] font-bold uppercase tracking-wider text-[#15803d]">
              Live Ecosystem
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 font-sans tracking-tight">
            Platform Command Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-normal">
            National agricultural marketplace performance, verified producer metrics, and system controls.
          </p>
        </div>

        <Link
          to="/admin/analytics"
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
        >
          Detailed Analytics & Trends →
        </Link>
      </div>

      {/* 8 Overview Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewStats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Link
              key={idx}
              to={stat.link}
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between group"
            >
              <div className="flex justify-between items-start mb-3">
                <div className={`w-9 h-9 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center`}>
                  <Icon size={18} />
                </div>
                <ArrowUpRight size={15} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{stat.label}</p>
                <div className="text-xl sm:text-2xl font-sans font-bold text-slate-950 tracking-tight">
                  {stat.isCurrency ? formatNaira(stat.value) : stat.value.toLocaleString()}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Real-time sync</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Navigation Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold font-sans text-sm text-slate-900">User Identity & KYC</h3>
              <Users size={16} className="text-slate-400" />
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Review verified farm cooperatives, commercial buyers, KYC validation, and status credentials.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/farmers" className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#15803d] rounded-xl text-xs font-semibold text-center transition-colors">
              Farmers
            </Link>
            <Link to="/admin/buyers" className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-[#0057b8] rounded-xl text-xs font-semibold text-center transition-colors">
              Buyers
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold font-sans text-sm text-slate-900">Marketplace Operations</h3>
              <Package size={16} className="text-slate-400" />
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Moderate produce listings across 8 agro-categories, review wholesale requests, and inspect orders.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/produce" className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold text-center transition-colors">
              Produce
            </Link>
            <Link to="/admin/orders" className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold text-center transition-colors">
              Orders
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold font-sans text-sm text-slate-900">Haulage Fleet Control</h3>
              <Truck size={16} className="text-slate-400" />
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Dispatch certified transport partners (AgriMove / FarmRoute), assign transit drivers, and update status.
            </p>
          </div>
          <Link to="/admin/logistics" className="block w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold text-center transition-colors">
            Manage Logistics ({logisticsRequests.length} active)
          </Link>
        </div>
      </div>
    </div>
  );
};

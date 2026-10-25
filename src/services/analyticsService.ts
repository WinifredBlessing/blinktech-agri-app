import { Produce, Order, Request, LogisticsRequest, User } from '../types';

export interface AnalyticsFilter {
  timePeriod: '7d' | '30d' | '3m' | '12m' | 'all';
  state: string; // 'All' or specific Nigerian state
}

export interface AnalyticsData {
  totalProduce: number;
  totalOrders: number;
  completedOrders: number;
  pendingRequests: number;
  activeFarmers: number;
  activeBuyers: number;
  marketplaceValue: number;
  ordersOverTime: { date: string; orders: number; revenue: number }[];
  produceByCategories: { name: string; count: number; value: number }[];
  mostRequestedProduce: { name: string; requests: number; volume: number }[];
  ordersByStatus: { status: string; count: number; color: string }[];
  regionalDistribution: { state: string; count: number }[];
}

// Baseline defaults (Order metrics are strictly 0 to reflect real Supabase data)
export const DEMO_BASELINE = {
  totalFarmers: 0,
  totalBuyers: 0,
  totalProduce: 0,
  totalOrders: 0,
  completedOrders: 0,
  pendingRequests: 0,
  activeLogistics: 0,
  marketplaceValue: 0,
};

export const NIGERIAN_STATES = [
  'All States',
  'Kano',
  'Kaduna',
  'Kebbi',
  'Plateau',
  'Abuja (FCT)',
  'Lagos',
  'Benue',
  'Niger',
  'Oyo',
  'Ogun',
  'Enugu',
  'Rivers',
  'Borno',
  'Sokoto',
  'Katsina',
];

export class AnalyticsService {
  public calculateAnalytics(
    produceList: Produce[],
    ordersList: Order[],
    requestsList: Request[],
    logisticsList: LogisticsRequest[],
    usersList: User[],
    filter: AnalyticsFilter
  ): AnalyticsData {
    // 1. Filter by State
    let filteredProduce = [...produceList];
    let filteredOrders = [...ordersList];
    let filteredRequests = [...requestsList];

    if (filter.state && filter.state !== 'All' && filter.state !== 'All States') {
      const stateQuery = filter.state.toLowerCase().replace('(fct)', '').trim();
      filteredProduce = filteredProduce.filter(p =>
        (p.location || '').toLowerCase().includes(stateQuery)
      );
      filteredOrders = filteredOrders.filter(o =>
        (o.deliveryLocation || '').toLowerCase().includes(stateQuery) ||
        (o.pickupLocation || '').toLowerCase().includes(stateQuery)
      );
      filteredRequests = filteredRequests.filter(r =>
        (r.deliveryLocation || '').toLowerCase().includes(stateQuery)
      );
    }

    // 2. Filter by Time Period
    const now = new Date();
    let daysCutoff = 365;
    if (filter.timePeriod === '7d') daysCutoff = 7;
    else if (filter.timePeriod === '30d') daysCutoff = 30;
    else if (filter.timePeriod === '3m') daysCutoff = 90;
    else if (filter.timePeriod === '12m') daysCutoff = 365;

    const cutoffTime = new Date(now.getTime() - daysCutoff * 24 * 60 * 60 * 1000).getTime();

    const timeFilteredOrders = filteredOrders.filter(o =>
      new Date(o.createdAt).getTime() >= cutoffTime
    );

    const timeFilteredRequests = filteredRequests.filter(r =>
      new Date(r.createdAt).getTime() >= cutoffTime
    );

    // Live Metrics Calculations from real Supabase data
    const liveRevenue = timeFilteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const liveCompleted = timeFilteredOrders.filter(o => o.status === 'Completed').length;
    const livePendingRequests = timeFilteredRequests.filter(r => r.status === 'Pending').length;

    // Live counts strictly from real registered database users and records
    const totalFarmers = usersList.filter(u => u.role?.toLowerCase() === 'farmer').length;
    const totalBuyers = usersList.filter(u => u.role?.toLowerCase() === 'buyer').length;
    const totalProduce = filteredProduce.length;
    const totalOrders = timeFilteredOrders.length;
    const completedOrders = liveCompleted;
    const pendingRequests = livePendingRequests;
    const marketplaceValue = liveRevenue;

    // 3. Category Breakdown (from actual produce)
    const catMap: Record<string, { count: number; value: number }> = {};

    filteredProduce.forEach(p => {
      const cat = p.category || 'Other';
      if (!catMap[cat]) catMap[cat] = { count: 0, value: 0 };
      catMap[cat].count += 1;
      catMap[cat].value += (p.price || 0) * (p.availableQuantity || 0);
    });

    const produceByCategories = Object.entries(catMap).map(([name, val]) => ({
      name,
      count: val.count,
      value: val.value,
    }));

    // 4. Most Requested Produce
    const demandMap: Record<string, { requests: number; volume: number }> = {};

    timeFilteredRequests.forEach(r => {
      const name = r.produceName || 'Custom Crop';
      if (!demandMap[name]) demandMap[name] = { requests: 0, volume: 0 };
      demandMap[name].requests += 1;
      demandMap[name].volume += r.quantity || 0;
    });

    const mostRequestedProduce = Object.entries(demandMap)
      .map(([name, data]) => ({ name, requests: data.requests, volume: data.volume }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 6);

    // 5. Orders by Status - Strictly all 7 Supabase statuses
    const statusCounts: Record<string, number> = {
      'Confirmed': 0,
      'Processing': 0,
      'Ready for Delivery': 0,
      'In Transit': 0,
      'Delivered': 0,
      'Completed': 0,
      'Cancelled': 0,
    };

    timeFilteredOrders.forEach(o => {
      if (statusCounts[o.status] !== undefined) {
        statusCounts[o.status] += 1;
      } else {
        statusCounts[o.status] = 1;
      }
    });

    const statusColors: Record<string, string> = {
      'Confirmed': '#0057b8',
      'Processing': '#8b5cf6',
      'Ready for Delivery': '#f59e0b',
      'In Transit': '#06b6d4',
      'Delivered': '#10b981',
      'Completed': '#15803d',
      'Cancelled': '#64748b',
    };

    const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      color: statusColors[status] || '#64748b',
    }));

    // 6. Orders Over Time (real bucketed trend data for chart)
    const bucketLabels = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Current'];
    const ordersOverTime = bucketLabels.map(date => ({ date, orders: 0, revenue: 0 }));

    if (timeFilteredOrders.length > 0) {
      const minTime = Math.min(...timeFilteredOrders.map(o => new Date(o.createdAt).getTime()));
      const maxTime = Math.max(...timeFilteredOrders.map(o => new Date(o.createdAt).getTime()), Date.now());
      const interval = (maxTime - minTime) / 6 || 1;

      timeFilteredOrders.forEach(o => {
        const t = new Date(o.createdAt).getTime();
        let idx = Math.floor((t - minTime) / interval);
        if (idx >= 6) idx = 5;
        if (idx < 0) idx = 0;
        ordersOverTime[idx].orders += 1;
        ordersOverTime[idx].revenue += (o.totalAmount || 0);
      });
    }

    // 7. Regional Distribution (calculated from real orders and produce)
    const stateMap: Record<string, number> = {};
    timeFilteredOrders.forEach(o => {
      if (o.deliveryLocation) {
        const state = o.deliveryLocation.split(',').pop()?.trim() || 'Other';
        stateMap[state] = (stateMap[state] || 0) + 1;
      }
    });
    const regionalDistribution = Object.entries(stateMap)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);

    return {
      totalProduce,
      totalOrders,
      completedOrders,
      pendingRequests,
      activeFarmers: totalFarmers,
      activeBuyers: totalBuyers,
      marketplaceValue,
      ordersOverTime,
      produceByCategories,
      mostRequestedProduce,
      ordersByStatus,
      regionalDistribution,
    };
  }
}

export const analyticsService = new AnalyticsService();

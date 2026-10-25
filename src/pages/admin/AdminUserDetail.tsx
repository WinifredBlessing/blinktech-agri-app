import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Mail, Phone } from 'lucide-react';
import { User } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { produceService } from '../../services/produceService';
import { buyerRequestService } from '../../services/buyerRequestService';
import { orderService } from '../../services/orderService';

export const AdminUserDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  // Analytics
  const [produceCount, setProduceCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [farmName, setFarmName] = useState('');

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      let foundUser: User | null = null;

      // 1. Try live Supabase profiles first
      try {
        const live = await authService.fetchAllProfiles();
        foundUser = live.find(u => u.id === id) ?? null;
      } catch {
        // fall through to localStorage
      }

      // 2. Fallback to localStorage cache
      if (!foundUser) {
        const users: User[] = JSON.parse(localStorage.getItem('agrilink_users') || '[]');
        foundUser = users.find(u => u.id === id) ?? null;
      }

      if (!foundUser) {
        navigate('/admin/users');
        return;
      }
      setUser(foundUser);

      // Fetch live requests from Supabase
      buyerRequestService.fetchRequests().then((allRequests) => {
        const targetRole = (foundUser!.role || '').toLowerCase();
        if (targetRole === 'farmer') {
          setRequestCount(allRequests.filter(r => r.farmerId === foundUser!.id).length);
        } else if (targetRole === 'buyer') {
          setRequestCount(allRequests.filter(r => r.buyerId === foundUser!.id).length);
        }
      }).catch((err) => console.warn('AdminUserDetail requests error:', err));

      if (foundUser.role === 'Farmer') {
        const farmers = JSON.parse(localStorage.getItem('agrilink_farmers') || '[]');
        const f = farmers.find((f: any) => f.id === foundUser!.id);
        if (f) setFarmName(f.farmName);

        produceService.fetchProduceList().then((allProduce) => {
          setProduceCount(allProduce.filter((p) => p.farmerId === foundUser!.id).length);
        }).catch((err) => console.warn('AdminUserDetail produce error:', err));

        orderService.fetchAllOrders().then((allOrders) => {
          const farmerOrders = allOrders.filter(o => o.farmerId === foundUser!.id);
          setOrderCount(farmerOrders.length);
          setTotalValue(farmerOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0));
        }).catch((err) => console.warn('AdminUserDetail orders error:', err));
      } else if (foundUser.role === 'Buyer') {
        orderService.fetchAllOrders().then((allOrders) => {
          const buyerOrders = allOrders.filter(o => o.buyerId === foundUser!.id);
          setOrderCount(buyerOrders.length);
          setTotalValue(buyerOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0));
        }).catch((err) => console.warn('AdminUserDetail orders error:', err));
      }
    };

    load();
  }, [id, navigate]);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Users
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center font-bold text-2xl text-slate-600">
              {user.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
              <p className="text-sm text-slate-500 font-mono mt-1">ID: {user.id}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
             <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                user.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                user.role === 'Farmer' ? 'bg-brand-100 text-brand-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {user.role}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                (user as any).status === 'Suspended' ? 'bg-amber-100 text-amber-700' :
                (user as any).status === 'Banned' ? 'bg-rose-100 text-rose-700' :
                (user as any).status === 'Deleted' ? 'bg-slate-100 text-slate-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {(user as any).status || 'Active'}
              </span>
          </div>
        </div>

        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Account Information</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Email Address</p>
                    <p className="text-sm text-slate-500">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Phone Number</p>
                    <p className="text-sm text-slate-500">{user.phone}</p>
                  </div>
                </div>
                {user.role === 'Farmer' && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Farm Details</p>
                      <p className="text-sm text-slate-500">{farmName || 'Not specified'}</p>
                      {(user as any).verificationStatus && (
                        <p className="text-xs font-medium mt-1 text-brand-600">Verification: {(user as any).verificationStatus}</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Registration Date</p>
                    <p className="text-sm text-slate-500">{(user as any).createdAt ? new Date((user as any).createdAt).toLocaleDateString() : 'Unknown'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Platform Activity</h3>
              <div className="grid grid-cols-2 gap-4">
                {user.role === 'Farmer' && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-medium text-slate-500 uppercase">Produce Listings</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{produceCount}</p>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase">Total Requests</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{requestCount}</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase">Completed Orders</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{orderCount}</p>
                </div>

                {(user.role === 'Buyer' || user.role === 'Farmer') && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 col-span-2">
                    <p className="text-xs font-medium text-slate-500 uppercase">
                      {user.role === 'Buyer' ? 'Total Purchase Value' : 'Total Sales Volume'}
                    </p>
                    <p className="text-2xl font-bold text-brand-600 mt-1">₦{totalValue.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

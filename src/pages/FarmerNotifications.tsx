import React, { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { FarmerHeader } from '../components/FarmerHeader';
import { Bell, Check, CheckCircle2, Package, Truck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const FarmerNotifications = () => {
  const { user } = useAuth();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useMarketplace();

  const userNotifications = useMemo(() => {
    if (!user) return [];
    return notifications
      .filter(n => n.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, user]);

  const unreadCount = userNotifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = () => {
    if (user) {
      markAllNotificationsRead(user.id);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_request':
        return <Package className="w-4 h-4 text-amber-600" />;
      case 'order_created':
      case 'order_status':
        return <CheckCircle2 className="w-4 h-4 text-[#15803d]" />;
      case 'logistics_update':
      case 'logistics_requested':
        return <Truck className="w-4 h-4 text-[#0057b8]" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      <FarmerHeader />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-slate-950">Farm Notifications</h1>
              {unreadCount > 0 && (
                <span className="bg-[#15803d] text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow-xs">
                  {unreadCount} Unread
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-normal">
              Instant alerts on incoming buyer purchase requests, order confirmations, and haulage transit.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs font-semibold text-slate-700 hover:text-slate-950 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>

        {userNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
            <Bell size={32} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-sm font-bold text-slate-900 mb-1">No notifications yet</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              When buyers request produce or place orders, you'll receive immediate updates here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {userNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && markNotificationRead(n.id)}
                className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                  n.read
                    ? 'bg-white border-slate-200/80 shadow-xs'
                    : 'bg-emerald-50/40 border-emerald-200 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{n.title}</h4>
                      {!n.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#15803d] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {getTimeAgo(n.createdAt)}
                    </span>
                  </div>
                </div>

                {n.link && (
                  <Link
                    to={n.link}
                    className="shrink-0 p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-white"
                  >
                    <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

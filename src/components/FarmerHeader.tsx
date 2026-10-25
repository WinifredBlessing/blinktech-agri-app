import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X, Bell, User, LayoutDashboard, Package, ListOrdered, FileText, Truck, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { Logo } from './Logo';
import { motion, AnimatePresence } from 'motion/react';

export const FarmerHeader = () => {
  const { logout, user } = useAuth();
  const { notifications, requests } = useMarketplace();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const pendingRequestsCount = requests.filter(r => r.farmerId === user?.id && r.status === 'Pending').length;

  const navLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Dashboard', path: '/farmer-dashboard', altPath: '/farmer/dashboard', icon: LayoutDashboard },
    { name: 'My Produce', path: '/farmer/produce', icon: Package },
    { name: 'Requests', path: '/farmer/requests', icon: FileText, badge: pendingRequestsCount },
    { name: 'Orders', path: '/farmer/orders', icon: ListOrdered },
    { name: 'Logistics', path: '/logistics', icon: Truck },
    { name: 'Profile', path: '/farmer/profile', icon: User },
  ];

  const unreadCount = notifications?.filter(n => n.userId === user?.id && !n.read).length || 0;

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Desktop Navigation */}
        <div className="flex items-center gap-8">
          <Logo size="sm" />
          
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path || location.pathname === link.altPath;
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-[#15803d]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={15} className={isActive ? 'text-[#15803d]' : 'text-slate-400'} />
                  <span>{link.name}</span>
                  {link.badge ? (
                    <span className="bg-[#15803d] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {link.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions: Notifications, Profile chip, Sign out */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/farmer/notifications"
            className={`relative p-2 rounded-lg border transition-colors ${
              location.pathname === '/farmer/notifications'
                ? 'bg-emerald-50 text-[#15803d] border-emerald-200'
                : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 border-slate-200'
            }`}
            aria-label="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#15803d] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#15803d]"></span>
              </span>
            )}
          </Link>

          {/* User Name Chip */}
          <Link
            to="/farmer/profile"
            className="hidden sm:flex items-center gap-2 py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-[#15803d] flex items-center justify-center font-bold text-xs">
              {user?.name?.charAt(0) || 'F'}
            </div>
            <span className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
              {user?.farmName || user?.name || 'Farmer'}
            </span>
          </Link>

          <button
            onClick={handleLogout}
            className="hidden sm:flex items-center gap-1.5 text-slate-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-50/70 transition-colors cursor-pointer"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-slate-200 bg-white shadow-lg overflow-hidden"
          >
            <nav className="flex flex-col p-4 space-y-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path || location.pathname === link.altPath;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-emerald-50 text-[#15803d]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={17} className={isActive ? 'text-[#15803d]' : 'text-slate-400'} />
                      <span>{link.name}</span>
                    </div>
                    {link.badge ? (
                      <span className="bg-[#15803d] text-white text-xs px-2 py-0.5 rounded-full font-bold">
                        {link.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  {user?.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

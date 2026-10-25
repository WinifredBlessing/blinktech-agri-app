import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Tractor,
  Package,
  FileText,
  ListOrdered,
  Truck,
  BarChart3,
  Settings,
  LogOut,
  Users,
  Menu,
  X,
  Home
} from 'lucide-react';
import { Logo } from '../Logo';

export const AdminLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const links = [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard },
    { name: 'Farmers', path: '/admin/farmers', icon: Tractor },
    { name: 'Buyers', path: '/admin/buyers', icon: Users },
    { name: 'Produce', path: '/admin/produce', icon: Package },
    { name: 'Requests', path: '/admin/requests', icon: FileText },
    { name: 'Orders', path: '/admin/orders', icon: ListOrdered },
    { name: 'Logistics', path: '/admin/logistics', icon: Truck },
    { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex selection:bg-brand-100 selection:text-brand-900 font-body text-slate-900">
      
      {/* Desktop Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200/90 flex-col hidden md:flex z-20 shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-slate-100">
          <Link to="/admin">
            <Logo />
          </Link>
        </div>

        <div className="p-3 border-b border-slate-100">
          <Link
            to="/"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-all border border-slate-200/80 bg-slate-50/60"
            title="Back to Homepage"
          >
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-slate-500" />
              <span>Home</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Exit ↗</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="px-3 mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Console Navigation
            </span>
          </div>
          <ul className="space-y-1">
            {links.map((link) => {
              const isActive = location.pathname === link.path;
              const Icon = link.icon;
              return (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className={`flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mr-2.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{link.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2.5 text-red-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <Logo />
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-950 bg-slate-100/80 hover:bg-slate-200/80 transition-colors border border-slate-200/80"
              title="Back to Homepage"
            >
              <Home size={14} className="text-slate-500" />
              <span>Home</span>
            </Link>
            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
              Enterprise Admin Hub
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-slate-900 block">{user?.name || 'Super Admin'}</span>
              <span className="text-[10px] text-[#0057b8] font-medium">Administrator</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <button
              onClick={handleLogout}
              className="md:hidden p-1.5 text-slate-400 hover:text-red-600"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Mobile Nav Overlay Drawer */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="md:hidden fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer panel */}
            <div className="md:hidden fixed top-16 left-0 right-0 z-40 bg-white border-b border-slate-200 shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
              <div className="p-4 space-y-1">
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 mb-2 transition-colors"
                >
                  <Home className="w-4 h-4 mr-2 text-slate-600" />
                  <span>Back to Homepage</span>
                </Link>
                {links.map((link) => {
                  const isActive = location.pathname === link.path;
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                        isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {link.name}
                    </Link>
                  );
                })}
                <button
                  onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                  className="flex items-center w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer mt-1 border-t border-slate-100 pt-3"
                >
                  <LogOut className="w-4 h-4 mr-2 text-red-500" />
                  Sign Out
                </button>
              </div>
            </div>
          </>
        )}

        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

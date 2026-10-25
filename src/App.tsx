import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { FarmerDashboard } from './pages/FarmerDashboard';
import { BuyerDashboard } from './pages/BuyerDashboard';
import { FarmerProfile } from './pages/FarmerProfile';
import { MyProduce } from './pages/MyProduce';
import { AddProduce } from './pages/AddProduce';
import { ProduceDetails } from './pages/ProduceDetails';
import { BuyerRequests } from './pages/BuyerRequests';
import { BuyerOrders } from './pages/BuyerOrders';
import { BuyerNotifications } from './pages/BuyerNotifications';
import { BuyerProfile } from './pages/BuyerProfile';
import { SmartMatching } from './pages/SmartMatching';
import { LogisticsPage } from './pages/LogisticsPage';
import { RequestLogistics } from './pages/RequestLogistics';
import { FarmerRequests } from './pages/FarmerRequests';
import { FarmerOrders } from './pages/FarmerOrders';
import { FarmerNotifications } from './pages/FarmerNotifications';

import { MarketplaceProvider } from './context/MarketplaceContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminUserDetail } from './pages/admin/AdminUserDetail';
import { AdminProduce } from './pages/admin/AdminProduce';
import { AdminRequests } from './pages/admin/AdminRequests';
import { AdminOrders } from './pages/admin/AdminOrders';
import { AdminLogistics } from './pages/admin/AdminLogistics';
import { AdminDisputes } from './pages/admin/AdminDisputes';
import { AdminAnalytics } from './pages/admin/AdminAnalytics';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminAuditLogs } from './pages/admin/AdminAuditLogs';

// Protected Route Guard
const ProtectedRoute = ({
  children,
  allowedRole
}: {
  children: React.ReactNode;
  allowedRole?: 'Farmer' | 'Buyer' | 'Admin' | 'farmer' | 'buyer' | 'admin';
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role.toLowerCase() !== allowedRole.toLowerCase()) {
    const r = user.role.toLowerCase();
    if (r === 'admin') return <Navigate to="/admin" replace />;
    if (r === 'farmer') return <Navigate to="/farmer-dashboard" replace />;
    return <Navigate to="/buyer-dashboard" replace />;
  }

  return <>{children}</>;
};

// Public Route (redirects to respective dashboard if already authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user) {
    const r = user.role.toLowerCase();
    if (r === 'admin') return <Navigate to="/admin" replace />;
    if (r === 'farmer') return <Navigate to="/farmer-dashboard" replace />;
    return <Navigate to="/buyer-dashboard" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <MarketplaceProvider>
        <Router>
          <Routes>
            {/* Public Entry Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

            {/* Admin Management Routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRole="Admin"><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:id" element={<AdminUserDetail />} />
              <Route path="farmers" element={<AdminUsers roleFilter="Farmer" />} />
              <Route path="buyers" element={<AdminUsers roleFilter="Buyer" />} />
              <Route path="produce" element={<AdminProduce />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="logistics" element={<AdminLogistics />} />
              <Route path="disputes" element={<AdminDisputes />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="audit-logs" element={<AdminAuditLogs />} />
            </Route>

            {/* Farmer Role Routes */}
            <Route path="/farmer-dashboard" element={<ProtectedRoute allowedRole="Farmer"><FarmerDashboard /></ProtectedRoute>} />
            <Route path="/farmer/dashboard" element={<ProtectedRoute allowedRole="Farmer"><FarmerDashboard /></ProtectedRoute>} />
            <Route path="/farmer/produce" element={<ProtectedRoute allowedRole="Farmer"><MyProduce /></ProtectedRoute>} />
            <Route path="/farmer/produce/new" element={<ProtectedRoute allowedRole="Farmer"><AddProduce /></ProtectedRoute>} />
            <Route path="/farmer/produce/add" element={<ProtectedRoute allowedRole="Farmer"><AddProduce /></ProtectedRoute>} />
            <Route path="/farmer/produce/:id/edit" element={<ProtectedRoute allowedRole="Farmer"><AddProduce /></ProtectedRoute>} />
            <Route path="/farmer/requests" element={<ProtectedRoute allowedRole="Farmer"><FarmerRequests /></ProtectedRoute>} />
            <Route path="/farmer/orders" element={<ProtectedRoute allowedRole="Farmer"><FarmerOrders /></ProtectedRoute>} />
            <Route path="/farmer/notifications" element={<ProtectedRoute allowedRole="Farmer"><FarmerNotifications /></ProtectedRoute>} />
            <Route path="/farmer/profile" element={<ProtectedRoute allowedRole="Farmer"><FarmerProfile /></ProtectedRoute>} />

            {/* Buyer Role Routes */}
            <Route path="/buyer-dashboard" element={<ProtectedRoute allowedRole="Buyer"><BuyerDashboard /></ProtectedRoute>} />
            <Route path="/buyer/dashboard" element={<ProtectedRoute allowedRole="Buyer"><BuyerDashboard /></ProtectedRoute>} />
            <Route path="/matching" element={<ProtectedRoute allowedRole="Buyer"><SmartMatching /></ProtectedRoute>} />
            <Route path="/buyer/requests" element={<ProtectedRoute allowedRole="Buyer"><BuyerRequests /></ProtectedRoute>} />
            <Route path="/buyer/orders" element={<ProtectedRoute allowedRole="Buyer"><BuyerOrders /></ProtectedRoute>} />
            <Route path="/buyer/notifications" element={<ProtectedRoute allowedRole="Buyer"><BuyerNotifications /></ProtectedRoute>} />
            <Route path="/buyer/profile" element={<ProtectedRoute allowedRole="Buyer"><BuyerProfile /></ProtectedRoute>} />
            <Route path="/produce/:id" element={<ProtectedRoute allowedRole="Buyer"><ProduceDetails /></ProtectedRoute>} />

            {/* Shared Logistics Routes */}
            <Route path="/logistics" element={<ProtectedRoute><LogisticsPage /></ProtectedRoute>} />
            <Route path="/logistics/request" element={<ProtectedRoute allowedRole="Buyer"><RequestLogistics /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </MarketplaceProvider>
    </AuthProvider>
  );
}

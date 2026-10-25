import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck, Tractor, Users, ArrowLeft, Check } from 'lucide-react';
import { Logo } from '../components/Logo';
import { motion, AnimatePresence } from 'motion/react';

export const Login = () => {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState(location.state?.message || '');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDemoRole, setSelectedDemoRole] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleDemoFill = (demoEmail: string, demoPass: string, roleName: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setSelectedDemoRole(roleName);
    setError('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      setIsLoading(true);
      console.log('LOGIN: start', { email });
      console.log('LOGIN: calling login()');
      const user = await login(email, password);
      console.log('LOGIN: login() returned user:', user.email, 'role:', user.role);
      const r = user.role?.toLowerCase();
      console.log('LOGIN: navigation started', { role: r });
      if (r === 'admin') {
        navigate('/admin');
      } else if (r === 'farmer') {
        navigate('/farmer-dashboard');
      } else if (r === 'buyer') {
        navigate('/buyer-dashboard');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error('LOGIN: error caught:', err);
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-body relative overflow-hidden selection:bg-brand-100 selection:text-brand-900">
      {/* Subtle Background Glows */}
      <div className="absolute top-0 right-1/3 w-96 h-96 bg-[#15803d]/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-[#0057b8]/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Back to Home Link */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-8 z-20">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-200/50"
        >
          <ArrowLeft size={14} />
          <span>Back to Home</span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>
        <h2 className="text-center text-2xl sm:text-3xl font-sans font-bold text-slate-950 tracking-tight">
          Welcome back
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 font-normal">
          Sign in to access your agricultural dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200/90 rounded-2xl">
          
          {/* Quick Demo Switcher */}
          <div className="mb-6 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#0057b8]" /> Quick Demo Accounts
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Click to fill</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('farmer@gmail.com', 'farmer', 'Farmer')}
                className={`py-2 px-2.5 rounded-lg border text-center transition-all flex flex-col items-center ${
                  selectedDemoRole === 'Farmer'
                    ? 'border-[#15803d] bg-emerald-50 text-[#15803d]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Tractor size={15} className="mb-1 text-[#15803d]" />
                <span className="text-xs font-bold leading-tight">Farmer</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('buyer@gmail.com', 'buyer', 'Buyer')}
                className={`py-2 px-2.5 rounded-lg border text-center transition-all flex flex-col items-center ${
                  selectedDemoRole === 'Buyer'
                    ? 'border-[#0057b8] bg-blue-50 text-[#0057b8]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Users size={15} className="mb-1 text-[#0057b8]" />
                <span className="text-xs font-bold leading-tight">Buyer</span>
              </button>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <AnimatePresence>
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800"
                >
                  <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{successMsg}</span>
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-2.5 text-xs text-red-800"
                >
                  <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. name@domain.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8] transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <span className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer">
                  Forgot password?
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-[#0057b8] hover:bg-[#003e8a] text-white transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500 font-normal">
              Don't have an account yet?{' '}
              <Link to="/register" className="font-semibold text-[#0057b8] hover:underline">
                Create an account
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

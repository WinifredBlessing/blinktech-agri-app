import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Check, AlertCircle, Tractor, Users, ArrowRight, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Logo';
import { motion, AnimatePresence } from 'motion/react';

export const Register = () => {
  const location = useLocation();
  const defaultRole = location.state?.role || 'Farmer';

  const [role, setRole] = useState<'Farmer' | 'Buyer'>(defaultRole as 'Farmer' | 'Buyer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [buyerType, setBuyerType] = useState('Individual');
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    try {
      setLoading(true);
      console.log('REGISTER: start', { email, role });
      const dbRole = role.toLowerCase() as 'farmer' | 'buyer';
      console.log('REGISTER: calling register()');
      await register(email, password, { 
        role: dbRole, 
        name, 
        phone,
        ...(role === 'Buyer' ? { buyerType } : {})
      });
      console.log('REGISTER: register() completed successfully, redirecting to login');
      navigate('/login', {
        state: {
          message: 'Account created successfully. Please sign in to continue.',
          email: email.trim().toLowerCase(),
        },
      });
    } catch (err: any) {
      console.error('REGISTER: error caught:', err);
      setError(err.message || 'Failed to create an account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-body relative overflow-hidden selection:bg-brand-100 selection:text-brand-900">
      {/* Subtle Background Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#15803d]/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#0057b8]/5 rounded-full blur-3xl pointer-events-none"></div>

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

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>
        <h2 className="text-center text-2xl sm:text-3xl font-sans font-bold text-slate-950 tracking-tight">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 font-normal">
          Join Nigeria's direct agricultural marketplace
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200/90 rounded-2xl">
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 border border-red-200 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-red-800"
                >
                  <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </motion.div>
              )}

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
            </AnimatePresence>

            {/* Role Selection Tabs */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                I want to join AgroLink as a:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('Farmer')}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    role === 'Farmer'
                      ? 'border-[#15803d] bg-emerald-50/60 ring-2 ring-[#15803d]/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      role === 'Farmer' ? 'bg-[#15803d] text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Tractor size={16} />
                    </div>
                    {role === 'Farmer' && (
                      <span className="w-4 h-4 rounded-full bg-[#15803d] text-white flex items-center justify-center">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 font-sans">Farmer</h4>
                    <p className="text-xs text-slate-500 mt-0.5">I grow & sell farm produce</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('Buyer')}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    role === 'Buyer'
                      ? 'border-[#0057b8] bg-blue-50/60 ring-2 ring-[#0057b8]/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      role === 'Buyer' ? 'bg-[#0057b8] text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Users size={16} />
                    </div>
                    {role === 'Buyer' && (
                      <span className="w-4 h-4 rounded-full bg-[#0057b8] text-white flex items-center justify-center">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 font-sans">Buyer</h4>
                    <p className="text-xs text-slate-500 mt-0.5">I buy produce in bulk</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Form Fields in 2 columns on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name / Business Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ibrahim Bello or Green Farms Ltd"
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0801 234 5678"
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8] transition-all"
                />
              </div>

              {role === 'Buyer' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Buyer Category
                  </label>
                  <select
                    value={buyerType}
                    onChange={(e) => setBuyerType(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8] transition-all"
                  >
                    <option value="Individual">Individual Commercial Buyer</option>
                    <option value="Wholesaler / Retailer">Wholesaler / Retailer</option>
                    <option value="Food Processor">Food Processor / Mill</option>
                    <option value="Restaurant / Hotel">Restaurant / Hotel / Hospitality</option>
                    <option value="Exporter">Exporter / Agro-Allied</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8] transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-[#0057b8] hover:bg-[#003e8a] text-white transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500 font-normal">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#0057b8] hover:underline">
                Sign In
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

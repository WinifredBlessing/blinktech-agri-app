import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Save, AlertCircle, CheckCircle2, User, Building, MapPin, Phone, Mail } from 'lucide-react';
import { BuyerHeader } from '../components/BuyerHeader';
import { motion } from 'motion/react';

export const BuyerProfile = () => {
  const { user, updateProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    buyerType: user?.buyerType || '',
    organization: user?.organization || '',
    location: user?.location || '',
    address: user?.address || ''
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setSuccess(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      await updateProfile(formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      <BuyerHeader />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-slate-950">Commercial Buyer Profile</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">Manage your procurement enterprise information and default logistics delivery destination.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50">
            <div className="w-16 h-16 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-2xl font-sans shrink-0">
              {user?.name?.charAt(0) || 'B'}
            </div>
            <div>
              <h2 className="text-lg font-sans font-bold text-slate-950">{user?.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="bg-blue-50 text-[#0057b8] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-200">
                  {user?.role} Account
                </span>
                {user?.buyerType && (
                  <span className="text-xs text-slate-500 font-medium">
                    &bull; {user.buyerType}
                  </span>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl flex items-start gap-2 border border-red-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="font-medium">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-emerald-50 text-[#15803d] p-3 rounded-xl flex items-start gap-2 border border-emerald-200 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Profile information updated successfully!</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <User size={13} /> Representative Details
                </h3>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>
              </div>

              {/* Organization Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Building size={13} /> Organization & Delivery
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Buyer Category</label>
                  <select
                    name="buyerType"
                    value={formData.buyerType}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  >
                    <option value="">Select Category</option>
                    <option value="Commercial Wholesaler">Commercial Wholesaler</option>
                    <option value="Food Processing Facility">Food Processing Facility</option>
                    <option value="Retail Supermarket Chain">Retail Supermarket Chain</option>
                    <option value="Hospitality & Institutional Catering">Hospitality & Institutional Catering</option>
                    <option value="Agricultural Exporter">Agricultural Exporter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Organization / Business Name</label>
                  <input
                    type="text"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    placeholder="e.g. Apex Agri Millers Ltd"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State / Central City</label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="e.g. Abuja, FCT"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Warehouse Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="e.g. Industrial Park, Phase II"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-[#0057b8] hover:bg-[#003e8a] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {loading ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

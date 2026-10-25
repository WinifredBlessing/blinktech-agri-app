import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import { FarmerHeader } from '../components/FarmerHeader';
import { BuyerHeader } from '../components/BuyerHeader';
import {
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Package,
  Award,
  ArrowLeft,
  Edit2,
  X,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProduceCard } from '../components/ProduceCard';
import { PaymentSettlement } from '../components/PaymentSettlement';

export const FarmerProfile = () => {
  const { id } = useParams();
  const { user, updateProfile } = useAuth();
  const { farmers, produceList, updateFarmer } = useMarketplace();

  const farmerId = id || user?.id || 'f1';
  const isOwnProfile = user?.id === farmerId;
  const isFarmerUser = user?.role === 'Farmer';

  const cachedFarmer = farmers.find((f) => f.id === farmerId);

  // If viewing own profile, user context from Supabase is the primary authoritative source of truth
  const farmer = isOwnProfile && user
    ? {
        id: user.id,
        name: user.name || 'Farmer',
        farmName: user.farmName || (user.name ? `${user.name}'s Farm` : 'Green Harvest Farm'),
        photo: cachedFarmer?.photo || '',
        phone: user.phone || cachedFarmer?.phone || '',
        state: user.state || user.location || cachedFarmer?.state || 'Kano',
        city: user.city || cachedFarmer?.city || '',
        lga: user.lga || cachedFarmer?.lga || '',
        description: user.description || cachedFarmer?.description || 'Commercial farm producing quality maize and grain harvests for processors and bulk buyers across Nigeria.',
        experience: user.experience || cachedFarmer?.experience || '5+ years',
        categories: cachedFarmer?.categories || ['Grains', 'Legumes'],
        status: user.status || cachedFarmer?.status || 'Active'
      }
    : (cachedFarmer || {
        id: farmerId,
        name: user?.name || 'Musa Ibrahim',
        farmName: user?.farmName || 'Green Harvest Farm',
        photo: '',
        phone: user?.phone || '0803 123 4567',
        state: user?.state || user?.location || 'Kano',
        city: user?.city || 'Kano',
        lga: user?.lga || 'Nassarawa',
        description: user?.description || 'Commercial farm producing quality maize and grain harvests for processors and bulk buyers across Nigeria.',
        experience: user?.experience || '5+ years',
        categories: ['Grains', 'Legumes'],
        status: 'Active'
      });

  const farmerProduce = produceList.filter((p) => p.farmerId === farmerId);

  const [showEditModal, setShowEditModal] = useState(false);
  const [farmName, setFarmName] = useState(farmer.farmName);
  const [description, setDescription] = useState(farmer.description);
  const [phone, setPhone] = useState(farmer.phone);
  const [experience, setExperience] = useState(farmer.experience || '5+ years');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Synchronize edit modal fields with authoritative profile data when not actively editing
  useEffect(() => {
    if (!showEditModal) {
      setFarmName(farmer.farmName || '');
      setDescription(farmer.description || '');
      setPhone(farmer.phone || '');
      setExperience(farmer.experience || '5+ years');
    }
  }, [farmer.farmName, farmer.description, farmer.phone, farmer.experience, showEditModal]);

  const handleOpenEdit = () => {
    setFarmName(farmer.farmName || '');
    setDescription(farmer.description || '');
    setPhone(farmer.phone || '');
    setExperience(farmer.experience || '5+ years');
    setSaveError(null);
    setShowEditModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    const trimmedExperience = experience.trim();

    try {
      if (isOwnProfile) {
        // updateProfile now throws if the DB write fails — so success message
        // is only shown after the database confirms the update.
        await updateProfile({
          farmName: farmName.trim(),
          phone: phone.trim(),
          description: description.trim(),
          experience: trimmedExperience || undefined,
        });
      }

      // Keep the in-memory farmer cache consistent with the saved values so
      // the page reflects the new data immediately without waiting for the next
      // loadRealFarmers call.
      updateFarmer(farmerId, {
        name: farmer.name || user?.name || 'Farmer',
        farmName: farmName.trim(),
        description: description.trim(),
        phone: phone.trim(),
        experience: trimmedExperience || '5+ years'
      });

      setShowEditModal(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Failed to update farmer profile:', err);
      setSaveError(err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      {isFarmerUser ? <FarmerHeader /> : <BuyerHeader />}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
        
        {!isOwnProfile && (
          <Link
            to="/buyer-dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Marketplace
          </Link>
        )}

        {saveSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-[#15803d] font-semibold shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#15803d] shrink-0" />
              <span>Profile updated successfully! Your farm information has been saved.</span>
            </div>
            <button
              onClick={() => setSaveSuccess(false)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer p-1"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Farmer Profile Hero Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#15803d] flex items-center justify-center font-bold text-2xl shrink-0 overflow-hidden shadow-xs">
                {farmer.photo ? (
                  <img src={farmer.photo} alt={farmer.name || 'Farmer'} className="w-full h-full object-cover" />
                ) : (
                  (farmer?.name || user?.name || 'Farmer').charAt(0)
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-sans font-bold text-slate-950">{farmer.farmName}</h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[#15803d] text-[10px] font-bold uppercase tracking-wider">
                    <ShieldCheck size={12} /> Verified Producer
                  </span>
                </div>

                <p className="text-xs font-semibold text-slate-700">{farmer.name}</p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-slate-400" /> {farmer.city || farmer.state}, {farmer.state} State
                  </span>
                  <span className="flex items-center gap-1">
                    <Award size={13} className="text-slate-400" /> {farmer.experience || '5+ years'} farming experience
                  </span>
                </div>
              </div>
            </div>

            {isOwnProfile && (
              <button
                onClick={handleOpenEdit}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Edit2 size={13} /> Edit Profile
              </button>
            )}
          </div>

          {/* Description & Contact Details */}
          <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div className="md:col-span-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">About This Farm</h4>
              <p className="text-slate-600 leading-relaxed font-normal">
                {farmer.description || 'Dedicated to sustainable crop production, quality seed grading, and reliable wholesale bulk supply for food processors.'}
              </p>
            </div>

            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Direct Contact Details</h4>
              <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Phone size={13} className="text-[#15803d]" /> {farmer.phone || '0803 123 4567'}
              </p>
              <p className="font-medium text-slate-600 flex items-center gap-1.5">
                <Mail size={13} className="text-[#0057b8]" /> {farmer.id}@agrolink.ng
              </p>
            </div>
          </div>
        </div>

        {/* Payment & Settlement — own profile only */}
        {isOwnProfile && (
          <div className="mb-8">
            <PaymentSettlement />
          </div>
        )}

        {/* Harvest Listings by this Farmer */}
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-sans font-bold text-slate-950">
              Harvest Listings by {farmer.farmName}
            </h2>
            <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
              {farmerProduce.length} available listings
            </span>
          </div>

          {farmerProduce.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs max-w-md mx-auto">
              <Package size={32} className="mx-auto text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">No produce listings yet</h3>
              <p className="text-xs text-slate-500 mb-4">This farmer currently has no active harvests in the marketplace.</p>
              {isOwnProfile && (
                <Link
                  to="/farmer/produce/add"
                  className="px-4 py-2 bg-[#15803d] text-white rounded-lg text-xs font-semibold"
                >
                  Add Your First Harvest
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {farmerProduce.map((prod) => (
                <ProduceCard key={prod.id} produce={prod} />
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setShowEditModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative z-10 border border-slate-200"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-base font-sans font-bold text-slate-900">Edit Farm Profile</h3>
                <button onClick={() => setShowEditModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {saveError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700 font-medium">
                    <AlertCircle size={15} className="shrink-0 text-red-600 mt-0.5" />
                    <span>{saveError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Farm Name
                  </label>
                  <input
                    type="text"
                    required
                    value={farmName}
                    onChange={(e) => setFarmName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Farming Experience
                  </label>
                  <input
                    type="text"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Farm Description
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] resize-none"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2 bg-[#15803d] hover:bg-[#166534] disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

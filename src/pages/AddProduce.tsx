import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Upload, X, AlertCircle, Info, Leaf, ImageIcon, MapPin, CheckCircle2 } from 'lucide-react';
import { FarmerHeader } from '../components/FarmerHeader';
import { motion, AnimatePresence } from 'motion/react';
import { compressImageFile, compressDataUrlIfNeeded } from '../utils/imageCompression';
import { storageService } from '../services/storageService';

export const AddProduce = () => {
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { addProduce, updateProduce, produceList } = useMarketplace();
  const { user } = useAuth();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef<boolean>(false);
  // Stable client-generated listing UUID reused for recovery and duplicate prevention
  const submissionIdRef = useRef<string>(crypto.randomUUID());

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    unit: 'Kg',
    availableQuantity: '',
    status: 'Available' as 'Available' | 'Low Stock' | 'Out of Stock',
    location: user?.location || '',
  });

  const [images, setImages] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [compressingImage, setCompressingImage] = useState(false);

  useEffect(() => {
    if (isEditing && id) {
      const existingProduct = produceList.find(p => p.id === id);
      if (existingProduct) {
        if (existingProduct.farmerId !== user?.id) {
          navigate('/farmer/produce');
          return;
        }
        setFormData({
          name: existingProduct.name,
          category: existingProduct.category,
          description: existingProduct.description,
          price: existingProduct.price.toString(),
          unit: existingProduct.unit || 'Kg',
          availableQuantity: existingProduct.availableQuantity.toString(),
          status: (existingProduct.status === 'Limited' ? 'Low Stock' : existingProduct.status) as any,
          location: existingProduct.location,
        });
        if (existingProduct.images && existingProduct.images.length > 0) {
          setImages(existingProduct.images);
        } else if (existingProduct.image) {
          setImages([existingProduct.image]);
        }
      } else {
        navigate('/farmer/produce');
      }
    }
  }, [id, isEditing, produceList, user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > 5) {
      setErrors(prev => ({ ...prev, image: 'Maximum 5 images allowed' }));
      return;
    }

    setCompressingImage(true);
    const t0 = performance.now();

    try {
      const fileList = Array.from(files);
      const compressedList = await Promise.all(
        fileList.map(file => compressImageFile(file))
      );

      const validCompressed = compressedList.filter(Boolean);
      setImages(prev => [...prev, ...validCompressed]);
      if (errors.image) {
        setErrors(prev => ({ ...prev, image: '' }));
      }

      if (import.meta.env.DEV) {
        console.log(
          `[DevTiming] Image selection & compression took ${(performance.now() - t0).toFixed(2)}ms for ${files.length} file(s)`
        );
      }
    } catch (err: any) {
      console.error('Image compression error:', err);
      setErrors(prev => ({ ...prev, image: 'Failed to process selected image(s). Please try another file.' }));
    } finally {
      setCompressingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Produce name is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) <= 0) newErrors.price = 'Valid price is required';
    if (!formData.unit) newErrors.unit = 'Unit is required';
    if (!formData.availableQuantity || isNaN(Number(formData.availableQuantity)) || Number(formData.availableQuantity) < 0) newErrors.availableQuantity = 'Valid quantity is required';
    if (!formData.location.trim()) newErrors.location = 'Location is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Immediate synchronous in-flight guard to prevent duplicate concurrent submissions
    if (isSubmittingRef.current || loading || compressingImage) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setErrors(prev => {
      const { submit, ...rest } = prev;
      return rest;
    });

    const submitStartTime = performance.now();
    console.log(`[AddProduce] 1. Form submitted. Name: "${formData.name}", Category: "${formData.category}", Images: ${images.length}`);

    try {
      // Ensure any lingering uncompressed data URLs are compressed
      const imgT0 = performance.now();
      const processedImages = await Promise.all(
        images.map(img => compressDataUrlIfNeeded(img))
      );
      console.log(`[AddProduce] 2. Images prepared in ${(performance.now() - imgT0).toFixed(1)}ms. Count: ${processedImages.length}`);

      const listingId = isEditing ? id! : submissionIdRef.current;

      // Upload newly added images (Base64 data URLs) to Supabase Storage
      const uploadT0 = performance.now();
      const finalImages = await Promise.all(
        processedImages.map(async (img, idx) => {
          if (img.startsWith('data:image/')) {
            console.log(`[AddProduce] Uploading image ${idx + 1}/${processedImages.length} to storage...`);
            const uploadResult = await storageService.uploadProduceImage(img, user!.id, listingId, idx);
            return uploadResult.publicUrl;
          }
          // Already an external or storage URL, or unchanged legacy URL
          return img;
        })
      );
      console.log(`[AddProduce] 3. Images stored in ${(performance.now() - uploadT0).toFixed(1)}ms. Count: ${finalImages.length}`);

      const productData = {
        ...formData,
        id: listingId,
        price: Number(formData.price),
        availableQuantity: Number(formData.availableQuantity),
        farmerId: user!.id,
        farmerName: user!.farmName || user!.name,
        images: finalImages,
        image: finalImages[0] || undefined
      };

      console.log(`[AddProduce] 4. Calling ${isEditing ? 'updateProduce' : 'addProduce'} (id: ${productData.id})...`);
      const addT0 = performance.now();

      if (isEditing && id) {
        await updateProduce(id, productData);
      } else {
        await addProduce(productData);
      }

      console.log(`[AddProduce] 5. Store updated in ${(performance.now() - addT0).toFixed(1)}ms`);

      // Reset submission token upon confirmed success for future listings
      submissionIdRef.current = crypto.randomUUID();

      console.log(`[AddProduce] 6. Success! Total duration: ${(performance.now() - submitStartTime).toFixed(1)}ms. Navigating to /farmer/produce...`);
      navigate('/farmer/produce');
    } catch (error: any) {
      console.error("[AddProduce] Submission error caught:", error);
      setErrors(prev => ({ ...prev, submit: error?.message || "Failed to save produce. Please try again." }));
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
      console.log(`[AddProduce] 7. Loading state reset in finally block.`);
    }
  };

  const categories = [
    'Grains & Cereals',
    'Tubers & Roots',
    'Fruits & Vegetables',
    'Livestock & Poultry',
    'Spices & Herbs',
    'Oils & Fats',
    'Cash Crops',
    'Other'
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-body pb-20 selection:bg-brand-100 selection:text-brand-900">
      <FarmerHeader />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
        
        <div className="mb-6">
          <Link to="/farmer/produce" className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 mb-3 transition-colors">
            <ArrowLeft size={14} className="mr-1" /> Back to Produce Inventory
          </Link>
          <h1 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-slate-950">
            {isEditing ? 'Edit Produce Listing' : 'Add New Produce Listing'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
            Provide harvest specifications to attract certified commercial buyers.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.submit && (
            <div className="bg-red-50 p-3.5 rounded-xl border border-red-200 flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <p className="font-medium">{errors.submit}</p>
            </div>
          )}

          {/* Basic Information */}
          <section className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/90">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-5">
              <Info size={14} /> Basic Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Produce Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Premium White Maize"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border ${errors.name ? 'border-red-300' : 'border-slate-200'} rounded-xl text-slate-900 font-medium text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-600 font-medium">{errors.name}</p>}
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border ${errors.category ? 'border-red-300' : 'border-slate-200'} rounded-xl text-slate-900 font-medium text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]`}
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-xs text-red-600 font-medium">{errors.category}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Describe moisture content, harvest date, packaging specifications..."
                  className={`w-full px-3.5 py-2 bg-slate-50 border ${errors.description ? 'border-red-300' : 'border-slate-200'} rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] resize-none`}
                />
                {errors.description && <p className="mt-1 text-xs text-red-600 font-medium">{errors.description}</p>}
              </div>
            </div>
          </section>

          {/* Product Images */}
          <section className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/90">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-4">
              <ImageIcon size={14} /> Product Images
            </h2>
            
            <div>
              <p className="text-xs text-slate-500 mb-3">Upload clear photos of your harvest to attract high-volume buyers (max 5 images).</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-2">
                <AnimatePresence>
                  {images.map((img, index) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      key={index} 
                      className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group"
                    >
                      <img src={img} alt={`Produce ${index + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {images.length < 5 && (
                  <button
                    type="button"
                    disabled={compressingImage || loading}
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 flex flex-col items-center justify-center text-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {compressingImage ? (
                      <div className="w-5 h-5 border-2 border-slate-300 border-t-[#15803d] rounded-full animate-spin" />
                    ) : (
                      <>
                        <Upload size={18} className="text-slate-400 mb-1" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Add Photo</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/jpeg, image/png, image/jpg"
                multiple
                className="hidden"
              />
              {errors.image && <p className="mt-1 text-xs text-red-600 font-medium">{errors.image}</p>}
            </div>
          </section>

          {/* Inventory & Pricing */}
          <section className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/90">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-5">
              <Leaf size={14} /> Inventory & Pricing
            </h2>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Available Stock</label>
                <input
                  type="number"
                  name="availableQuantity"
                  value={formData.availableQuantity}
                  onChange={handleChange}
                  placeholder="e.g. 5000"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border ${errors.availableQuantity ? 'border-red-300' : 'border-slate-200'} rounded-xl text-slate-900 font-medium text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]`}
                />
                {errors.availableQuantity && <p className="mt-1 text-xs text-red-600 font-medium">{errors.availableQuantity}</p>}
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measurement</label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]"
                >
                  <option value="Kg">Kg</option>
                  <option value="Bags (100kg)">Bags (100kg)</option>
                  <option value="Bags (50kg)">Bags (50kg)</option>
                  <option value="Tonnes">Tonnes</option>
                  <option value="Crates">Crates</option>
                  <option value="Tubers">Tubers</option>
                  <option value="Baskets">Baskets</option>
                  <option value="Pieces">Pieces</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₦ Per Unit)</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="e.g. 650"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border ${errors.price ? 'border-red-300' : 'border-slate-200'} rounded-xl text-slate-900 font-medium text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]`}
                />
                {errors.price && <p className="mt-1 text-xs text-red-600 font-medium">{errors.price}</p>}
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Availability Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]"
                >
                  <option value="Available">Available</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>
            </div>
            
            {formData.price && formData.unit && !errors.price && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-[#15803d]">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>
                  Buyers will see: <strong className="font-bold">₦{Number(formData.price).toLocaleString()} per {formData.unit.toLowerCase()}</strong>
                </span>
              </div>
            )}
          </section>

          {/* Location */}
          <section className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/90">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-4">
              <MapPin size={14} /> Farm Location
            </h2>
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Farm Origin (State / Region)</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. Kano, Nigeria"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border ${errors.location ? 'border-red-300' : 'border-slate-200'} rounded-xl text-slate-900 font-medium text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]`}
              />
              {errors.location && <p className="mt-1 text-xs text-red-600 font-medium">{errors.location}</p>}
            </div>
          </section>

          {/* Error Feedback Banner */}
          {errors.submit && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700 font-medium">
              <AlertCircle size={16} className="shrink-0 text-red-600" />
              <span>{errors.submit}</span>
            </div>
          )}

          {/* Submit Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              disabled={loading || compressingImage}
              onClick={() => navigate('/farmer/produce')}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-opacity"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || compressingImage}
              className="px-6 py-2.5 bg-[#15803d] hover:bg-[#166534] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-opacity"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{isEditing ? 'Saving Changes...' : 'Publishing Listing...'}</span>
                </>
              ) : (
                <span>{isEditing ? 'Save Changes' : 'Publish Listing'}</span>
              )}
            </button>
          </div>
          
        </form>
      </main>
    </div>
  );
};

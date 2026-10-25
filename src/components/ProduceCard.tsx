import React from 'react';
import { Link } from 'react-router-dom';
import { Produce } from '../types';
import { MapPin, Package, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface ProduceCardProps {
  produce: Produce;
  onRequest?: (produce: Produce) => void;
}

export const ProduceCard: React.FC<ProduceCardProps> = ({ produce, onRequest }) => {
  const isOutOfStock = produce.status === 'Out of Stock' || produce.availableQuantity <= 0;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group"
    >
      <div>
        {/* Image Container */}
        <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden">
          {produce.image ? (
            <img
              src={produce.image}
              alt={produce.name}
              className={`w-full h-full object-cover group-hover:scale-104 transition-transform duration-300 ${
                isOutOfStock ? 'grayscale opacity-60' : ''
              }`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
              <Package size={32} />
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-2.5 left-2.5">
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded shadow-xs ${
                produce.status === 'Available'
                  ? 'bg-emerald-50 text-[#15803d] border border-emerald-200'
                  : produce.status === 'Limited'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {produce.status}
            </span>
          </div>

          {/* Category Pill */}
          <div className="absolute top-2.5 right-2.5">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-white/90 backdrop-blur-xs text-slate-700 border border-slate-200 shadow-xs">
              {produce.category}
            </span>
          </div>
        </div>

        {/* Card Details */}
        <div className="p-4">
          <h3 className="font-bold text-sm sm:text-base text-slate-950 line-clamp-1 mb-1 group-hover:text-[#0057b8] transition-colors">
            {produce.name}
          </h3>

          <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mb-3">
            <MapPin size={12} className="text-slate-400 shrink-0" />
            <span className="truncate">{produce.location || 'Nigeria'}</span>
          </p>

          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-lg font-sans font-extrabold text-slate-900">
              ₦{produce.price.toLocaleString()}
            </span>
            <span className="text-xs font-normal text-slate-500">/{produce.unit || 'kg'}</span>
          </div>

          <div className="space-y-1 pt-2.5 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-[11px]">Stock</span>
              <span className={`font-semibold ${isOutOfStock ? 'text-red-500' : 'text-slate-800'}`}>
                {produce.availableQuantity.toLocaleString()} {produce.unit || 'kg'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-[11px]">Farmer</span>
              <span className="font-medium text-slate-700 truncate max-w-[130px]">
                {produce.farmerName || 'Verified Farm'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 pt-0 flex gap-2">
        <Link
          to={`/produce/${produce.id}`}
          className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold text-center transition-colors"
        >
          Details
        </Link>
        {onRequest && !isOutOfStock ? (
          <button
            onClick={() => onRequest(produce)}
            className="flex-1 py-2 bg-[#0057b8] hover:bg-[#003e8a] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Request
          </button>
        ) : (
          <Link
            to={`/produce/${produce.id}`}
            className="flex-1 py-2 bg-[#0057b8] hover:bg-[#003e8a] text-white rounded-lg text-xs font-semibold text-center transition-colors"
          >
            Request
          </Link>
        )}
      </div>
    </motion.div>
  );
};

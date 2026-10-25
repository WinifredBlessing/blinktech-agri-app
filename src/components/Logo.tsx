import React from 'react';
import { Link } from 'react-router-dom';

interface LogoProps {
  className?: string;
  linkTo?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  linkTo = '/',
  showTagline = false,
  size = 'md',
  variant = 'light'
}) => {
  const sizeClasses = {
    sm: { img: 'h-8 sm:h-9 w-auto', title: 'text-base sm:text-lg', sub: 'text-[9px] sm:text-[10px]' },
    md: { img: 'h-8 sm:h-10 w-auto', title: 'text-base sm:text-xl', sub: 'text-[9px] sm:text-[10px]' },
    lg: { img: 'h-8 sm:h-10 md:h-11 w-auto', title: 'text-lg sm:text-xl md:text-2xl', sub: 'text-[10px] sm:text-xs' },
    xl: { img: 'h-12 sm:h-16 w-auto', title: 'text-xl sm:text-3xl', sub: 'text-xs sm:text-sm' }
  };

  const currentSize = sizeClasses[size];
  const isDark = variant === 'dark';

  return (
    <Link
      to={linkTo}
      className={`inline-flex items-center gap-2 sm:gap-3 shrink min-w-0 group select-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057b8]/30 rounded-xl ${className}`}
      aria-label="Blink Tech AgroLink Home"
    >
      {/* Visual Emblem */}
      <div className="relative shrink-0 flex items-center justify-center">
        <img
          src="/logo.jpg"
          alt="Blink Tech AgroLink Logo"
          className={`${currentSize.img} rounded-xl object-contain shadow-xs border ${
            isDark ? 'border-slate-800 bg-white/95' : 'border-slate-200/80 bg-white'
          } group-hover:scale-[1.03] transition-transform duration-200`}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      <div className="flex flex-col justify-center min-w-0">
        <div className={`font-sans font-black tracking-tight leading-none ${currentSize.title} flex items-center`}>
          <span className={isDark ? 'text-blue-400' : 'text-[#0057b8]'}>AGRO</span>
          <span className={isDark ? 'text-emerald-400' : 'text-[#15803d]'}>LINK</span>
        </div>
        {showTagline ? (
          <span className={`font-semibold tracking-wider uppercase mt-1 truncate ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          } ${currentSize.sub}`}>
            BlinkTech Agro Marketplace
          </span>
        ) : (
          <span className={`font-medium tracking-normal mt-0.5 truncate hidden min-[360px]:inline-block ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          } ${currentSize.sub}`}>
            Agricultural Marketplace
          </span>
        )}
      </div>
    </Link>
  );
};


import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  className?: string;
}

export const RippleButton: React.FC<RippleButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  onClick,
  ...props
}) => {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();

      setRipples((prev) => [...prev, { x, y, id }]);

      // Remove ripple after animation
      setTimeout(() => {
        setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
      }, 600); // match animation duration
    }

    if (onClick) {
      onClick(e);
    }
  };

  const baseStyles = "relative overflow-hidden inline-flex items-center justify-center font-bold transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-600/20",
    secondary: "bg-slate-900 text-white hover:bg-slate-800 shadow-md",
    outline: "bg-transparent text-slate-900 border border-slate-200 hover:border-slate-300 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900"
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ top: ripple.y, left: ripple.x, scale: 0, opacity: 0.5 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 pointer-events-none"
            style={{ width: '100px', height: '100px' }}
          />
        ))}
      </AnimatePresence>
    </button>
  );
};

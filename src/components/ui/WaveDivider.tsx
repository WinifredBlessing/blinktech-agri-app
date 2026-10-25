import React from 'react';
import { motion } from 'motion/react';

interface WaveDividerProps {
  position?: 'top' | 'bottom';
  className?: string;
  fill?: string;
}

export const WaveDivider: React.FC<WaveDividerProps> = ({ 
  position = 'bottom',
  className = '',
  fill = '#ffffff'
}) => {
  return (
    <div className={`absolute left-0 w-full overflow-hidden leading-[0] ${position === 'top' ? 'top-0 rotate-180' : 'bottom-0'} ${className}`}>
      <svg 
        data-name="Layer 1" 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 1200 120" 
        preserveAspectRatio="none"
        className="relative block w-[calc(100%+1.3px)] h-[60px] md:h-[120px]"
      >
        <motion.path 
          d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" 
          fill={fill}
          initial={{ d: "M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" }}
          animate={{ d: [
            "M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z",
            "M321.39,36.44c58,10.79,114.16,30.13,172,41.86,82.39,16.72,168.19,17.73,250.45,.39C823.78,51,906.67,32,985.66,12.83c70.05-18.48,146.53-26.09,214.34-3V0H0V27.35A600.21,600.21,0,0,0,321.39,36.44Z",
            "M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
          ]}}
          transition={{ duration: 15, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
        />
      </svg>
    </div>
  );
};

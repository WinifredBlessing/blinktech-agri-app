import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView, useSpring, useTransform } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 2000,
  format = (val) => val.toLocaleString(),
  className = ""
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  
  const springValue = useSpring(0, {
    stiffness: 50,
    damping: 20,
    duration: duration,
  });

  useEffect(() => {
    if (isInView) {
      springValue.set(value);
    }
  }, [isInView, value, springValue]);

  const [displayValue, setDisplayValue] = useState(format(0));

  useEffect(() => {
    return springValue.on("change", (latest) => {
      setDisplayValue(format(Math.floor(latest)));
    });
  }, [springValue, format]);

  return (
    <motion.span ref={ref} className={className}>
      {displayValue}
    </motion.span>
  );
};

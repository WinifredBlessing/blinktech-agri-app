import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export const DashboardCard = ({ title, value, icon, subtitle }: DashboardCardProps) => {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-agri-border shadow-sm flex flex-col justify-between h-full hover:shadow-lg transition-all group cursor-pointer hover:-translate-y-1">
      <div className="flex justify-between items-start mb-6">
        <div className="w-14 h-14 bg-agri-bg rounded-2xl text-agri-text flex items-center justify-center group-hover:bg-agri-green group-hover:text-white transition-colors duration-300">
          {icon}
        </div>
      </div>
      <div>
        <div className="text-xs text-agri-muted font-bold uppercase tracking-widest mb-2">{title}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold text-agri-text tracking-tight group-hover:text-agri-green transition-colors">{value}</span>
          {subtitle && <span className="text-sm font-bold text-agri-muted uppercase tracking-wider">{subtitle}</span>}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Bell, Search, Info } from 'lucide-react';
import { Activity } from '../types';

export const ActivityItem = ({ activity }: { activity: Activity; key?: React.Key }) => {
  const getIcon = () => {
    switch (activity.type) {
      case 'interest':
      case 'new_produce':
        return <Search size={20} className="text-blue-600" />;
      case 'order_update':
        return <Bell size={20} className="text-agri-green" />;
      case 'availability':
      case 'profile':
      case 'new_farmer':
      default:
        return <Info size={20} className="text-orange-600" />;
    }
  };

  const getBgColor = () => {
    switch (activity.type) {
      case 'interest':
      case 'new_produce':
        return 'bg-blue-50';
      case 'order_update':
        return 'bg-agri-green-light/50';
      case 'availability':
      case 'profile':
      case 'new_farmer':
      default:
        return 'bg-orange-50';
    }
  };

  return (
    <div className="flex gap-5 p-5 hover:bg-agri-bg rounded-[1.5rem] transition-colors border-b border-agri-border last:border-0 group cursor-default">
      <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 ${getBgColor()} group-hover:scale-110 transition-transform`}>
        {getIcon()}
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <h4 className="text-base font-bold text-agri-text">{activity.title}</h4>
        <p className="text-sm text-agri-muted mt-1 font-medium">{activity.description}</p>
        <span className="text-xs font-bold text-slate-400 mt-2 block tracking-wider uppercase">{activity.timeAgo}</span>
      </div>
    </div>
  );
};

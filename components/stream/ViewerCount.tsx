import React from 'react';
import { Eye } from 'lucide-react';

interface ViewerCountProps {
  count: number;
  showIcon?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  isLive?: boolean;
}

export const ViewerCount: React.FC<ViewerCountProps> = ({
  count,
  showIcon = true,
  label = 'viewers',
  size = 'md',
  isLive = true,
}) => {
  const formattedCount = new Intl.NumberFormat('en-US').format(count);

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-all duration-300 ${
        isLive
          ? 'bg-white/10 text-slate-200 border border-white/10'
          : 'bg-white/5 text-slate-400 border border-transparent'
      } ${
        size === 'sm'
          ? 'px-2 py-0.5 text-xs'
          : size === 'lg'
          ? 'px-3 py-1.5 text-base font-semibold'
          : 'px-2.5 py-1 text-sm'
      }`}
    >
      {showIcon && (
        <Eye
          className={`${
            size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
          } ${isLive ? 'text-rose-400' : 'text-slate-500'}`}
        />
      )}
      <span className="font-semibold text-white tracking-wide">{formattedCount}</span>
      {label && <span className="text-slate-400 text-xs font-normal">{count === 1 ? 'viewer' : label}</span>}
    </div>
  );
};

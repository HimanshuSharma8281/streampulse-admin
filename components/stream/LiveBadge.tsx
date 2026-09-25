import React from 'react';

interface LiveBadgeProps {
  status: 'live' | 'offline' | 'starting' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

export const LiveBadge: React.FC<LiveBadgeProps> = ({ status, size = 'md' }) => {
  if (status === 'live') {
    return (
      <div
        className={`inline-flex items-center gap-2 font-bold uppercase tracking-wider rounded-md bg-rose-600/90 text-white shadow-lg shadow-rose-600/30 ${
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
        </span>
        LIVE
      </div>
    );
  }

  if (status === 'starting') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider rounded-md bg-amber-500/80 text-white shadow ${
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        STARTING
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider rounded-md bg-slate-800 text-slate-400 border border-slate-700/60 ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
      OFFLINE
    </div>
  );
};

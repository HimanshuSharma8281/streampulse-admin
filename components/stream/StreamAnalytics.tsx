'use client';

import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, Clock, MessageSquare, Activity } from 'lucide-react';
import { StreamStats } from '@/lib/types';

interface StreamAnalyticsProps {
  stats: StreamStats;
  isLive: boolean;
  startedAt: string | null;
}

export const StreamAnalytics: React.FC<StreamAnalyticsProps> = ({
  stats,
  isLive,
  startedAt,
}) => {
  const [duration, setDuration] = useState<number>(0);

  useEffect(() => {
    if (!isLive || !startedAt) {
      setDuration(0);
      return;
    }

    const interval = setInterval(() => {
      const startTime = new Date(startedAt).getTime();
      const diffSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      setDuration(diffSec);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive, startedAt]);

  const formatDuration = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <div className="bg-[#151824] border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
          <span>Current Viewers</span>
          <Users className="w-4 h-4 text-rose-400" />
        </div>
        <div className="text-2xl font-bold text-white tracking-tight">
          {stats.currentViewers.toLocaleString()}
        </div>
        <div className="text-[11px] text-rose-400/90 font-medium mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          Realtime Presence
        </div>
      </div>

      <div className="bg-[#151824] border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
          <span>Peak Viewers</span>
          <TrendingUp className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-2xl font-bold text-white tracking-tight">
          {stats.peakViewers.toLocaleString()}
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          All-time stream high
        </div>
      </div>

      <div className="bg-[#151824] border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
          <span>Stream Uptime</span>
          <Clock className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-2xl font-bold text-white tracking-tight font-mono">
          {formatDuration(duration)}
        </div>
        <div className="text-[11px] text-emerald-400/90 mt-1">
          {isLive ? 'Broadcasting now' : 'Stream offline'}
        </div>
      </div>

      <div className="bg-[#151824] border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
          <span>Total Unique</span>
          <Activity className="w-4 h-4 text-sky-400" />
        </div>
        <div className="text-2xl font-bold text-white tracking-tight">
          {stats.totalUniqueViewers.toLocaleString()}
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          Unique sessions
        </div>
      </div>

      <div className="bg-[#151824] border border-white/10 rounded-xl p-3.5 flex flex-col justify-between col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
          <span>Chat Messages</span>
          <MessageSquare className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="text-2xl font-bold text-white tracking-tight">
          {stats.messagesCount.toLocaleString()}
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          Total chat activity
        </div>
      </div>
    </div>
  );
};

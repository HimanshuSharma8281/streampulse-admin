'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, LogOut, ExternalLink } from 'lucide-react';
import { LiveBadge } from '../stream/LiveBadge';

interface AdminNavbarProps {
  isLive: boolean;
  onLogout: () => void;
}

export const AdminNavbar: React.FC<AdminNavbarProps> = ({ isLive, onLogout }) => {
  return (
    <header className="sticky top-0 z-50 bg-[#0d0f17]/95 backdrop-blur-md border-b border-indigo-500/20 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-rose-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">
                STREAMER<span className="text-indigo-400">STUDIO</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                ADMIN
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Live Broadcast & Moderation Control Center</p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <LiveBadge status={isLive ? 'live' : 'offline'} size="sm" />

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all active:scale-95"
            title="Log out from Streamer Studio"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};

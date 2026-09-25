'use client';

import React, { useState } from 'react';
import {
  Play,
  Square,
  Radio,
  Mic,
  Volume2,
  Edit3,
  Check,
  Tag,
} from 'lucide-react';
import { LiveBadge } from '../stream/LiveBadge';

interface StreamControlsProps {
  isLive: boolean;
  title: string;
  description: string;
  category: string;
  includeAudio: boolean;
  includeMic: boolean;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (desc: string) => void;
  onCategoryChange: (cat: string) => void;
  onAudioChange: (include: boolean) => void;
  onMicChange: (include: boolean) => void;
  onStartStream: () => void;
  onStopStream: () => void;
  onUpdateMetadata: () => void;
  isLoading?: boolean;
}

const CATEGORIES = [
  'Sports & Live Action',
  'Gaming & Esports',
  'Software & Coding',
  'Crypto & Markets',
  'Education & Tutorials',
  'Just Chatting & Events',
];

export const StreamControls: React.FC<StreamControlsProps> = ({
  isLive,
  title,
  description,
  category,
  includeAudio,
  includeMic,
  onTitleChange,
  onDescriptionChange,
  onCategoryChange,
  onAudioChange,
  onMicChange,
  onStartStream,
  onStopStream,
  onUpdateMetadata,
  isLoading = false,
}) => {
  const [hasUpdated, setHasUpdated] = useState(false);

  const handleUpdate = () => {
    onUpdateMetadata();
    setHasUpdated(true);
    setTimeout(() => setHasUpdated(false), 2000);
  };

  return (
    <div className="bg-[#12141c] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center">
            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Stream Control Center</h3>
            <p className="text-[11px] text-slate-400">Broadcast screen & configure live metadata</p>
          </div>
        </div>

        <LiveBadge status={isLive ? 'live' : 'offline'} size="md" />
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Stream Title</span>
            <span className="text-[11px] text-slate-500 font-normal">{title.length}/100</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            maxLength={100}
            placeholder="e.g. Football Live — English Commentary"
            className="w-full bg-[#181b26] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/60 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-indigo-400" />
              <span>Category</span>
            </label>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="w-full bg-[#181b26] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500/60 transition-all"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Audio Source Setup
            </label>
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={includeAudio}
                  onChange={(e) => onAudioChange(e.target.checked)}
                  className="rounded bg-slate-900 border-white/20 text-rose-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                <span>System Audio</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={includeMic}
                  onChange={(e) => onMicChange(e.target.checked)}
                  className="rounded bg-slate-900 border-white/20 text-rose-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <Mic className="w-3.5 h-3.5 text-slate-400" />
                <span>Microphone</span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Stream Description
          </label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Tell viewers what you are broadcasting..."
            className="w-full bg-[#181b26] border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/60 transition-all resize-none"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        {!isLive ? (
          <button
            type="button"
            onClick={onStartStream}
            disabled={isLoading}
            className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-bold text-sm tracking-wide shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>START LIVE STREAM</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onStopStream}
              disabled={isLoading}
              className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-slate-800 hover:bg-rose-950/80 text-rose-300 hover:text-rose-100 border border-rose-500/30 hover:border-rose-500 font-bold text-sm tracking-wide shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>STOP LIVE STREAM</span>
            </button>

            <button
              type="button"
              onClick={handleUpdate}
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              {hasUpdated ? <Check className="w-4 h-4 text-emerald-400" /> : <Edit3 className="w-4 h-4" />}
              <span>{hasUpdated ? 'Updated!' : 'Update Info'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import { Trash2, Clock, Crown, Ban, Shield } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '@/lib/types';

interface ChatMessageProps {
  message: ChatMessageType;
  onDelete?: (messageId: string) => void;
  onTimeout?: (userId: string, username: string) => void;
  onBan?: (userId: string, username: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onDelete,
  onTimeout,
  onBan,
}) => {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isDeleted = message.is_deleted;

  return (
    <div className={`group relative flex items-start gap-2.5 px-3 py-2 rounded-xl transition-colors hover:bg-white/[0.04] ${
      isDeleted ? 'opacity-50' : ''
    }`}>
      <div className="mt-0.5 flex-shrink-0">
        {message.role === 'admin' ? (
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-sm" title="Broadcaster / Admin">
            <Crown className="w-3.5 h-3.5" />
          </div>
        ) : message.role === 'moderator' ? (
          <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center text-white" title="Moderator">
            <Shield className="w-3.5 h-3.5" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400 text-[10px] font-bold">
            {message.username.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 pr-12">
        <div className="flex items-baseline gap-1.5 flex-wrap mb-0.5">
          <span
            className={`text-xs font-semibold truncate ${
              message.role === 'admin'
                ? 'text-rose-400 font-bold'
                : message.role === 'moderator'
                ? 'text-emerald-400 font-bold'
                : 'text-slate-300'
            }`}
          >
            {message.username}
          </span>

          {message.role === 'admin' && (
            <span className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Admin
            </span>
          )}

          <span className="text-[10px] text-slate-400 font-mono">{time}</span>
        </div>

        <p className={`text-xs sm:text-sm break-words leading-relaxed ${
          isDeleted ? 'text-slate-400 italic' : 'text-slate-100'
        }`}>
          {message.message}
        </p>
      </div>

      {/* Admin Moderation Actions */}
      {!isDeleted && message.role !== 'admin' && (
        <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-[#1a1d28] border border-white/10 rounded-lg p-1 shadow-lg z-10">
          {onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
              title="Delete message"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          {onTimeout && (
            <button
              onClick={() => onTimeout(message.user_id, message.username)}
              className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-white/10 transition-colors"
              title="Timeout user (60s)"
            >
              <Clock className="w-3 h-3" />
            </button>
          )}
          {onBan && (
            <button
              onClick={() => onBan(message.user_id, message.username)}
              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-white/10 transition-colors"
              title="Ban user from chat"
            >
              <Ban className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

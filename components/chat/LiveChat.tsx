'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, ArrowDown, Sparkles, Trash2, Bell, AlertTriangle } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '@/lib/types';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { getSocket } from '@/lib/socket/socketClient';

interface LiveChatProps {
  streamId?: string;
  initialMessages?: ChatMessageType[];
}

export const LiveChat: React.FC<LiveChatProps> = ({
  streamId = 'main-stream',
  initialMessages = [],
}) => {
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages);
  const [systemNotices, setSystemNotices] = useState<string[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on('chat:new-message', (msg: ChatMessageType) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('chat:message-deleted', (data: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, is_deleted: true, message: 'This message was removed by a moderator.' }
            : m
        )
      );
    });

    socket.on('chat:cleared', () => {
      setMessages([]);
      setSystemNotices((prev) => [...prev, 'Chat was cleared by the broadcaster.']);
    });

    socket.on('chat:system-notice', (data: { notice: string }) => {
      setSystemNotices((prev) => [...prev.slice(-4), data.notice]);
    });

    socket.on('chat:error', (data: { message: string }) => {
      setChatError(data.message);
      setTimeout(() => setChatError(null), 4000);
    });

    return () => {
      socket.off('chat:new-message');
      socket.off('chat:message-deleted');
      socket.off('chat:cleared');
      socket.off('chat:system-notice');
      socket.off('chat:error');
    };
  }, []);

  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, systemNotices, autoScroll]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAutoScroll(isAtBottom);
    setShowScrollBottom(!isAtBottom);
  };

  const scrollToBottom = () => {
    setAutoScroll(true);
    setShowScrollBottom(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (text: string) => {
    const socket = getSocket();
    socket.emit('chat:send-message', {
      stream_id: streamId,
      user_id: 'admin_broadcaster',
      username: 'Broadcaster (Host)',
      role: 'admin',
      message: text,
    });
  };

  const handleDeleteMessage = (messageId: string) => {
    const socket = getSocket();
    socket.emit('chat:delete-message', { messageId });
  };

  const handleTimeoutUser = (targetUserId: string, targetUsername: string) => {
    const socket = getSocket();
    socket.emit('chat:timeout-user', {
      userId: targetUserId,
      username: targetUsername,
      durationSeconds: 60,
    });
  };

  const handleBanUser = (targetUserId: string, targetUsername: string) => {
    const socket = getSocket();
    socket.emit('chat:ban-user', {
      userId: targetUserId,
      username: targetUsername,
      reason: 'Banned by admin',
    });
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear all chat messages for everyone?')) {
      const socket = getSocket();
      socket.emit('chat:clear-chat');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#12141c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 bg-[#151824] border-b border-white/10">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-rose-400" />
          <span className="font-bold text-sm text-white tracking-wide">CHAT MODERATION</span>
          <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">
            {messages.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleClearChat}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-rose-400 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            title="Clear all chat messages"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {chatError && (
        <div className="px-3 py-1.5 bg-rose-500/20 border-b border-rose-500/30 flex items-center gap-2 text-xs text-rose-300 animate-fade-in">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
          <span>{chatError}</span>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-1 relative"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <Sparkles className="w-8 h-8 text-rose-500/40 mb-2 animate-bounce" />
            <p className="text-sm font-semibold text-slate-300">Live Chat Channel</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
              Viewer chat will stream here in real time. Hover over messages to delete, timeout, or ban.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onDelete={handleDeleteMessage}
              onTimeout={handleTimeoutUser}
              onBan={handleBanUser}
            />
          ))
        )}

        {systemNotices.map((notice, idx) => (
          <div
            key={idx}
            className="my-1.5 px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] flex items-center gap-1.5"
          >
            <Bell className="w-3 h-3 flex-shrink-0" />
            <span>{notice}</span>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {showScrollBottom && (
        <div className="absolute bottom-20 right-6 z-20">
          <button
            onClick={scrollToBottom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-semibold shadow-lg hover:bg-rose-500 transition-all animate-bounce"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>New messages</span>
          </button>
        </div>
      )}

      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
};

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AdminNavbar } from '@/components/ui/AdminNavbar';
import { ScreenShare } from '@/components/video/ScreenShare';
import { StreamControls } from '@/components/video/StreamControls';
import { StreamAnalytics } from '@/components/stream/StreamAnalytics';
import { LiveChat } from '@/components/chat/LiveChat';
import { WebRTCBroadcaster } from '@/lib/streaming/WebRTCBroadcaster';
import { getSocket } from '@/lib/socket/socketClient';
import { StreamStats } from '@/lib/types';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  const [title, setTitle] = useState('Football Live — English Commentary & Match Analysis');
  const [description, setDescription] = useState(
    'Broadcasting live high-definition screen and commentary. Join the real-time chat and enjoy the stream!'
  );
  const [category, setCategory] = useState('Sports & Live Action');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeMic, setIncludeMic] = useState(false);

  const [isLive, setIsLive] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [stats, setStats] = useState<StreamStats>({
    currentViewers: 0,
    peakViewers: 0,
    totalUniqueViewers: 0,
    streamDuration: 0,
    messagesCount: 0,
  });

  const broadcasterRef = useRef<WebRTCBroadcaster | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = sessionStorage.getItem('admin_token');
        const res = await fetch('/api/admin/verify', {
          headers: token ? { 'x-admin-token': token } : {},
        });

        if (!res.ok) {
          const statusRes = await fetch('/api/admin/status');
          const statusData = await statusRes.json();
          if (statusData.setupRequired) {
            router.replace('/setup');
          } else {
            router.replace('/login');
          }
          return;
        }

        setIsAuthenticated(true);
        setIsVerifying(false);

        const socket = getSocket();
        socket.emit('admin:auth', { token });
      } catch (e) {
        router.replace('/login');
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetch('/api/stream/state')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setTitle(data.title || title);
          setDescription(data.description || description);
          setCategory(data.category || category);
          setIsLive(data.status === 'live');
          setStartedAt(data.started_at || null);
          setStats((prev) => ({
            ...prev,
            currentViewers: data.current_viewers || 0,
            peakViewers: data.peak_viewers || 0,
            totalUniqueViewers: data.total_unique_viewers || 0,
            messagesCount: data.messagesCount || 0,
          }));
        }
      })
      .catch(() => {});

    const socket = getSocket();

    socket.on('stream:viewer-count', (data: { current: number; peak: number; totalUnique: number }) => {
      setStats((prev) => ({
        ...prev,
        currentViewers: data.current,
        peakViewers: data.peak,
        totalUniqueViewers: data.totalUnique || prev.totalUniqueViewers,
      }));
    });

    socket.on('chat:new-message', () => {
      setStats((prev) => ({ ...prev, messagesCount: prev.messagesCount + 1 }));
    });

    socket.on('admin:error', (err: { message: string }) => {
      setCaptureError(err.message);
    });

    return () => {
      socket.off('stream:viewer-count');
      socket.off('chat:new-message');
      socket.off('admin:error');
    };
  }, [isAuthenticated]);

  const handleStartStream = async () => {
    setCaptureError(null);
    setIsLoading(true);

    try {
      const broadcaster = new WebRTCBroadcaster(() => {
        handleStopStream();
      });

      const mediaStream = await broadcaster.startScreenCapture(includeAudio, includeMic);
      setScreenStream(mediaStream);
      broadcasterRef.current = broadcaster;

      const socket = getSocket();
      socket.emit('broadcaster:start', {
        title,
        description,
        category,
      });

      setIsLive(true);
      setStartedAt(new Date().toISOString());
    } catch (err: any) {
      console.error('Failed to start stream:', err);
      setCaptureError(err.message || 'Failed to capture screen.');
      if (broadcasterRef.current) {
        broadcasterRef.current.stop();
        broadcasterRef.current = null;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopStream = () => {
    if (broadcasterRef.current) {
      broadcasterRef.current.stop();
      broadcasterRef.current = null;
    }
    setScreenStream(null);
    setIsLive(false);

    const socket = getSocket();
    socket.emit('broadcaster:stop');
  };

  const handleUpdateMetadata = () => {
    const socket = getSocket();
    socket.emit('broadcaster:update-info', {
      title,
      description,
      category,
    });
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {}
    sessionStorage.removeItem('admin_token');
    router.replace('/login');
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-xs text-slate-400">Verifying Admin Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] flex flex-col selection:bg-indigo-500">
      <AdminNavbar isLive={isLive} onLogout={handleLogout} />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6">
        <StreamAnalytics stats={stats} isLive={isLive} startedAt={startedAt} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <ScreenShare
              stream={screenStream}
              isLive={isLive}
              error={captureError}
              onRetry={handleStartStream}
            />

            <StreamControls
              isLive={isLive}
              title={title}
              description={description}
              category={category}
              includeAudio={includeAudio}
              includeMic={includeMic}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
              onCategoryChange={setCategory}
              onAudioChange={setIncludeAudio}
              onMicChange={setIncludeMic}
              onStartStream={handleStartStream}
              onStopStream={handleStopStream}
              onUpdateMetadata={handleUpdateMetadata}
              isLoading={isLoading}
            />
          </div>

          <div className="lg:col-span-4 h-[640px] sticky top-20">
            <LiveChat streamId="main-stream" />
          </div>
        </div>
      </main>
    </div>
  );
}

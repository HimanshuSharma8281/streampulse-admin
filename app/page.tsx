'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AdminNavbar } from '@/components/ui/AdminNavbar';
import { ScreenShare } from '@/components/video/ScreenShare';
import { StreamControls } from '@/components/video/StreamControls';
import { StreamAnalytics } from '@/components/stream/StreamAnalytics';
import { LiveChat } from '@/components/chat/LiveChat';
import { WebRTCBroadcaster } from '@/lib/streaming/WebRTCBroadcaster';
import { getSocket } from '@/lib/socket/socketClient';
import { StreamStats } from '@/lib/types';

export default function AdminDashboardPage() {
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

  // Setup Socket Telemetry and Stream State
  useEffect(() => {
    const socket = getSocket();

    // Fetch current stream state from server
    const serverUrl = process.env.NEXT_PUBLIC_STREAM_SERVER_URL || '';
    const stateEndpoint = serverUrl ? `${serverUrl.replace(/\/+$/, '')}/api/stream/state` : '/api/stream/state';

    fetch(stateEndpoint)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.title) {
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

    socket.on('stream:init', (data: any) => {
      if (data?.stream) {
        setIsLive(data.stream.status === 'live');
        setStartedAt(data.stream.started_at || null);
      }
    });

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

    return () => {
      socket.off('stream:init');
      socket.off('stream:viewer-count');
      socket.off('chat:new-message');
    };
  }, [title, description, category]);

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

  return (
    <div className="min-h-screen bg-[#090a0f] flex flex-col selection:bg-indigo-500">
      <AdminNavbar isLive={isLive} />

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

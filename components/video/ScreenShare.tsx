'use client';

import React, { useRef, useEffect } from 'react';
import { Monitor, Volume2, VolumeX, AlertCircle, CheckCircle2, Activity } from 'lucide-react';
import { BroadcasterDiagnostics } from '@/lib/streaming/WebRTCBroadcaster';

interface ScreenShareProps {
  stream: MediaStream | null;
  isLive: boolean;
  error?: string | null;
  diagnostics?: BroadcasterDiagnostics | null;
  onRetry?: () => void;
}

export const ScreenShare: React.FC<ScreenShareProps> = ({
  stream,
  error,
  diagnostics,
  onRetry,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const videoTracks = stream ? stream.getVideoTracks() : [];
  const audioTracks = stream ? stream.getAudioTracks() : [];
  const hasAudioTrack = audioTracks.length > 0;
  const videoTrack = videoTracks[0] || null;
  const settings = videoTrack ? videoTrack.getSettings() : null;
  const resolution = settings?.width ? `${settings.width}x${settings.height}` : '720p/1080p';
  const frameRate = diagnostics?.fps || (settings?.frameRate ? Math.round(settings.frameRate) : 30);

  return (
    <div className="relative w-full aspect-video bg-[#000000] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center group">
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
        />
      )}

      {!stream && !error && (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-slate-400 group-hover:text-rose-400 group-hover:scale-105 transition-all">
            <Monitor className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Screen Capture Preview</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Click &quot;Start Live Stream&quot; below. Make sure to check <strong>&quot;Share audio&quot;</strong> in your browser dialog if you want viewers to hear screen sound.
          </p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-rose-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mb-3 text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white mb-1">Screen Capture Error</h4>
          <p className="text-xs text-rose-200/90 max-w-sm mb-4 leading-relaxed">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-xl bg-white text-rose-900 text-xs font-bold shadow hover:bg-slate-100 transition-transform active:scale-95"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {stream && (
        <>
          {/* Top Status Bar */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
            <div className="flex items-center gap-2 pointer-events-auto">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/90 text-white text-xs font-bold tracking-wide shadow">
                <CheckCircle2 className="w-3.5 h-3.5" />
                CAPTURER ACTIVE
              </span>

              <span className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-slate-200 border border-white/10 text-xs font-medium">
                Video: {videoTracks.length} track ({resolution} @ {frameRate}fps)
              </span>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              {hasAudioTrack ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/80 backdrop-blur-md text-emerald-300 border border-emerald-500/40 text-xs font-semibold shadow">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  Audio: {audioTracks.length} track (Active)
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/80 backdrop-blur-md text-amber-300 border border-amber-500/40 text-xs font-semibold shadow"
                  title="No audio track captured. Check 'Share audio' in browser prompt."
                >
                  <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                  Audio: 0 tracks (No system audio captured)
                </span>
              )}
            </div>
          </div>

          {/* Bottom Telemetry Bar */}
          {diagnostics && diagnostics.bitrateKbps > 0 && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 pointer-events-auto z-10 bg-black/70 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-[11px] font-mono text-slate-300">
              <Activity className="w-3 h-3 text-indigo-400" />
              <span>Bitrate: {(diagnostics.bitrateKbps / 1000).toFixed(1)} Mbps</span>
              <span className="text-slate-600">|</span>
              <span>FPS: {diagnostics.fps}</span>
              <span className="text-slate-600">|</span>
              <span>WebRTC Peers: {diagnostics.activeViewersCount}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

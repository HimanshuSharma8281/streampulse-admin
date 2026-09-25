'use client';

import { getSocket } from '../socket/socketClient';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 2,
};

export interface BroadcasterDiagnostics {
  fps: number;
  width: number;
  height: number;
  bitrateKbps: number;
  activeViewersCount: number;
  videoTracksCount: number;
  audioTracksCount: number;
  hasAudio: boolean;
  audioLabel?: string;
}

export class WebRTCBroadcaster {
  private localStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private onEndedCallback?: () => void;
  private onDiagnosticsCallback?: (stats: BroadcasterDiagnostics) => void;
  private statsInterval: NodeJS.Timeout | null = null;
  private prevBytesSent: Map<string, { bytes: number; timestamp: number }> = new Map();

  constructor(
    onEnded?: () => void,
    onDiagnostics?: (stats: BroadcasterDiagnostics) => void
  ) {
    this.onEndedCallback = onEnded;
    this.onDiagnosticsCallback = onDiagnostics;
    this.setupSocketListeners();
    this.startDiagnostics();
  }

  public async startScreenCapture(withAudio: boolean = true, includeMic: boolean = false): Promise<MediaStream> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen sharing is not supported by your browser.');
    }

    try {
      // 1. Request screen share with video and system audio constraints
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: withAudio
          ? {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            }
          : false,
      });

      // 2. Mix microphone audio if explicitly requested and mic is available
      if (includeMic) {
        try {
          this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });

          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          this.audioContext = new AudioCtxClass();
          const destination = this.audioContext.createMediaStreamDestination();

          // Mix screen system audio if present
          if (displayStream.getAudioTracks().length > 0) {
            const sysSource = this.audioContext.createMediaStreamSource(
              new MediaStream([displayStream.getAudioTracks()[0]])
            );
            sysSource.connect(destination);
          }

          // Mix microphone audio
          if (this.micStream.getAudioTracks().length > 0) {
            const micSource = this.audioContext.createMediaStreamSource(this.micStream);
            micSource.connect(destination);
          }

          const mixedAudioTrack = destination.stream.getAudioTracks()[0];
          if (mixedAudioTrack) {
            // Replace screen audio track with mixed track
            displayStream.getAudioTracks().forEach((t) => {
              t.stop();
              displayStream.removeTrack(t);
            });
            displayStream.addTrack(mixedAudioTrack);
          }
        } catch (micErr) {
          console.warn('[Broadcaster] Mic mixing error (proceeding with system audio only):', micErr);
        }
      }

      this.localStream = displayStream;

      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stop();
          if (this.onEndedCallback) {
            this.onEndedCallback();
          }
        };
      }

      console.log(
        `[Broadcaster] Captured Stream: Video Tracks: ${displayStream.getVideoTracks().length}, Audio Tracks: ${displayStream.getAudioTracks().length}`
      );

      return displayStream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Screen sharing permission was denied.');
      }
      throw err;
    }
  }

  private setupSocketListeners() {
    const socket = getSocket();

    socket.off('webrtc:new-viewer');
    socket.on('webrtc:new-viewer', async (data: { viewerSocketId: string }) => {
      const viewerSocketId = data.viewerSocketId;
      if (!this.localStream || !viewerSocketId) return;

      console.log(`[Broadcaster] Signaling request for new viewer: ${viewerSocketId}`);
      await this.initiatePeerConnection(viewerSocketId);
    });

    socket.off('webrtc:answer');
    socket.on('webrtc:answer', async (data: { answer: RTCSessionDescriptionInit; fromSocketId: string }) => {
      const pc = this.peerConnections.get(data.fromSocketId);
      if (pc && data.answer) {
        try {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            console.log(`[Broadcaster] Remote answer set successfully for viewer: ${data.fromSocketId}`);

            // Drain queued ICE candidates
            const pending = this.pendingCandidates.get(data.fromSocketId) || [];
            for (const cand of pending) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch((e) =>
                console.warn('[Broadcaster] Pending ICE candidate error:', e)
              );
            }
            this.pendingCandidates.delete(data.fromSocketId);
          }
        } catch (e) {
          console.error('[Broadcaster] Failed setting remote description:', e);
        }
      }
    });

    socket.off('webrtc:ice-candidate');
    socket.on('webrtc:ice-candidate', async (data: { candidate: RTCIceCandidateInit; fromSocketId: string }) => {
      const pc = this.peerConnections.get(data.fromSocketId);
      if (pc && data.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.error('[Broadcaster] Error adding ice candidate:', e);
          }
        } else {
          // Queue candidate until remote description is set
          const list = this.pendingCandidates.get(data.fromSocketId) || [];
          list.push(data.candidate);
          this.pendingCandidates.set(data.fromSocketId, list);
        }
      }
    });
  }

  private async initiatePeerConnection(viewerSocketId: string) {
    if (!this.localStream) return;

    // Close any previous connection for this viewer
    if (this.peerConnections.has(viewerSocketId)) {
      const oldPc = this.peerConnections.get(viewerSocketId);
      oldPc?.close();
      this.peerConnections.delete(viewerSocketId);
      this.pendingCandidates.delete(viewerSocketId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(viewerSocketId, pc);

    // 1. Add local tracks (Video + Audio)
    this.localStream.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream!);
      console.log(`[Broadcaster] Added track [${track.kind}] (${track.label}) to peer ${viewerSocketId}`);
    });

    // 2. Setup ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket().emit('webrtc:ice-candidate', {
          targetSocketId: viewerSocketId,
          candidate: event.candidate,
        });
      }
    };

    // 3. Monitor connection state
    pc.onconnectionstatechange = () => {
      console.log(`[Broadcaster] Connection state [${viewerSocketId}]: ${pc.connectionState}`);
      if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed'
      ) {
        this.peerConnections.delete(viewerSocketId);
        this.pendingCandidates.delete(viewerSocketId);
        pc.close();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Broadcaster] ICE connection state [${viewerSocketId}]: ${pc.iceConnectionState}`);
    };

    // 4. Create Offer & Optimize Sender Parameters
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });

      await pc.setLocalDescription(offer);

      // Optimize sender bitrate (3.5 Mbps target, 30fps max) to prevent lag and buffer bloat
      const senders = pc.getSenders();
      for (const sender of senders) {
        if (sender.track && sender.track.kind === 'video') {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 3500000; // 3.5 Mbps cap
            params.encodings[0].maxFramerate = 30; // 30 fps cap
            (params as any).degradationPreference = 'maintain-framerate';
            await sender.setParameters(params);
            console.log(`[Broadcaster] Sender parameters configured: 3.5 Mbps @ 30fps`);
          } catch (paramErr) {
            console.warn('[Broadcaster] Could not set sender parameters:', paramErr);
          }
        }
      }

      getSocket().emit('webrtc:offer', {
        targetSocketId: viewerSocketId,
        offer: pc.localDescription,
      });

      console.log(`[Broadcaster] Sent WebRTC offer to viewer: ${viewerSocketId}`);
    } catch (err) {
      console.error('[Broadcaster] Error creating/sending offer:', err);
    }
  }

  private startDiagnostics() {
    this.statsInterval = setInterval(async () => {
      if (!this.localStream || this.peerConnections.size === 0) {
        if (this.localStream && this.onDiagnosticsCallback) {
          const videoTrack = this.localStream.getVideoTracks()[0];
          const audioTrack = this.localStream.getAudioTracks()[0];
          const settings = videoTrack ? videoTrack.getSettings() : null;

          this.onDiagnosticsCallback({
            fps: settings?.frameRate ? Math.round(settings.frameRate) : 0,
            width: settings?.width || 0,
            height: settings?.height || 0,
            bitrateKbps: 0,
            activeViewersCount: 0,
            videoTracksCount: this.localStream.getVideoTracks().length,
            audioTracksCount: this.localStream.getAudioTracks().length,
            hasAudio: Boolean(audioTrack),
            audioLabel: audioTrack?.label,
          });
        }
        return;
      }

      let totalBitrateKbps = 0;
      let observedFps = 30;

      const pcEntries = Array.from(this.peerConnections.entries());
      for (const [viewerId, pc] of pcEntries) {
        try {
          const stats = await pc.getStats();
          const now = Date.now();

          stats.forEach((report) => {
            if (report.type === 'outbound-rtp' && report.kind === 'video') {
              const prev = this.prevBytesSent.get(viewerId);
              if (prev && report.bytesSent) {
                const deltaBytes = report.bytesSent - prev.bytes;
                const deltaTime = (now - prev.timestamp) / 1000;
                if (deltaTime > 0) {
                  const kbps = Math.round((deltaBytes * 8) / (deltaTime * 1000));
                  totalBitrateKbps += kbps;
                }
              }
              if (report.framesPerSecond) {
                observedFps = Math.round(report.framesPerSecond);
              }
              if (report.bytesSent) {
                this.prevBytesSent.set(viewerId, { bytes: report.bytesSent, timestamp: now });
              }
            }
          });
        } catch (e) {}
      }

      if (this.onDiagnosticsCallback && this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        const audioTrack = this.localStream.getAudioTracks()[0];
        const settings = videoTrack ? videoTrack.getSettings() : null;

        this.onDiagnosticsCallback({
          fps: observedFps || (settings?.frameRate ? Math.round(settings.frameRate) : 30),
          width: settings?.width || 1280,
          height: settings?.height || 720,
          bitrateKbps: totalBitrateKbps,
          activeViewersCount: this.peerConnections.size,
          videoTracksCount: this.localStream.getVideoTracks().length,
          audioTracksCount: this.localStream.getAudioTracks().length,
          hasAudio: Boolean(audioTrack),
          audioLabel: audioTrack?.label,
        });
      }
    }, 3000);
  }

  public stop(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.pendingCandidates.clear();
    this.prevBytesSent.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    getSocket().emit('broadcaster:stop');
  }
}

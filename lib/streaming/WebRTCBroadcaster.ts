'use client';

import { getSocket } from '../socket/socketClient';

function getIceServers(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrl && turnUrl.trim() !== '') {
    const rawUrls = turnUrl.split(',').map((u) => u.trim()).filter(Boolean);
    if (rawUrls.length > 0) {
      const turnEntry: RTCIceServer = {
        urls: rawUrls,
      };
      if (turnUsername && turnUsername.trim() !== '') {
        turnEntry.username = turnUsername.trim();
      }
      if (turnCredential && turnCredential.trim() !== '') {
        turnEntry.credential = turnCredential.trim();
      }
      iceServers.push(turnEntry);
    }
  }

  return {
    iceServers,
    iceCandidatePoolSize: 2,
    iceTransportPolicy: 'all',
  };
}

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
  selectedCandidateType?: string;
}

export class WebRTCBroadcaster {
  private localStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private attemptIds: Map<string, string> = new Map();
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
    socket.on('webrtc:new-viewer', async (data: { viewerSocketId: string; attemptId?: string }) => {
      const viewerSocketId = data.viewerSocketId;
      if (!this.localStream || !viewerSocketId) return;

      console.log(`[Broadcaster] Viewer joined: ${viewerSocketId} (attempt: ${data.attemptId || 'new'})`);
      await this.initiatePeerConnection(viewerSocketId, data.attemptId);
    });

    socket.off('webrtc:answer');
    socket.on('webrtc:answer', async (data: { answer: RTCSessionDescriptionInit; fromSocketId: string; attemptId?: string }) => {
      const pc = this.peerConnections.get(data.fromSocketId);
      const activeAttemptId = this.attemptIds.get(data.fromSocketId);

      // Verify attempt match if attemptId is provided
      if (data.attemptId && activeAttemptId && data.attemptId !== activeAttemptId) {
        console.warn(`[Broadcaster] Ignored stale answer from ${data.fromSocketId} (got: ${data.attemptId}, expected: ${activeAttemptId})`);
        return;
      }

      if (pc && data.answer) {
        try {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            console.log(`[Broadcaster] Answer received from ${data.fromSocketId}. Remote description set.`);

            // Drain queued ICE candidates
            const pending = this.pendingCandidates.get(data.fromSocketId) || [];
            for (const cand of pending) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch((e) =>
                console.warn('[Broadcaster] Pending ICE candidate error:', e)
              );
            }
            this.pendingCandidates.delete(data.fromSocketId);
          } else {
            console.warn(`[Broadcaster] Answer from ${data.fromSocketId} ignored because signalingState is ${pc.signalingState}`);
          }
        } catch (e) {
          console.error('[Broadcaster] Failed setting remote description:', e);
        }
      }
    });

    socket.off('webrtc:ice-candidate');
    socket.on('webrtc:ice-candidate', async (data: { candidate: RTCIceCandidateInit; fromSocketId: string; attemptId?: string }) => {
      const pc = this.peerConnections.get(data.fromSocketId);
      const activeAttemptId = this.attemptIds.get(data.fromSocketId);

      if (data.attemptId && activeAttemptId && data.attemptId !== activeAttemptId) {
        return; // Ignore stale ICE candidate
      }

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

  private async initiatePeerConnection(viewerSocketId: string, attemptId?: string) {
    if (!this.localStream) return;

    // 1. Clean up any existing connection for this viewer socket ID
    if (this.peerConnections.has(viewerSocketId)) {
      const oldPc = this.peerConnections.get(viewerSocketId);
      if (oldPc) {
        oldPc.onconnectionstatechange = null;
        oldPc.oniceconnectionstatechange = null;
        oldPc.onicegatheringstatechange = null;
        oldPc.onicecandidate = null;
        oldPc.close();
      }
      this.peerConnections.delete(viewerSocketId);
      this.pendingCandidates.delete(viewerSocketId);
    }

    const currentAttemptId = attemptId || `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.attemptIds.set(viewerSocketId, currentAttemptId);

    console.log(`[Broadcaster] Creating PeerConnection for ${viewerSocketId} (attempt: ${currentAttemptId})`);
    const pc = new RTCPeerConnection(getIceServers());
    this.peerConnections.set(viewerSocketId, pc);

    // 2. Add local tracks (Video + Audio)
    this.localStream.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream!);
      console.log(`[Broadcaster] Added track [${track.kind}] (${track.label}) to peer ${viewerSocketId}`);
    });

    // 3. Setup ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateStr = event.candidate.candidate || '';
        const candType = event.candidate.type || (candidateStr.includes('typ relay') ? 'relay' : candidateStr.includes('typ srflx') ? 'srflx' : 'host');
        const proto = event.candidate.protocol || (candidateStr.includes('udp') ? 'udp' : 'tcp');
        console.log(`[WebRTC] ICE candidate gathered: type=${candType}, proto=${proto}`);

        getSocket().emit('webrtc:ice-candidate', {
          targetSocketId: viewerSocketId,
          candidate: event.candidate,
          attemptId: currentAttemptId,
        });
      } else {
        console.log(`[WebRTC] ICE gathering complete for ${viewerSocketId}`);
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[WebRTC] ICE gathering state for ${viewerSocketId}: ${pc.iceGatheringState}`);
    };

    // 4. Monitor connection state
    pc.onconnectionstatechange = () => {
      console.log(`[Broadcaster] Connection state for ${viewerSocketId}: ${pc.connectionState}`);
      if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed'
      ) {
        setTimeout(() => {
          if (this.peerConnections.get(viewerSocketId) === pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) {
            this.peerConnections.delete(viewerSocketId);
            this.pendingCandidates.delete(viewerSocketId);
            this.attemptIds.delete(viewerSocketId);
            pc.close();
          }
        }, 3000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Broadcaster] ICE connection state for ${viewerSocketId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log(`[Broadcaster] ICE connected for ${viewerSocketId}`);
      }
    };

    // 5. Create Offer & Optimize Sender Parameters (3.5 Mbps @ 30fps)
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });

      await pc.setLocalDescription(offer);

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
          } catch (paramErr) {
            console.warn('[Broadcaster] Could not set sender parameters:', paramErr);
          }
        }
      }

      getSocket().emit('webrtc:offer', {
        targetSocketId: viewerSocketId,
        offer: pc.localDescription,
        attemptId: currentAttemptId,
      });

      console.log(`[Broadcaster] Offer sent to ${viewerSocketId} (attempt: ${currentAttemptId})`);
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
      let candidatePairType = 'direct';

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

            if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
              const localCand = stats.get(report.localCandidateId);
              const remoteCand = stats.get(report.remoteCandidateId);
              const localType = localCand?.candidateType || 'host';
              const remoteType = remoteCand?.candidateType || 'host';
              if (localType === 'relay' || remoteType === 'relay') {
                candidatePairType = 'TURN Relay';
              } else if (localType === 'srflx' || remoteType === 'srflx') {
                candidatePairType = 'STUN srflx';
              } else {
                candidatePairType = 'Direct P2P';
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
          selectedCandidateType: candidatePairType,
        });
      }
    }, 3000);
  }

  public stop(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    this.peerConnections.forEach((pc) => {
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onicegatheringstatechange = null;
      pc.onicecandidate = null;
      pc.close();
    });
    this.peerConnections.clear();
    this.attemptIds.clear();
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

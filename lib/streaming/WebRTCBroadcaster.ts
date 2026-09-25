'use client';

import { getSocket } from '../socket/socketClient';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCBroadcaster {
  private localStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private onEndedCallback?: () => void;

  constructor(onEnded?: () => void) {
    this.onEndedCallback = onEnded;
    this.setupSocketListeners();
  }

  public async startScreenCapture(withAudio: boolean = true, includeMic: boolean = false): Promise<MediaStream> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen sharing is not supported by your browser.');
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
        audio: withAudio,
      });

      if (includeMic) {
        try {
          this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const destination = audioContext.createMediaStreamDestination();

          if (displayStream.getAudioTracks().length > 0) {
            const sysSource = audioContext.createMediaStreamSource(new MediaStream([displayStream.getAudioTracks()[0]]));
            sysSource.connect(destination);
          }

          if (this.micStream.getAudioTracks().length > 0) {
            const micSource = audioContext.createMediaStreamSource(this.micStream);
            micSource.connect(destination);
          }

          const mixedAudioTrack = destination.stream.getAudioTracks()[0];
          displayStream.getAudioTracks().forEach(t => displayStream.removeTrack(t));
          if (mixedAudioTrack) {
            displayStream.addTrack(mixedAudioTrack);
          }
        } catch (micErr) {
          console.warn('[Broadcaster] Mic capture skipped:', micErr);
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
      await this.initiatePeerConnection(viewerSocketId);
    });

    socket.off('webrtc:answer');
    socket.on('webrtc:answer', async (data: { answer: RTCSessionDescriptionInit; fromSocketId: string }) => {
      const pc = this.peerConnections.get(data.fromSocketId);
      if (pc && data.answer) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (e) {
          console.error('[Broadcaster] Failed setting remote description:', e);
        }
      }
    });

    socket.off('webrtc:ice-candidate');
    socket.on('webrtc:ice-candidate', async (data: { candidate: RTCIceCandidateInit; fromSocketId: string }) => {
      const pc = this.peerConnections.get(data.fromSocketId);
      if (pc && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('[Broadcaster] Error adding ice candidate:', e);
        }
      }
    });
  }

  private async initiatePeerConnection(viewerSocketId: string) {
    if (!this.localStream) return;

    if (this.peerConnections.has(viewerSocketId)) {
      this.peerConnections.get(viewerSocketId)?.close();
      this.peerConnections.delete(viewerSocketId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(viewerSocketId, pc);

    this.localStream.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket().emit('webrtc:ice-candidate', {
          targetSocketId: viewerSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.peerConnections.delete(viewerSocketId);
        pc.close();
      }
    };

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      getSocket().emit('webrtc:offer', {
        targetSocketId: viewerSocketId,
        offer: pc.localDescription,
      });
    } catch (err) {
      console.error('[Broadcaster] Error creating offer:', err);
    }
  }

  public stop(): void {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    getSocket().emit('broadcaster:stop');
  }
}

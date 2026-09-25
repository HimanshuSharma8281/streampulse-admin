'use client';

import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === 'undefined') {
    return {} as Socket;
  }

  if (!socketInstance) {
    const serverUrl = process.env.NEXT_PUBLIC_STREAM_SERVER_URL || undefined;
    socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      autoConnect: true,
    });
  }

  return socketInstance;
}

'use client';

import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === 'undefined') {
    return {} as Socket;
  }

  if (!socketInstance) {
    const serverUrl = process.env.NEXT_PUBLIC_STREAM_SERVER_URL || '';
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const adminNamespaceUrl = cleanUrl ? `${cleanUrl}/admin` : '/admin';

    socketInstance = io(adminNamespaceUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      autoConnect: true,
    });
  }

  return socketInstance;
}

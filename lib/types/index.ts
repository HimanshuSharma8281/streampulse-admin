export type StreamStatus = 'offline' | 'live' | 'starting' | 'error';

export interface StreamInfo {
  id: string;
  title: string;
  description: string;
  category?: string;
  status: StreamStatus;
  started_at: string | null;
  ended_at: string | null;
  current_viewers: number;
  peak_viewers: number;
  total_unique_viewers: number;
  streamer_name: string;
}

export interface ChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  username: string;
  role: 'viewer' | 'admin' | 'moderator';
  message: string;
  created_at: string;
  is_deleted?: boolean;
}

export interface StreamStats {
  currentViewers: number;
  peakViewers: number;
  totalUniqueViewers: number;
  streamDuration: number;
  messagesCount: number;
}

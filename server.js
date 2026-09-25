const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3001', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const SECRET_FILE = path.join(process.cwd(), '.admin-secret.json');
const activeAdminTokens = new Set();

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function isSetupRequired() {
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim() !== '') {
    return false;
  }
  return !fs.existsSync(SECRET_FILE);
}

function saveAdminPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  fs.writeFileSync(SECRET_FILE, JSON.stringify({ salt, hash, created_at: new Date().toISOString() }));
}

function verifyPassword(password) {
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim() !== '') {
    return password === process.env.ADMIN_PASSWORD.trim();
  }
  if (fs.existsSync(SECRET_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf-8'));
      if (data.salt && data.hash) {
        const computed = hashPassword(password, data.salt);
        return computed === data.hash;
      }
    } catch (e) {
      console.error('[Auth] Error reading secret file:', e);
    }
  }
  return false;
}

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

const streamState = {
  id: 'main-stream',
  title: 'Football Live — English Commentary & Match Analysis',
  description: 'Broadcasting live high-definition screen and commentary. Join the real-time chat and enjoy the stream!',
  category: 'Sports & Live Action',
  status: 'offline',
  streamerSocketId: null,
  streamerName: 'Official Streamer',
  started_at: null,
  ended_at: null,
  current_viewers: 0,
  peak_viewers: 0,
  total_unique_viewers: 0,
};

const viewersPresence = new Map();
viewersPresence.set(streamState.id, new Map());
const uniqueViewersSet = new Set();
const chatMessages = [];
const bannedUsers = new Map();
const rateLimitMap = new Map();

function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
}

function updateViewerStats(io, streamId) {
  const streamViewers = viewersPresence.get(streamId) || new Map();
  const currentCount = streamViewers.size;
  streamState.current_viewers = currentCount;
  if (currentCount > streamState.peak_viewers) {
    streamState.peak_viewers = currentCount;
  }
  streamState.total_unique_viewers = uniqueViewersSet.size;

  io.to(streamId).emit('stream:viewer-count', {
    current: streamState.current_viewers,
    peak: streamState.peak_viewers,
    totalUnique: streamState.total_unique_viewers,
  });
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies['admin_token'] || req.headers['x-admin-token'];
    const isAdminAuthenticated = sessionToken ? activeAdminTokens.has(sessionToken) : false;

    // CORS Headers for cross-origin communication with streampulse-user
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    if (parsedUrl.pathname === '/api/admin/status' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(
        JSON.stringify({
          setupRequired: isSetupRequired(),
          authenticated: isAdminAuthenticated,
        })
      );
    }

    if (parsedUrl.pathname === '/api/admin/setup' && req.method === 'POST') {
      res.setHeader('Content-Type', 'application/json');
      if (!isSetupRequired()) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Admin account is already configured.' }));
      }

      const { password, confirmPassword } = await parseJsonBody(req);
      if (!password || password.length < 6) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Password must be at least 6 characters.' }));
      }
      if (password !== confirmPassword) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Passwords do not match.' }));
      }

      saveAdminPassword(password);
      const token = crypto.randomBytes(32).toString('hex');
      activeAdminTokens.add(token);

      res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
      return res.end(JSON.stringify({ ok: true, token }));
    }

    if (parsedUrl.pathname === '/api/admin/login' && req.method === 'POST') {
      res.setHeader('Content-Type', 'application/json');
      if (isSetupRequired()) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Setup required', setupRequired: true }));
      }

      const { password } = await parseJsonBody(req);
      if (!password || !verifyPassword(password)) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: 'Invalid admin password.' }));
      }

      const token = crypto.randomBytes(32).toString('hex');
      activeAdminTokens.add(token);

      res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
      return res.end(JSON.stringify({ ok: true, token }));
    }

    if (parsedUrl.pathname === '/api/admin/logout' && req.method === 'POST') {
      res.setHeader('Content-Type', 'application/json');
      if (sessionToken) {
        activeAdminTokens.delete(sessionToken);
      }
      res.setHeader('Set-Cookie', 'admin_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
      return res.end(JSON.stringify({ ok: true }));
    }

    if (parsedUrl.pathname === '/api/admin/verify' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      if (!isAdminAuthenticated) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ authenticated: false }));
      }
      return res.end(JSON.stringify({ authenticated: true }));
    }

    if (parsedUrl.pathname === '/api/stream/state') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(
        JSON.stringify({
          ...streamState,
          duration: streamState.started_at
            ? Math.floor((Date.now() - new Date(streamState.started_at).getTime()) / 1000)
            : 0,
          messagesCount: chatMessages.length,
        })
      );
    }

    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  setInterval(() => {
    const now = Date.now();
    const streamViewers = viewersPresence.get(streamState.id);
    if (!streamViewers) return;

    let changed = false;
    for (const [viewerId, viewer] of streamViewers.entries()) {
      if (now - viewer.lastHeartbeat > 25000) {
        streamViewers.delete(viewerId);
        changed = true;
      }
    }

    if (changed) {
      updateViewerStats(io, streamState.id);
    }
  }, 6000);

  io.on('connection', (socket) => {
    socket.isAdmin = false;

    socket.on('admin:auth', (data) => {
      const token = data?.token;
      if (token && activeAdminTokens.has(token)) {
        socket.isAdmin = true;
        socket.join('admin-room');
        socket.emit('admin:auth-success');
      } else {
        socket.isAdmin = false;
        socket.emit('admin:auth-failed', { message: 'Invalid admin token.' });
      }
    });

    socket.on('broadcaster:start', (data) => {
      if (!socket.isAdmin) {
        return socket.emit('admin:error', { message: 'Unauthorized. Admin authorization required.' });
      }

      streamState.status = 'live';
      streamState.streamerSocketId = socket.id;
      streamState.title = sanitizeText(data?.title || streamState.title) || streamState.title;
      streamState.description = sanitizeText(data?.description || streamState.description) || streamState.description;
      streamState.category = sanitizeText(data?.category || streamState.category) || streamState.category;
      streamState.started_at = new Date().toISOString();
      streamState.ended_at = null;

      socket.join(streamState.id);

      io.to(streamState.id).emit('stream:status-changed', {
        status: 'live',
        title: streamState.title,
        description: streamState.description,
        category: streamState.category,
        started_at: streamState.started_at,
      });

      socket.to(streamState.id).emit('broadcaster:ready', {
        streamerSocketId: socket.id,
      });
    });

    socket.on('broadcaster:stop', () => {
      if (!socket.isAdmin) {
        return socket.emit('admin:error', { message: 'Unauthorized. Admin authorization required.' });
      }

      streamState.status = 'offline';
      streamState.streamerSocketId = null;
      streamState.ended_at = new Date().toISOString();

      io.to(streamState.id).emit('stream:status-changed', {
        status: 'offline',
        ended_at: streamState.ended_at,
      });

      io.to(streamState.id).emit('stream:stopped');
    });

    socket.on('broadcaster:update-info', (data) => {
      if (!socket.isAdmin) {
        return socket.emit('admin:error', { message: 'Unauthorized. Admin authorization required.' });
      }

      if (data?.title) streamState.title = sanitizeText(data.title);
      if (data?.description) streamState.description = sanitizeText(data.description);
      if (data?.category) streamState.category = sanitizeText(data.category);

      io.to(streamState.id).emit('stream:info-updated', {
        title: streamState.title,
        description: streamState.description,
        category: streamState.category,
      });
    });

    socket.on('webrtc:viewer-ready', (data) => {
      if (streamState.streamerSocketId) {
        io.to(streamState.streamerSocketId).emit('webrtc:new-viewer', {
          viewerSocketId: socket.id,
          viewerId: data?.viewerId,
        });
      }
    });

    socket.on('webrtc:offer', (data) => {
      if (data?.targetSocketId && data?.offer) {
        io.to(data.targetSocketId).emit('webrtc:offer', {
          offer: data.offer,
          fromSocketId: socket.id,
        });
      }
    });

    socket.on('webrtc:answer', (data) => {
      if (data?.targetSocketId && data?.answer) {
        io.to(data.targetSocketId).emit('webrtc:answer', {
          answer: data.answer,
          fromSocketId: socket.id,
        });
      }
    });

    socket.on('webrtc:ice-candidate', (data) => {
      if (data?.targetSocketId && data?.candidate) {
        io.to(data.targetSocketId).emit('webrtc:ice-candidate', {
          candidate: data.candidate,
          fromSocketId: socket.id,
        });
      }
    });

    socket.on('viewer:join', (data) => {
      const viewerId = data?.viewerId || socket.id;
      const username = sanitizeText(data?.username || 'Viewer');
      const streamId = data?.streamId || streamState.id;

      socket.join(streamId);
      socket.data = { viewerId, username, streamId };

      uniqueViewersSet.add(viewerId);

      const streamViewers = viewersPresence.get(streamId) || new Map();
      streamViewers.set(viewerId, {
        socketId: socket.id,
        username,
        joinedAt: Date.now(),
        lastHeartbeat: Date.now(),
      });
      viewersPresence.set(streamId, streamViewers);

      socket.emit('stream:init', {
        stream: streamState,
        messages: chatMessages.slice(-50),
      });

      updateViewerStats(io, streamId);

      if (streamState.status === 'live' && streamState.streamerSocketId) {
        socket.emit('broadcaster:ready', {
          streamerSocketId: streamState.streamerSocketId,
        });
      }
    });

    socket.on('viewer:heartbeat', (data) => {
      const viewerId = data?.viewerId || socket.data?.viewerId;
      const streamId = data?.streamId || streamState.id;
      const streamViewers = viewersPresence.get(streamId);
      if (streamViewers && viewerId && streamViewers.has(viewerId)) {
        const v = streamViewers.get(viewerId);
        v.lastHeartbeat = Date.now();
      }
    });

    socket.on('viewer:leave', (data) => {
      const viewerId = data?.viewerId || socket.data?.viewerId;
      const streamId = data?.streamId || streamState.id;
      const streamViewers = viewersPresence.get(streamId);
      if (streamViewers && viewerId) {
        streamViewers.delete(viewerId);
        updateViewerStats(io, streamId);
      }
    });

    socket.on('chat:send-message', (data) => {
      const userId = data?.user_id || socket.id;
      const username = sanitizeText(data?.username || 'Viewer');
      const role = socket.isAdmin ? 'admin' : 'viewer';
      const rawMessage = data?.message;

      const banInfo = bannedUsers.get(userId);
      if (banInfo) {
        if (!banInfo.timeoutUntil || Date.now() < banInfo.timeoutUntil) {
          return socket.emit('chat:error', {
            message: banInfo.timeoutUntil
              ? `You are timed out until ${new Date(banInfo.timeoutUntil).toLocaleTimeString()}`
              : 'You have been banned from sending chat messages.',
          });
        } else {
          bannedUsers.delete(userId);
        }
      }

      const lastSent = rateLimitMap.get(socket.id) || 0;
      if (Date.now() - lastSent < 400 && !socket.isAdmin) {
        return socket.emit('chat:error', { message: 'You are typing too fast. Please slow down.' });
      }
      rateLimitMap.set(socket.id, Date.now());

      if (!rawMessage || typeof rawMessage !== 'string') return;
      const cleanMessage = sanitizeText(rawMessage);
      if (cleanMessage.length === 0 || cleanMessage.length > 300) {
        return socket.emit('chat:error', { message: 'Message must be between 1 and 300 characters.' });
      }

      const newMsg = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        stream_id: streamState.id,
        user_id: userId,
        username: username,
        role: role,
        message: cleanMessage,
        created_at: new Date().toISOString(),
        is_deleted: false,
      };

      chatMessages.push(newMsg);
      if (chatMessages.length > 200) chatMessages.shift();

      io.to(streamState.id).emit('chat:new-message', newMsg);
    });

    socket.on('chat:delete-message', (data) => {
      if (!socket.isAdmin) {
        return socket.emit('admin:error', { message: 'Unauthorized. Admin authorization required.' });
      }
      const messageId = data?.messageId;
      if (!messageId) return;

      const target = chatMessages.find((m) => m.id === messageId);
      if (target) {
        target.is_deleted = true;
        target.message = 'This message was removed by a moderator.';
      }

      io.to(streamState.id).emit('chat:message-deleted', { messageId });
    });

    socket.on('chat:timeout-user', (data) => {
      if (!socket.isAdmin) {
        return socket.emit('admin:error', { message: 'Unauthorized. Admin authorization required.' });
      }
      const { userId, username, durationSeconds = 60, reason } = data || {};
      if (!userId) return;

      const timeoutUntil = Date.now() + durationSeconds * 1000;
      bannedUsers.set(userId, { reason, timeoutUntil });

      io.to(streamState.id).emit('chat:system-notice', {
        notice: `User @${username || userId} has been timed out for ${durationSeconds}s.`,
      });
    });

    socket.on('chat:ban-user', (data) => {
      if (!socket.isAdmin) {
        return socket.emit('admin:error', { message: 'Unauthorized. Admin authorization required.' });
      }
      const { userId, username, reason } = data || {};
      if (!userId) return;

      bannedUsers.set(userId, { reason: reason || 'Banned by admin', timeoutUntil: null });

      io.to(streamState.id).emit('chat:system-notice', {
        notice: `User @${username || userId} has been banned from chat.`,
      });
    });

    socket.on('chat:clear-chat', () => {
      if (!socket.isAdmin) {
        return socket.emit('admin:error', { message: 'Unauthorized. Admin authorization required.' });
      }
      chatMessages.length = 0;
      io.to(streamState.id).emit('chat:cleared');
    });

    socket.on('disconnect', () => {
      rateLimitMap.delete(socket.id);

      if (socket.id === streamState.streamerSocketId) {
        streamState.status = 'offline';
        streamState.streamerSocketId = null;
        streamState.ended_at = new Date().toISOString();
        io.to(streamState.id).emit('stream:status-changed', { status: 'offline' });
        io.to(streamState.id).emit('stream:stopped');
      }

      if (socket.data?.viewerId) {
        const streamViewers = viewersPresence.get(socket.data.streamId || streamState.id);
        if (streamViewers) {
          streamViewers.delete(socket.data.viewerId);
          updateViewerStats(io, socket.data.streamId || streamState.id);
        }
      }
    });
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> StreamPulse Admin Studio ready on http://${hostname}:${port}`);
  });
});

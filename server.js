const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const app = express();
const port = process.env.PORT || 3000;

// === Rate Limiting (prevents spam/flooding) ===
const limiter = rateLimit({
  windowMs: 60 * 1000,          // 1 minute
  max: 15,                      // max 15 requests per minute per IP
  message: { success: false, error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors({ origin: '*' }));  // Allow Roblox clients (tighten in production if needed)
app.use(express.json());
app.use(limiter);                // Apply rate limit to all routes

// Storage
let globalMessages = [];
const localServers = {};         // serverId → { messages: [], lastSeen: timestamp }

const MAX_MESSAGES_PER_CHAT = 200;
const MAX_MESSAGE_LENGTH = 500;
const LOCAL_SERVER_TIMEOUT = 60 * 60 * 1000; // 1 hour - clean up inactive servers

// Health check (Render keep-alive)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Init session (optional - logs new users)
app.post('/api/v1/chat/init', (req, res) => {
  const { userId, username, placeId } = req.body;
  console.log(`[INIT] User ${username} (${userId}) joined from place ${placeId || 'unknown'}`);
  res.json({ success: true });
});

// Get messages
app.get('/api/v1/chat/messages', (req, res) => {
  const { chatType = 'global', serverId, after = '0', limit = '50' } = req.query;
  const afterTs = parseInt(after, 10) || 0;
  const limitNum = Math.min(parseInt(limit, 10) || 50, 100);

  let messages = [];

  if (chatType === 'global') {
    messages = globalMessages;
  } else if (chatType === 'local' && serverId) {
    if (!localServers[serverId]) {
      localServers[serverId] = { messages: [], lastSeen: Date.now() };
    }
    messages = localServers[serverId].messages;
    localServers[serverId].lastSeen = Date.now(); // update activity
  } else {
    return res.status(400).json({ success: false, error: 'Invalid chatType or missing serverId for local' });
  }

  // Filter newer than 'after', sort by time, take latest 'limit'
  const filtered = messages
    .filter(m => m.timestamp > afterTs)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limitNum);

  res.json({
    success: true,
    messages: filtered
  });
});

// Send message
app.post('/api/v1/chat/send', (req, res) => {
  const { userId, username, displayName, message, chatType = 'global', serverId } = req.body;

  if (!username || !message) {
    return res.status(400).json({ success: false, error: 'Missing username or message' });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ success: false, error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` });
  }

  const timestamp = Date.now();
  const msgData = {
    id: `${timestamp}-${Math.random().toString(36).slice(2, 10)}`,
    userId: userId || 'anonymous',
    username,
    displayName: displayName || username,
    message: message.trim(),
    chatType,
    timestamp
  };

  if (chatType === 'global') {
    globalMessages.push(msgData);
    if (globalMessages.length > MAX_MESSAGES_PER_CHAT) globalMessages.shift();
  } else if (chatType === 'local' && serverId) {
    if (!localServers[serverId]) {
      localServers[serverId] = { messages: [], lastSeen: Date.now() };
    }
    localServers[serverId].messages.push(msgData);
    localServers[serverId].lastSeen = Date.now();
    if (localServers[serverId].messages.length > MAX_MESSAGES_PER_CHAT) {
      localServers[serverId].messages.shift();
    }
  } else {
    return res.status(400).json({ success: false, error: 'Invalid chatType or missing serverId for local' });
  }

  console.log(`[MSG] ${chatType.toUpperCase()} | ${username}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);

  res.json({
    success: true,
    message: 'Sent',
    messageData
  });
});

// Optional: periodic cleanup of inactive local servers
setInterval(() => {
  const now = Date.now();
  for (const serverId in localServers) {
    if (now - localServers[serverId].lastSeen > LOCAL_SERVER_TIMEOUT) {
      console.log(`[CLEANUP] Removed inactive server: ${serverId}`);
      delete localServers[serverId];
    }
  }
}, 10 * 60 * 1000); // every 10 minutes

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Deadly Chat API running on port ${port}`);
});

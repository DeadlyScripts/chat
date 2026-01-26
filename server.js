const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());                    // Allows Roblox script to connect
app.use(express.json());            // Parse JSON bodies

// In-memory storage (resets on restart/sleep, fine for small chat)
let globalMessages = [];
let localServers = {};              // serverId → array of local messages only

const MAX_MESSAGES = 150;           // Prevent memory explosion on free tier
const MAX_MESSAGE_LENGTH = 500;

// Simple health check (ping this to keep Render awake)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Initialize session (optional)
app.post('/api/v1/chat/init', (req, res) => {
  res.json({ success: true });
});

// Get messages – FIXED: separate logic for global vs local
app.post('/api/v1/chat/messages', (req, res) => {
  const chatType = req.query.chatType || 'global';
  const serverId = req.query.serverId;
  const after = parseInt(req.query.after) || 0;
  let limit = parseInt(req.query.limit) || 50;
  limit = Math.min(limit, 100); // safety cap

  let messages = [];

  if (chatType === 'global') {
    messages = globalMessages;
  } else if (chatType === 'local' && serverId) {
    if (localServers[serverId]) {
      messages = localServers[serverId];
    } else {
      messages = []; // no messages yet for this server
    }
  } else {
    return res.status(400).json({
      success: false,
      error: 'Invalid chatType or missing serverId for local mode'
    });
  }

  // Filter, sort, limit
  messages = messages
    .filter(msg => msg.timestamp > after)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit);

  res.json({
    success: true,
    messages
  });
});

// Send message – FIXED: only add to the correct storage
app.post('/api/v1/chat/send', (req, res) => {
  const { userId, username, displayName, message, chatType = 'global', serverId } = req.body;

  if (!message || !username) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ success: false, message: 'Message too long' });
  }

  const timestamp = Date.now();
  const msgData = {
    id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
    userId: userId || 'anonymous',
    username,
    displayName: displayName || username,
    message,
    chatType,
    timestamp
  };

  // Store in the correct place – do NOT always add to global
  if (chatType === 'global') {
    globalMessages.push(msgData);
    if (globalMessages.length > MAX_MESSAGES) globalMessages.shift();
  } else if (chatType === 'local' && serverId) {
    if (!localServers[serverId]) localServers[serverId] = [];
    localServers[serverId].push(msgData);
    if (localServers[serverId].length > MAX_MESSAGES) localServers[serverId].shift();
  } else {
    return res.status(400).json({
      success: false,
      message: 'Invalid chatType or missing serverId for local messages'
    });
  }

  res.json({
    success: true,
    message: 'Message sent',
    messageData: msgData
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Deadly Chat API running on port ${port}`);
});

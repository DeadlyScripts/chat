const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());                    // Allows Roblox script to connect
app.use(express.json());            // Parse JSON bodies

// In-memory storage (resets on restart/sleep, fine for small chat)
let globalMessages = [];
let localServers = {};              // serverId → array of local messages

const MAX_MESSAGES = 150;           // Prevent memory explosion on free tier

// Simple health check (ping this to keep Render awake)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Initialize session (optional, can be empty or log)
app.post('/api/v1/chat/init', (req, res) => {
  res.json({ success: true });
});

// Get messages
app.get('/api/v1/chat/messages', (req, res) => {
  const chatType = req.query.chatType || 'global';
  const serverId = req.query.serverId;
  const after = parseInt(req.query.after) || 0;
  let limit = parseInt(req.query.limit) || 50;

  // Start with all global messages (everyone sees these)
  let messages = [...globalMessages];

  // If local mode + serverId, add that server's local messages
  if (chatType === 'local' && serverId && localServers[serverId]) {
    messages = messages.concat(localServers[serverId]);
  }

  // Filter by timestamp and limit
  messages = messages
    .filter(msg => msg.timestamp > after)
    .sort((a, b) => a.timestamp - b.timestamp) // oldest first
    .slice(-limit); // last N messages

  res.json({
    success: true,
    messages
  });
});

// Send message
app.post('/api/v1/chat/send', (req, res) => {
  const { userId, username, displayName, message, chatType, serverId } = req.body;

  if (!message || !username) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const timestamp = Date.now();
  const msgData = {
    id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
    userId: userId || 'anonymous',
    username,
    displayName: displayName || username,
    message,
    chatType: chatType || 'global',
    timestamp
  };

  // Always add to global (so both modes can see it)
  globalMessages.push(msgData);
  if (globalMessages.length > MAX_MESSAGES) globalMessages.shift();

  // If local chat, also store in that server bucket
  if (chatType === 'local' && serverId) {
    if (!localServers[serverId]) localServers[serverId] = [];
    localServers[serverId].push(msgData);
    if (localServers[serverId].length > MAX_MESSAGES) localServers[serverId].shift();
  }

  res.json({
    success: true,
    message: 'Message sent',
    messageData
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Deadly Chat API running on port ${port}`);
});

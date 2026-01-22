const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Manual CORS headers (fixes Roblox block without extra package)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');  // Allow Roblox / any origin
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS preflight (required for POST)
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json());

// In-memory messages (resets on restart/sleep — normal free tier)
let messages = [];

// POST init (dummy)
app.post('/api/v1/chat/init', (req, res) => {
  res.json({ success: true });
});

// POST send message
app.post('/api/v1/chat/send', (req, res) => {
  const { userId, username, displayName, message, chatType, serverId } = req.body;
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ success: false, error: 'Message required' });
  }
  
  const newMsg = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 10),
    userId: userId || 'unknown',
    username: username || 'Guest',
    displayName: displayName || username || 'Guest',
    message: message.slice(0, 2000),
    timestamp: Date.now(),
    chatType: chatType || 'local', // Default to 'local'
    serverId: serverId || null // Only for local chats
  };
  
  messages.push(newMsg);
  
  // Keep only last 300 messages
  if (messages.length > 300) {
    messages.shift();
  }
  
  res.json({
    success: true,
    message: `Message sent to ${newMsg.chatType} chat`,
    messageData: newMsg
  });
});

// GET messages
app.get('/api/v1/chat/messages', (req, res) => {
  const { after = '0', limit = '50', chatType = 'local', serverId } = req.query;
  const afterTime = Number(after);
  
  let filtered = messages.filter(msg => {
    // Must be after timestamp
    if (msg.timestamp <= afterTime) return false;
    
    // Must match chatType
    if (msg.chatType !== chatType) return false;
    
    // If local chat, must match serverId
    if (chatType === 'local' && msg.serverId !== serverId) return false;
    
    return true;
  }).slice(0, Number(limit));
  
  res.json({
    success: true,
    messages: filtered
  });
});

app.listen(port, () => {
  console.log(`Global chat server running on port ${port}`);
});

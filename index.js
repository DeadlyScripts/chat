const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json());

let messages = [];

app.post('/api/v1/chat/init', (req, res) => {
  res.json({ success: true });
});

app.post('/api/v1/chat/send', (req, res) => {
  const { userId, username, displayName, message, chatType, serverId } = req.body;
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ success: false, error: 'Message required' });
  }
  
  // For local chat, serverId is REQUIRED
  if (chatType === 'local' && !serverId) {
    return res.status(400).json({ success: false, error: 'serverId required for local chat' });
  }
  
  const newMsg = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 10),
    userId: userId || 'unknown',
    username: username || 'Guest',
    displayName: displayName || username || 'Guest',
    message: message.slice(0, 2000),
    timestamp: Date.now(),
    chatType: chatType || 'local',
    serverId: serverId ? String(serverId) : null  // Convert to string!
  };
  
  messages.push(newMsg);
  
  if (messages.length > 300) {
    messages.shift();
  }
  
  console.log('Message saved:', newMsg);  // DEBUG
  
  res.json({
    success: true,
    message: `Message sent to ${newMsg.chatType} chat`,
    messageData: newMsg
  });
});

app.get('/api/v1/chat/messages', (req, res) => {
  const { after = '0', limit = '50', chatType = 'local', serverId } = req.query;
  const afterTime = Number(after);
  
  console.log('GET request:', { chatType, serverId, after });  // DEBUG
  
  let filtered = messages.filter(msg => {
    if (msg.timestamp <= afterTime) return false;
    if (msg.chatType !== chatType) return false;
    
    // For local chat, MUST match serverId exactly (both as strings)
    if (chatType === 'local') {
      if (!serverId || String(msg.serverId) !== String(serverId)) {
        return false;
      }
    }
    
    return true;
  }).slice(0, Number(limit));
  
  console.log('Filtered messages:', filtered.length);  // DEBUG
  
  res.json({
    success: true,
    messages: filtered
  });
});

app.listen(port, () => {
  console.log(`Chat server running on port ${port}`);
});

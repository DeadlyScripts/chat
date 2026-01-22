const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS – this is required so Roblox/exploits can talk to your API
app.use(cors({
  origin: '*',                          // Allow from anywhere (including Roblox)
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false,
  optionsSuccessStatus: 200
}));

app.use(express.json());

// In-memory storage (resets on server restart/sleep – normal for free Render)
let messages = [];

// POST /api/v1/chat/init – just confirms connection
app.post('/api/v1/chat/init', (req, res) => {
  res.json({ success: true });
});

// POST /api/v1/chat/send – add new message to global chat
app.post('/api/v1/chat/send', (req, res) => {
  const { userId, username, displayName, message, chatType } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ success: false, error: 'Message required' });
  }

  const newMsg = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 10),
    userId: userId || 'unknown',
    username: username || 'Guest',
    displayName: displayName || username || 'Guest',
    message: message.slice(0, 2000), // limit length
    timestamp: Date.now(),
    chatType: chatType || 'general'
  };

  messages.push(newMsg);

  // Keep only last 300 messages
  if (messages.length > 300) {
    messages.shift();
  }

  res.json({
    success: true,
    message: 'Message sent',
    messageData: newMsg
  });
});

// GET /api/v1/chat/messages – fetch messages (supports ?after= timestamp)
app.get('/api/v1/chat/messages', (req, res) => {
  const { after = '0', limit = '50', chatType = 'general' } = req.query;
  const afterTime = Number(after);

  const filtered = messages
    .filter(msg => msg.timestamp > afterTime && msg.chatType === chatType)
    .slice(0, Number(limit));

  res.json({
    success: true,
    messages: filtered
  });
});

app.listen(port, () => {
  console.log(`Global chat server running on port ${port}`);
});

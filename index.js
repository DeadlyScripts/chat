const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// In-memory storage for global chat messages
// Messages reset when the server sleeps/restarts (normal on free Render)
let messages = [];

// POST /api/v1/chat/init - dummy endpoint your script expects
app.post('/api/v1/chat/init', (req, res) => {
  res.json({ success: true });
});

// POST /api/v1/chat/send - send a message to the global chat
app.post('/api/v1/chat/send', (req, res) => {
  const { userId, username, displayName, message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ success: false, error: 'Message required' });
  }

  const newMsg = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 10),
    userId: userId || 'unknown',
    username: username || 'Guest',
    displayName: displayName || username || 'Guest',
    message: message.slice(0, 2000), // basic length limit
    timestamp: Date.now()
  };

  messages.push(newMsg);

  // Keep only the last 300 messages to prevent memory growth
  if (messages.length > 300) {
    messages.shift();
  }

  res.json({
    success: true,
    message: 'Message sent to global chat',
    messageData: newMsg
  });
});

// GET /api/v1/chat/messages - get recent global messages
app.get('/api/v1/chat/messages', (req, res) => {
  const { after = '0', limit = '50' } = req.query;

  const afterTime = Number(after);
  const filtered = messages
    .filter(msg => msg.timestamp > afterTime)
    .slice(0, Number(limit));

  res.json({
    success: true,
    messages: filtered
  });
});

app.listen(port, () => {
  console.log(`Global chat server running on port ${port}`);
});

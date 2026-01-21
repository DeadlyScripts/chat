const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// In-memory messages (reset on restart/sleep — good for start)
let messages = [];

// POST /api/v1/chat/init
app.post('/api/v1/chat/init', (req, res) => {
  res.json({ success: true });
});

// POST /api/v1/chat/send
app.post('/api/v1/chat/send', (req, res) => {
  const { userId, username, displayName, jobId, message, chatType = 'general' } = req.body;

  if (!jobId || !message || message.trim() === '') {
    return res.status(400).json({ success: false, error: 'jobId and message required' });
  }

  const newMsg = {
    id: Date.now().toString(),
    userId: userId || 'unknown',
    username: username || 'Guest',
    displayName: displayName || username || 'Guest',
    jobId,
    message: message.slice(0, 2000),
    chatType,
    timestamp: Date.now()
  };

  messages.push(newMsg);
  if (messages.length > 200) messages.shift(); // keep last 200

  res.json({
    success: true,
    message: 'Sent',
    messageData: newMsg
  });
});

// GET /api/v1/chat/messages
app.get('/api/v1/chat/messages', (req, res) => {
  const { jobId, after = '0', limit = '50', chatType = 'general' } = req.query;

  if (!jobId) return res.status(400).json({ success: false, error: 'jobId required' });

  const afterTime = Number(after);
  const filtered = messages
    .filter(m => m.jobId === jobId && m.chatType === chatType && m.timestamp > afterTime)
    .slice(0, Number(limit));

  res.json({ success: true, messages: filtered });
});

app.listen(port, () => {
  console.log(`API running → port ${port}`);
});

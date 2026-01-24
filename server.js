const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let globalMessages = [];
let localServers = {}; // serverId → array of local messages only

const MAX_MESSAGES = 150;
const MAX_MESSAGE_LENGTH = 500;

// Health check (keeps Render awake when pinged)
app.get('/health', (req, res) => res.status(200).send('OK'));

// Init (optional)
app.post('/api/v1/chat/init', (req, res) => res.json({ success: true }));

// Get messages – now truly separated
app.get('/api/v1/chat/messages', (req, res) => {
    const chatType = req.query.chatType || 'global';
    const serverId = req.query.serverId;
    const after = parseInt(req.query.after) || 0;
    let limit = parseInt(req.query.limit) || 50;

    let messages = [];

    if (chatType === 'global') {
        messages = [...globalMessages];
    } else if (chatType === 'local' && serverId) {
        messages = localServers[serverId] ? [...localServers[serverId]] : [];
    } else {
        return res.json({ success: true, messages: [] });
    }

    messages = messages
        .filter(msg => msg.timestamp > after)
        .sort((a, b) => b.timestamp - a.timestamp) // newest first
        .slice(0, limit);

    res.json({ success: true, messages });
});

// Send message – global goes to global, local goes to specific server only
app.post('/api/v1/chat/send', (req, res) => {
    const { userId, username, displayName, message, chatType, serverId } = req.body;

    if (!message || !username) {
        return res.status(400).json({ success: false, message: 'Missing fields' });
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
        chatType: chatType || 'global',
        timestamp
    };

    if (chatType === 'local' && serverId) {
        if (!localServers[serverId]) localServers[serverId] = [];
        localServers[serverId].push(msgData);
        if (localServers[serverId].length > MAX_MESSAGES) localServers[serverId].shift();
    } else {
        globalMessages.push(msgData);
        if (globalMessages.length > MAX_MESSAGES) globalMessages.shift();
    }

    res.json({ success: true, message: 'Sent', messageData });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Deadly Chat API running on port ${port}`);
});

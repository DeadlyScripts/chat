// server.js - IP-Secured Rate Limited Chat Backend
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy to get real IP addresses (important for Render/Heroku/etc)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// IP Hashing - stores hashed IPs instead of real IPs
function hashIP(ip) {
    return crypto.createHash('sha256').update(ip + 'salt-change-this').digest('hex');
}

// Custom key generator that uses hashed IPs
function secureKeyGenerator(req) {
    const ip = req.ip || req.connection.remoteAddress;
    return hashIP(ip);
}

// RATE LIMITERS with IP protection

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    keyGenerator: secureKeyGenerator, // Uses hashed IP
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    // Don't log IPs
    handler: (req, res) => {
        res.status(429).json({ success: false, message: 'Rate limit exceeded' });
    }
});

const messageLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    keyGenerator: (req) => {
        // Use userId if available, otherwise use hashed IP
        return req.body.userId || secureKeyGenerator(req);
    },
    message: { success: false, message: 'You are sending messages too fast! Slow down.' }
});

const initLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.body.userId || secureKeyGenerator(req),
    message: { success: false, message: 'Too many session requests.' }
});

app.use('/api/', globalLimiter);

// In-Memory Storage (IPs are never stored)
const messages = {
    global: [],
    local: new Map()
};

// Middleware to strip IP from logs
app.use((req, res, next) => {
    // Override console.log to prevent IP logging
    const originalLog = console.log;
    console.log = function(...args) {
        const filtered = args.map(arg => {
            if (typeof arg === 'string') {
                // Remove IP patterns from logs
                return arg.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP-REDACTED]');
            }
            return arg;
        });
        originalLog.apply(console, filtered);
    };
    next();
});

// Routes

app.post('/api/v1/chat/init', initLimiter, (req, res) => {
    const { userId, username, displayName, jobId, placeId } = req.body;
    
    if (!userId || !username) {
        return res.status(400).json({ success: false, message: 'Missing userId or username' });
    }
    
    // Never log IP addresses
    console.log(`Session init for user: ${username}`);
    
    res.json({
        success: true,
        message: 'Session initialized',
        userId
    });
});

app.post('/api/v1/chat/send', messageLimiter, (req, res) => {
    const { userId, username, displayName, message, chatType, serverId } = req.body;
    
    if (!message || !userId || !username) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    if (message.length > 500) {
        return res.status(400).json({ success: false, message: 'Message too long (max 500 characters)' });
    }
    
    // Sanitize message to prevent XSS
    const sanitizedMessage = message
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .trim();
    
    const messageData = {
        id: Date.now() + '-' + crypto.randomBytes(8).toString('hex'),
        userId,
        username,
        displayName: displayName || username,
        message: sanitizedMessage,
        chatType,
        serverId: chatType === 'local' ? serverId : null,
        timestamp: Date.now()
        // NO IP ADDRESS STORED
    };
    
    if (chatType === 'global') {
        messages.global.push(messageData);
        if (messages.global.length > 1000) {
            messages.global = messages.global.slice(-1000);
        }
    } else {
        if (!messages.local.has(serverId)) {
            messages.local.set(serverId, []);
        }
        messages.local.get(serverId).push(messageData);
        
        const serverMessages = messages.local.get(serverId);
        if (serverMessages.length > 500) {
            messages.local.set(serverId, serverMessages.slice(-500));
        }
    }
    
    res.json({
        success: true,
        message: 'Message sent',
        messageData
    });
});

app.get('/api/v1/chat/messages', (req, res) => {
    const { chatType, serverId, limit, after } = req.query;
    
    let messageList = [];
    
    if (chatType === 'global') {
        messageList = messages.global;
    } else {
        messageList = messages.local.get(serverId) || [];
    }
    
    if (after) {
        const afterTimestamp = parseInt(after);
        messageList = messageList.filter(msg => msg.timestamp > afterTimestamp);
    }
    
    const maxLimit = parseInt(limit) || 50;
    const limitedMessages = messageList.slice(-Math.min(maxLimit, 100));
    
    res.json({
        success: true,
        messages: limitedMessages,
        count: limitedMessages.length
    });
});

// Error handler - never expose IPs in errors
app.use((err, req, res, next) => {
    console.error('Error occurred (IP redacted)');
    res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`🔒 IP-Secured server running on port ${PORT}`);
    console.log(`✓ IP addresses are hashed and never stored`);
    console.log(`✓ Rate limiting active`);
});

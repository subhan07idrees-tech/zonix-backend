require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const orgRoutes = require('./routes/organizations');
const userRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');
const proxyRoutes = require('./routes/proxies');
const heartbeatRoutes = require('./routes/heartbeat');
const eventRoutes = require('./routes/events');
const cookieRoutes = require('./routes/cookies');
const dashboardRoutes = require('./routes/dashboard');
const { authenticateToken } = require('./middleware/auth');
const { auditMiddleware } = require('./middleware/audit');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;
const WS_PORT = process.env.WS_PORT || 4001;

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 20,
  message: { error: 'Too many authentication attempts' }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.set('prisma', prisma);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/organizations', authenticateToken, orgRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/sessions', authenticateToken, sessionRoutes);
app.use('/api/proxies', authenticateToken, proxyRoutes);
app.use('/api/heartbeat', authenticateToken, heartbeatRoutes);
app.use('/api/events', authenticateToken, eventRoutes);
app.use('/api/cookies', authenticateToken, cookieRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);

app.use(auditMiddleware);

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const orgCount = await prisma.organization.count();
    const activeSessions = await prisma.session.count({ where: { status: 'ACTIVE' } });
    const activeUsers = await prisma.user.count({ where: { status: 'ACTIVE' } });

    res.json({
      status: 'operational',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      metrics: {
        organizations: orgCount,
        activeSessions,
        activeUsers
      }
    });
  } catch (err) {
    console.error('[Health] Check failed:', err.message);
    res.status(503).json({ status: 'degraded', error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

const wss = new WebSocketServer({ server, path: '/ws' });

const wsClients = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(1008, 'Authentication required');
    return;
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zonix-secret-change-in-production');

    const clientId = `${decoded.orgId}_${decoded.userId}_${Date.now()}`;
    wsClients.set(clientId, {
      ws,
      orgId: decoded.orgId,
      userId: decoded.userId,
      role: decoded.role,
      connectedAt: Date.now()
    });

    console.log(`[WS] Client connected: ${clientId}`);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleWSMessage(clientId, msg);
      } catch (err) {
        console.error(`[WS] Message parse error from ${clientId}:`, err.message);
      }
    });

    ws.on('close', () => {
      wsClients.delete(clientId);
      console.log(`[WS] Client disconnected: ${clientId}`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Client error ${clientId}:`, err.message);
    });

    ws.send(JSON.stringify({
      type: 'connected',
      data: { clientId, timestamp: Date.now() }
    }));

  } catch (err) {
    ws.close(1008, 'Invalid token');
  }
});

function handleWSMessage(clientId, msg) {
  const client = wsClients.get(clientId);
  if (!client) return;

  switch (msg.type) {
    case 'command:kill':
    case 'command:restart':
    case 'command:refreshCookies':
      broadcastToOrg(client.orgId, msg, clientId);
      break;
    case 'sessions:subscribe':
      sendSessionsToClient(client);
      break;
    default:
      console.log(`[WS] Unknown message type from ${clientId}: ${msg.type}`);
  }
}

function broadcastToOrg(orgId, message, excludeClientId) {
  const payload = JSON.stringify(message);
  wsClients.forEach((client, id) => {
    if (client.orgId === orgId && id !== excludeClientId) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  });
}

function broadcastToAll(message) {
  const payload = JSON.stringify(message);
  wsClients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  });
}

async function sendSessionsToClient(client) {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        orgId: client.orgId,
        status: 'ACTIVE'
      },
      include: {
        user: { select: { username: true } },
        proxyNode: { select: { name: true } }
      }
    });

    const payload = sessions.map(s => ({
      sessionId: s.id,
      orgId: s.orgId,
      operator: s.user.username,
      proxyNode: s.proxyNode?.name || 'none',
      status: s.status,
      targetUrl: s.targetUrl,
      startedAt: s.startedAt,
      lastHeartbeat: s.lastHeartbeat
    }));

    client.ws.send(JSON.stringify({ type: 'sessions:update', data: payload }));
  } catch (err) {
    console.error(`[WS] Failed to send sessions to ${client.orgId}:`, err.message);
  }
}

async function broadcastSessions(orgId) {
  wsClients.forEach(async (client) => {
    if (client.orgId === orgId) {
      await sendSessionsToClient(client);
    }
  });
}

async function cleanupStaleSessions() {
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

  try {
    const staleSessions = await prisma.session.updateMany({
      where: {
        status: 'ACTIVE',
        lastHeartbeat: { lt: staleThreshold }
      },
      data: {
        status: 'DISCONNECTED',
        endedAt: new Date(),
        endReason: 'heartbeat-timeout'
      }
    });

    if (staleSessions.count > 0) {
      console.log(`[Cleanup] Marked ${staleSessions.count} stale sessions as disconnected`);
      broadcastToAll({ type: 'sessions:cleanup', data: { count: staleSessions.count } });
      wsClients.forEach(async (client) => {
        await sendSessionsToClient(client);
      });
    }
  } catch (err) {
    console.error('[Cleanup] Stale session cleanup failed:', err.message);
  }
}

setInterval(cleanupStaleSessions, 60000);

async function startServer() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL via Prisma');

    server.listen(PORT, () => {
      console.log(`[ZONIX Backend] HTTP server running on port ${PORT}`);
      console.log(`[ZONIX Backend] WebSocket endpoint: ws://localhost:${PORT}/ws`);
    });
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('[ZONIX] SIGTERM received. Shutting down gracefully...');
  wss.clients.forEach(ws => ws.close(1001, 'Server shutting down'));
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  console.log('[ZONIX] SIGINT received. Shutting down...');
  wss.clients.forEach(ws => ws.close(1001, 'Server shutting down'));
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});

startServer();

module.exports = { app, server, prisma, wss, broadcastToOrg, broadcastToAll, broadcastSessions, sendSessionsToClient };

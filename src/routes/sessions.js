const express = require('express');
const { requireOrgAccess } = require('../middleware/auth');
const SessionService = require('../services/session');

const router = express.Router();

router.get('/:orgId', requireOrgAccess, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId } = req.params;
  const { status, userId } = req.query;

  try {
    const where = { orgId };
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const sessions = await prisma.session.findMany({
      where,
      include: {
        user: { select: { username: true } },
        proxyNode: { select: { name: true, host: true, protocol: true } },
        org: { select: { name: true, displayName: true } }
      },
      orderBy: { startedAt: 'desc' },
      take: parseInt(req.query.limit) || 100
    });

    res.json({ sessions });
  } catch (err) {
    console.error('[Sessions] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.get('/:orgId/:userId', requireOrgAccess, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId, userId } = req.params;

  try {
    const sessionService = new SessionService(prisma);
    const sessions = await sessionService.getActiveSessionsByUser(orgId, userId);

    const sessionsWithCookies = await Promise.all(sessions.map(async (session) => {
      const cookies = await sessionService.getDecryptedCookies(session.id);
      return {
        ...session,
        cookies: cookies || []
      };
    }));

    res.json({ sessions: sessionsWithCookies });
  } catch (err) {
    console.error('[Sessions] Get user sessions error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user sessions' });
  }
});

router.post('/:orgId', requireOrgAccess, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId } = req.params;
  const { userId, targetUrl, proxyNodeId, cookies } = req.body;

  console.log('[Sessions Create Route] Request received:', {
    orgId,
    bodyUserId: userId,
    authedUserId: req.user?.userId,
    targetUrl,
    proxyNodeId
  });

  try {
    const sessionService = new SessionService(prisma);
    const resolvedUserId = userId || req.user.userId;
    const partitionId = `persist:org_${orgId}_user_${resolvedUserId}`;

    const session = await sessionService.createSession({
      orgId,
      userId: userId || req.user.userId,
      targetUrl,
      proxyNodeId,
      partitionId,
      cookies
    });

    try {
      const { broadcastSessions } = require('../server');
      broadcastSessions(orgId);
    } catch (broadcastErr) {
      console.error('[Sessions] Broadcast error:', broadcastErr.message);
    }

    res.status(201).json({ session });
  } catch (err) {
    console.error('[Sessions] Create error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create session' });
  }
});

router.post('/:sessionId/heartbeat', async (req, res) => {
  const prisma = req.app.get('prisma');
  const { sessionId } = req.params;

  try {
    const sessionService = new SessionService(prisma);
    await sessionService.updateHeartbeat(sessionId);

    res.json({ success: true, timestamp: Date.now() });
  } catch (err) {
    console.error('[Sessions] Heartbeat error:', err.message);
    res.status(500).json({ error: 'Heartbeat update failed' });
  }
});

router.delete('/:sessionId', async (req, res) => {
  const prisma = req.app.get('prisma');
  const { sessionId } = req.params;

  try {
    const sessionService = new SessionService(prisma);
    await sessionService.endSession(sessionId, 'admin-command');

    const { broadcastToOrg } = require('../server');
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { orgId: true }
    });

    if (session) {
      const { broadcastSessions } = require('../server');
      broadcastToOrg(session.orgId, {
        type: 'command:kill',
        sessionId
      });
      broadcastSessions(session.orgId);
    }

    res.json({ success: true, message: 'Session killed' });
  } catch (err) {
    console.error('[Sessions] Kill error:', err.message);
    res.status(500).json({ error: 'Failed to kill session' });
  }
});

router.post('/:sessionId/restart', async (req, res) => {
  const prisma = req.app.get('prisma');
  const { sessionId } = req.params;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { org: true }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionService = new SessionService(prisma);
    await sessionService.endSession(sessionId, 'restart');

    const newSession = await sessionService.createSession({
      orgId: session.orgId,
      userId: session.userId,
      targetUrl: session.targetUrl,
      proxyNodeId: session.proxyNodeId,
      partitionId: session.partitionId
    });

    const { broadcastToOrg, broadcastSessions } = require('../server');
    broadcastToOrg(session.orgId, {
      type: 'command:restart',
      oldSessionId: sessionId,
      newSessionId: newSession.id
    });
    broadcastSessions(session.orgId);

    res.json({ success: true, session: newSession });
  } catch (err) {
    console.error('[Sessions] Restart error:', err.message);
    res.status(500).json({ error: 'Failed to restart session' });
  }
});

router.get('/:orgId/stats', requireOrgAccess, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId } = req.params;

  try {
    const sessionService = new SessionService(prisma);
    const stats = await sessionService.getSessionStats(orgId);
    res.json({ stats });
  } catch (err) {
    console.error('[Sessions] Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch session stats' });
  }
});

module.exports = router;

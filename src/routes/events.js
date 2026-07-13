const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const prisma = req.app.get('prisma');
  const { type, sessionId, timestamp, reason, details } = req.body;

  try {
    await prisma.auditLog.create({
      data: {
        orgId: req.user.orgId,
        userId: req.user.userId,
        action: `event:${type}`,
        resource: 'event',
        resourceId: sessionId,
        details: {
          type,
          sessionId,
          timestamp,
          reason,
          ...details
        },
        ipAddress: req.ip
      }
    });

    const { broadcastToOrg } = require('../server');
    broadcastToOrg(req.user.orgId, {
      type: 'alert:system',
      data: {
        eventType: type,
        sessionId,
        timestamp,
        reason,
        severity: type === 'kill-switch' ? 'critical' : 'warning'
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Events] Log error:', err.message);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

router.get('/:orgId', async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId } = req.params;
  const { type, limit, offset } = req.query;

  try {
    const where = { orgId, resource: 'event' };
    if (type) {
      where.action = `event:${type}`;
    }

    const events = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit) || 100,
      skip: parseInt(offset) || 0
    });

    res.json({ events });
  } catch (err) {
    console.error('[Events] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

module.exports = router;

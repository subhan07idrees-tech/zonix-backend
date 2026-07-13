const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const prisma = req.app.get('prisma');
  const { sessionId, orgId, userId, proxyString } = req.body;

  try {
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { proxyNode: true }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { lastHeartbeat: new Date() }
    });

    let proxyStatus = 'healthy';
    let latency = 0;

    if (session.proxyNode) {
      const lastCheck = await prisma.proxyHealthCheck.findFirst({
        where: { proxyNodeId: session.proxyNodeId },
        orderBy: { checkedAt: 'desc' }
      });

      if (lastCheck) {
        proxyStatus = lastCheck.status.toLowerCase();
        latency = lastCheck.latencyMs || 0;
      }
    }

    if (proxyStatus === 'unreachable') {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'ERROR',
          endedAt: new Date(),
          endReason: 'proxy-unreachable'
        }
      });
    }

    res.json({
      success: true,
      proxyStatus,
      latency,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('[Heartbeat] Error:', err.message);
    res.status(500).json({ error: 'Heartbeat processing failed' });
  }
});

module.exports = router;

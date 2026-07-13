const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  const prisma = req.app.get('prisma');
  const orgId = req.user.role === 'SUPER_ADMIN' ? null : req.user.orgId;

  try {
    const orgFilter = orgId ? { orgId } : {};

    const [
      totalOrgs,
      activeOrgs,
      totalUsers,
      activeUsers,
      activeSessions,
      totalSessions,
      activeProxies,
      totalProxies,
      recentEvents
    ] = await Promise.all([
      prisma.organization.count(orgId ? { where: { id: orgId } } : {}),
      prisma.organization.count({ where: { ...orgFilter, status: 'ACTIVE' } }),
      prisma.user.count({ where: orgFilter }),
      prisma.user.count({ where: { ...orgFilter, status: 'ACTIVE' } }),
      prisma.session.count({ where: { ...orgFilter, status: 'ACTIVE' } }),
      prisma.session.count({ where: orgFilter }),
      prisma.proxyNode.count({ where: { ...orgFilter, status: 'ACTIVE' } }),
      prisma.proxyNode.count({ where: orgFilter }),
      prisma.auditLog.findMany({
        where: { ...orgFilter, resource: 'event' },
        orderBy: { createdAt: 'desc' },
        take: 20
      })
    ]);

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentSessions = await prisma.session.findMany({
      where: {
        ...orgFilter,
        startedAt: { gte: thirtyMinutesAgo }
      },
      include: {
        user: { select: { username: true } },
        proxyNode: { select: { name: true } },
        org: { select: { displayName: true } }
      },
      orderBy: { startedAt: 'desc' },
      take: 50
    });

    const proxyStats = await prisma.proxyNode.groupBy({
      by: ['status'],
      where: orgFilter,
      _count: true
    });

    const sessionStats = await prisma.session.groupBy({
      by: ['status'],
      where: orgFilter,
      _count: true
    });

    const errorsByType = recentEvents.filter(e =>
      e.action.includes('kill-switch') || e.action.includes('error')
    ).length;

    res.json({
      overview: {
        totalOrgs,
        activeOrgs,
        totalUsers,
        activeUsers,
        activeSessions,
        totalSessions,
        activeProxies,
        totalProxies,
        systemHealth: calculateHealth(activeProxies, totalProxies, activeSessions, errorsByType)
      },
      recentSessions: recentSessions.map(s => ({
        sessionId: s.id,
        org: s.org?.displayName || 'Unknown',
        operator: s.user?.username || 'Unknown',
        proxyNode: s.proxyNode?.name || 'none',
        status: s.status,
        targetUrl: s.targetUrl,
        startedAt: s.startedAt
      })),
      proxyDistribution: proxyStats,
      sessionDistribution: sessionStats,
      recentEvents: recentEvents.map(e => ({
        id: e.id,
        action: e.action,
        details: e.details,
        createdAt: e.createdAt
      }))
    });
  } catch (err) {
    console.error('[Dashboard] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.get('/health', async (req, res) => {
  const prisma = req.app.get('prisma');

  try {
    const dbHealthy = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);

    const activeSessions = await prisma.session.count({ where: { status: 'ACTIVE' } });
    const staleSessions = await prisma.session.count({
      where: {
        status: 'ACTIVE',
        lastHeartbeat: { lt: new Date(Date.now() - 5 * 60 * 1000) }
      }
    });

    const unhealthyProxies = await prisma.proxyNode.count({
      where: { status: { in: ['UNREACHABLE', 'DEGRADED'] } }
    });

    const overallHealth = dbHealthy && unhealthyProxies === 0 && staleSessions === 0
      ? 'operational'
      : dbHealthy ? 'degraded' : 'critical';

    res.json({
      status: overallHealth,
      database: dbHealthy ? 'connected' : 'disconnected',
      metrics: {
        activeSessions,
        staleSessions,
        unhealthyProxies
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({ status: 'critical', error: err.message });
  }
});

router.get('/audit', async (req, res) => {
  const prisma = req.app.get('prisma');
  const { startDate, endDate, userId, resource, limit, offset } = req.query;

  try {
    const where = {};
    if (req.user.orgId) where.orgId = req.user.orgId;
    if (userId) where.userId = userId;
    if (resource) where.resource = resource;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { username: true } },
          org: { select: { displayName: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit) || 100,
        skip: parseInt(offset) || 0
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({ logs, total, limit: parseInt(limit) || 100, offset: parseInt(offset) || 0 });
  } catch (err) {
    console.error('[Dashboard] Audit log error:', err.message);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

function calculateHealth(activeProxies, totalProxies, activeSessions, errorCount) {
  const proxyHealth = totalProxies > 0 ? (activeProxies / totalProxies) * 100 : 100;
  const errorRate = activeSessions > 0 ? (errorCount / activeSessions) * 100 : 0;
  const health = Math.max(0, Math.min(100, proxyHealth - errorRate * 2));
  return Math.round(health * 10) / 10;
}

module.exports = router;

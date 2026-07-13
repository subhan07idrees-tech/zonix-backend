const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireOrgAccess, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/:orgId', requireOrgAccess, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId } = req.params;

  try {
    const proxies = await prisma.proxyNode.findMany({
      where: { orgId },
      include: {
        _count: { select: { sessions: true, healthChecks: true } },
        healthChecks: {
          orderBy: { checkedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const sanitized = proxies.map(p => ({
      ...p,
      password: p.passwordHash,
      passwordHash: undefined,
      healthChecks: undefined,
      lastHealthCheck: p.healthChecks[0] || null
    }));

    res.json({ proxies: sanitized });
  } catch (err) {
    console.error('[Proxies] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch proxies' });
  }
});

router.post('/:orgId', requireOrgAccess, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), [
  body('name').notEmpty().trim().withMessage('Name required'),
  body('host').notEmpty().trim().withMessage('Host required'),
  body('port').isInt({ min: 1, max: 65535 }).withMessage('Valid port required'),
  body('protocol').optional().isIn(['HTTP', 'HTTPS', 'SOCKS5']),
  body('username').optional().trim(),
  body('password').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const prisma = req.app.get('prisma');
  const { orgId } = req.params;
  const { name, host, port, protocol, username, password, maxSessions } = req.body;

  try {
    const existing = await prisma.proxyNode.findFirst({
      where: { orgId, name }
    });
    if (existing) {
      return res.status(409).json({ error: 'Proxy name already exists in this organization' });
    }

    let passwordHash = null;
    if (password) {
      passwordHash = password;
    }

    const proxy = await prisma.proxyNode.create({
      data: {
        orgId,
        name,
        host,
        port,
        protocol: protocol || 'HTTP',
        username: username || null,
        passwordHash,
        maxSessions: maxSessions || 10
      }
    });

    const sanitized = { ...proxy, passwordHash: undefined };
    res.status(201).json({ proxy: sanitized });
  } catch (err) {
    console.error('[Proxies] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create proxy' });
  }
});

router.put('/:orgId/:proxyId', requireOrgAccess, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId, proxyId } = req.params;
  const { name, host, port, protocol, username, password, status, maxSessions } = req.body;

  try {
    const proxy = await prisma.proxyNode.findFirst({
      where: { id: proxyId, orgId }
    });
    if (!proxy) {
      return res.status(404).json({ error: 'Proxy not found' });
    }

    let passwordHash = undefined;
    if (password) {
      passwordHash = password;
    }

    const updated = await prisma.proxyNode.update({
      where: { id: proxyId },
      data: {
        ...(name && { name }),
        ...(host && { host }),
        ...(port && { port }),
        ...(protocol && { protocol }),
        ...(username !== undefined && { username }),
        ...(passwordHash && { passwordHash }),
        ...(status && { status }),
        ...(maxSessions && { maxSessions })
      }
    });

    const sanitized = { ...updated, passwordHash: undefined };
    res.json({ proxy: sanitized });
  } catch (err) {
    console.error('[Proxies] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update proxy' });
  }
});

router.delete('/:orgId/:proxyId', requireOrgAccess, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId, proxyId } = req.params;

  try {
    const activeSessions = await prisma.session.count({
      where: { proxyNodeId: proxyId, status: 'ACTIVE' }
    });

    if (activeSessions > 0) {
      return res.status(400).json({
        error: `Proxy has ${activeSessions} active sessions. Kill them first.`
      });
    }

    await prisma.proxyNode.delete({ where: { id: proxyId } });
    res.json({ success: true, message: 'Proxy deleted' });
  } catch (err) {
    console.error('[Proxies] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete proxy' });
  }
});

router.get('/:orgId/:proxyId/health', requireOrgAccess, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId, proxyId } = req.params;

  try {
    const healthChecks = await prisma.proxyHealthCheck.findMany({
      where: { proxyNodeId: proxyId },
      orderBy: { checkedAt: 'desc' },
      take: 50
    });

    res.json({ healthChecks });
  } catch (err) {
    console.error('[Proxies] Health history error:', err.message);
    res.status(500).json({ error: 'Failed to fetch health history' });
  }
});

router.post('/:orgId/:proxyId/test', requireOrgAccess, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId, proxyId } = req.params;

  try {
    const proxy = await prisma.proxyNode.findFirst({ where: { id: proxyId, orgId } });
    if (!proxy) return res.status(404).json({ error: 'Proxy not found' });

    const net = require('net');
    const start = Date.now();

    const result = await new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ reachable: false, latencyMs: -1, error: 'Connection timed out (5s)' });
      }, 5000);

      socket.connect(proxy.port, proxy.host, () => {
        clearTimeout(timeout);
        const latencyMs = Date.now() - start;
        socket.destroy();
        resolve({ reachable: true, latencyMs });
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ reachable: false, latencyMs: -1, error: err.message });
      });
    });

    // Persist the result as a health check entry
    if (result.reachable) {
      await prisma.proxyNode.update({
        where: { id: proxyId },
        data: { status: 'ACTIVE' }
      });
      await prisma.proxyHealthCheck.create({
        data: {
          proxyNodeId: proxyId,
          status: 'ACTIVE',
          latencyMs: result.latencyMs,
          checkedAt: new Date()
        }
      });
    } else {
      await prisma.proxyNode.update({
        where: { id: proxyId },
        data: { status: 'UNREACHABLE' }
      });
      await prisma.proxyHealthCheck.create({
        data: {
          proxyNodeId: proxyId,
          status: 'UNREACHABLE',
          latencyMs: -1,
          checkedAt: new Date()
        }
      });
    }

    res.json({ ...result, proxy: { host: proxy.host, port: proxy.port, protocol: proxy.protocol } });
  } catch (err) {
    console.error('[Proxies] Test error:', err.message);
    res.status(500).json({ error: 'Test failed: ' + err.message });
  }
});

module.exports = router;

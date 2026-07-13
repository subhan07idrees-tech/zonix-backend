const { getIpLocation } = require('../services/geolocation');

const auditMiddleware = (req, res, next) => {
  const originalSend = res.send;

  res.send = function(body) {
    if (req.user && req.method !== 'GET') {
      logAuditEvent(req).catch(err => {
        console.error('[Audit] Failed to log event:', err.message);
      });
    }
    originalSend.call(this, body);
  };

  next();
};

async function logAuditEvent(req) {
  const prisma = req.app.get('prisma');
  if (!prisma) return;

  try {
    const action = `${req.method} ${req.path}`;
    const resource = extractResource(req.path);
    const resourceId = req.params.id || req.params.sessionId || null;

    const ipAddress = req.ip || req.connection?.remoteAddress || '';
    const loc = await getIpLocation(ipAddress);

    let details = {};
    if (req.body && Object.keys(req.body).length > 0) {
      const sanitized = { ...req.body };
      delete sanitized.password;
      delete sanitized.passwordHash;
      delete sanitized.token;
      details = sanitized;
    }
    details.city = loc.city;
    details.state = loc.state;

    await prisma.auditLog.create({
      data: {
        orgId: req.user.orgId,
        userId: req.user.userId,
        action,
        resource,
        resourceId,
        details,
        ipAddress
      }
    });
  } catch (err) {
    console.error('[Audit] Log creation error:', err.message);
  }
}

function extractResource(path) {
  const segments = path.split('/').filter(Boolean);
  if (segments.length >= 2) {
    return segments[1];
  }
  return 'unknown';
}

async function queryAuditLogs(prisma, { orgId, userId, resource, action, startDate, endDate, limit = 100, offset = 0 }) {
  const where = {};

  if (orgId) where.orgId = orgId;
  if (userId) where.userId = userId;
  if (resource) where.resource = resource;
  if (action) where.action = { contains: action };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { username: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.auditLog.count({ where })
  ]);

  return { logs, total, limit, offset };
}

module.exports = { auditMiddleware, queryAuditLogs };

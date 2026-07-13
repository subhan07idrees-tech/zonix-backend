const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'zonix-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      orgId: user.orgId,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
}

function requireOrgAccess(req, res, next) {
  const targetOrgId = req.params.orgId || req.body.orgId || req.query.orgId;

  if (targetOrgId && req.user.orgId !== targetOrgId && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied to this organization' });
  }

  next();
}

function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return authenticateToken(req, res, next);
  }

  const prisma = req.app.get('prisma');
  const keyPrefix = apiKey.substring(0, 8);

  prisma.apiKey.findFirst({
    where: {
      keyPrefix,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    }
  }).then(async (keyRecord) => {
    if (!keyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const bcrypt = require('bcryptjs');
    const isValid = await bcrypt.compare(apiKey, keyRecord.keyHash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() }
    });

    req.user = {
      orgId: keyRecord.orgId,
      role: 'ADMIN',
      permissions: keyRecord.permissions
    };

    next();
  }).catch((err) => {
    console.error('[Auth] API key verification failed:', err.message);
    return res.status(500).json({ error: 'Authentication error' });
  });
}

module.exports = {
  generateToken,
  authenticateToken,
  requireRole,
  requireOrgAccess,
  authenticateApiKey,
  JWT_SECRET
};

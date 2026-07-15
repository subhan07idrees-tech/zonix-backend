const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { generateToken } = require('../middleware/auth');
const { getIpLocation } = require('../services/geolocation');

const router = express.Router();

async function logLoginAttempt(prisma, { orgId, username, success, error, ipAddress }) {
  try {
    const loc = await getIpLocation(ipAddress);
    
    // Resolve organization ID from name/display-name if needed
    let resolvedOrgId = 'zonix-system'; // Default placeholder for system/unknown orgs
    let userOrgId = null;
    let resolvedUserId = null;
    let resolvedUsername = username || 'unknown';

    if (orgId && orgId !== 'zonix-system') {
      const org = await prisma.organization.findFirst({
        where: { OR: [{ id: orgId }, { name: orgId }, { displayName: orgId }] }
      });
      if (org) {
        resolvedOrgId = org.id;
      }
    }

    if (username) {
      const user = await prisma.user.findFirst({
        where: { orgId: resolvedOrgId, username }
      });
      if (user) {
        resolvedUserId = user.id;
        userOrgId = user.orgId;
        resolvedUsername = user.username;
      }
    }

    await prisma.auditLog.create({
      data: {
        orgId: userOrgId || resolvedOrgId,
        userId: resolvedUserId,
        action: success ? 'POST /auth/login' : `POST /auth/login (failed)`,
        resource: 'auth',
        details: {
          username: resolvedUsername,
          success,
          error: error || null,
          city: loc.city,
          state: loc.state
        },
        ipAddress
      }
    });
  } catch (err) {
    console.error('[Auth] Failed to log login attempt:', err.message);
  }
}

router.post('/login', [
  body('username').notEmpty().withMessage('Username required'),
  body('password').notEmpty().withMessage('Password required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const prisma = req.app.get('prisma');
  let { orgId, username, password } = req.body;
  const ipAddress = (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '').split(',')[0].trim();

  try {
    const fs = require('fs');
    const logMsg = `${new Date().toISOString()} - Login Request: orgId='${orgId}', username='${username}'\n`;
    fs.appendFileSync(require('path').join(__dirname, '..', 'debug.log'), logMsg);

    console.log('[ZONIX Backend] Login request received for org:', orgId, 'username:', username);
    if (!orgId || orgId.trim() === '') {
      if (username === 'superadmin') {
        orgId = 'zonix-system';
        fs.appendFileSync(require('path').join(__dirname, '..', 'debug.log'), `Defaulted orgId to 'zonix-system'\n`);
      } else {
        fs.appendFileSync(require('path').join(__dirname, '..', 'debug.log'), `Rejected: Org ID required\n`);
        await logLoginAttempt(prisma, { orgId, username, success: false, error: 'Organization ID required', ipAddress });
        return res.status(400).json({ error: 'Organization ID required' });
      }
    }

    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { name: orgId },
          { displayName: orgId }
        ]
      }
    });
    if (!org) {
      fs.appendFileSync(require('path').join(__dirname, '..', 'debug.log'), `Rejected: Organization '${orgId}' not found in DB\n`);
      console.log('[ZONIX Backend] Organization not found:', orgId);
      await logLoginAttempt(prisma, { orgId, username, success: false, error: 'Organization not found', ipAddress });
      return res.status(404).json({ error: 'Organization not found' });
    }
    fs.appendFileSync(require('path').join(__dirname, '..', 'debug.log'), `Found organization UUID: ${org.id}\n`);
    console.log('[ZONIX Backend] Organization found:', org.name, 'UUID:', org.id);
    if (org.status !== 'ACTIVE') {
      await logLoginAttempt(prisma, { orgId: org.id, username, success: false, error: 'Organization is suspended', ipAddress });
      return res.status(403).json({ error: 'Organization is suspended' });
    }

    const user = await prisma.user.findFirst({
      where: { orgId: org.id, username }
    });

    if (!user) {
      console.log('[ZONIX Backend] User not found for:', username);
      await logLoginAttempt(prisma, { orgId: org.id, username, success: false, error: 'Invalid credentials (User not found)', ipAddress });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status !== 'ACTIVE') {
      await logLoginAttempt(prisma, { orgId: org.id, username, success: false, error: 'Account is suspended or locked', ipAddress });
      return res.status(403).json({ error: 'Account is suspended or locked' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      await logLoginAttempt(prisma, { orgId: org.id, username, success: false, error: 'Invalid credentials (Bad password)', ipAddress });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Terminate any existing active dispatcher sessions for this user in DB
    try {
      await prisma.session.updateMany({
        where: { userId: user.id, status: 'ACTIVE' },
        data: { status: 'KILLED', endedAt: new Date(), endReason: 'login-conflict' }
      });
    } catch (dbErr) {
      console.error('[Auth] Failed to terminate existing DB sessions:', dbErr.message);
    }

    // Trigger a force logout command via WebSocket to other client instances of this user
    try {
      const { forceLogoutUser } = require('../server');
      forceLogoutUser(user.id);
    } catch (wsErr) {
      console.error('[Auth] Failed to broadcast force-logout:', wsErr.message);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const token = generateToken(user);

    await logLoginAttempt(prisma, { orgId: org.id, username, success: true, ipAddress });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        orgId: user.orgId
      },
      organization: {
        id: org.id,
        name: org.name,
        displayName: org.displayName,
        targetUrl: org.targetUrl
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/verify', async (req, res) => {
  const prisma = req.app.get('prisma');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ valid: false });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zonix-secret-change-in-production');

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, role: true, status: true, orgId: true }
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ valid: false });
    }

    res.json({ valid: true, user });
  } catch (err) {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { requireRole, requireOrgAccess } = require('../middleware/auth');

const router = express.Router();

router.get('/:orgId', requireOrgAccess, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId } = req.params;

  try {
    console.log('[ZONIX Backend] Fetching users for orgId:', orgId);
    const users = await prisma.user.findMany({
      where: { orgId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { sessions: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('[ZONIX Backend] Users found count:', users.length);
    res.json({ users });
  } catch (err) {
    console.error('[Users] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/:orgId', requireOrgAccess, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), [
  body('username').notEmpty().trim().withMessage('Username required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').optional().isIn(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DISPATCHER', 'VIEWER']),
  body('email').optional().isEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const prisma = req.app.get('prisma');
  const { orgId } = req.params;
  const { username, password, role, email } = req.body;

  try {
    console.log('[ZONIX Backend] Creating user for org:', orgId, 'username:', username, 'role:', role);
    const existing = await prisma.user.findFirst({
      where: { orgId, username }
    });
    if (existing) {
      console.log('[ZONIX Backend] User creation blocked: username already exists in this org');
      return res.status(409).json({ error: 'Username already exists in this organization' });
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      console.log('[ZONIX Backend] User creation blocked: org not found:', orgId);
      return res.status(404).json({ error: 'Organization not found' });
    }
    const userCount = await prisma.user.count({ where: { orgId } });
    if (userCount >= org.maxUsers) {
      return res.status(400).json({ error: `Organization user limit reached (${org.maxUsers})` });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        orgId,
        username,
        passwordHash,
        role: role || 'DISPATCHER',
        email: email || null
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    res.status(201).json({ user });
  } catch (err) {
    console.error('[Users] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/:orgId/:userId', requireOrgAccess, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), [
  body('role').optional().isIn(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DISPATCHER', 'VIEWER']),
  body('status').optional().isIn(['ACTIVE', 'SUSPENDED', 'LOCKED']),
  body('email').optional().isEmail(),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId, userId } = req.params;
  const { role, status, email, password } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, orgId }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let passwordHash = undefined;
    if (password) {
      const bcrypt = require('bcryptjs');
      passwordHash = await bcrypt.hash(password, 12);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(role && { role }),
        ...(status && { status }),
        ...(email !== undefined && { email }),
        ...(passwordHash && { passwordHash })
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true
      }
    });

    res.json({ user: updated });
  } catch (err) {
    console.error('[Users] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.post('/:orgId/:userId/reset-password', requireOrgAccess, requireRole('SUPER_ADMIN', 'ADMIN'), [
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const prisma = req.app.get('prisma');
  const { orgId, userId } = req.params;
  const { newPassword } = req.body;

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('[Users] Password reset error:', err.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.delete('/:orgId/:userId', requireOrgAccess, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId, userId } = req.params;

  try {
    await prisma.user.delete({
      where: { id: userId }
    });

    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    console.error('[Users] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;

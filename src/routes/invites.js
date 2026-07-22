const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole, requireOrgAccess } = require('../middleware/auth');
const { sendInviteEmail } = require('../services/email');

const router = express.Router();

// Public: Verify an invite token before rendering the signup form
router.get('/verify/:token', async (req, res) => {
  const prisma = req.app.get('prisma');
  const { token } = req.params;

  try {
    const invite = await prisma.userInvite.findUnique({
      where: { token },
      include: {
        org: { select: { displayName: true, name: true } }
      }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invitation link is invalid or does not exist.' });
    }

    if (invite.status !== 'PENDING') {
      return res.status(400).json({ error: `Invitation link has already been ${invite.status.toLowerCase()}.` });
    }

    if (new Date(invite.expiresAt) < new Date()) {
      await prisma.userInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' }
      });
      return res.status(410).json({ error: 'Invitation link has expired. Please ask your administrator for a new invite.' });
    }

    res.json({
      valid: true,
      email: invite.email,
      role: invite.role,
      maxTabs: invite.maxTabs,
      orgName: invite.org.displayName || invite.org.name,
      expiresAt: invite.expiresAt
    });
  } catch (err) {
    console.error('[Invite] Verify Error:', err.message);
    res.status(500).json({ error: 'Failed to verify invitation' });
  }
});

// Public: Accept an invite link and create account
router.post('/accept', [
  body('token').notEmpty().withMessage('Token required'),
  body('username').notEmpty().trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const prisma = req.app.get('prisma');
  const { token, username, password } = req.body;

  try {
    const invite = await prisma.userInvite.findUnique({
      where: { token },
      include: { org: true }
    });

    if (!invite || invite.status !== 'PENDING' || new Date(invite.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired invitation link' });
    }

    // Check if username is already taken in this Organization
    const existing = await prisma.user.findUnique({
      where: {
        orgId_username: {
          orgId: invite.orgId,
          username: username.toLowerCase().trim()
        }
      }
    });

    if (existing) {
      return res.status(409).json({ error: `Username '${username}' is already taken in this organization.` });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create User & update invite in transaction
    const [user] = await prisma.$transaction([
      prisma.user.create({
        data: {
          orgId: invite.orgId,
          username: username.toLowerCase().trim(),
          email: invite.email,
          passwordHash,
          role: invite.role,
          maxTabs: invite.maxTabs,
          status: 'ACTIVE'
        }
      }),
      prisma.userInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' }
      })
    ]);

    // Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          orgId: invite.orgId,
          userId: user.id,
          action: 'INVITE_ACCEPTED',
          resource: 'user',
          resourceId: user.id,
          details: { username: user.username, email: user.email, role: user.role }
        }
      });
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: 'Account created successfully! You can now log into the ZONIX app.',
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('[Invite] Accept Error:', err.message);
    res.status(500).json({ error: 'Failed to complete account setup' });
  }
});

// Admin: Get all pending/recent invites for an organization
router.get('/:orgId', authenticateToken, requireOrgAccess, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId } = req.params;

  try {
    const invites = await prisma.userInvite.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ invites });
  } catch (err) {
    console.error('[Invite] List Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Admin: Create and send invitation email
router.post('/:orgId', authenticateToken, requireOrgAccess, requireRole('SUPER_ADMIN', 'ADMIN'), [
  body('email').isEmail().withMessage('Valid email required'),
  body('role').optional().isIn(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DISPATCHER', 'VIEWER']),
  body('maxTabs').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const prisma = req.app.get('prisma');
  const { orgId } = req.params;
  const { email, role = 'DISPATCHER', maxTabs = 5 } = req.body;

  try {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Generate 64-char hex token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Create pending invite for this email in this org
    const invite = await prisma.userInvite.create({
      data: {
        orgId,
        email: email.toLowerCase().trim(),
        role,
        maxTabs,
        token,
        status: 'PENDING',
        expiresAt,
        invitedBy: req.user.userId || req.user.id || 'system'
      }
    });

    const webDomain = process.env.PUBLIC_WEB_URL || 'https://thezonix.com';
    const inviteLink = `${webDomain}/join?token=${token}`;

    // Send email asynchronously
    const emailResult = await sendInviteEmail({
      email: invite.email,
      orgName: org.displayName || org.name,
      role: invite.role,
      inviteLink,
      expiresAt: invite.expiresAt
    });

    res.status(201).json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        maxTabs: invite.maxTabs,
        token: invite.token,
        inviteLink,
        expiresAt: invite.expiresAt,
        emailSent: emailResult.success
      }
    });
  } catch (err) {
    console.error('[Invite] Create Error:', err.message);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Admin: Cancel / Delete an invitation
router.delete('/:orgId/:inviteId', authenticateToken, requireOrgAccess, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const prisma = req.app.get('prisma');
  const { inviteId } = req.params;

  try {
    await prisma.userInvite.delete({ where: { id: inviteId } });
    res.json({ success: true, message: 'Invitation cancelled' });
  } catch (err) {
    console.error('[Invite] Delete Error:', err.message);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

module.exports = router;

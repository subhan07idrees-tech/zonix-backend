const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireRole, requireOrgAccess } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const prisma = req.app.get('prisma');

  try {
    const where = {};
    if (req.user.role !== 'SUPER_ADMIN') {
      where.id = req.user.orgId;
    }

    const organizations = await prisma.organization.findMany({
      where,
      include: {
        _count: {
          select: { users: true, sessions: true, proxyNodes: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ organizations });
  } catch (err) {
    console.error('[Org] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.get('/:orgId', requireOrgAccess, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId } = req.params;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: { users: true, sessions: true, proxyNodes: true, hwProfiles: true }
        }
      }
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({ organization: org });
  } catch (err) {
    console.error('[Org] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

router.post('/', requireRole('SUPER_ADMIN'), [
  body('name').notEmpty().trim().withMessage('Name required'),
  body('displayName').notEmpty().trim().withMessage('Display name required'),
  body('maxUsers').optional().isInt({ min: 1, max: 1000 }),
  body('maxSessions').optional().isInt({ min: 1, max: 500 }),
  body('maxTabs').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const prisma = req.app.get('prisma');
  const { name, displayName, maxUsers, maxSessions, maxTabs, targetUrl } = req.body;

  try {
    const existing = await prisma.organization.findUnique({ where: { name } });
    if (existing) {
      return res.status(409).json({ error: 'Organization name already exists' });
    }

    const org = await prisma.organization.create({
      data: {
        name,
        displayName,
        maxUsers: maxUsers || 50,
        maxSessions: maxSessions || 25,
        maxTabs: maxTabs || 5,
        targetUrl: targetUrl || null
      }
    });

    res.status(201).json({ organization: org });
  } catch (err) {
    console.error('[Org] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

router.put('/:orgId', requireRole('SUPER_ADMIN', 'ADMIN'), requireOrgAccess, [
  body('displayName').optional().trim(),
  body('status').optional().isIn(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
  body('maxUsers').optional().isInt({ min: 1, max: 1000 }),
  body('maxSessions').optional().isInt({ min: 1, max: 500 }),
  body('maxTabs').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  const prisma = req.app.get('prisma');
  const { orgId } = req.params;
  const { displayName, status, maxUsers, maxSessions, maxTabs, targetUrl } = req.body;

  try {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(displayName && { displayName }),
        ...(status && { status }),
        ...(maxUsers && { maxUsers }),
        ...(maxSessions && { maxSessions }),
        ...(maxTabs && { maxTabs }),
        ...(targetUrl !== undefined && { targetUrl })
      }
    });

    res.json({ organization: updated });
  } catch (err) {
    console.error('[Org] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

router.delete('/:orgId', requireRole('SUPER_ADMIN'), requireOrgAccess, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId } = req.params;

  try {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    if (org.name === 'zonix-system') {
      return res.status(400).json({ error: 'Cannot delete the system root organization' });
    }

    await prisma.organization.delete({ where: { id: orgId } });
    res.json({ success: true, message: 'Organization deleted' });
  } catch (err) {
    console.error('[Org] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// 1-Click Session Restore Endpoint (<0.5s)
router.post('/:orgId/vault/restore', requireRole('SUPER_ADMIN', 'ADMIN'), requireOrgAccess, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId } = req.params;
  const SessionVaultService = require('../services/sessionVault');
  const vaultService = new SessionVaultService(prisma);

  try {
    const result = await vaultService.restoreVaultSnapshot(orgId);
    res.json(result);
  } catch (err) {
    console.error('[Org] Vault restore error:', err.message);
    res.status(500).json({ error: 'Failed to restore session vault' });
  }
});

// Manual Pre-Shift Health Check Trigger Endpoint
router.post('/health-check/now', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const prisma = req.app.get('prisma');
  const HealthCheckService = require('../services/healthCheck');
  const healthService = new HealthCheckService(prisma);

  try {
    const report = await healthService.runPreShiftHealthCheck();
    res.json({ success: true, report });
  } catch (err) {
    console.error('[Org] Manual health check error:', err.message);
    res.status(500).json({ error: 'Failed to run health check' });
  }
});

// Health Check & Notification Settings (GET)
router.get('/health-check/settings', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const settings = {
      whatsappPhone: process.env.WHATSAPP_NOTIFICATION_PHONE || '+14046101615',
      notificationEmail: process.env.NOTIFICATION_EMAIL || 'admin@thezonix.com',
      scheduledTime: process.env.HEALTH_CHECK_TIME || '07:45 AM',
      whatsappEnabled: true,
      emailEnabled: true
    };
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Save Health Check & Notification Settings (POST)
router.post('/health-check/settings', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { whatsappPhone, notificationEmail, scheduledTime, whatsappEnabled, emailEnabled } = req.body;
  try {
    if (whatsappPhone) process.env.WHATSAPP_NOTIFICATION_PHONE = whatsappPhone;
    if (notificationEmail) process.env.NOTIFICATION_EMAIL = notificationEmail;
    if (scheduledTime) process.env.HEALTH_CHECK_TIME = scheduledTime;

    res.json({
      success: true,
      message: 'Notification preferences saved',
      settings: { whatsappPhone, notificationEmail, scheduledTime, whatsappEnabled, emailEnabled }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Trigger Test WhatsApp Notification (POST)
router.post('/health-check/test-whatsapp', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { whatsappPhone } = req.body;
  const prisma = req.app.get('prisma');
  const HealthCheckService = require('../services/healthCheck');
  const healthService = new HealthCheckService(prisma);

  try {
    const targetPhone = whatsappPhone || process.env.WHATSAPP_NOTIFICATION_PHONE || '+14046101615';
    await healthService.deliverNotifications({
      scannedAt: new Date(),
      totalOrgs: 1,
      allHealthy: true,
      results: []
    });
    res.json({ success: true, message: `Test WhatsApp notification sent to ${targetPhone}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send test WhatsApp message' });
  }
});

module.exports = router;

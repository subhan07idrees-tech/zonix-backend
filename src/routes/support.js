const express = require('express');
const router = express.Router();
const { sendSupportTicket, sendBroadcastEmail } = require('../services/email');

/**
 * Submit In-App Customer Support Ticket / Broadcast Report
 * POST /api/support/ticket
 */
router.post('/ticket', async (req, res) => {
  const { 
    subject, 
    message, 
    telemetry, 
    notifyAllUsers, 
    ticketType = 'SUPPORT', 
    maintenanceWindow, 
    audience = 'single' 
  } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required' });
  }

  const prisma = req.app.get('prisma');

  try {
    let userEmail = req.body.userEmail || req.user?.email;
    let username = req.user?.username || 'Dispatcher';
    let orgName = req.user?.orgName;
    const userRole = req.user?.role || 'OPERATOR';
    const userOrgId = req.user?.orgId;

    const userId = req.user?.userId || req.user?.id;
    if (userId && (!userEmail || userEmail.includes('@zonix.io') || !orgName || !userOrgId)) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          include: { org: true }
        });
        if (dbUser) {
          if (!userEmail || userEmail.includes('@zonix.io')) {
            userEmail = dbUser.email;
          }
          username = dbUser.username || username;
          orgName = dbUser.org?.displayName || dbUser.org?.name || orgName;
        }
      } catch (dbErr) {
        console.warn('[SupportRoute] DB lookup warning:', dbErr.message);
      }
    }

    if (!userEmail || userEmail.includes('@zonix.io') || userEmail === 'support.zonix@gmail.com') {
      userEmail = 'subhan07idrees@gmail.com';
    }
    orgName = orgName || 'ZONIX Organization';

    // Resolve target recipients based on audience
    let recipients = [];

    if (audience === 'org') {
      // Find all users belonging to this user's organization
      if (userOrgId) {
        const orgUsers = await prisma.user.findMany({
          where: { 
            orgId: userOrgId, 
            email: { not: null } 
          },
          select: { email: true }
        });
        recipients = orgUsers.map(u => u.email).filter(Boolean);
      }
    } else if (audience === 'all' || notifyAllUsers) {
      // Fleet-wide (SuperAdmin or notifyAllUsers)
      const allUsers = await prisma.user.findMany({
        where: { email: { not: null } },
        select: { email: true }
      });
      recipients = allUsers.map(u => u.email).filter(Boolean);
    }

    // Filter out dummy domains and deduplicate
    recipients = [...new Set(recipients.filter(e => e && !e.includes('@zonix.io') && e !== 'support.zonix@gmail.com'))];

    // If single user or no org users found, fallback to target user email
    if (recipients.length === 0) {
      recipients = [userEmail];
    }

    // Dispatch executive branded email
    const ticketResult = await sendSupportTicket({
      recipients,
      userEmail,
      username,
      orgName,
      subject,
      message,
      ticketType,
      maintenanceWindow,
      telemetry
    });

    if (ticketResult.success) {
      const count = ticketResult.recipients?.length || recipients.length;
      let statusMsg = '';
      if (ticketType === 'MAINTENANCE') {
        statusMsg = count > 1 
          ? `Maintenance advisory dispatched to ${count} users across ${orgName}.` 
          : `Maintenance advisory delivered to ${recipients[0]}.`;
      } else if (ticketType === 'ANNOUNCEMENT') {
        statusMsg = count > 1 
          ? `System announcement broadcasted to ${count} users.` 
          : `System announcement delivered to ${recipients[0]}.`;
      } else {
        statusMsg = count > 1 
          ? `Support ticket notification sent to ${count} users.` 
          : `Support ticket delivered to ${recipients[0]}.`;
      }

      res.json({
        success: true,
        message: statusMsg,
        recipientCount: count,
        recipients: ticketResult.recipients || recipients
      });
    } else {
      res.status(500).json({ error: ticketResult.error || 'Failed to deliver support ticket' });
    }
  } catch (err) {
    console.error('[SupportRoute] Error:', err.message);
    res.status(500).json({ error: 'Failed to process support ticket' });
  }
});

/**
 * Super Admin Broadcast System Announcement / Maintenance Notice
 * POST /api/support/broadcast
 */
router.post('/broadcast', async (req, res) => {
  const { subject, announcementText } = req.body;
  const prisma = req.app.get('prisma');

  try {
    const users = await prisma.user.findMany({
      where: { email: { not: null } },
      select: { email: true }
    });

    const emailList = [...new Set(users.map(u => u.email).filter(Boolean))];
    if (emailList.length === 0) {
      return res.status(400).json({ error: 'No user emails found to broadcast' });
    }

    const result = await sendBroadcastEmail({
      recipients: emailList,
      subject,
      announcementText
    });

    res.json({ success: true, count: emailList.length, result });
  } catch (err) {
    console.error('[SupportRoute] Broadcast error:', err.message);
    res.status(500).json({ error: 'Failed to broadcast announcement' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { sendSupportTicket, sendBroadcastEmail } = require('../services/email');

/**
 * Submit In-App Customer Support Ticket / Broadcast Report
 * POST /api/support/ticket
 */
router.post('/ticket', async (req, res) => {
  const { subject, message, telemetry, notifyAllUsers } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required' });
  }

  const prisma = req.app.get('prisma');

  try {
    const userEmail = req.user?.email || 'dispatcher@thezonix.com';
    const username = req.user?.username || 'Dispatcher';
    const orgName = req.user?.orgName || 'ZONIX Organization';

    // 1. Always deliver ticket to support.zonix@gmail.com
    const ticketResult = await sendSupportTicket({
      userEmail,
      username,
      orgName,
      subject,
      message,
      telemetry
    });

    let broadcastCount = 0;

    // 2. If notifyAllUsers is enabled (or triggered by admin/report), broadcast to all registered users across ALL organizations
    if (notifyAllUsers) {
      const allUsers = await prisma.user.findMany({
        where: { email: { not: null } },
        select: { email: true }
      });
      const emailList = [...new Set(allUsers.map(u => u.email).filter(Boolean))];
      
      if (emailList.length > 0) {
        await sendBroadcastEmail({
          recipients: emailList,
          subject: `[ZONIX Fleet Alert] ${subject}`,
          announcementText: `Reported by ${username} (${orgName}):\n\n${message}`
        });
        broadcastCount = emailList.length;
      }
    }

    if (ticketResult.success) {
      res.json({
        success: true,
        message: notifyAllUsers
          ? `Support ticket delivered & broadcasted to ${broadcastCount} users across all organizations.`
          : 'Support ticket submitted successfully to support.zonix@gmail.com.'
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

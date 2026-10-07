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
    let userEmail = req.user?.email;
    let username = req.user?.username || 'Dispatcher';
    let orgName = req.user?.orgName;

    const userId = req.user?.userId || req.user?.id;
    if (userId && (!userEmail || !orgName)) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          include: { org: true }
        });
        if (dbUser) {
          userEmail = dbUser.email || userEmail;
          username = dbUser.username || username;
          orgName = dbUser.org?.displayName || dbUser.org?.name || orgName;
        }
      } catch (dbErr) {
        console.warn('[SupportRoute] DB lookup warning:', dbErr.message);
      }
    }

    userEmail = userEmail || 'support.zonix@gmail.com';
    orgName = orgName || 'ZONIX Organization';

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
      const deliveredTo = ticketResult.recipient || userEmail;
      res.json({
        success: true,
        message: notifyAllUsers
          ? `Support ticket confirmed & broadcasted to ${broadcastCount} users.`
          : `Support ticket dispatched from support.zonix@gmail.com to ${deliveredTo}.`
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

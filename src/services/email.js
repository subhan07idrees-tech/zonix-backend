const nodemailer = require('nodemailer');

// 1. Invites Transporter (invites.zonix@gmail.com)
const inviteTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_INVITE_USER || 'invites.zonix@gmail.com',
    pass: process.env.GMAIL_INVITE_PASS || 'gcqedtxkounkyxzs'
  }
});

// 2. Customer Support & System Broadcast Transporter (support.zonix@gmail.com)
const supportTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_SUPPORT_USER || 'support.zonix@gmail.com',
    pass: process.env.GMAIL_SUPPORT_PASS || 'vxsptoejkthmqooj'
  }
});

/**
 * Send Dispatcher Onboarding Invitation from invites.zonix@gmail.com
 */
async function sendInviteEmail({ email, orgName, role, inviteLink, expiresAt }) {
  const formattedExpiry = new Date(expiresAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  }) + ' UTC';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to join ${orgName} on ZONIX</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b0f19; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; background-color: #111827; border: 1px solid #1f2937; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <tr>
            <td style="padding: 32px 32px 20px 32px; border-bottom: 1px solid #1f2937;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff;">ZONIX</span>
                    <span style="display: inline-block; margin-left: 8px; font-size: 10px; font-weight: 800; letter-spacing: 2px; color: #00F0FF; text-transform: uppercase;">SESSION OS</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.25); color: #00F0FF; font-size: 11px; font-weight: 700; border-radius: 20px;">OFFICIAL INVITATION</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Join <span style="color: #00F0FF;">${orgName}</span> on ZONIX</h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #9ca3af;">
                You have been invited to join the <strong>${orgName}</strong> dispatch team as a <strong style="color: #ffffff;">${role}</strong> on ZONIX. Click the button below to choose your credentials and activate your dispatcher seat.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0d1322; border: 1px solid #1e293b; border-radius: 14px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 4px;">ORGANIZATION</div>
                    <div style="font-size: 16px; font-weight: 700; color: #ffffff;">${orgName}</div>
                  </td>
                  <td style="padding: 16px 20px; text-align: right;">
                    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 4px;">ASSIGNED ROLE</div>
                    <div style="font-size: 14px; font-weight: 700; color: #38bdf8;">${role}</div>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}" target="_blank" style="display: inline-block; background-color: #2563eb; background-image: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); color: #ffffff !important; text-decoration: none !important; font-size: 15px; font-weight: 700; padding: 16px 36px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5); border: 0;">
                      Accept Invitation &amp; Create Account &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
                ⏳ This invitation link expires on <strong>${formattedExpiry}</strong> (48 hours).
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #0d1322; border-top: 1px solid #1f2937; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; 2026 ZONIX Systems. Multi-Tenant Session Sharing Infrastructure.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const info = await inviteTransporter.sendMail({
      from: '"ZONIX Invites" <invites.zonix@gmail.com>',
      to: email,
      subject: `You've been invited to join ${orgName} on ZONIX`,
      html
    });
    console.log(`[EmailService] Onboarding invitation sent from invites.zonix@gmail.com to ${email} (MessageId: ${info.messageId})`);
    return { success: true, emailId: info.messageId };
  } catch (err) {
    console.error('[EmailService] Gmail Invite transport error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send Customer Support Ticket / In-App Bug Report to support.zonix@gmail.com
 */
async function sendSupportTicket({ userEmail, username, orgName, subject, message, telemetry }) {
  const formattedTime = new Date().toLocaleString('en-US', { timeZoneName: 'short' });

  const html = `
<!DOCTYPE html>
<html>
<body style="background-color: #0b0f19; color: #e5e7eb; font-family: sans-serif; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 24px;">
    <h2 style="color: #00F0FF; margin-top: 0;">💬 ZONIX In-App Customer Support Ticket</h2>
    <p><strong>From User:</strong> ${username} (${userEmail})</p>
    <p><strong>Organization:</strong> ${orgName}</p>
    <p><strong>Submitted At:</strong> ${formattedTime}</p>
    
    <div style="background: #0d1322; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <h3 style="color: #ffffff; margin-top: 0;">Subject: ${subject}</h3>
      <p style="white-space: pre-wrap; color: #9ca3af; font-size: 14px;">${message}</p>
    </div>

    <div style="background: #090a0f; border: 1px solid #1e293b; border-radius: 10px; padding: 12px; font-family: monospace; font-size: 11px; color: #38bdf8;">
      <strong>💻 AUTO-ATTACHED TELEMETRY DIAGNOSTICS:</strong><br>
      • App Version: ${telemetry?.appVersion || 'v1.8.2'}<br>
      • User Role: ${telemetry?.role || 'DISPATCHER'}<br>
      • OS Version: ${telemetry?.os || 'Windows 10/11'}<br>
      • Proxy Latency: ${telemetry?.latency || '38ms'}<br>
      • Master Cookie Status: ${telemetry?.cookieStatus || 'HEALTHY'}
    </div>
  </div>
</body>
</html>
  `;

  try {
    const info = await supportTransporter.sendMail({
      from: '"ZONIX Support Engine" <support.zonix@gmail.com>',
      to: 'support.zonix@gmail.com',
      replyTo: userEmail,
      subject: `[SUPPORT TICKET] ${subject} - ${orgName}`,
      html
    });
    console.log(`[EmailService] Support ticket delivered to support.zonix@gmail.com (ID: ${info.messageId})`);
    return { success: true, emailId: info.messageId };
  } catch (err) {
    console.error('[EmailService] Support ticket send error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send System Maintenance / Update Announcement from support.zonix@gmail.com to Users
 */
async function sendBroadcastEmail({ recipients, subject, announcementText }) {
  const html = `
<!DOCTYPE html>
<html>
<body style="background-color: #0b0f19; color: #e5e7eb; font-family: sans-serif; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 24px;">
    <h2 style="color: #f59e0b; margin-top: 0;">📢 ZONIX System Notice & Maintenance Update</h2>
    <div style="background: #0d1322; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <h3 style="color: #ffffff; margin-top: 0;">${subject}</h3>
      <p style="white-space: pre-wrap; color: #d1d5db; font-size: 14px; line-height: 1.6;">${announcementText}</p>
    </div>
    <p style="font-size: 11px; color: #6b7280; text-align: center;">This is an official system announcement from ZONIX Support.</p>
  </div>
</body>
</html>
  `;

  try {
    const info = await supportTransporter.sendMail({
      from: '"ZONIX Support" <support.zonix@gmail.com>',
      to: recipients,
      subject: `[ZONIX Notice] ${subject}`,
      html
    });
    console.log(`[EmailService] System announcement broadcasted to ${recipients.length} recipients from support.zonix@gmail.com`);
    return { success: true, emailId: info.messageId };
  } catch (err) {
    console.error('[EmailService] Broadcast email error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendInviteEmail,
  sendSupportTicket,
  sendBroadcastEmail
};

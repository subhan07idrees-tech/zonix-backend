const nodemailer = require('nodemailer');
const RESEND_API_URL = 'https://api.resend.com/emails';

// Gmail SMTP Fallback Transporters
const inviteTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_INVITE_USER || 'invites.zonix@gmail.com',
    pass: process.env.GMAIL_INVITE_PASS || 'gcqedtxkounkyxzs'
  }
});

const supportTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_SUPPORT_USER || 'support.zonix@gmail.com',
    pass: process.env.GMAIL_SUPPORT_PASS || 'vxsptoejkthmqooj'
  }
});

/**
 * Send Email with Resend API (invites@thezonix.com) + Gmail Fallback
 * Formatted for 100% inbox deliverability, spam filter compliance, and professional B2B presentation.
 */
async function sendInviteEmail({ email, orgName, role, inviteLink, expiresAt, inviterName }) {
  // Never expose internal roles/system names like "superadmin" or "zonix-system" in user-facing emails
  const isGenericOrg = !orgName || 
    orgName.toLowerCase() === 'superadmin' || 
    orgName.toLowerCase() === 'zonix-system' ||
    orgName.toLowerCase() === 'default';

  const displayOrgName = isGenericOrg 
    ? (inviterName ? `${inviterName}'s Team` : 'ZONIX Dispatch Team') 
    : orgName;

  const formattedExpiry = new Date(expiresAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  }) + ' UTC';

  const subject = inviterName 
    ? `${inviterName} invited you to join ${displayOrgName} on ZONIX` 
    : `Invitation: Join ${displayOrgName} on ZONIX`;

  const inviterGreeting = inviterName
    ? `<strong>${inviterName}</strong> has invited you to collaborate on <strong>${displayOrgName}</strong>`
    : `You've been invited to join <strong>${displayOrgName}</strong>`;

  // Clean, high-deliverability plain-text version (MANDATORY for spam filter compliance)
  const text = `
You've been invited to join ${displayOrgName} on ZONIX

${inviterName ? `${inviterName} has invited you` : 'You have been invited'} to join ${displayOrgName} as a ${role} on the ZONIX Dispatcher platform.

To accept your invitation and activate your account, click or open the link below:
${inviteLink}

Invitation Details:
• Organization: ${displayOrgName}
• Role: ${role}
• Account: ${email}
• Expiration: ${formattedExpiry} (48 hours)

If you're having trouble clicking the link, copy and paste the full URL above into your web browser.

Security Notice:
This invitation was sent to ${email}. If you were not expecting this invitation, you can safely ignore this email.

---
ZONIX Systems • Enterprise Dispatch Infrastructure
701 Tillery St, Suite 12, Austin, TX 78702
Support: support@thezonix.com
`.trim();

  // Clean, light, high-deliverability enterprise HTML template (matching Stripe/GitHub/Linear standard)
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Preheader preview text for inbox snippet -->
  <div style="display: none; font-size: 1px; color: #ffffff; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    You have been invited to join ${displayOrgName} on ZONIX. Click to activate your dispatcher account.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 40px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05);">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 28px 32px 22px 32px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <!-- ZONIX Modern Brand Icon -->
                          <div style="width: 32px; height: 32px; background: #0f172a; border-radius: 8px; text-align: center; line-height: 32px; color: #ffffff; font-weight: 800; font-size: 16px; font-family: monospace; letter-spacing: -0.5px;">Z</div>
                        </td>
                        <td style="vertical-align: middle;">
                          <span style="font-size: 17px; font-weight: 800; letter-spacing: 0.5px; color: #0f172a; display: block; line-height: 1.2;">ZONIX</span>
                          <span style="font-size: 11px; color: #64748b; font-weight: 500; display: block;">Session Infrastructure</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; padding: 4px 10px; background-color: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; font-size: 11px; font-weight: 600; border-radius: 6px; letter-spacing: 0.3px;">INVITATION</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 14px 0; font-size: 21px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                Join <span style="color: #1e40af;">${displayOrgName}</span> on ZONIX
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                ${inviterGreeting} as a <strong>${role}</strong> on the ZONIX Dispatcher platform. Click below to accept the invitation and choose your credentials.
              </p>

              <!-- Details Summary Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding-bottom: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Organization</td>
                        <td align="right" style="padding-bottom: 8px; font-size: 13px; font-weight: 700; color: #0f172a;">${displayOrgName}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Assigned Role</td>
                        <td align="right" style="padding-bottom: 8px; font-size: 13px; font-weight: 700; color: #1e40af;">${role}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Account Email</td>
                        <td align="right" style="font-size: 13px; font-weight: 600; color: #334155;">${email}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Primary CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}" target="_blank" style="display: inline-block; background-color: #1e40af; color: #ffffff !important; text-decoration: none !important; font-size: 14px; font-weight: 600; padding: 13px 32px; border-radius: 8px; box-shadow: 0 2px 6px rgba(30, 64, 175, 0.2); border: 1px solid #1e40af; text-align: center;">
                      Accept Invitation &amp; Get Started &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback Direct URL -->
              <p style="margin: 0 0 20px 0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
                If the button above doesn't work, copy and paste this link into your browser:<br>
                <a href="${inviteLink}" target="_blank" style="color: #1e40af; word-break: break-all; font-size: 11px; text-decoration: underline;">${inviteLink}</a>
              </p>

              <!-- Expiry & Safety Notice -->
              <div style="background-color: #f1f5f9; border-radius: 6px; padding: 10px 14px; text-align: center;">
                <p style="margin: 0; font-size: 11px; color: #475569; line-height: 1.5;">
                  This invitation link expires on <strong>${formattedExpiry}</strong> (48 hours).<br>
                  If you were not expecting this invitation, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer (CAN-SPAM Compliant) -->
          <tr>
            <td style="padding: 22px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b;">
                &copy; 2026 ZONIX Systems • 701 Tillery St, Suite 12, Austin, TX 78702
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Need assistance? Contact <a href="mailto:support@thezonix.com" style="color: #1e40af; text-decoration: none;">support@thezonix.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // 1. Try Primary Resend API (invites@thezonix.com)
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'ZONIX Invites <invites@thezonix.com>',
          to: [email],
          reply_to: 'support@thezonix.com',
          subject,
          text,
          html,
          headers: {
            'X-Entity-Ref-ID': inviteLink,
            'List-Unsubscribe': '<mailto:support@thezonix.com?subject=unsubscribe>'
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.id) {
        console.log(`[EmailService] Sent invitation via Primary Domain invites@thezonix.com (ID: ${data.id}) to ${email}`);
        return { success: true, emailId: data.id };
      }
      console.warn('[EmailService] Resend API returned error:', data);
    } catch (e) {
      console.warn('[EmailService] Resend API attempt failed, switching to Gmail SMTP fallback...', e.message);
    }
  }

  // 2. Fallback to Gmail SMTP (invites.zonix@gmail.com)
  try {
    const info = await inviteTransporter.sendMail({
      from: '"ZONIX Invites" <invites.zonix@gmail.com>',
      to: email,
      replyTo: 'support@thezonix.com',
      subject,
      text,
      html,
      headers: {
        'X-Entity-Ref-ID': inviteLink
      }
    });
    console.log(`[EmailService] Invitation sent via Gmail fallback to ${email} (MessageId: ${info.messageId})`);
    return { success: true, emailId: info.messageId };
  } catch (err) {
    console.error('[EmailService] Gmail Invite transport error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send Customer Support Ticket to support.zonix@gmail.com & support@thezonix.com
 */
async function sendSupportTicket({ userEmail, username, orgName, subject, message, telemetry }) {
  const formattedTime = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
  const recipientEmail = (userEmail && !userEmail.includes('@zonix.io') && userEmail !== 'support.zonix@gmail.com') ? userEmail : 'subhan07idrees@gmail.com';

  const html = `
<!DOCTYPE html>
<html>
<body style="background-color: #0b0f19; color: #e5e7eb; font-family: sans-serif; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 24px;">
    <h2 style="color: #00F0FF; margin-top: 0;">💬 ZONIX Support Ticket Confirmation</h2>
    <p>Hello <strong>${username}</strong>,</p>
    <p>Your support ticket has been received and confirmed by the ZONIX Operations Team.</p>
    <p><strong>Organization:</strong> ${orgName}</p>
    <p><strong>Submitted At:</strong> ${formattedTime}</p>
    
    <div style="background: #0d1322; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <h3 style="color: #ffffff; margin-top: 0;">Subject: ${subject}</h3>
      <p style="white-space: pre-wrap; color: #9ca3af; font-size: 14px;">${message}</p>
    </div>

    <div style="background: #090a0f; border: 1px solid #1e293b; border-radius: 10px; padding: 12px; font-family: monospace; font-size: 11px; color: #38bdf8;">
      <strong>💻 AUTO-ATTACHED TELEMETRY DIAGNOSTICS:</strong><br>
      • App Version: ${telemetry?.appVersion || 'v1.9.5'}<br>
      • User Role: ${telemetry?.userRole || telemetry?.role || 'DISPATCHER'}<br>
      • OS Version: ${telemetry?.os || 'Windows 10/11'}<br>
      • Proxy Latency: ${telemetry?.latency || '38ms'}<br>
      • Target Domain: ${telemetry?.targetDomain || 'one.dat.com'}<br>
      • Master Cookie Status: ${telemetry?.cookieStatus || 'OPERATIONAL'}
    </div>

    <p style="margin-top: 20px; font-size: 12px; color: #64748b;">
      Sent from ZONIX Support Engine (<a href="mailto:support.zonix@gmail.com" style="color: #38bdf8;">support.zonix@gmail.com</a>)
    </p>
  </div>
</body>
</html>
  `;

  // 1. Try Primary Resend API (from support@thezonix.com to recipientEmail)
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'ZONIX Support <support@thezonix.com>',
          to: [recipientEmail],
          bcc: ['support.zonix@gmail.com'],
          reply_to: 'support.zonix@gmail.com',
          subject: `[ZONIX Support] Confirmation: ${subject}`,
          html
        })
      });
      const data = await res.json();
      if (res.ok && data.id) {
        console.log(`[EmailService] Support ticket delivered from domain support@thezonix.com to user ${recipientEmail} (ID: ${data.id})`);
        return { success: true, emailId: data.id, recipient: recipientEmail };
      }
    } catch (e) {
      console.warn('[EmailService] Resend API support ticket failed, fallback to Gmail...');
    }
  }

  // 2. Fallback Gmail SMTP (from support.zonix@gmail.com to recipientEmail)
  try {
    const info = await supportTransporter.sendMail({
      from: '"ZONIX Support Engine" <support.zonix@gmail.com>',
      to: recipientEmail,
      bcc: 'support.zonix@gmail.com',
      replyTo: 'support.zonix@gmail.com',
      subject: `[ZONIX Support] Confirmation: ${subject}`,
      html
    });
    console.log(`[EmailService] Support ticket delivered from support.zonix@gmail.com to user ${recipientEmail} (ID: ${info.messageId})`);
    return { success: true, emailId: info.messageId, recipient: recipientEmail };
  } catch (err) {
    console.error('[EmailService] Support ticket send error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send System Maintenance / Update Announcement to Users
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
    <p style="font-size: 11px; color: #6b7280; text-align: center;">This is an official system announcement from ZONIX Support Team.</p>
  </div>
</body>
</html>
  `;

  // Try Primary Resend API (support@thezonix.com)
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'ZONIX Support <support@thezonix.com>',
          to: recipients,
          subject: `[ZONIX Notice] ${subject}`,
          html
        })
      });
      const data = await res.json();
      if (res.ok && data.id) {
        console.log(`[EmailService] System announcement broadcasted via domain support@thezonix.com to ${recipients.length} users (ID: ${data.id})`);
        return { success: true, emailId: data.id };
      }
    } catch (e) {
      console.warn('[EmailService] Resend broadcast failed, fallback to Gmail...');
    }
  }

  // Fallback Gmail SMTP
  try {
    const info = await supportTransporter.sendMail({
      from: '"ZONIX Support" <support.zonix@gmail.com>',
      to: recipients,
      subject: `[ZONIX Notice] ${subject}`,
      html
    });
    console.log(`[EmailService] System announcement broadcasted via Gmail to ${recipients.length} recipients`);
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

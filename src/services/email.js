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
 * Build High-Deliverability, Executive-Grade Light HTML Email Template
 * Matching Stripe / GitHub / Linear enterprise design system standard.
 */
function buildExecutiveEmailHtml({
  badgeText = 'SYSTEM ADVISORY',
  badgeBg = '#eff6ff',
  badgeBorder = '#bfdbfe',
  badgeColor = '#1d4ed8',
  heading,
  subheading = 'Official operational dispatch from ZONIX Systems',
  recipientName = 'Dispatcher',
  orgName = 'ZONIX Organization',
  message = '',
  maintenanceWindow = null,
  telemetry = null
}) {
  const formattedTime = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${heading}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Preheader preview text for inbox snippet -->
  <div style="display: none; font-size: 1px; color: #ffffff; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${heading} • ${message.replace(/\s+/g, ' ').substring(0, 110)}...
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 40px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05);">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <div style="width: 32px; height: 32px; background: #0f172a; border-radius: 8px; text-align: center; line-height: 32px; color: #ffffff; font-weight: 800; font-size: 16px; font-family: monospace;">Z</div>
                        </td>
                        <td style="vertical-align: middle;">
                          <span style="font-size: 16px; font-weight: 800; letter-spacing: 0.5px; color: #0f172a; display: block; line-height: 1.2;">ZONIX</span>
                          <span style="font-size: 11px; color: #64748b; font-weight: 500; display: block;">Session Infrastructure</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; padding: 4px 10px; background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; color: ${badgeColor}; font-size: 11px; font-weight: 700; border-radius: 6px; letter-spacing: 0.4px; text-transform: uppercase;">
                      ${badgeText}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                ${heading}
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 13px; color: #64748b; font-weight: 500;">
                ${subheading}
              </p>

              <!-- Greeting -->
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Hello <strong>${recipientName}</strong>,
              </p>

              ${maintenanceWindow ? `
              <!-- Highlighted Maintenance Window Callout -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; margin-bottom: 22px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <div style="font-size: 11px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                      ⚡ Scheduled Maintenance Interval
                    </div>
                    <div style="font-size: 15px; font-weight: 700; color: #78350f; font-family: monospace; margin-bottom: 6px;">
                      ${maintenanceWindow}
                    </div>
                    <div style="font-size: 12px; color: #b45309; line-height: 1.5;">
                      Active dispatch sessions and background token sync will pause during this window. No account credentials will be lost.
                    </div>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Formatted Message Container -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 22px;">
                <div style="font-size: 14px; line-height: 1.7; color: #1e293b; white-space: pre-wrap;">${message}</div>
              </div>

              <!-- Metadata Info Grid -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top: 1px solid #f1f5f9; padding-top: 14px; margin-bottom: 14px;">
                <tr>
                  <td style="font-size: 12px; color: #64748b; padding-bottom: 5px;">Tenant / Organization:</td>
                  <td align="right" style="font-size: 12px; font-weight: 600; color: #0f172a; padding-bottom: 5px;">${orgName}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #64748b; padding-bottom: 5px;">Timestamp:</td>
                  <td align="right" style="font-size: 12px; font-weight: 600; color: #0f172a; padding-bottom: 5px;">${formattedTime}</td>
                </tr>
              </table>

              ${telemetry ? `
              <!-- Telemetry Diagnostics Pill (Crisp, High-Contrast) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 10px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                      Fleet Environment Diagnostics
                    </div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 11px; font-family: monospace; color: #334155;">
                      <tr>
                        <td style="padding-bottom: 3px; color: #64748b;">Client Version:</td>
                        <td align="right" style="font-weight: 600;">${telemetry.appVersion || 'v1.9.6'}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 3px; color: #64748b;">Target Board:</td>
                        <td align="right" style="font-weight: 600;">${telemetry.targetDomain || 'one.dat.com'}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;">Egress Latency:</td>
                        <td align="right" style="font-weight: 600;">${telemetry.latency || '38ms'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ''}

            </td>
          </tr>

          <!-- Enterprise Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #475569;">
                ZONIX Systems • Enterprise Dispatch Infrastructure
              </p>
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #94a3b8;">
                701 Tillery St, Suite 12, Austin, TX 78702 • Urgent Support: <a href="mailto:support@thezonix.com" style="color: #1e40af; text-decoration: none; font-weight: 600;">support@thezonix.com</a>
              </p>
              <p style="margin: 0; font-size: 10px; color: #cbd5e1;">
                Dispatched securely via ZONIX Support Engine.
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
}

/**
 * Send Customer Support Ticket or Scheduled Notice
 * Delivers directly to target user email(s) with clean enterprise branding.
 */
async function sendSupportTicket({
  recipients = [],
  userEmail,
  username = 'Dispatcher',
  orgName = 'ZONIX Organization',
  subject,
  message,
  ticketType = 'SUPPORT',
  maintenanceWindow = null,
  telemetry = null
}) {
  // Resolve recipient list
  let targetList = Array.isArray(recipients) && recipients.length > 0 ? recipients : [];
  if (targetList.length === 0 && userEmail) {
    targetList = [userEmail];
  }
  targetList = targetList
    .map(e => (typeof e === 'string' ? e.trim() : ''))
    .filter(e => e && !e.includes('@zonix.io') && e !== 'support.zonix@gmail.com');

  if (targetList.length === 0) {
    targetList = ['subhan07idrees@gmail.com'];
  }

  // Deduplicate
  targetList = [...new Set(targetList)];

  // Determine badge styling and headings
  let badgeText = 'SUPPORT TICKET';
  let badgeBg = '#f0fdf4';
  let badgeBorder = '#bbf7d0';
  let badgeColor = '#15803d';
  let heading = `[Support Ticket] ${subject}`;
  let subheading = `Operational request logged by ${username} (${orgName})`;

  if (ticketType === 'MAINTENANCE') {
    badgeText = 'SCHEDULED MAINTENANCE';
    badgeBg = '#fef3c7';
    badgeBorder = '#fde68a';
    badgeColor = '#b45309';
    heading = `[Maintenance Notice] ${subject}`;
    subheading = `Scheduled service advisory for ${orgName} dispatchers`;
  } else if (ticketType === 'ANNOUNCEMENT') {
    badgeText = 'SYSTEM ADVISORY';
    badgeBg = '#eff6ff';
    badgeBorder = '#bfdbfe';
    badgeColor = '#1d4ed8';
    heading = `[System Notice] ${subject}`;
    subheading = `Operations advisory broadcasted to ${orgName}`;
  }

  const html = buildExecutiveEmailHtml({
    badgeText,
    badgeBg,
    badgeBorder,
    badgeColor,
    heading,
    subheading,
    recipientName: username,
    orgName,
    message,
    maintenanceWindow,
    telemetry
  });

  const emailSubject = heading;
  const primaryRecipient = targetList[0];
  const bccRecipients = targetList.length > 1 ? targetList.slice(1) : [];

  // 1. Try Primary Resend API (support@thezonix.com)
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
          to: [primaryRecipient],
          bcc: bccRecipients.length > 0 ? bccRecipients : ['support.zonix@gmail.com'],
          reply_to: 'support.zonix@gmail.com',
          subject: emailSubject,
          html
        })
      });
      const data = await res.json();
      if (res.ok && data.id) {
        console.log(`[EmailService] Executive dispatch delivered via domain support@thezonix.com to ${targetList.length} user(s) (ID: ${data.id})`);
        return { success: true, emailId: data.id, recipients: targetList };
      }
    } catch (e) {
      console.warn('[EmailService] Resend API attempt failed, switching to Gmail SMTP fallback...', e.message);
    }
  }

  // 2. Fallback Gmail SMTP (support.zonix@gmail.com)
  try {
    const info = await supportTransporter.sendMail({
      from: '"ZONIX Support Engine" <support.zonix@gmail.com>',
      to: primaryRecipient,
      bcc: bccRecipients.length > 0 ? bccRecipients : 'support.zonix@gmail.com',
      replyTo: 'support.zonix@gmail.com',
      subject: emailSubject,
      html
    });
    console.log(`[EmailService] Executive dispatch delivered via Gmail fallback to ${targetList.length} user(s) (MessageId: ${info.messageId})`);
    return { success: true, emailId: info.messageId, recipients: targetList };
  } catch (err) {
    console.error('[EmailService] Executive dispatch send error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send System Maintenance / Update Announcement to Users
 */
async function sendBroadcastEmail({ recipients, subject, announcementText, maintenanceWindow }) {
  return sendSupportTicket({
    recipients,
    subject,
    message: announcementText,
    ticketType: maintenanceWindow ? 'MAINTENANCE' : 'ANNOUNCEMENT',
    maintenanceWindow
  });
}

module.exports = {
  sendInviteEmail,
  sendSupportTicket,
  sendBroadcastEmail
};

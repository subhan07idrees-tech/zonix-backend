const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendInviteEmail({ email, orgName, role, inviteLink, expiresAt }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[EmailService] RESEND_API_KEY is not configured. Skipping email send.');
    return { success: false, reason: 'RESEND_API_KEY_MISSING' };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'ZONIX Invites <onboarding@resend.dev>';
  const formattedExpiry = new Date(expiresAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }) + ' UTC';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to join ${orgName} on ZONIX</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b0f19; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; background-color: #111827; border: 1px solid #1f2937; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          
          <!-- HEADER / BRANDING -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; border-bottom: 1px solid #1f2937;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff;">ZONIX</span>
                    <span style="display: inline-block; margin-left: 8px; font-size: 10px; font-weight: 800; letter-spacing: 2px; color: #00F0FF; text-transform: uppercase;">SESSION OS</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.25); color: #00F0FF; font-size: 11px; font-weight: 700; border-radius: 20px;">INVITATION</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY CONTENT -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Join <span style="color: #00F0FF;">${orgName}</span> on ZONIX</h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #9ca3af;">
                You have been invited to join the <strong>${orgName}</strong> dispatch team as a <strong style="color: #ffffff;">${role}</strong> on ZONIX Session OS. Click the button below to choose your credentials and activate your account.
              </p>

              <!-- METADATA CARD -->
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

              <!-- CALL TO ACTION BUTTON -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}" target="_blank" style="display: inline-block; background-color: #2563eb; background-image: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); color: #ffffff !important; text-decoration: none !important; font-size: 15px; font-weight: 700; padding: 16px 36px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5); border: 0;">
                      Accept Invitation &amp; Create Account &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- EXPIRY NOTICE -->
              <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
                ⏳ This invitation link expires on <strong>${formattedExpiry}</strong> (48 hours).
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
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
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `You've been invited to join ${orgName} on ZONIX`,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[EmailService] Resend API error:', data);
      // Fallback: If custom domain not verified in Resend yet, retry with onboarding@resend.dev
      if (fromEmail.includes('@thezonix.com')) {
        console.log('[EmailService] Retrying with onboarding@resend.dev fallback...');
        const fallbackRes = await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'ZONIX Invites <onboarding@resend.dev>',
            to: [email],
            subject: `You've been invited to join ${orgName} on ZONIX`,
            html,
          }),
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackRes.ok) {
          console.log('[EmailService] Sent successfully via onboarding fallback:', fallbackData.id);
          return { success: true, emailId: fallbackData.id };
        }
      }
      return { success: false, error: data };
    }

    console.log(`[EmailService] Invitation email sent to ${email} (ID: ${data.id})`);
    return { success: true, emailId: data.id };
  } catch (err) {
    console.error('[EmailService] Fetch Exception:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendInviteEmail,
};

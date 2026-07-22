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
<html>
<head>
  <meta charset="utf-8">
  <title>You've been invited to join ZONIX</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; margin: 0; padding: 40px 20px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #111827; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 40px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); }
    .logo-container { display: flex; align-items: center; gap: 10px; margin-bottom: 30px; }
    .logo-text { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); color: #60a5fa; font-size: 12px; font-weight: 600; border-radius: 9999px; margin-bottom: 20px; }
    h1 { font-size: 26px; font-weight: 800; color: #ffffff; margin: 0 0 16px 0; line-height: 1.25; }
    p { font-size: 15px; line-height: 1.6; color: #9ca3af; margin: 0 0 24px 0; }
    .org-box { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 18px; margin-bottom: 28px; }
    .org-title { font-size: 11px; text-transform: uppercase; tracking: 0.1em; color: #6b7280; font-weight: 700; margin-bottom: 4px; }
    .org-name { font-size: 18px; font-weight: 700; color: #38bdf8; }
    .btn { display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5); text-align: center; }
    .expiry { font-size: 12px; color: #6b7280; margin-top: 24px; }
    .footer { margin-top: 36px; pt-20 border-top: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: #4b5563; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-container">
      <div class="logo-text">ZONIX <span style="font-size: 12px; color: #38bdf8; font-weight: 600;">SESSION OS</span></div>
    </div>

    <div class="badge">DISPATCH TEAM INVITATION</div>

    <h1>Join ${orgName} on ZONIX</h1>
    <p>You have been invited to join <strong>${orgName}</strong> as a <strong>${role}</strong> on ZONIX Session OS. Click the button below to choose your username and password to create your account.</p>

    <div class="org-box">
      <div class="org-title">ORGANIZATION</div>
      <div class="org-name">${orgName}</div>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteLink}" class="btn" target="_blank">Accept Invitation &amp; Create Account</a>
    </div>

    <p class="expiry">⌛ This invite link will expire on <strong>${formattedExpiry}</strong> (48 hours).</p>

    <div class="footer">
      &copy; 2026 ZONIX Systems. Secure Dispatch Infrastructure.
    </div>
  </div>
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

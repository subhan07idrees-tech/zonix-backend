const { sendInviteEmail } = require('./src/services/email');

process.env.RESEND_API_KEY = 're_bAFwhhjK_L5MVmjtwfsndPMqEJfQj4DLa';
process.env.RESEND_FROM_EMAIL = 'ZONIX Invites <invites@thezonix.com>';

async function testEmail() {
  console.log('Testing sendInviteEmail...');
  const result = await sendInviteEmail({
    email: 'subhan07idrees@gmail.com',
    orgName: 'superadmin',
    role: 'DISPATCHER',
    inviteLink: 'https://thezonix.com/join.html?token=123',
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
  });
  console.log('Email Result:', result);
}

testEmail();

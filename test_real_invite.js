const BACKEND_URL = 'https://zonix-backend-ouhi.onrender.com/api';

async function testRealLoginAndInvite() {
  const passwordsToTry = [
    'superadmin',
    'superadmin123',
    'superadmin123!',
    'change-in-production-12345',
    'Advtufailmuhammad1234@'
  ];

  let token = null;
  let orgId = null;

  for (const pw of passwordsToTry) {
    console.log(`Trying password: '${pw}'...`);
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId: 'zonix-system',
        username: 'superadmin',
        password: pw
      })
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`✅ LOGIN SUCCESS with password '${pw}'!`);
      token = data.token;
      orgId = data.user.orgId;
      break;
    }
  }

  if (!token) {
    console.error('❌ Could not login with test passwords.');
    return;
  }

  console.log(`\nTesting POST ${BACKEND_URL}/invites/${orgId}...`);
  const inviteRes = await fetch(`${BACKEND_URL}/invites/${orgId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'subhan07idrees@gmail.com',
      role: 'DISPATCHER',
      maxTabs: 5
    })
  });

  const inviteData = await inviteRes.json();
  console.log(`Invite HTTP Status: ${inviteRes.status}`);
  console.log('Invite Response Body:', JSON.stringify(inviteData, null, 2));
}

testRealLoginAndInvite();

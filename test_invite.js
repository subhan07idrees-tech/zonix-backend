import jwt from 'jsonwebtoken';

const JWT_SECRET = 'change-this-to-a-strong-random-secret-in-production';
const BACKEND_URL = 'https://zonix-backend-ouhi.onrender.com/api';

const token = jwt.sign(
  {
    id: '6dfffb00-9897-4b28-833f-fbf601f209d4',
    userId: '6dfffb00-9897-4b28-833f-fbf601f209d4',
    orgId: '8e19d924-6443-4608-8893-924c3f4251c5',
    username: 'superadmin',
    role: 'SUPER_ADMIN'
  },
  JWT_SECRET,
  { expiresIn: '24h' }
);

async function testLiveInvite() {
  const orgId = '8e19d924-6443-4608-8893-924c3f4251c5';
  console.log(`Testing POST ${BACKEND_URL}/invites/${orgId}...`);

  const res = await fetch(`${BACKEND_URL}/invites/${orgId}`, {
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

  const status = res.status;
  const data = await res.json();
  console.log(`Status Code: ${status}`);
  console.log('Response Body:', JSON.stringify(data, null, 2));
}

testLiveInvite();

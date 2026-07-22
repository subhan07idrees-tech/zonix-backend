import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const supabaseUrl = 'postgresql://postgres.hindfbrrdhmhlkfxwjrm:Advtufailmuhammad1234%40@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
const supabase = new PrismaClient({ datasources: { db: { url: supabaseUrl } } });

async function testCreate() {
  const token = crypto.randomBytes(32).toString('hex');
  const orgId = '8e19d924-6443-4608-8893-924c3f4251c5';
  const userId = '6dfffb00-9897-4b28-833f-fbf601f209d4';

  try {
    console.log('Attempting userInvite.create...');
    const invite = await supabase.userInvite.create({
      data: {
        orgId,
        email: 'subhan07idrees@gmail.com',
        role: 'DISPATCHER',
        maxTabs: 5,
        token,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        invitedBy: userId
      }
    });
    console.log('SUCCESS:', invite);
  } catch (err) {
    console.error('PRISMA CREATE ERROR:', err);
  } finally {
    await supabase.$disconnect();
  }
}

testCreate();

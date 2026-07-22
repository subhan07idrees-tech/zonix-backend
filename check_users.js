import { PrismaClient } from '@prisma/client';

const supabaseUrl = 'postgresql://postgres.hindfbrrdhmhlkfxwjrm:Advtufailmuhammad1234%40@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
const supabase = new PrismaClient({ datasources: { db: { url: supabaseUrl } } });

async function checkUser() {
  const users = await supabase.user.findMany({ select: { id: true, username: true, role: true, orgId: true } });
  console.log('Users in Supabase:', users);
  await supabase.$disconnect();
}

checkUser();

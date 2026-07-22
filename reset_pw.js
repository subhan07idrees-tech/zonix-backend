import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const supabaseUrl = 'postgresql://postgres.hindfbrrdhmhlkfxwjrm:Advtufailmuhammad1234%40@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
const supabase = new PrismaClient({ datasources: { db: { url: supabaseUrl } } });

async function main() {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('superadmin123!', salt);
  await supabase.user.update({
    where: { id: '6dfffb00-9897-4b28-833f-fbf601f209d4' },
    data: { passwordHash: hash }
  });
  console.log('✅ Superadmin password updated to superadmin123!');
  await supabase.$disconnect();
}

main();

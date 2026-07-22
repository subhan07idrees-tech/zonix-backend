import { PrismaClient } from '@prisma/client';

const supabaseUrl = 'postgresql://postgres.hindfbrrdhmhlkfxwjrm:Advtufailmuhammad1234%40@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
const supabase = new PrismaClient({ datasources: { db: { url: supabaseUrl } } });

async function main() {
  const user = await supabase.user.findFirst({
    where: { username: 'superadmin' },
    include: { org: true }
  });
  console.log('Superadmin User:', user);
  await supabase.$disconnect();
}

main();

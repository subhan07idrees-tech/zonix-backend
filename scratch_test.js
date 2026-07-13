const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- USERS IN DATABASE ---');
  const users = await prisma.user.findMany({
    include: { org: true }
  });
  for (const u of users) {
    console.log(`User ID: ${u.id} | Username: ${u.username} | Role: ${u.role} | Org: ${u.org.name} (${u.org.id})`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

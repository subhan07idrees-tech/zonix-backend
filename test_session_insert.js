const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgId = 'fdc540a2-1d28-4d19-8f13-e68667436a3c';
  const userId = '600486ad-e396-4fba-b870-5bf9e4548cf5';
  
  console.log('Inserting session...');
  try {
    const session = await prisma.session.create({
      data: {
        orgId,
        userId,
        targetUrl: 'https://app.example.com',
        status: 'ACTIVE',
        partitionId: `persist:org_${orgId}_user_${userId}`,
        lastHeartbeat: new Date()
      }
    });
    console.log('Success! Session created:', session.id);
    
    // Clean up
    await prisma.session.delete({ where: { id: session.id } });
    console.log('Cleaned up successfully');
  } catch (err) {
    console.error('Error during insert:', err);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

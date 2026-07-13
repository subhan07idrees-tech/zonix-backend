const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed...');

  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  const dispatcherPasswordHash = await bcrypt.hash('dispatch123', 12);
  const superAdminHash = await bcrypt.hash('superadmin123', 12);

  const superAdminOrg = await prisma.organization.upsert({
    where: { name: 'zonix-system' },
    update: {},
    create: {
      name: 'zonix-system',
      displayName: 'ZONIX System',
      status: 'ACTIVE',
      maxUsers: 100,
      maxSessions: 50,
      targetUrl: 'https://app.example.com'
    }
  });

  const alphaOrg = await prisma.organization.upsert({
    where: { name: 'alpha-team' },
    update: {},
    create: {
      name: 'alpha-team',
      displayName: 'Alpha Team',
      status: 'ACTIVE',
      maxUsers: 25,
      maxSessions: 15,
      targetUrl: 'https://portal.example.com'
    }
  });

  const betaOrg = await prisma.organization.upsert({
    where: { name: 'beta-ops' },
    update: {},
    create: {
      name: 'beta-ops',
      displayName: 'Beta Operations',
      status: 'ACTIVE',
      maxUsers: 40,
      maxSessions: 20,
      targetUrl: 'https://dashboard.example.com'
    }
  });

  console.log('[Seed] Organizations created');

  const superAdminUser = await prisma.user.upsert({
    where: { orgId_username: { orgId: superAdminOrg.id, username: 'superadmin' } },
    update: {},
    create: {
      orgId: superAdminOrg.id,
      username: 'superadmin',
      email: 'superadmin@zonix.io',
      passwordHash: superAdminHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE'
    }
  });

  const alphaAdmin = await prisma.user.upsert({
    where: { orgId_username: { orgId: alphaOrg.id, username: 'admin' } },
    update: {},
    create: {
      orgId: alphaOrg.id,
      username: 'admin',
      email: 'admin@alphateam.io',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    }
  });

  const alphaDispatcher1 = await prisma.user.upsert({
    where: { orgId_username: { orgId: alphaOrg.id, username: 'user.01' } },
    update: {},
    create: {
      orgId: alphaOrg.id,
      username: 'user.01',
      email: 'user01@alphateam.io',
      passwordHash: dispatcherPasswordHash,
      role: 'DISPATCHER',
      status: 'ACTIVE'
    }
  });

  const alphaDispatcher2 = await prisma.user.upsert({
    where: { orgId_username: { orgId: alphaOrg.id, username: 'user.02' } },
    update: {},
    create: {
      orgId: alphaOrg.id,
      username: 'user.02',
      email: 'user02@alphateam.io',
      passwordHash: dispatcherPasswordHash,
      role: 'DISPATCHER',
      status: 'ACTIVE'
    }
  });

  const betaAdmin = await prisma.user.upsert({
    where: { orgId_username: { orgId: betaOrg.id, username: 'manager' } },
    update: {},
    create: {
      orgId: betaOrg.id,
      username: 'manager',
      email: 'manager@betaops.io',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    }
  });

  const betaDispatcher = await prisma.user.upsert({
    where: { orgId_username: { orgId: betaOrg.id, username: 'agent.s1' } },
    update: {},
    create: {
      orgId: betaOrg.id,
      username: 'agent.s1',
      email: 'agents1@betaops.io',
      passwordHash: dispatcherPasswordHash,
      role: 'DISPATCHER',
      status: 'ACTIVE'
    }
  });

  console.log('[Seed] Users created');

  const alphaProxy1 = await prisma.proxyNode.upsert({
    where: { orgId_name: { orgId: alphaOrg.id, name: 'proxy-us-east' } },
    update: {},
    create: {
      orgId: alphaOrg.id,
      name: 'proxy-us-east',
      host: 'us-east.proxy.example.com',
      port: 8080,
      protocol: 'HTTP',
      username: 'alpha_user',
      status: 'ACTIVE',
      maxSessions: 10
    }
  });

  const alphaProxy2 = await prisma.proxyNode.upsert({
    where: { orgId_name: { orgId: alphaOrg.id, name: 'proxy-eu-west' } },
    update: {},
    create: {
      orgId: alphaOrg.id,
      name: 'proxy-eu-west',
      host: 'eu-west.proxy.example.com',
      port: 8080,
      protocol: 'HTTP',
      username: 'alpha_eu',
      status: 'ACTIVE',
      maxSessions: 8
    }
  });

  const betaProxy = await prisma.proxyNode.upsert({
    where: { orgId_name: { orgId: betaOrg.id, name: 'proxy-asia-1' } },
    update: {},
    create: {
      orgId: betaOrg.id,
      name: 'proxy-asia-1',
      host: 'asia1.proxy.example.com',
      port: 3128,
      protocol: 'SOCKS5',
      status: 'ACTIVE',
      maxSessions: 12
    }
  });

  console.log('[Seed] Proxy nodes created');

  await prisma.hardwareProfile.createMany({
    data: [
      {
        orgId: alphaOrg.id,
        name: 'default-win10',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: 'Win32',
        screenResolution: '1920x1080',
        languages: 'en-US,en',
        hardwareConcurrency: 8,
        deviceMemory: 8,
        webglVendor: 'Google Inc. (NVIDIA)',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)',
        isDefault: true
      },
      {
        orgId: betaOrg.id,
        name: 'default-win11',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: 'Win32',
        screenResolution: '2560x1440',
        languages: 'en-US,en',
        hardwareConcurrency: 12,
        deviceMemory: 16,
        webglVendor: 'Google Inc. (NVIDIA)',
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)',
        isDefault: true
      }
    ],
    
  });

  console.log('[Seed] Hardware profiles created');

  console.log('[Seed] Seed completed successfully!');
  console.log('[Seed] Login credentials:');
  console.log('  Super Admin: superadmin / superadmin123 (org: zonix-system)');
  console.log('  Alpha Admin: admin / admin123 (org: alpha-team)');
  console.log('  Alpha User 1: user.01 / dispatch123 (org: alpha-team)');
  console.log('  Alpha User 2: user.02 / dispatch123 (org: alpha-team)');
  console.log('  Beta Manager: manager / admin123 (org: beta-ops)');
  console.log('  Beta Agent: agent.s1 / dispatch123 (org: beta-ops)');
}

main()
  .catch((e) => {
    console.error('[Seed] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

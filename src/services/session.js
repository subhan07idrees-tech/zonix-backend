const { encryptData, decryptData } = require('./encryption');

class SessionService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async createSession({ orgId, userId, targetUrl, proxyNodeId, partitionId, cookies }) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new Error('Organization not found');
    if (org.status !== 'ACTIVE') throw new Error('Organization is not active');

    const activeSessions = await this.prisma.session.count({
      where: { orgId, status: 'ACTIVE' }
    });
    if (activeSessions >= org.maxSessions) {
      throw new Error(`Organization session limit reached (${org.maxSessions})`);
    }

    let encryptedCookieData = null;
    if (cookies && cookies.length > 0) {
      const cookieJson = JSON.stringify(cookies);
      const encrypted = encryptData(cookieJson);
      encryptedCookieData = JSON.stringify(encrypted);
    }

    const session = await this.prisma.session.create({
      data: {
        orgId,
        userId,
        targetUrl,
        proxyNodeId: proxyNodeId || null,
        partitionId: partitionId || `persist:org_${orgId}_user_${userId}`,
        encryptedCookieData,
        status: 'ACTIVE',
        lastHeartbeat: new Date()
      },
      include: {
        user: { select: { username: true } },
        proxyNode: { select: { name: true, host: true, port: true, protocol: true } }
      }
    });

    return session;
  }

  async getSession(sessionId) {
    return this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { username: true } },
        proxyNode: true,
        org: { select: { name: true, displayName: true } }
      }
    });
  }

  async getActiveSessionsByOrg(orgId) {
    return this.prisma.session.findMany({
      where: { orgId, status: 'ACTIVE' },
      include: {
        user: { select: { username: true } },
        proxyNode: { select: { name: true } }
      },
      orderBy: { startedAt: 'desc' }
    });
  }

  async getActiveSessionsByUser(orgId, userId) {
    return this.prisma.session.findMany({
      where: { orgId, userId, status: 'ACTIVE' },
      include: {
        proxyNode: { select: { name: true } }
      },
      orderBy: { startedAt: 'desc' }
    });
  }

  async updateHeartbeat(sessionId) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { lastHeartbeat: new Date() }
    });
  }

  async endSession(sessionId, reason = 'manual') {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'KILLED',
        endedAt: new Date(),
        endReason: reason
      }
    });
  }

  async refreshCookies(sessionId, cookies) {
    const cookieJson = JSON.stringify(cookies);
    const encrypted = encryptData(cookieJson);

    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        encryptedCookieData: JSON.stringify(encrypted),
        lastHeartbeat: new Date()
      }
    });
  }

  async getDecryptedCookies(sessionId) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session || !session.encryptedCookieData) return null;

    try {
      const encrypted = JSON.parse(session.encryptedCookieData);
      const decrypted = decryptData(encrypted.encryptedData, encrypted.iv);
      return JSON.parse(decrypted);
    } catch (err) {
      console.error('[SessionService] Cookie decryption failed:', err.message);
      return null;
    }
  }

  async killAllOrgSessions(orgId, reason = 'admin-command') {
    const result = await this.prisma.session.updateMany({
      where: { orgId, status: 'ACTIVE' },
      data: {
        status: 'KILLED',
        endedAt: new Date(),
        endReason: reason
      }
    });

    return result.count;
  }

  async getSessionStats(orgId) {
    const [total, active, killed, errored] = await Promise.all([
      this.prisma.session.count({ where: { orgId } }),
      this.prisma.session.count({ where: { orgId, status: 'ACTIVE' } }),
      this.prisma.session.count({ where: { orgId, status: 'KILLED' } }),
      this.prisma.session.count({ where: { orgId, status: 'ERROR' } })
    ]);

    const recentSessions = await this.prisma.session.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: { select: { username: true } },
        proxyNode: { select: { name: true } }
      }
    });

    return {
      total,
      active,
      killed,
      errored,
      recentSessions
    };
  }
}

module.exports = SessionService;

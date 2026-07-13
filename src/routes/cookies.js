const express = require('express');
const router = express.Router();
const { encryptData, decryptData } = require('../services/encryption');

router.post('/store', async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId, userId, targetDomain, cookies } = req.body;

  try {
    if (!orgId || !userId || !targetDomain || !cookies) {
      return res.status(400).json({ error: 'orgId, userId, targetDomain, and cookies required' });
    }

    const cookieJson = JSON.stringify(cookies);
    const { encryptedData, iv, hash } = encryptData(cookieJson);

    const masterCookie = await prisma.masterCookie.upsert({
      where: {
        orgId_userId_targetDomain: { orgId, userId, targetDomain }
      },
      update: {
        encryptedData,
        iv,
        hash,
        updatedAt: new Date()
      },
      create: {
        orgId,
        userId,
        targetDomain,
        encryptedData,
        iv,
        hash
      }
    });

    res.json({ success: true, id: masterCookie.id, hash });
  } catch (err) {
    console.error('[Cookies] Store error:', err.message);
    res.status(500).json({ error: 'Failed to store cookies' });
  }
});

router.get('/retrieve/:orgId/:userId/:targetDomain', async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId, userId, targetDomain } = req.params;

  try {
    let masterCookie = await prisma.masterCookie.findUnique({
      where: {
        orgId_userId_targetDomain: { orgId, userId, targetDomain }
      }
    });

    if (!masterCookie) {
      masterCookie = await prisma.masterCookie.findFirst({
        where: { orgId, targetDomain },
        orderBy: { updatedAt: 'desc' }
      });
    }

    if (!masterCookie) {
      return res.status(404).json({ error: 'No stored cookies found for this domain' });
    }

    if (masterCookie.expiresAt && new Date(masterCookie.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Stored cookies have expired' });
    }

    const decryptedJson = decryptData(masterCookie.encryptedData, masterCookie.iv);
    const cookies = JSON.parse(decryptedJson);

    res.json({ cookies, hash: masterCookie.hash, capturedAt: masterCookie.capturedAt });
  } catch (err) {
    console.error('[Cookies] Retrieve error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve cookies' });
  }
});

router.delete('/:orgId/:userId/:targetDomain', async (req, res) => {
  const prisma = req.app.get('prisma');
  const { orgId, userId, targetDomain } = req.params;

  try {
    await prisma.masterCookie.delete({
      where: {
        orgId_userId_targetDomain: { orgId, userId, targetDomain }
      }
    });

    res.json({ success: true, message: 'Cookies deleted' });
  } catch (err) {
    console.error('[Cookies] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete cookies' });
  }
});

module.exports = router;

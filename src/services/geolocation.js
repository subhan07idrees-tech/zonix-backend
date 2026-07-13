async function getIpLocation(ip) {
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('127.') || ip === '::ffff:127.0.0.1') {
    return { city: 'Local', state: 'Loopback' };
  }
  try {
    const cleanIp = ip.startsWith('::ffff:') ? ip.substring(7) : ip;
    const response = await fetch(`http://ip-api.com/json/${cleanIp}`);
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        return {
          city: data.city || 'Unknown',
          state: data.regionName || data.region || 'Unknown'
        };
      }
    }
  } catch (err) {
    console.error('[Geolocation] Fetch failed:', err.message);
  }
  return { city: 'Unknown', state: 'Unknown' };
}

module.exports = { getIpLocation };

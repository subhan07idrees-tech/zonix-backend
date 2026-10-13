function isPrivateIp(ip) {
  const cleaned = ip.startsWith('::ffff:') ? ip.substring(7) : ip;
  return (
    cleaned === '127.0.0.1' ||
    cleaned === '::1' ||
    cleaned.startsWith('10.') ||
    cleaned.startsWith('192.168.') ||
    cleaned.match(/^172\.(1[6-9]|2\d|3[01])\./)
  );
}

async function getIpLocation(ip) {
  if (!ip) return { city: 'Unknown', state: 'Unknown' };

  // Strip IPv6-mapped IPv4 prefix
  const cleanIp = ip.startsWith('::ffff:') ? ip.substring(7) : ip;

  if (cleanIp === '::1' || cleanIp === '127.0.0.1' || cleanIp.startsWith('127.')) {
    return { city: 'Local', state: 'Loopback' };
  }

  if (isPrivateIp(cleanIp)) {
    return { city: 'Private', state: 'Network' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,city,regionName`, {
      signal: controller.signal
    });
    clearTimeout(timer);
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        return {
          city: data.city || 'Unknown',
          state: data.regionName || 'Unknown'
        };
      }
    }
  } catch (err) {
    console.error('[Geolocation] Fetch failed:', err.message);
  }
  return { city: 'Unknown', state: 'Unknown' };
}

module.exports = { getIpLocation };

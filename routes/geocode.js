const express = require('express');
const router = express.Router();

router.get('/reverse', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat va lon kerak' });
  try {
    const url = 'https://nominatim.openstreetmap.org/reverse?lat=' + encodeURIComponent(lat) +
      '&lon=' + encodeURIComponent(lon) + '&format=jsonv2&addressdetails=1&accept-language=uz';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'uzumone/1.0' }
    });
    clearTimeout(timer);
    if (!r.ok) return res.status(502).json({ error: 'Geokodlash xizmati javob bermadi' });
    const data = await r.json();
    const addr = data.address || {};
    const region = addr.state || addr.region || '';
    const district = addr.county || addr.city_district || addr.state_district || '';
    const city = addr.city || addr.town || addr.village || addr.municipality || '';
    const parts = [];
    const road = addr.road || addr.residential || addr.pedestrian || addr.footway || '';
    if (road) parts.push(addr.house_number ? (road + ' ' + addr.house_number) : road);
    if (addr.neighbourhood) parts.push(addr.neighbourhood);
    if (addr.suburb && addr.suburb !== city) parts.push(addr.suburb);
    if (city) parts.push(city);
    if (district && district !== city && district !== addr.suburb) parts.push(district);
    if (region && region !== city) parts.push(region);
    const display = parts.join(', ') || data.display_name || '';
    res.json({
      display,
      lat,
      lon,
      region,
      district,
      city,
      address: addr
    });
  } catch (e) {
    res.status(500).json({ error: 'Manzil aniqlanmadi' });
  }
});

module.exports = router;

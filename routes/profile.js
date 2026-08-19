const express = require('express');
const { db } = require('../database');
const { optionalAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/:userId', optionalAuth, (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = db.query('users').find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  const products = db.query('products').filter(p => p.userId === userId && !p.hidden);
  const totalProducts = products.length;
  const totalViews = products.reduce((s, p) => s + (p.views || 0), 0);
  const allReviews = db.query('reviews').all();
  const sellerProductIds = products.map(p => p.id);
  const reviews = allReviews.filter(r => sellerProductIds.includes(r.productId));
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating || 5), 0) / reviews.length) : 0;
  const memberSince = user.createdAt || user.registeredAt || null;
  const safePhone = req.userId ? user.phone : maskPhone(user.phone);
  res.json({
    user: { id: user.id, name: user.name, avatar: user.avatar, role: user.role, phone: safePhone, createdAt: user.createdAt },
    stats: { totalProducts, totalViews, totalReviews: reviews.length, avgRating: parseFloat(avgRating.toFixed(1)) }
  });
});

function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  return '+' + digits.slice(0, digits.length - 4).replace(/.(?=.)/g, '*') + digits.slice(-4);
}

module.exports = router;

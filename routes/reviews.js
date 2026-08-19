const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.get('/product/:productId', (req, res) => {
  const productId = parseInt(req.params.productId);
  const reviews = db.query('reviews').filter(r => r.productId === productId);
  const users = db.query('users').all();
  const enriched = reviews.map(r => {
    const author = users.find(u => u.id === r.fromUserId);
    return { ...r, authorName: author ? author.name : '', authorAvatar: author ? author.avatar : null };
  });
  enriched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const avg = enriched.length > 0
    ? (enriched.reduce((s, r) => s + (r.rating || 5), 0) / enriched.length)
    : 0;
  res.json({ reviews: enriched, average: parseFloat(avg.toFixed(1)), count: enriched.length });
});

router.post('/', authMiddleware, (req, res) => {
  const { productId, rating, text } = req.body;
  const pid = parseInt(productId);
  if (!pid || !rating) return res.status(400).json({ error: 'Ma\'lumot yetarli emas' });
  const product = db.query('products').find(p => p.id === pid);
  if (!product) return res.status(400).json({ error: 'Mahsulot topilmadi' });
  if (product.userId === req.userId) return res.status(400).json({ error: 'O\'z mahsulotingizga baho bera olmaysiz' });
  const existing = db.query('reviews').find(r => r.fromUserId === req.userId && r.productId === pid);
  if (existing) return res.status(400).json({ error: 'Siz allaqachon baho bergansiz' });
  const review = db.query('reviews').insert({
    fromUserId: req.userId, productId: pid, rating: Math.max(1, Math.min(5, parseInt(rating) || 5)),
    text: text || '', createdAt: new Date().toISOString()
  });
  res.json({ review });
});

router.get('/seller/:sellerId/average', (req, res) => {
  const sellerId = parseInt(req.params.sellerId);
  const allProducts = db.query('products').filter(p => p.userId === sellerId);
  const productIds = allProducts.map(p => p.id);
  const reviews = db.query('reviews').all();
  const sellerReviews = reviews.filter(r => productIds.includes(r.productId));
  const avg = sellerReviews.length > 0
    ? (sellerReviews.reduce((s, r) => s + (r.rating || 5), 0) / sellerReviews.length)
    : 0;
  res.json({ average: parseFloat(avg.toFixed(1)), count: sellerReviews.length });
});

module.exports = router;

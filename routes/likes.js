const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const likes = db.query('likes').filter(l => l.userId === req.userId);
  const products = db.query('products').all();
  const users = db.query('users').all();
  const allReviews = db.query('reviews').all();

  const likedProducts = likes.map(l => {
    const p = products.find(pr => pr.id === l.productId);
    if (!p) return null;
    const seller = users.find(u => u.id === p.userId);
    const sellerProducts = products.filter(pr => pr.userId === p.userId);
    const sellerProductIds = sellerProducts.map(pr => pr.id);
    const sellerReviews = allReviews.filter(r => sellerProductIds.includes(r.productId));
    const avg = sellerReviews.length > 0
      ? (sellerReviews.reduce((s, r) => s + (r.rating || 5), 0) / sellerReviews.length)
      : 0;
    return {
      ...p,
      sellerName: seller ? seller.name : '',
      sellerAvatar: seller ? seller.avatar : null,
      sellerPhone: seller ? seller.phone : '',
      sellerRating: parseFloat(avg.toFixed(1)),
      sellerRatingCount: sellerReviews.length,
      liked: true
    };
  }).filter(Boolean);

  likedProducts.sort((a, b) => b.id - a.id);
  res.json({ products: likedProducts });
});

router.get('/count', authMiddleware, (req, res) => {
  const products = db.query('products').all();
  const count = db.query('likes').filter(l => l.userId === req.userId && products.some(p => p.id === l.productId)).length;
  res.json({ count });
});

router.post('/toggle', authMiddleware, (req, res) => {
  const productId = parseInt(req.body.productId, 10);
  if (!productId) return res.status(400).json({ error: 'Product ID kerak' });

  const product = db.query('products').find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });

  const existing = db.query('likes').find(l => l.userId === req.userId && l.productId === productId);
  if (existing) {
    db.query('likes').delete(existing.id);
    res.json({ liked: false });
  } else {
    db.query('likes').insert({ userId: req.userId, productId });
    res.json({ liked: true });
  }
});

module.exports = router;

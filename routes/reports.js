const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.post('/', authMiddleware, (req, res) => {
  const { productId, reason } = req.body;
  const pid = parseInt(productId);
  if (!pid || !reason || typeof reason !== 'string' || !reason.trim()) return res.status(400).json({ error: 'Mahsulot ID va sabab kerak' });
  const product = db.query('products').find(p => p.id === pid);
  if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  const existing = db.query('reports').find(r => r.productId === pid && r.userId === req.userId);
  if (existing) return res.status(400).json({ error: 'Siz allaqachon bu mahsulotga shikoyat yuborgansiz' });
  db.query('reports').insert({
    productId: pid, userId: req.userId, reason: reason.trim(),
    createdAt: new Date().toISOString()
  });
  res.json({ success: true, message: 'Shikoyat yuborildi' });
});

module.exports = router;

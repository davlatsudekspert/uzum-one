const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.post('/', authMiddleware, (req, res) => {
  const { productId, targetPrice } = req.body;
  const pid = parseInt(productId);
  const tp = parseFloat(targetPrice);
  if (!pid || isNaN(tp) || tp <= 0) return res.status(400).json({ error: 'Mahsulot va to\'g\'ri narx kerak' });
  const product = db.query('products').find(p => p.id === pid);
  if (!product) return res.status(400).json({ error: 'Mahsulot topilmadi' });
  if (product.userId === req.userId) return res.status(400).json({ error: 'O\'z mahsulotingizni kuzata olmaysiz' });
  const existing = db.query('priceAlerts').find(a => a.userId === req.userId && a.productId === pid);
  if (existing) return res.status(400).json({ error: 'Siz allaqachon kuzatyapsiz' });
  const alert = db.query('priceAlerts').insert({
    userId: req.userId, productId: pid, targetPrice: tp,
    currentPrice: product.price, createdAt: new Date().toISOString()
  });
  res.json({ alert });
});

router.get('/my', authMiddleware, (req, res) => {
  const alerts = db.query('priceAlerts').filter(a => a.userId === req.userId);
  const products = db.query('products').all();
  const enriched = alerts.map(a => {
    const prod = products.find(p => p.id === a.productId);
    return { ...a, productName: prod ? prod.name : '', productPrice: prod ? prod.price : 0, productImage: prod ? (prod.images||[])[0] : null };
  });
  enriched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ alerts: enriched });
});

router.delete('/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const alert = db.query('priceAlerts').find(a => a.id === id);
  if (!alert) return res.status(404).json({ error: 'Kuzatuv topilmadi' });
  if (alert.userId !== req.userId) return res.status(403).json({ error: 'Bu sizning kuzatuviz emas' });
  db.query('priceAlerts').delete(id);
  res.json({ success: true });
});

module.exports = router;

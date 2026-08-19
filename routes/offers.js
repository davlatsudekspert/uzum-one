const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.post('/', authMiddleware, (req, res) => {
  const { productId, price, message } = req.body;
  const pid = parseInt(productId);
  if (!pid || isNaN(parseFloat(price)) || parseFloat(price) <= 0) return res.status(400).json({ error: 'Mahsulot va to\'g\'ri narx kerak' });
  const product = db.query('products').find(p => p.id === pid);
  if (!product) return res.status(400).json({ error: 'Mahsulot topilmadi' });
  if (product.hidden) return res.status(400).json({ error: 'Bu mahsulot arxivlangan' });
  if (product.status === 'sold') return res.status(400).json({ error: 'Bu mahsulot allaqachon sotilgan' });
  if (product.userId === req.userId) return res.status(400).json({ error: 'O\'z mahsulotingizga taklif bera olmaysiz' });
  const existing = db.query('offers').find(o => o.buyerId === req.userId && o.productId === pid && o.status === 'pending');
  if (existing) return res.status(400).json({ error: 'Siz allaqachon taklif bergansiz' });
  const offer = db.query('offers').insert({
    buyerId: req.userId, sellerId: product.userId, productId: pid, price: parseFloat(price),
    message: message || '', status: 'pending', createdAt: new Date().toISOString()
  });
  res.json({ offer });
});

router.get('/received', authMiddleware, (req, res) => {
  const offers = db.query('offers').filter(o => o.sellerId === req.userId);
  const users = db.query('users').all();
  const products = db.query('products').all();
  const enriched = offers.map(o => {
    const buyer = users.find(u => u.id === o.buyerId);
    const prod = products.find(p => p.id === o.productId);
    return { ...o, buyerName: buyer ? buyer.name : '', buyerPhone: buyer ? buyer.phone : '', productName: prod ? prod.name : '' };
  });
  enriched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ offers: enriched });
});

router.get('/my', authMiddleware, (req, res) => {
  const offers = db.query('offers').filter(o => o.buyerId === req.userId);
  const products = db.query('products').all();
  const enriched = offers.map(o => {
    const prod = products.find(p => p.id === o.productId);
    return { ...o, productName: prod ? prod.name : '' };
  });
  enriched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ offers: enriched });
});

router.put('/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  if (!status || !['accepted', 'declined'].includes(status)) return res.status(400).json({ error: 'Noto\'g\'ri status' });
  const offer = db.query('offers').find(o => o.id === id);
  if (!offer) return res.status(404).json({ error: 'Taklif topilmadi' });
  if (offer.sellerId !== req.userId) return res.status(403).json({ error: 'Bu sizning taklifingiz emas' });
  const updated = db.query('offers').update(id, { status });
  res.json({ offer: updated });
});

module.exports = router;

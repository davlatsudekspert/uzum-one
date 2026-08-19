const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

function adminOnly(req, res, next) {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin huquqi kerak' });
  next();
}

router.get('/users', authMiddleware, adminOnly, (req, res) => {
  const users = db.query('users').all().map(u => {
    const { password, ...rest } = u;
    const products = db.query('products').filter(p => p.userId === u.id).map(p => ({ id: p.id, name: p.name, price: p.price }));
    return { ...rest, productCount: products.length, products };
  });
  res.json({ users });
});

router.put('/users/:id/role', authMiddleware, adminOnly, (req, res) => {
  const id = parseInt(req.params.id);
  const user = db.query('users').find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  const { role } = req.body;
  if (!['buyer', 'seller', 'admin'].includes(role)) return res.status(400).json({ error: 'Noto\'g\'ri rol' });
  db.query('users').update(id, { role });
  res.json({ success: true });
});

router.delete('/users/:id', authMiddleware, adminOnly, (req, res) => {
  const id = parseInt(req.params.id);
  const user = db.query('users').find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  if (id === req.userId) return res.status(400).json({ error: 'O\'zingizni o\'chira olmaysiz' });
  const myProductIds = db.query('products').filter(p => p.userId === id).map(p => p.id);
  db.query('users').delete(id);
  db.query('products').deleteWhere(p => p.userId === id);
  db.query('cartItems').deleteWhere(c => c.productId && myProductIds.includes(c.productId));
  db.query('cartItems').deleteWhere(c => c.userId === id);
  db.query('likes').deleteWhere(l => l.productId && myProductIds.includes(l.productId));
  db.query('likes').deleteWhere(l => l.userId === id);
  db.query('reviews').deleteWhere(r => r.productId && myProductIds.includes(r.productId));
  db.query('reviews').deleteWhere(r => r.userId === id);
  db.query('offers').deleteWhere(o => o.productId && myProductIds.includes(o.productId));
  db.query('offers').deleteWhere(o => o.buyerId === id || o.sellerId === id);
  db.query('priceAlerts').deleteWhere(a => a.productId && myProductIds.includes(a.productId));
  db.query('priceAlerts').deleteWhere(a => a.userId === id);
  db.query('reports').deleteWhere(r => r.productId && myProductIds.includes(r.productId));
  db.query('reports').deleteWhere(r => r.userId === id);
  db.query('messages').deleteWhere(m => m.fromUserId === id || m.toUserId === id);
  db.query('orders').deleteWhere(o => o.userId === id);
  db.query('orders').deleteWhere(o => o.items && o.items.some(i => myProductIds.includes(i.productId)));
  db.query('phoneLinks').deleteWhere(l => l.userId === id);
  res.json({ success: true });
});

router.get('/products', authMiddleware, adminOnly, (req, res) => {
  const products = db.query('products').all();
  products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ products });
});

router.delete('/products/:id', authMiddleware, adminOnly, (req, res) => {
  const id = parseInt(req.params.id);
  db.query('products').delete(id);
  db.query('cartItems').deleteWhere(c => c.productId === id);
  db.query('likes').deleteWhere(l => l.productId === id);
  db.query('reviews').deleteWhere(r => r.productId === id);
  db.query('offers').deleteWhere(o => o.productId === id);
  db.query('priceAlerts').deleteWhere(a => a.productId === id);
  db.query('reports').deleteWhere(r => r.productId === id);
  res.json({ success: true });
});

router.get('/reports', authMiddleware, adminOnly, (req, res) => {
  const reports = db.query('reports').all();
  reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const users = db.query('users').all();
  const products = db.query('products').all();
  const enriched = reports.map(r => {
    const reporter = users.find(u => u.id === r.userId);
    const product = products.find(p => p.id === r.productId);
    return { ...r, reporterName: reporter ? reporter.name : '', productName: product ? product.name : '' };
  });
  res.json({ reports: enriched });
});

router.delete('/reports/:id', authMiddleware, adminOnly, (req, res) => {
  db.query('reports').delete(parseInt(req.params.id));
  res.json({ success: true });
});

module.exports = router;
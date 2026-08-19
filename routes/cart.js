const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

const MAX_QTY = 99;

function toId(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

router.get('/', authMiddleware, (req, res) => {
  const cartItems = db.query('cartItems').filter(c => c.userId === req.userId);
  const products = db.query('products').all();
  const users = db.query('users').all();

  const items = cartItems.map(ci => {
    const prod = products.find(p => p.id === ci.productId);
    if (!prod) return null;
    const seller = users.find(u => u.id === prod.userId);
    return {
      id: ci.id,
      quantity: ci.quantity,
      productId: prod.id,
      name: prod.name,
      price: prod.price,
      images: prod.images,
      category: prod.category,
      sellerId: prod.userId,
      sellerName: seller ? seller.name : '',
      sold: prod.status === 'sold' || !!prod.hidden
    };
  }).filter(Boolean);

  items.sort((a, b) => b.id - a.id);
  const totalPrice = items.reduce((s, i) => (i.sold ? s : s + (parseFloat(i.price) || 0) * (parseInt(i.quantity, 10) || 1)), 0);
  res.json({ items, totalPrice });
});

router.post('/add', authMiddleware, (req, res) => {
  const productId = toId(req.body.productId);
  const quantity = Math.min(parseInt(req.body.quantity, 10) || 1, MAX_QTY);
  if (!productId || quantity < 1) return res.status(400).json({ error: 'Product ID kerak' });

  const product = db.query('products').find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  if (product.status === 'sold') return res.status(400).json({ error: 'Bu mahsulot allaqachon sotilgan' });
  if (product.hidden) return res.status(400).json({ error: 'Bu mahsulot arxivda, sotib olish mumkin emas' });

  const existing = db.query('cartItems').find(c => c.userId === req.userId && c.productId === productId);
  if (existing) {
    db.query('cartItems').update(existing.id, { quantity: Math.min(existing.quantity + quantity, MAX_QTY) });
  } else {
    db.query('cartItems').insert({
      userId: req.userId, productId, quantity
    });
  }
  res.json({ success: true });
});

router.post('/update', authMiddleware, (req, res) => {
  const itemId = toId(req.body.itemId);
  const quantity = toId(req.body.quantity);
  if (!itemId || !quantity || quantity < 1) return res.status(400).json({ error: 'Noto\'g\'ri ma\'lumot' });
  const item = db.query('cartItems').find(c => c.id === itemId && c.userId === req.userId);
  if (!item) return res.status(404).json({ error: 'Savatda topilmadi' });
  const product = db.query('products').find(p => p.id === item.productId);
  if (product && product.status === 'sold') return res.status(400).json({ error: 'Bu mahsulot allaqachon sotilgan' });
  db.query('cartItems').update(itemId, { quantity: Math.min(quantity, MAX_QTY) });
  res.json({ success: true });
});

router.delete('/remove/:itemId', authMiddleware, (req, res) => {
  const itemId = toId(req.params.itemId);
  const item = db.query('cartItems').find(c => c.id === itemId && c.userId === req.userId);
  if (!item) return res.status(404).json({ error: 'Savatda topilmadi' });
  db.query('cartItems').delete(itemId);
  res.json({ success: true });
});

router.delete('/clear', authMiddleware, (req, res) => {
  db.query('cartItems').deleteWhere(c => c.userId === req.userId);
  res.json({ success: true });
});

module.exports = router;

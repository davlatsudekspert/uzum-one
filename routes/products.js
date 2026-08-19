const express = require('express');
const { db, CATEGORIES } = require('../database');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { translateTexts } = require('./translate');
const router = express.Router();

async function autoTranslate(name, description) {
  const src = [String(name || '').trim(), String(description || '').trim()].filter(Boolean);
  if (src.length === 0) {
    return { name_ru: '', name_en: '', description_ru: '', description_en: '' };
  }
  const [ruMap, enMap] = await Promise.all([translateTexts(src, 'ru'), translateTexts(src, 'en')]);
  const n = String(name || '').trim();
  const d = String(description || '').trim();
  return {
    name_ru: ruMap[n] || '',
    name_en: enMap[n] || '',
    description_ru: ruMap[d] || '',
    description_en: enMap[d] || ''
  };
}

function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  return '+' + digits.slice(0, digits.length - 4).replace(/.(?=.)/g, '*') + digits.slice(-4);
}

router.get('/categories/list', (req, res) => {
  res.json({ categories: CATEGORIES });
});

router.get('/my/list', authMiddleware, (req, res) => {
  const products = db.query('products').filter(p => p.userId === req.userId);
  products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ products });
});

router.get('/', optionalAuth, (req, res) => {
  const { category, search, subcategory, location, minPrice, maxPrice, sort, sellerId, condition, page, limit } = req.query;
  const includeHidden = req.query.includeHidden === 'true';
  let products = db.query('products').all();
  const users = db.query('users').all();

  if (sellerId) {
    const sid = parseInt(sellerId);
    // if viewing own products, include hidden; otherwise exclude
    if (req.userId !== sid) products = products.filter(p => !p.hidden);
  } else if (!includeHidden) {
    // main listing excludes archived products
    products = products.filter(p => !p.hidden);
  }

  if (category && category !== 'Hammasi') {
    products = products.filter(p => p.category === category);
  }
  if (subcategory) {
    products = products.filter(p => p.subcategory === subcategory);
  }
  if (location) {
    const loc = location.toLowerCase();
    products = products.filter(p => p.location && p.location.toLowerCase().includes(loc));
  }
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.name_ru && p.name_ru.toLowerCase().includes(q)) ||
      (p.name_en && p.name_en.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.description_ru && p.description_ru.toLowerCase().includes(q)) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q))
    );
  }
  if (minPrice) {
    const mn = parseFloat(minPrice);
    if (!isNaN(mn)) products = products.filter(p => (p.price || 0) >= mn);
  }
  if (maxPrice) {
    const mx = parseFloat(maxPrice);
    if (!isNaN(mx)) products = products.filter(p => (p.price || 0) <= mx);
  }
  if (condition) {
    products = products.filter(p => p.condition === condition);
  }

  if (sort === 'price_asc') products.sort((a, b) => (a.price || 0) - (b.price || 0));
  else if (sort === 'price_desc') products.sort((a, b) => (b.price || 0) - (a.price || 0));
  else if (sort === 'views') products.sort((a, b) => (b.views || 0) - (a.views || 0));
  else products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = products.length;
  const pg = parseInt(page) || 1;
  const lm = parseInt(limit) || 20;
  const start = (pg - 1) * lm;
  const paged = products.slice(start, start + lm);

  const enriched = paged.map(p => {
    const seller = users.find(u => u.id === p.userId);
    // compute seller avg rating from product-based reviews
    const allReviews = db.query('reviews').all();
    const sellerProducts = db.query('products').filter(pr => pr.userId === p.userId);
    const sellerProductIds = sellerProducts.map(pr => pr.id);
    const sellerReviews = allReviews.filter(r => sellerProductIds.includes(r.productId));
    const avg = sellerReviews.length > 0
      ? (sellerReviews.reduce((s, r) => s + (r.rating || 5), 0) / sellerReviews.length)
      : 0;
    return {
      ...p,
      sellerName: seller ? seller.name : '',
      sellerAvatar: seller ? seller.avatar : null,
      sellerPhone: seller ? (req.userId ? seller.phone : maskPhone(seller.phone)) : '',
      sellerRating: parseFloat(avg.toFixed(1)),
      sellerRatingCount: sellerReviews.length,
      liked: false
    };
  });

  if (req.userId) {
    const likedIds = db.query('likes').filter(l => l.userId === req.userId).map(l => l.productId);
    for (const p of enriched) {
      p.liked = likedIds.includes(p.id);
    }
  }

  res.json({ products: enriched, total, page: pg, limit: lm, totalPages: Math.ceil(total / lm) });
});

router.get('/:id', optionalAuth, (req, res) => {
  const product = db.query('products').find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  const newViews = (product.views || 0) + 1;
  if (req.userId !== product.userId) {
    db.query('products').update(product.id, { views: newViews });
  }
  const seller = db.query('users').find(u => u.id === product.userId);
  const allReviews = db.query('reviews').all();
  const sellerProducts = db.query('products').filter(pr => pr.userId === product.userId);
  const sellerProductIds = sellerProducts.map(pr => pr.id);
  const sellerReviews = allReviews.filter(r => sellerProductIds.includes(r.productId));
  const avg = sellerReviews.length > 0
    ? (sellerReviews.reduce((s, r) => s + (r.rating || 5), 0) / sellerReviews.length)
    : 0;
  const result = {
    ...product,
    views: newViews,
    sellerName: seller ? seller.name : '',
    sellerAvatar: seller ? seller.avatar : null,
    sellerPhone: seller ? (req.userId ? seller.phone : maskPhone(seller.phone)) : '',
    sellerRating: parseFloat(avg.toFixed(1)),
    sellerRatingCount: sellerReviews.length,
    liked: false
  };
  if (req.userId) {
    result.liked = !!db.query('likes').find(l => l.userId === req.userId && l.productId === product.id);
  }
  res.json({ product: result });
});

router.post('/', authMiddleware, async (req, res) => {
  if (req.userRole !== 'seller' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Faqat sotuvchilar mahsulot qo\'sha oladi' });
  }
  const { name, price, category, description, images, subcategory, location, address, name_ru, name_en, description_ru, description_en, condition } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nomi majburiy' });
  }
  if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
    return res.status(400).json({ error: 'Narxi to\'g\'ri kiritilmagan' });
  }
  if (!category) {
    return res.status(400).json({ error: 'Kategoriyasi majburiy' });
  }
  const cleanName = name.trim();
  const cleanDesc = (description || '').trim();
  const tr = await autoTranslate(cleanName, cleanDesc);
  const product = db.query('products').insert({
    userId: req.userId, name: cleanName, price: parseFloat(price), category,
    description: cleanDesc,
    images: images || [],
    subcategory: subcategory || '',
    location: location || '',
    address: address || '',
    name_ru: name_ru || tr.name_ru || '',
    name_en: name_en || tr.name_en || '',
    description_ru: description_ru || tr.description_ru || '',
    description_en: description_en || tr.description_en || '',
    condition: condition || 'new',
    views: 0,
    createdAt: new Date().toISOString()
  });
  res.json({ product });
});

router.put('/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id);
  const product = db.query('products').find(p => p.id === id);
  if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  if (product.userId !== req.userId) return res.status(403).json({ error: 'Bu sizning mahsulotingiz emas' });

  const { name, price, category, description, images, subcategory, location, address, name_ru, name_en, description_ru, description_en, condition, status } = req.body;
  const changes = {};
  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Nomi bo\'sh bo\'lolmaydi' });
    changes.name = name.trim();
  }
  if (price !== undefined) {
    if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) return res.status(400).json({ error: 'Narxi to\'g\'ri kiritilmagan' });
    changes.price = parseFloat(price);
  }
  if (category) changes.category = category;
  if (description !== undefined) changes.description = description;
  if (images) changes.images = images;
  if (subcategory !== undefined) changes.subcategory = subcategory;
  if (location !== undefined) changes.location = location;
  if (address !== undefined) changes.address = address;
  if (name_ru !== undefined) changes.name_ru = name_ru;
  if (name_en !== undefined) changes.name_en = name_en;
  if (description_ru !== undefined) changes.description_ru = description_ru;
  if (description_en !== undefined) changes.description_en = description_en;
  if (condition) changes.condition = condition;
  if (status === 'sold') { changes.status = 'sold'; changes.hidden = true; }
  else if (status === 'active') { changes.status = 'active'; changes.hidden = false; }

  if ((changes.name || changes.description !== undefined) && name_ru === undefined && name_en === undefined && description_ru === undefined && description_en === undefined) {
    try {
      const tr = await autoTranslate(
        changes.name !== undefined ? changes.name : product.name,
        changes.description !== undefined ? changes.description : (product.description || '')
      );
      if (name_ru === undefined && tr.name_ru) changes.name_ru = tr.name_ru;
      if (name_en === undefined && tr.name_en) changes.name_en = tr.name_en;
      if (description_ru === undefined && tr.description_ru) changes.description_ru = tr.description_ru;
      if (description_en === undefined && tr.description_en) changes.description_en = tr.description_en;
    } catch (e) {}
  }

  const updated = db.query('products').update(id, changes);
  res.json({ product: updated });
});

router.put('/:id/archive', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const product = db.query('products').find(p => p.id === id);
  if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  if (product.userId !== req.userId) return res.status(403).json({ error: 'Bu sizning mahsulotingiz emas' });
  const updated = db.query('products').update(id, { hidden: !product.hidden });
  res.json({ product: updated });
});

router.get('/my/stats', authMiddleware, (req, res) => {
  const myProducts = db.query('products').filter(p => p.userId === req.userId);
  const totalProducts = myProducts.length;
  const totalViews = myProducts.reduce((s, p) => s + (p.views || 0), 0);
  const myProductIds = myProducts.map(p => p.id);
  const orders = db.query('orders').all();
  const myOrders = orders.filter(o => o.items && o.items.some(i => myProductIds.includes(i.productId)));
  const totalOrders = myOrders.length;
  const totalRevenue = myOrders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.totalPrice || 0), 0);
  const activeProducts = myProducts.filter(p => !p.hidden).length;
  res.json({ totalProducts, activeProducts, totalViews, totalOrders, totalRevenue });
});

router.post('/:id/bump', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const product = db.query('products').find(p => p.id === id);
  if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  if (product.userId !== req.userId) return res.status(403).json({ error: 'Bu sizning mahsulotingiz emas' });
  const updated = db.query('products').update(id, { createdAt: new Date().toISOString() });
  res.json({ product: updated });
});

router.delete('/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const product = db.query('products').find(p => p.id === id);
  if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  if (product.userId !== req.userId) return res.status(403).json({ error: 'Bu sizning mahsulotingiz emas' });
  db.query('products').delete(id);
  db.query('cartItems').deleteWhere(c => c.productId === id);
  db.query('likes').deleteWhere(l => l.productId === id);
  db.query('reviews').deleteWhere(r => r.productId === id);
  db.query('offers').deleteWhere(o => o.productId === id);
  db.query('priceAlerts').deleteWhere(a => a.productId === id);
  db.query('reports').deleteWhere(r => r.productId === id);
  res.json({ success: true });
});

module.exports = router;

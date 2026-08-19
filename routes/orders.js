const express = require('express');
const { db } = require('../database');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const TelegramBot = require('node-telegram-bot-api');
const router = express.Router();

function sendTelegramMessage(chatId, message) {
  const token = process.env.BOT_TOKEN;
  if (!token || token === 'your_telegram_bot_token_here' || !chatId) {
    console.log('Telegram bot not configured. Message:', message);
    return;
  }
  try {
    const bot = new TelegramBot(token);
    bot.sendMessage(chatId, message, { parse_mode: 'HTML' }).catch(err => {
      console.error('Telegram send error:', err.message);
    });
  } catch (err) {
    console.error('Telegram bot error:', err.message);
  }
}

function normPhone(p) {
  if (!p) return p;
  let digits = String(p).replace(/[^\d+]/g, '');
  if (digits.startsWith('8') && digits.length === 12) digits = '+' + digits;
  else if (!digits.startsWith('+')) digits = '+' + digits;
  return digits;
}

function getChatIdByUserId(userId) {
  const user = db.query('users').find(u => u.id === userId);
  if (!user || !user.phone) return null;
  const userPhone = normPhone(user.phone);
  try {
    const links = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'phone_links.json'), 'utf8'));
    for (const phone in links) {
      if (normPhone(phone) === userPhone) return links[phone].chatId;
    }
  } catch (_) {}
  return null;
}

router.post('/', optionalAuth, (req, res) => {
  const { name, phone, address, items } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Ism va telefon kerak' });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Mahsulotlar kerak' });
  }

  const verifiedItems = [];
  for (const item of items) {
    const pid = parseInt(item.productId, 10);
    if (!pid) continue;
    const product = db.query('products').find(p => p.id === pid);
    if (!product) continue;
    if (product.status === 'sold') {
      return res.status(400).json({ error: `"${product.name}" allaqachon sotilgan` });
    }
    if (product.hidden) {
      return res.status(400).json({ error: `"${product.name}" arxivda, sotib olish mumkin emas` });
    }
    const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
    verifiedItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      sellerId: product.userId
    });
  }

  if (verifiedItems.length === 0) {
    return res.status(400).json({ error: 'Mahsulotlar kerak' });
  }

  const items_ = verifiedItems;
  const totalPrice = items_.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0);

  const order = db.query('orders').insert({
    userId: req.userId || null, name, phone, address: address || '',
    items: items_, totalPrice, status: 'pending',
    createdAt: new Date().toISOString()
  });

  // Admin notification — only if admin's products are in this order
  const adminUser = db.query('users').find(u => u.role === 'admin');
  const adminItems = items_.filter(i => adminUser && i.sellerId === adminUser.id);
  const adminChatId = process.env.ADMIN_CHAT_ID;

  if (adminChatId && adminItems.length > 0) {
    let itemsHtml = adminItems.map((item, i) =>
      `${i + 1}. ${item.name} x ${item.quantity || 1} = ${((parseFloat(item.price) || 0) * (parseInt(item.quantity, 10) || 1)).toLocaleString()} so'm`
    ).join('\n');
    const adminTotal = adminItems.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.quantity, 10) || 1), 0);
    const msg = `
🆕 <b>Sizning mahsulotingizga buyurtma!</b>

👤 <b>Ism:</b> ${name}
📞 <b>Telefon:</b> ${phone}
📍 <b>Manzil:</b> ${address || 'Kiritilmagan'}

📦 <b>Mahsulotlar:</b>
${itemsHtml}

💰 <b>Jami:</b> ${adminTotal.toLocaleString()} so'm
🕐 <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}
    `;
    sendTelegramMessage(adminChatId, msg);
  }

  // Seller notifications — group items by seller
  const sellerItems = {};
  for (const item of items_) {
    if (!item.sellerId) continue;
    if (!sellerItems[item.sellerId]) sellerItems[item.sellerId] = [];
    sellerItems[item.sellerId].push(item);
  }

  for (const sellerId in sellerItems) {
    const sellerChatId = getChatIdByUserId(parseInt(sellerId));
    if (!sellerChatId) continue;
    const sellerMsgs = sellerItems[sellerId].map((item, i) =>
      `${i + 1}. ${item.name} x ${item.quantity || 1} = ${((parseFloat(item.price) || 0) * (parseInt(item.quantity, 10) || 1)).toLocaleString()} so'm`
    ).join('\n');
    const sellerTotal = sellerItems[sellerId].reduce((s, item) => s + (parseFloat(item.price) || 0) * (parseInt(item.quantity, 10) || 1), 0);
    const sellerAlert = `
🛒 <b>Mahsulotingiz xarid qilindi!</b>

👤 <b>Xaridor:</b> ${name}
📞 <b>Telefon:</b> ${phone}
📍 <b>Manzil:</b> ${address || 'Kiritilmagan'}

📦 <b>Xarid qilingan:</b>
${sellerMsgs}

💰 <b>Summa:</b> ${sellerTotal.toLocaleString()} so'm
🕐 <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}
    `;
    sendTelegramMessage(sellerChatId, sellerAlert);
  }

  if (req.userId) {
    db.query('cartItems').deleteWhere(c => c.userId === req.userId);
  }

  res.json({ success: true, orderId: order.id });
});

router.post('/buy', authMiddleware, (req, res) => {
  const buyer = db.query('users').find(u => u.id === req.userId);
  if (!buyer) return res.status(401).json({ error: 'Avval tizimga kiring' });
  const buyerName = buyer.name || '';
  const buyerPhone = buyer.phone || '';

  let items = Array.isArray(req.body.items) ? req.body.items : null;
  if (!items && req.body.productId) items = [{ productId: req.body.productId, quantity: req.body.quantity || 1 }];
  if (!items || items.length === 0) return res.status(400).json({ error: 'Mahsulotlar kerak' });
  const extraMessage = (req.body.message || '').toString().trim();

  const verifiedItems = [];
  for (const item of items) {
    const pid = parseInt(item.productId, 10);
    if (!pid) continue;
    const product = db.query('products').find(p => p.id === pid);
    if (!product) continue;
    if (product.status === 'sold') return res.status(400).json({ error: `"${product.name}" allaqachon sotilgan` });
    if (product.hidden) return res.status(400).json({ error: `"${product.name}" arxivda, sotib olish mumkin emas` });
    const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
    verifiedItems.push({ productId: product.id, name: product.name, price: product.price, quantity, sellerId: product.userId });
  }

  if (verifiedItems.length === 0) {
    return res.status(400).json({ error: 'Mahsulot topilmadi' });
  }

  const totalPrice = verifiedItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0);

  const order = db.query('orders').insert({
    userId: req.userId, name: buyerName, phone: buyerPhone, address: '',
    note: extraMessage || null,
    items: verifiedItems, totalPrice, status: 'pending',
    createdAt: new Date().toISOString()
  });

  // Admin notification — only if admin's products are in this order
  const adminUser = db.query('users').find(u => u.role === 'admin');
  const adminProducts = verifiedItems.filter(i => adminUser && i.sellerId === adminUser.id);
  const adminChatId = process.env.ADMIN_CHAT_ID;

  if (adminChatId && adminProducts.length > 0) {
    let itemsHtml = adminProducts.map((item, i) =>
      `${i + 1}. ${item.name} x ${item.quantity || 1} = ${((parseFloat(item.price) || 0) * (parseInt(item.quantity, 10) || 1)).toLocaleString()} so'm`
    ).join('\n');
    const adminTotal = adminProducts.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.quantity, 10) || 1), 0);
    const msg = `
🛍️ <b>Sizning mahsulotingiz sotildi!</b>

👤 <b>Xaridor:</b> ${buyerName}
📞 <b>Telefon:</b> ${buyerPhone}
${extraMessage ? '💬 <b>Xabar:</b> ' + extraMessage + '\n' : ''}
📦 <b>Mahsulotlar:</b>
${itemsHtml}

💰 <b>Jami:</b> ${adminTotal.toLocaleString()} so'm
🕐 <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}
    `;
    sendTelegramMessage(adminChatId, msg);
  }

  // Group items by seller and notify each seller via the bot
  const sellerGroups = {};
  for (const item of verifiedItems) {
    if (!sellerGroups[item.sellerId]) sellerGroups[item.sellerId] = [];
    sellerGroups[item.sellerId].push(item);
  }

  for (const sellerId in sellerGroups) {
    const sid = parseInt(sellerId, 10);
    if (sid === req.userId) continue;
    const sellerChatId = getChatIdByUserId(sid);
    const sellerItems = sellerGroups[sellerId];
    const sellerMsgs = sellerItems.map((item, i) =>
      `${i + 1}. ${item.name} x ${item.quantity || 1} = ${((parseFloat(item.price) || 0) * (parseInt(item.quantity, 10) || 1)).toLocaleString()} so'm`
    ).join('\n');
    const sellerTotal = sellerItems.reduce((s, item) => s + (parseFloat(item.price) || 0) * (parseInt(item.quantity, 10) || 1), 0);
    const sellerAlert = `
🛒 <b>Mahsulotingizga buyurtma keldi!</b>

📦 <b>Mahsulot:</b>
${sellerMsgs}

💰 <b>Summa:</b> ${sellerTotal.toLocaleString()} so'm

👤 <b>Xaridor:</b> ${buyerName}
📞 <b>Telefon:</b> ${buyerPhone}
${extraMessage ? '💬 <b>Xabar:</b> ' + extraMessage + '\n' : ''}
🕐 <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}
    `;
    if (sellerChatId) {
      sendTelegramMessage(sellerChatId, sellerAlert);
    } else {
      console.log(`[Order] Seller ${sid} has no Telegram chatId, bot message skipped`);
    }

    const chatText = `🛒 ${sellerItems.map(it => `${it.name} x${it.quantity}`).join(', ')} — ${sellerTotal.toLocaleString()} so'm${extraMessage ? ' 💬 ' + extraMessage : ''}`;
    db.query('messages').insert({
      fromUserId: req.userId,
      toUserId: sid,
      text: chatText,
      image: null,
      productId: sellerItems[0].productId,
      read: false,
      createdAt: new Date().toISOString()
    });
  }

  // Remove purchased items from the buyer's cart
  const boughtIds = verifiedItems.map(i => i.productId);
  db.query('cartItems').deleteWhere(c => c.userId === req.userId && boughtIds.includes(c.productId));

  res.json({ success: true, orderId: order.id });
});

router.get('/my', authMiddleware, (req, res) => {
  const orders = db.query('orders').filter(o => o.userId === req.userId);
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ orders });
});

router.get('/sales', authMiddleware, (req, res) => {
  const myProductIds = db.query('products').filter(p => p.userId === req.userId).map(p => p.id);
  const orders = db.query('orders').all().filter(o => {
    return o.items && o.items.some(item => myProductIds.includes(item.productId));
  });
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ orders });
});

router.put('/:id/status', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const order = db.query('orders').find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
  const { status } = req.body;
  if (!['pending', 'confirmed', 'completed', 'cancelled', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Noto\'g\'ri status' });
  }
  const myProductIds = db.query('products').filter(p => p.userId === req.userId).map(p => p.id);
  const isOrderBuyer = order.userId === req.userId;
  const isInvolvedSeller = order.items && order.items.some(item => myProductIds.includes(item.productId));
  const isAdmin = req.userRole === 'admin';
  if (!isOrderBuyer && !isInvolvedSeller && !isAdmin) {
    return res.status(403).json({ error: 'Bu buyurtmani o\'zgartirish huquqi yo\'q' });
  }
  const updated = db.query('orders').update(id, { status });

  const statusLabels = {
    confirmed: 'Tasdiqlandi',
    completed: 'Bajarildi',
    cancelled: 'Bekor qilindi',
    rejected: 'Rad etildi',
    pending: 'Kutilmoqda'
  };
  const statusEmoji = {
    confirmed: '✅',
    completed: '🏁',
    cancelled: '❌',
    rejected: '🚫',
    pending: '⏳'
  };

  const buyerId = order.userId;
  const sellerIds = order.items ? [...new Set(order.items.map(i => i.sellerId).filter(Boolean))] : [];
  const buyer = buyerId ? db.query('users').find(u => u.id === buyerId) : null;
  const fromUser = db.query('users').find(u => u.id === req.userId);

  const itemsText = (order.items || []).map(i => `${i.name} x${i.quantity||1}`).join(', ');
  const statusText = statusLabels[status] || status;
  const emoji = statusEmoji[status] || '📋';
  const tgMsg = `${emoji} <b>Buyurtma #${id}</b> — ${statusText}\n📦 ${itemsText}`;

  if (isInvolvedSeller && !isAdmin) {
    const buyerChatId = buyer ? getChatIdByUserId(buyerId) : null;
    if (buyerChatId) sendTelegramMessage(buyerChatId, tgMsg);
  } else if (isOrderBuyer) {
    for (const sid of sellerIds) {
      if (sid !== req.userId) {
        const sellerChatId = getChatIdByUserId(sid);
        if (sellerChatId) sendTelegramMessage(sellerChatId, tgMsg);
      }
    }
  } else if (isAdmin) {
    if (buyerId) {
      const buyerChatId = buyer ? getChatIdByUserId(buyerId) : null;
      if (buyerChatId) sendTelegramMessage(buyerChatId, tgMsg);
    }
    for (const sid of sellerIds) {
      if (sid !== req.userId) {
        const sellerChatId = getChatIdByUserId(sid);
        if (sellerChatId) sendTelegramMessage(sellerChatId, tgMsg);
      }
    }
  }

  res.json({ order: updated });
});

module.exports = router;

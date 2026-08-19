const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.get('/conversations', authMiddleware, (req, res) => {
  const messages = db.query('messages').all();
  const users = db.query('users').all();

  const myMessages = messages.filter(m => m.fromUserId === req.userId || m.toUserId === req.userId);
  const lastByUser = new Map();
  const unreadByUser = new Map();

  for (const m of myMessages) {
    const otherId = m.fromUserId === req.userId ? m.toUserId : m.fromUserId;
    const ts = new Date(m.createdAt).getTime() || 0;
    const cur = lastByUser.get(otherId);
    if (!cur || ts > cur.ts) lastByUser.set(otherId, { msg: m, ts });
    if (m.fromUserId === otherId && !m.read) unreadByUser.set(otherId, (unreadByUser.get(otherId) || 0) + 1);
  }

  const conversations = [];
  for (const [otherId, { msg }] of lastByUser) {
    const otherUser = users.find(u => u.id === otherId);
    conversations.push({
      userId: otherId,
      name: otherUser ? otherUser.name : 'Unknown',
      avatar: otherUser ? otherUser.avatar : null,
      lastMessage: msg.text || (msg.image ? '📷 Rasm' : ''),
      lastTime: msg.createdAt,
      unread: unreadByUser.get(otherId) || 0
    });
  }

  conversations.sort((a, b) => {
    const ta = new Date(a.lastTime).getTime() || 0;
    const tb = new Date(b.lastTime).getTime() || 0;
    return tb - ta;
  });

  res.json({ conversations });
});

router.get('/conversations/unread/count', authMiddleware, (req, res) => {
  const messages = db.query('messages').all();
  const unread = messages.filter(m => m.toUserId === req.userId && !m.read).length;
  res.json({ count: unread });
});

router.get('/:userId', authMiddleware, (req, res) => {
  const otherId = parseInt(req.params.userId, 10);
  if (!otherId) return res.status(400).json({ error: 'Noto\'g\'ri foydalanuvchi ID' });
  const messages = db.query('messages').all()
    .filter(m =>
      (m.fromUserId === req.userId && m.toUserId === otherId) ||
      (m.fromUserId === otherId && m.toUserId === req.userId)
    )
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  db.query('messages').updateWhere(
    m => m.toUserId === req.userId && m.fromUserId === otherId && !m.read,
    { read: true }
  );

  res.json({ messages });
});

router.post('/send', authMiddleware, (req, res) => {
  const toUserId = parseInt(req.body.toUserId, 10);
  const text = (req.body.text || '').toString().trim();
  const { productId, image } = req.body;
  if (!toUserId || (!text && !image)) {
    return res.status(400).json({ error: 'Qabul qiluvchi va matn yoki rasm kerak' });
  }
  if (toUserId === req.userId) {
    return res.status(400).json({ error: 'O\'zingizga xabar yubora olmaysiz' });
  }
  const toUser = db.query('users').find(u => u.id === toUserId);
  if (!toUser) {
    return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  }

  const message = db.query('messages').insert({
    fromUserId: req.userId,
    toUserId,
    text,
    image: image || null,
    productId: productId ? parseInt(productId, 10) : null,
    read: false,
    createdAt: new Date().toISOString()
  });

  res.json({ message });
});

module.exports = router;

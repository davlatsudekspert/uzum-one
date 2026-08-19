const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { getByPhone } = require('../phonebot');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const smsCodes = {};
const verifiedPhones = {};

function normPhone(p) {
  if (!p) return p;
  let digits = String(p).replace(/[^\d+]/g, '');
  if (digits.startsWith('8') && digits.length === 12) digits = '+' + digits;
  else if (!digits.startsWith('+')) digits = '+' + digits;
  return digits;
}

router.post('/send-code', (req, res) => {
  const phone = normPhone(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'Telefon raqam kiriting' });
  const code = Math.floor(100000 + Math.random() * 900000);
  smsCodes[phone] = { code, expiresAt: Date.now() + 300000 };
  console.log(`[SMS] Kod for ${phone}: ${code}`);
  const token = process.env.BOT_TOKEN;
  const userData = getByPhone(phone);
  const userChatId = userData ? userData.chatId : null;
  if (token && token !== 'your_telegram_bot_token_here' && userChatId) {
    try {
      const TelegramBot = require('node-telegram-bot-api');
      const bot = new TelegramBot(token);
      bot.sendMessage(userChatId,
        `🔐 Tasdiqlash kodingiz: <b>${code}</b>\n\n5 daqiqa ichida amal qiladi.`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    } catch (e) {}
  }
  res.json({ success: true, message: userChatId ? 'Kod Telegram\'ga yuborildi' : 'Telefon botga ulanmagan. Avval botda /start bosib raqamingizni ulang.' });
});

router.post('/verify-code', (req, res) => {
  const phone = normPhone(req.body.phone);
  const { code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'Telefon va kod kerak' });
  const record = smsCodes[phone];
  if (!record) return res.status(400).json({ error: 'Kod yuborilmagan' });
  if (Date.now() > record.expiresAt) {
    delete smsCodes[phone];
    return res.status(400).json({ error: 'Kod muddati tugagan' });
  }
  if (parseInt(code) !== record.code) return res.status(400).json({ error: 'Noto\'g\'ri kod' });
  delete smsCodes[phone];
  verifiedPhones[phone] = true;
  res.json({ success: true, verified: true });
});

router.post('/reset-password', (req, res) => {
  const phone = normPhone(req.body.phone);
  const { newPassword } = req.body;
  if (!phone || !newPassword) {
    return res.status(400).json({ error: 'Telefon va yangi parol kerak' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'Parol kamida 4 belgidan iborat bo\'lishi kerak' });
  }
  if (!verifiedPhones[phone]) {
    return res.status(400).json({ error: 'Telefon raqam tasdiqlanmagan' });
  }
  const user = db.query('users').find(u => u.phone === phone);
  if (!user) {
    return res.status(404).json({ error: 'Bu raqam bilan foydalanuvchi topilmadi' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.query('users').update(user.id, { password: hash });
  delete verifiedPhones[phone];
  res.json({ success: true, message: 'Parol yangilandi' });
});

router.post('/register', (req, res) => {
  let { name, phone, password, role } = req.body;
  phone = normPhone(phone);
  if (!phone || !password || !role) {
    return res.status(400).json({ error: 'Telefon, parol va rol kerak' });
  }
  if (!['buyer', 'seller'].includes(role)) {
    return res.status(400).json({ error: 'Noto\'g\'ri rol' });
  }
  if (!verifiedPhones[phone]) {
    return res.status(400).json({ error: 'Telefon raqam tasdiqlanmagan' });
  }
  const botData = getByPhone(phone);
  if (!name && botData) {
    name = botData.name;
  }
  if (!name) {
    return res.status(400).json({ error: 'Ism familiya kerak. Bot orqali ro\'yxatdan o\'ting.' });
  }
  const existing = db.query('users').find(u => u.phone === phone);
  if (existing) {
    return res.status(409).json({ error: 'Bu raqam allaqachon ro\'yxatdan o\'tgan' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const user = db.query('users').insert({
    name, phone, password: hash, role, avatar: null, createdAt: new Date().toISOString()
  });
  delete verifiedPhones[phone];
  const token = jwt.sign({ id: user.id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, name, phone, role, avatar: null } });
});

// Google orqali kirish o'chirilgan
router.post('/google', (req, res) => {
  res.status(403).json({ error: 'Google orqali kirish vaqtincha o\'chirilgan' });
});

router.post('/login', (req, res) => {
  const { password } = req.body;
  const phone = normPhone(req.body.phone);
  if (!phone || !password) {
    return res.status(400).json({ error: 'Telefon va parolni kiriting' });
  }
  const user = db.query('users').find(u => u.phone === phone);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Telefon yoki parol noto\'g\'ri' });
  }
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({
    token,
    user: { id: user.id, name: user.name, phone: user.phone, role: user.role, avatar: user.avatar }
  });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.query('users').find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  res.json({ user: { id: user.id, name: user.name, phone: user.phone, role: user.role, avatar: user.avatar } });
});

router.post('/change-name', authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Ism kerak' });
  db.query('users').update(req.userId, { name });
  res.json({ success: true, name });
});

router.post('/change-password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Parollarni kiriting' });
  const user = db.query('users').find(u => u.id === req.userId);
  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(400).json({ error: 'Joriy parol noto\'g\'ri' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.query('users').update(req.userId, { password: hash });
  res.json({ success: true });
});

router.post('/change-avatar', authMiddleware, (req, res) => {
  const { avatar } = req.body;
  if (!avatar) {
    return res.status(400).json({ error: 'Rasm yuklang' });
  }
  const matches = avatar.match(/^data:image\/(png|jpg|jpeg|gif|webp);base64,(.+)$/);
  if (!matches) {
    return res.status(400).json({ error: 'Noto\'g\'ri rasm formati' });
  }
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const filename = `avatar_${req.userId}_${Date.now()}.${ext}`;
  const filepath = path.join(__dirname, '..', 'uploads', filename);
  fs.writeFileSync(filepath, buffer);
  const url = `/uploads/${filename}`;
  db.query('users').update(req.userId, { avatar: url });
  res.json({ success: true, avatar: url });
});

module.exports = router;

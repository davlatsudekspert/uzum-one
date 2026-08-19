const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'phone_links.json');
let links = {};
if (fs.existsSync(FILE)) {
  try { links = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {}
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(links, null, 2));
}

function normPhone(p) {
  if (!p) return p;
  let digits = String(p).replace(/[^\d+]/g, '');
  if (digits.startsWith('8') && digits.length === 12) digits = '+' + digits;
  else if (!digits.startsWith('+')) digits = '+' + digits;
  return digits;
}

function getByPhone(phone) {
  return links[normPhone(phone)] || null;
}

function setLink(phone, chatId, fullName) {
  const key = normPhone(phone);
  if (!key) return;
  links[key] = { chatId, name: fullName, createdAt: new Date().toISOString() };
  save();
}

const pendingNames = {};

function startBot() {
  const token = process.env.BOT_TOKEN;
  if (!token || token === 'your_telegram_bot_token_here') {
    console.log('[Bot] Token not configured, skipping');
    return;
  }
  try {
    const TelegramBot = require('node-telegram-bot-api');
    const bot = new TelegramBot(token, { polling: true });

    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      pendingNames[chatId] = true;
      bot.sendMessage(chatId,
        '👋 Assalomu alaykum! UzumOne botiga xush kelibsiz.\n\n' +
        'Ro\'yxatdan o\'tish uchun <b>Ism Familiya</b>ngizni yozing:',
        { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } });
    });

    bot.on('message', (msg) => {
      const chatId = msg.chat.id;
      if (msg.contact || msg.text?.startsWith('/')) return;

      if (pendingNames[chatId]) {
        const name = msg.text.trim();
        if (name.length < 2) {
          bot.sendMessage(chatId, 'Iltimos, to\'liq ism familiyangizni yozing (kamida 2 harf).');
          return;
        }
        delete pendingNames[chatId];
        const opts = {
          reply_markup: {
            keyboard: [[{ text: '📱 Telefon raqamni yuborish', request_contact: true }]],
            resize_keyboard: true, one_time_keyboard: true
          }
        };
        bot.sendMessage(chatId, `✅ ${name}\n\nEndi telefon raqamingizni yuboring:`, opts);
        bot._pendingContactName = bot._pendingContactName || {};
        bot._pendingContactName[chatId] = name;
      }
    });

    bot.on('contact', (msg) => {
      const chatId = msg.chat.id;
      const phone = msg.contact.phone_number;
      const cleanPhone = phone.startsWith('+') ? phone : '+' + phone;
      const name = (bot._pendingContactName || {})[chatId] || msg.contact.first_name || 'User';
      delete (bot._pendingContactName || {})[chatId];

      setLink(cleanPhone, chatId, name);
      bot.sendMessage(chatId,
        `✅ <b>${name}</b> — ro\'yxatdan muvaffaqiyatli o\'tdingiz!\n\n` +
        `Endi saytga qaytib, <b>telefon raqamingizni kiriting</b> va "Kod olish" tugmasini bosing.\n` +
        `Tasdiqlash kodi sizga shu bot orqali yuboriladi.`,
        { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } });
      console.log(`[Bot] Registered: ${name} | ${cleanPhone} | chatId ${chatId}`);
    });

    console.log('[Bot] Telegram bot started with polling');
  } catch (e) {
    console.log('[Bot] Failed to start:', e.message);
  }
}

module.exports = { startBot, getByPhone };

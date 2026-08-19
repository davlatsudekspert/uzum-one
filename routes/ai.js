const express = require('express');

const router = express.Router();

const BLOCKRUN_URL = 'https://blockrun.ai/api/v1/chat/completions';
const BLOCKRUN_MODEL = 'nvidia/mistral-nemotron';

function sysPrompt(lang) {
  const prompts = {
    uz: 'Sen "UzumOne" onlayn bozori uchun AI yordamchisan. Foydalanuvchilarga mahsulot topish, narxlar, buyurtma, sotish va sayt haqidagi savollarga javob ber. '
      + 'QATIY QOIDALAR: '
      + '(1) HAR DOIM faqat o\'zbek tilida javob ber, ingliz yoki boshqa tilga o\'tma; '
      + '(2) "UzumOne" brend nomini hech qachon tarjima qilma va o\'zgartirma; '
      + '(3) viloyat, shahar, tuman nomlarini (Andijon, Buxoro, Farg\'ona, Namangan, Samarqand, Toshkent, Xorazm va h.k.) tarjima qilma, foydalanuvchi ishlatgan shaklda qoldir; '
      + '(4) qisqa va foydali javob ber (2-4 jumla), savolga aniq javob qaytar.',
    ru: 'Ты ИИ-ассистент онлайн-маркетплейса "UzumOne". Отвечай на вопросы о товарах, ценах, заказах, продажах и сайте. '
      + 'СТРОГИЕ ПРАВИЛА: '
      + '(1) ВСЕГДА отвечай ТОЛЬКО на русском языке, никогда не переходи на английский; '
      + '(2) никогда не переводи и не изменяй название бренда "UzumOne"; '
      + '(3) не переводи названия областей, городов и районов (Андижан, Бухара, Фергана, Наманган, Самарканд, Ташкент, Хорезм и т.д.), оставляй их как есть; '
      + '(4) отвечай кратко и полезно (2-4 предложения), давай точный ответ на вопрос.',
    en: 'You are the AI assistant of the "UzumOne" online marketplace. Answer users\' questions about products, prices, orders, selling and the site. STRICT RULES: (1) always answer ONLY in English; (2) never translate or change the brand name "UzumOne"; (3) keep region and city names as the user wrote them; (4) reply briefly and helpfully (2-4 sentences).'
  };
  return prompts[lang] || prompts.uz;
}

router.post('/chat', async (req, res) => {
  const { message, lang, context } = req.body;
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'Xabar yozing' });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    let userContent = String(message).trim();
    const ctx = Array.isArray(context) ? context.filter(Boolean) : [];
    if (ctx.length) {
      userContent = 'Kontekst (joriy sahifadagi mahsulot haqida ma\'lumot):\n' + ctx.join('\n') + '\n\nFoydalanuvchi savoli: ' + userContent;
    }
    const resp = await fetch(BLOCKRUN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: BLOCKRUN_MODEL,
        messages: [
          { role: 'system', content: sysPrompt(lang) },
          { role: 'user', content: userContent }
        ],
        max_tokens: 512,
        temperature: 0.7
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error((data.error && data.error.message) || ('AI xatosi (' + resp.status + ')'));
    }
    const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!reply) throw new Error('AI javob bermadi');
    res.json({ reply: String(reply).trim() });
  } catch (e) {
    const msg = e.message === 'This operation was aborted' || e.name === 'AbortError'
      ? 'AI javob berishda vaqt oshdi, qayta urinib ko\'ring'
      : ('AI bilan bog\'lanishda xatolik: ' + e.message);
    res.status(500).json({ error: msg });
  }
});

module.exports = router;

const express = require('express');
const { translate } = require('@vitalets/google-translate-api');

const router = express.Router();

const BRAND_SET = new Set([
  'samsung','galaxy','apple','iphone','ipad','macbook','imac','airpods','air',
  'lg','nike','adidas','puma','reebok','new balance',
  'xiaomi','redmi','poco','huawei','honor','realme','oppo','vivo','oneplus','nothing',
  'sony','playstation','xbox','nintendo','steam',
  'dell','lenovo','hp','asus','acer','msi','razer',
  'canon','nikon','fujifilm','gopro','dji',
  'philips','bosch','electrolux','whirlpool','hisense','tcl',
  'google','microsoft','intel','amd','nvidia','qualcomm','snapdragon','mediatek',
  'dyson','irobot','roborock','dreame',
  'ikea','zara','gucci','prada','yeezy','ultraboost','superstar',
  'pro','ultra','max','plus','mini','lite','note','pad','air'
]);

const SPEC_RE = /^(\d+)\s*(gb|mb|tb|kg|g|ml|l|cm|mm|hz|w|wh|mah|rpm|dpi|fps)$/i;
const MODEL_RE = /^[A-Z][\w]*\d[\w]*$/i;

function isProtected(word) {
  const clean = word.replace(/[^a-zA-Z0-9\-]/g, '');
  if (!clean) return false;
  if (BRAND_SET.has(clean.toLowerCase())) return true;
  if (SPEC_RE.test(clean)) return true;
  if (MODEL_RE.test(clean) && /\d/.test(clean)) return true;
  if (/^[A-Z]{2,}$/.test(clean)) return true;
  return false;
}

function tokenize(text) {
  const tokens = [];
  const re = /([A-Za-z][\w'-]*|\d+[\w]*|[^\s])/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ value: m[1], protected: isProtected(m[1]) });
  }
  return tokens;
}

function hasMojibake(str) {
  if (!str) return false;
  let mojiCount = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if ((c >= 0xC0 && c <= 0xC3) || (c >= 0xC8 && c <= 0xCF) || (c >= 0xD0 && c <= 0xD3)) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0x80 && next <= 0xBF) { mojiCount++; i++; }
    }
  }
  return mojiCount >= 2;
}

async function translateChunk(text, to) {
  if (!text.trim()) return text;
  try {
    const r = await translate(text, { to });
    if (r && r.text && r.text.trim()) {
      const t = r.text.trim();
      if (!hasMojibake(t)) return t;
    }
  } catch (e) {}
  try {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=uz|' + to;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const raw = await res.text();
    const j = JSON.parse(raw);
    const t = j && j.responseData && j.responseData.translatedText;
    if (t && t.trim()) {
      let decoded = t.trim();
      if (/[\u00C0-\u00FF]/.test(decoded)) {
        try {
          const fixed = Buffer.from(decoded, 'latin1').toString('utf8');
          if (/[а-яА-ЯёЁ]/.test(fixed)) decoded = fixed;
        } catch (e) {}
      }
      return decoded;
    }
  } catch (e) {}
  return text;
}

async function translateTexts(texts, to) {
  const arr = Array.isArray(texts) ? texts : [texts];
  const unique = [...new Set(arr
    .filter(t => t && String(t).trim())
    .map(t => String(t).trim()))];
  const out = {};
  if (unique.length === 0) return out;

  const map = async (item) => {
    const tokens = tokenize(item);
    const hasProtected = tokens.some(t => t.protected);
    const hasTranslatable = tokens.some(t => !t.protected);

    if (!hasTranslatable) return [item, item];
    if (!hasProtected) {
      const translated = await translateChunk(item, to);
      return [item, translated];
    }

    const groups = [];
    let current = [];
    for (const tok of tokens) {
      if (!tok.protected) {
        current.push(tok.value);
      } else {
        if (current.length) {
          groups.push({ type: 'text', value: current.join(' ') });
          current = [];
        }
        groups.push({ type: 'brand', value: tok.value });
      }
    }
    if (current.length) groups.push({ type: 'text', value: current.join(' ') });

    const textGroups = groups.filter(g => g.type === 'text');
    const translations = await Promise.all(
      textGroups.map(g => translateChunk(g.value, to))
    );

    let ti = 0;
    const result = groups.map(g => {
      if (g.type === 'brand') return g.value;
      return translations[ti++];
    });

    return [item, result.join(' ')];
  };

  const poolSize = 6;
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < unique.length) {
      const cur = unique[idx++];
      results.push(await map(cur));
    }
  }
  await Promise.all(Array.from({ length: Math.min(poolSize, unique.length) }, worker));
  results.forEach(([k, v]) => { if (v) out[k] = v; });
  return out;
}

router.post('/', async (req, res) => {
  const { to, texts } = req.body;
  if (!to || texts === undefined) {
    return res.status(400).json({ error: 'to va texts kerak' });
  }
  try {
    const translations = await translateTexts(texts, to);
    res.json({ translations });
  } catch (e) {
    res.status(500).json({ error: 'Tarjima xatosi: ' + e.message });
  }
});

module.exports = router;
module.exports.translateTexts = translateTexts;

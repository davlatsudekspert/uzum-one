const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const head = html.split('<script>')[0]; // static HTML part only
const re = />([^<>{}]+)</g;
const seen = new Set();
let m;
const out = [];
while ((m = re.exec(head)) !== null) {
  const t = m[1].replace(/\s+/g, ' ').trim();
  if (!t) continue;
  if (/^[\s]*$/.test(t)) continue;
  if (!/\p{L}/u.test(t)) continue;
  if (/^[\s]*[0-9\s.,$%\-]+$/.test(t)) continue;
  if (t.includes('&#') || t.includes('--') || t.includes('/*') || t.includes('<')) continue;
  if (t.length > 60) continue;
  const key = t.replace(/^[\s]*\+\s*/, '');
  if (!seen.has(key)) { seen.add(key); out.push(key); }
}
console.log(out.join('\n'));

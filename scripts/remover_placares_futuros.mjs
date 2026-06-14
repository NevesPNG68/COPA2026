import fs from 'node:fs';

const mapaTimes = {
  'mexico': 'mexico', 'africa do sul': 'south africa', 'south africa': 'south africa',
  'coreia do sul': 'south korea', 'south korea': 'south korea',
  'tchequia': 'czech republic', 'czechia': 'czech republic', 'czech republic': 'czech republic',
  'canada': 'canada', 'bosnia e herzegovina': 'bosnia and herzegovina', 'bosnia herzegovina': 'bosnia herzegovina', 'bosnia and herzegovina': 'bosnia and herzegovina',
  'estados unidos': 'united states', 'united states': 'united states', 'usa': 'united states', 'paraguai': 'paraguay', 'paraguay': 'paraguay',
  'catar': 'qatar', 'qatar': 'qatar', 'suica': 'switzerland', 'switzerland': 'switzerland', 'brasil': 'brazil', 'brazil': 'brazil',
  'marrocos': 'morocco', 'morocco': 'morocco', 'haiti': 'haiti', 'escocia': 'scotland', 'scotland': 'scotland',
  'australia': 'australia', 'turquia': 'turkey', 'turkey': 'turkey', 'turkiye': 'turkiye', 'alemanha': 'germany', 'germany': 'germany',
  'curacao': 'curacao', 'curaçao': 'curacao', 'holanda': 'netherlands', 'netherlands': 'netherlands', 'japao': 'japan', 'japan': 'japan',
  'costa do marfim': 'cote d ivoire', 'cote d ivoire': 'cote d ivoire', 'equador': 'ecuador', 'ecuador': 'ecuador',
  'suecia': 'sweden', 'sweden': 'sweden', 'tunisia': 'tunisia', 'tunisia': 'tunisia', 'espanha': 'spain', 'spain': 'spain',
  'cabo verde': 'cape verde', 'cape verde': 'cape verde', 'belgica': 'belgium', 'belgium': 'belgium', 'egito': 'egypt', 'egypt': 'egypt',
  'arabia saudita': 'saudi arabia', 'saudi arabia': 'saudi arabia', 'uruguai': 'uruguay', 'uruguay': 'uruguay',
  'ira': 'iran', 'iran': 'iran', 'nova zelandia': 'new zealand', 'new zealand': 'new zealand',
  'franca': 'france', 'france': 'france', 'senegal': 'senegal', 'iraque': 'iraq', 'iraq': 'iraq', 'noruega': 'norway', 'norway': 'norway',
  'argentina': 'argentina', 'argelia': 'algeria', 'algeria': 'algeria', 'austria': 'austria', 'jordania': 'jordan', 'jordan': 'jordan',
  'portugal': 'portugal', 'rd congo': 'dr congo', 'dr congo': 'dr congo', 'inglaterra': 'england', 'england': 'england',
  'croacia': 'croatia', 'croatia': 'croatia', 'gana': 'ghana', 'ghana': 'ghana', 'panama': 'panama', 'panamá': 'panama',
  'uzbequistao': 'uzbekistan', 'uzbekistan': 'uzbekistan', 'colombia': 'colombia'
};

function normalizarTexto(txt) {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[\u{1F3F4}]/gu, '')
    .replace(/[\u{E0000}-\u{E007F}]/gu, '')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function normalizarTime(nome) { const n = normalizarTexto(nome); return mapaTimes[n] || n; }
function chave(data, a, b) { return `${data}|${normalizarTime(a)}|${normalizarTime(b)}`; }
function num(iso) { const p = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); return p ? Number(`${p[1]}${p[2]}${p[3]}${p[4]}${p[5]}`) : 0; }
function agoraBrasiliaNumero() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
  if (m.hour === '24') m.hour = '00';
  return Number(`${m.year}${m.month}${m.day}${m.hour}${m.minute}`);
}
function stripTags(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

const html = fs.readFileSync('index.html', 'utf8');
const dados = JSON.parse(fs.readFileSync('placares.json', 'utf8'));
const agora = agoraBrasiliaNumero();
let removidos = 0;
const rowRe = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
let m;
while ((m = rowRe.exec(html))) {
  const attrs = m[1] || '';
  const body = m[2] || '';
  const start = (attrs.match(/data-start="([^"]+)"/) || [])[1];
  const end = (attrs.match(/data-end="([^"]+)"/) || [])[1];
  if (!start || !end || num(end) <= agora) continue;
  const td = (body.match(/<td\b[^>]*class="[^"]*match[^"]*"[^>]*>([\s\S]*?)<\/td>/i) || [])[1];
  if (!td) continue;
  const texto = stripTags(td);
  const partes = texto.split(/\s+x\s+/i);
  if (partes.length < 2) continue;
  const casa = partes[0].trim();
  const fora = partes.slice(1).join(' x ').trim();
  const data = start.slice(0, 10);
  for (const k of [chave(data, casa, fora), chave(data, fora, casa)]) {
    if (dados.scores && Object.prototype.hasOwnProperty.call(dados.scores, k)) {
      delete dados.scores[k];
      removidos++;
    }
  }
}
fs.writeFileSync('placares.json', JSON.stringify(dados, null, 2) + '\n');
console.log(`Placares futuros removidos: ${removidos}`);

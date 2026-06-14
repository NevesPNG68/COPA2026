import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const HTML_FILE = path.join(ROOT, 'index.html');
const OUT_FILE = path.join(ROOT, 'placares.json');
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=';

const FALLBACK_SCORES = {
  '2026-06-13|qatar|switzerland': '1 x 1',
  '2026-06-13|switzerland|qatar': '1 x 1',
  '2026-06-13|brazil|morocco': '1 x 1',
  '2026-06-13|morocco|brazil': '1 x 1',
  '2026-06-13|haiti|scotland': '0 x 1',
  '2026-06-13|scotland|haiti': '1 x 0',
  '2026-06-14|australia|turkey': '2 x 0',
  '2026-06-14|turkey|australia': '0 x 2'
};

const mapaTimes = {
  'mexico': 'mexico', 'africa do sul': 'south africa', 'south africa': 'south africa',
  'coreia do sul': 'south korea', 'south korea': 'south korea',
  'tchequia': 'czech republic', 'czechia': 'czech republic', 'czech republic': 'czech republic',
  'canada': 'canada', 'bosnia e herzegovina': 'bosnia and herzegovina', 'bosnia and herzegovina': 'bosnia and herzegovina',
  'estados unidos': 'united states', 'united states': 'united states', 'usa': 'united states',
  'paraguai': 'paraguay', 'paraguay': 'paraguay',
  'catar': 'qatar', 'qatar': 'qatar',
  'suica': 'switzerland', 'switzerland': 'switzerland',
  'brasil': 'brazil', 'brazil': 'brazil',
  'marrocos': 'morocco', 'morocco': 'morocco',
  'haiti': 'haiti',
  'escocia': 'scotland', 'scotland': 'scotland',
  'australia': 'australia', 'turquia': 'turkey', 'turkey': 'turkey',
  'alemanha': 'germany', 'germany': 'germany',
  'curacao': 'curacao', 'curaçao': 'curacao',
  'holanda': 'netherlands', 'netherlands': 'netherlands',
  'japao': 'japan', 'japan': 'japan',
  'costa do marfim': 'cote d ivoire', "cote d'ivoire": 'cote d ivoire', 'cote divoire': 'cote d ivoire', 'ivory coast': 'cote d ivoire',
  'equador': 'ecuador', 'ecuador': 'ecuador',
  'suecia': 'sweden', 'sweden': 'sweden',
  'tunisia': 'tunisia', 'tunisia': 'tunisia',
  'espanha': 'spain', 'spain': 'spain',
  'cabo verde': 'cape verde', 'cape verde': 'cape verde',
  'belgica': 'belgium', 'belgium': 'belgium',
  'egito': 'egypt', 'egypt': 'egypt',
  'arabia saudita': 'saudi arabia', 'saudi arabia': 'saudi arabia',
  'uruguai': 'uruguay', 'uruguay': 'uruguay',
  'ira': 'iran', 'iran': 'iran',
  'nova zelandia': 'new zealand', 'new zealand': 'new zealand',
  'franca': 'france', 'france': 'france',
  'senegal': 'senegal',
  'iraque': 'iraq', 'iraq': 'iraq',
  'noruega': 'norway', 'norway': 'norway',
  'argentina': 'argentina',
  'argelia': 'algeria', 'algeria': 'algeria',
  'austria': 'austria',
  'jordania': 'jordan', 'jordan': 'jordan',
  'portugal': 'portugal',
  'rd congo': 'dr congo', 'dr congo': 'dr congo', 'congo dr': 'dr congo',
  'inglaterra': 'england', 'england': 'england',
  'croacia': 'croatia', 'croatia': 'croatia',
  'gana': 'ghana', 'ghana': 'ghana',
  'panama': 'panama', 'panamá': 'panama',
  'uzbequistao': 'uzbekistan', 'uzbekistan': 'uzbekistan',
  'colombia': 'colombia'
};

function normalizarTexto(txt) {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[\u{1F3F4}]/gu, '')
    .replace(/[\u{E0000}-\u{E007F}]/gu, '')
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, ' and ')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizarTime(nome) {
  const n = normalizarTexto(nome);
  return mapaTimes[n] || n;
}

function chaveJogo(data, time1, time2) {
  return `${data}|${normalizarTime(time1)}|${normalizarTime(time2)}`;
}

function chavePar(time1, time2) {
  return [normalizarTime(time1), normalizarTime(time2)].sort().join('|');
}

function agoraBrasiliaParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
  if (m.hour === '24') m.hour = '00';
  return m;
}

function numeroDataHora(isoLocal) {
  const p = String(isoLocal || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!p) return 0;
  return Number(`${p[1]}${p[2]}${p[3]}${p[4]}${p[5]}`);
}

function hojeBrasiliaNumero() {
  const m = agoraBrasiliaParts();
  return Number(`${m.year}${m.month}${m.day}${m.hour}${m.minute}`);
}

function addDaysYYYYMMDD(dateStr, delta) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairJogos(html) {
  const jogos = [];
  const rowRe = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = rowRe.exec(html))) {
    const attrs = m[1] || '';
    const body = m[2] || '';
    const start = (attrs.match(/data-start="([^"]+)"/) || [])[1];
    const end = (attrs.match(/data-end="([^"]+)"/) || [])[1];
    if (!start || !end) continue;

    const matchTd = (body.match(/<td\b[^>]*class="[^"]*match[^"]*"[^>]*>([\s\S]*?)<\/td>/i) || [])[1];
    if (!matchTd) continue;

    const texto = stripTags(matchTd);
    const partes = texto.split(/\s+x\s+/i);
    if (partes.length < 2) continue;

    const casa = partes[0].trim();
    const fora = partes.slice(1).join(' x ').trim();
    jogos.push({
      data: start.slice(0, 10),
      dataEspn: start.slice(0, 10).replace(/-/g, ''),
      start,
      end,
      casa,
      fora,
      par: chavePar(casa, fora)
    });
  }
  return jogos;
}

async function lerJsonAtual() {
  try {
    const raw = await fs.readFile(OUT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { scores: {} };
  } catch {
    return { scores: {} };
  }
}

async function buscarDataEspn(dataEspn) {
  const url = `${ESPN_SCOREBOARD}${dataEspn}`;
  const resp = await fetch(url, { headers: { accept: 'application/json' } });
  if (!resp.ok) throw new Error(`ESPN retornou ${resp.status} para ${dataEspn}`);
  return resp.json();
}

function inserirEventoNoMapa(evento, scores, jogosPorPar) {
  const competicao = evento?.competitions?.[0];
  const competidores = competicao?.competitors;
  if (!competidores || competidores.length < 2) return;

  const c1 = competidores[0];
  const c2 = competidores[1];
  const t1 = c1?.team?.displayName || c1?.team?.shortDisplayName || c1?.team?.name || c1?.team?.location || '';
  const t2 = c2?.team?.displayName || c2?.team?.shortDisplayName || c2?.team?.name || c2?.team?.location || '';
  const s1 = c1?.score;
  const s2 = c2?.score;
  if (!t1 || !t2 || s1 === undefined || s2 === undefined || s1 === null || s2 === null) return;

  const dataEvento = String(evento?.date || '').slice(0, 10);
  if (dataEvento) {
    scores[chaveJogo(dataEvento, t1, t2)] = `${s1} x ${s2}`;
    scores[chaveJogo(dataEvento, t2, t1)] = `${s2} x ${s1}`;
  }

  const jogo = jogosPorPar.get(chavePar(t1, t2));
  if (!jogo) return;

  const nCasa = normalizarTime(jogo.casa);
  const nFora = normalizarTime(jogo.fora);
  const n1 = normalizarTime(t1);
  const n2 = normalizarTime(t2);

  let placarCasaFora = `${s1} x ${s2}`;
  let placarForaCasa = `${s2} x ${s1}`;
  if (nCasa === n2 && nFora === n1) {
    placarCasaFora = `${s2} x ${s1}`;
    placarForaCasa = `${s1} x ${s2}`;
  }

  scores[chaveJogo(jogo.data, jogo.casa, jogo.fora)] = placarCasaFora;
  scores[chaveJogo(jogo.data, jogo.fora, jogo.casa)] = placarForaCasa;
}

function ordenarObjeto(obj) {
  return Object.fromEntries(Object.entries(obj || {}).sort(([a], [b]) => a.localeCompare(b)));
}

async function atualizarPlacares(html) {
  const jogos = extrairJogos(html);
  const agora = hojeBrasiliaNumero();
  const jogosEncerradosOuIniciados = jogos.filter(j => numeroDataHora(j.start) <= agora);
  const jogosPorPar = new Map(jogos.map(j => [j.par, j]));

  const datas = new Set();
  for (const jogo of jogosEncerradosOuIniciados) {
    datas.add(jogo.dataEspn);
    datas.add(addDaysYYYYMMDD(jogo.data, -1));
    datas.add(addDaysYYYYMMDD(jogo.data, 1));
  }

  const atual = await lerJsonAtual();
  const scores = { ...FALLBACK_SCORES, ...(atual.scores || {}) };
  const erros = [];

  for (const data of [...datas].sort()) {
    try {
      const dados = await buscarDataEspn(data);
      for (const evento of (dados.events || [])) inserirEventoNoMapa(evento, scores, jogosPorPar);
    } catch (err) {
      erros.push(`${data}: ${err.message}`);
    }
  }

  const proximoCore = {
    source: 'GitHub Actions + ESPN scoreboard',
    scores: ordenarObjeto(scores),
    errors: erros.sort()
  };

  const atualCore = {
    source: atual.source || 'GitHub Actions + ESPN scoreboard',
    scores: ordenarObjeto(atual.scores || {}),
    errors: [...(atual.errors || [])].sort()
  };

  const mudou = JSON.stringify(proximoCore) !== JSON.stringify(atualCore);
  const saida = mudou
    ? { updatedAt: new Date().toISOString(), ...proximoCore }
    : { updatedAt: atual.updatedAt || new Date().toISOString(), ...proximoCore };

  const atualRaw = JSON.stringify(atual, null, 2) + '\n';
  const novoRaw = JSON.stringify(saida, null, 2) + '\n';
  if (atualRaw !== novoRaw) await fs.writeFile(OUT_FILE, novoRaw, 'utf8');

  console.log(`placares.json verificado. Datas consultadas: ${[...datas].sort().join(', ') || 'nenhuma'}. Placar(es): ${Object.keys(scores).length}. Mudou: ${mudou ? 'sim' : 'não'}.`);
  if (erros.length) console.warn('Avisos:', erros.join(' | '));
}

function limparHtml(html) {
  let out = String(html || '')
    .replace(/[\u{E0000}-\u{E007F}]/gu, '')
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '');

  const primeiraTagFinal = out.indexOf('</html>');
  if (primeiraTagFinal !== -1) {
    out = out.slice(0, primeiraTagFinal + '</html>'.length);
  }
  return out;
}

function aplicarPatchIndex(html) {
  let out = limparHtml(html);

  if (!out.includes('var placaresJson = Object.create(null);')) {
    out = out.replace(
      /var placaresInternet = Object\.create\(null\);\s*/,
      match => `${match}  var placaresJson = Object.create(null);\n`
    );
  }

  if (!out.includes('placaresJson[chave1]')) {
    out = out.replace(
      /return\s+placaresInternet\[chave1\]\s*\|\|\s*placaresInternet\[chave2\]\s*\|\|\s*placaresConfirmados\[chave1\]\s*\|\|\s*placaresConfirmados\[chave2\]\s*\|\|\s*tr\.getAttribute\('data-result'\)\s*\|\|\s*'';/,
      "return placaresJson[chave1] || placaresJson[chave2] ||\n           placaresInternet[chave1] || placaresInternet[chave2] ||\n           placaresConfirmados[chave1] || placaresConfirmados[chave2] ||\n           tr.getAttribute('data-result') || '';"
    );
  }

  if (!out.includes('async function buscarPlacaresDoJson')) {
    const funcaoJson = `\n  async function buscarPlacaresDoJson(forcar) {\n    try {\n      var resp = await fetch('placares.json?_=' + Date.now(), { cache: 'no-store' });\n      if (!resp.ok) return;\n      var dados = await resp.json();\n      if (dados && dados.scores) {\n        placaresJson = Object.assign(Object.create(null), dados.scores);\n        atualizarStatusAutomatico();\n        atualizarJogosExibidos();\n      }\n    } catch (e) {\n      console.warn('Não foi possível ler placares.json:', e);\n    }\n  }\n\n`;
    out = out.replace(/\n\s*async function buscarPlacaresNaInternet\(forcar\) \{/, `${funcaoJson}  async function buscarPlacaresNaInternet(forcar) {`);
  }

  if (!out.includes('VERSAO_GITHUB_ACTIONS_PLACARES_JSON')) {
    out = out.replaceAll('buscarPlacaresNaInternet(true);', "buscarPlacaresDoJson(true).then(function () { buscarPlacaresNaInternet(true); });");
    out = out.replaceAll('buscarPlacaresNaInternet(false);', "buscarPlacaresDoJson(false).then(function () { buscarPlacaresNaInternet(false); });");
    out = out.replace('</body>', '\n<!-- VERSAO_GITHUB_ACTIONS_PLACARES_JSON -->\n</body>');
  }

  return out.endsWith('\n') ? out : `${out}\n`;
}

async function main() {
  const htmlOriginal = await fs.readFile(HTML_FILE, 'utf8');
  const htmlPatched = aplicarPatchIndex(htmlOriginal);
  if (htmlPatched !== htmlOriginal) {
    await fs.writeFile(HTML_FILE, htmlPatched, 'utf8');
    console.log('index.html corrigido para ler placares.json e limpar caracteres ocultos.');
  } else {
    console.log('index.html já estava corrigido.');
  }

  await atualizarPlacares(htmlPatched);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

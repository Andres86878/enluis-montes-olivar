/* =========================================================
   API del panel de agenda — Enluis Montes Olivar
   GET  /api/concerts   -> lee data/concerts.json desde GitHub
   PUT  /api/concerts   -> guarda la agenda (commit en GitHub)
   Variables de entorno en Vercel:
     ADMIN_PASSWORD  contraseña del panel
     GITHUB_TOKEN    token con permiso "Contents: Read and write" al repo
     GITHUB_REPO     usuario/repositorio   (ej. kromatik/enluis-web)
     GITHUB_BRANCH   rama (por defecto: main)
     GITHUB_FILE     ruta del archivo (por defecto: data/concerts.json)
   ========================================================= */
const crypto = require('crypto');
const B = require('../admin/agenda-builder.js');

const API = process.env.GITHUB_API || 'https://api.github.com';
const cfg = () => ({
  repo: process.env.GITHUB_REPO,
  branch: process.env.GITHUB_BRANCH || 'main',
  file: process.env.GITHUB_FILE || 'data/concerts.json',
  token: process.env.GITHUB_TOKEN,
  pass: process.env.ADMIN_PASSWORD
});

function same(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
const wait = ms => new Promise(r => setTimeout(r, ms));
function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = []; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
async function gh(path, opts = {}) {
  const c = cfg();
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${c.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'enluis-agenda-admin',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) {}
  return { status: r.status, json };
}

// Limpieza: solo texto/HTML simple, sin scripts ni eventos
const ALLOWED = /^(br|strong|em|b|i)$/i;
function clean(s, max) {
  s = String(s == null ? '' : s).slice(0, max || 4000);
  return s.replace(/<\/?([a-z0-9]+)[^>]*>/gi, (m, tag) => ALLOWED.test(tag) ? m.replace(/\s+[^>]*?(\/?)>$/, '$1>') : '');
}
function sanitize(list) {
  if (!Array.isArray(list)) throw new Error('Formato inválido.');
  if (list.length > 500) throw new Error('Demasiados conciertos.');
  return list.map((c, i) => {
    let item;
    if (c && c._f && typeof c._f === 'object') {
      const errs = B.validar(c._f);
      if (errs.length) throw new Error(`Concierto ${i + 1}: ${errs.join(' ')}`);
      item = B.construir(JSON.parse(JSON.stringify(c._f)));   // se reconstruye en el servidor
    } else {
      item = {};
      ['title_en','title_es','dateDisplay_en','dateDisplay_es','role_en','role_es','soloists_en','soloists_es','program_en','program_es'].forEach(k => item[k] = clean(c && c[k]));
      item.dateStr = String(c && c.dateStr || '');
      item.ticketLink = /^https?:\/\/\S+$/i.test(String(c && c.ticketLink || '')) ? String(c.ticketLink) : '#';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.dateStr)) throw new Error(`Concierto ${i + 1}: fecha inválida.`);
    ['title_en','title_es','dateDisplay_en','dateDisplay_es','role_en','role_es','soloists_en','soloists_es','program_en','program_es'].forEach(k => item[k] = clean(item[k]));
    if (item._f) item._f = JSON.parse(JSON.stringify(item._f, (k, v) => typeof v === 'string' ? v.slice(0, 4000) : v));
    return item;
  }).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

module.exports = async function handler(req, res) {
  const c = cfg();
  if (!c.pass || !c.token || !c.repo) {
    return send(res, 500, { error: 'El panel aún no está conectado: faltan las variables ADMIN_PASSWORD, GITHUB_TOKEN o GITHUB_REPO en Vercel.' });
  }
  const pw = req.headers['x-admin-password'] || '';
  if (!pw || !same(pw, c.pass)) { await wait(700); return send(res, 401, { error: 'Contraseña incorrecta.' }); }

  const path = `/repos/${c.repo}/contents/${c.file.split('/').map(encodeURIComponent).join('/')}`;
  try {
    if (req.method === 'GET') {
      const r = await gh(`${path}?ref=${encodeURIComponent(c.branch)}`);
      if (r.status === 404) return send(res, 200, { data: [], sha: null });
      if (r.status !== 200) return send(res, 502, { error: `GitHub respondió ${r.status}. Revisa el token y el nombre del repositorio.` });
      const data = JSON.parse(Buffer.from(r.json.content, 'base64').toString('utf8'));
      return send(res, 200, { data, sha: r.json.sha });
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      const data = sanitize(body.data);
      const content = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64');
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const r = await gh(path, {
        method: 'PUT',
        body: JSON.stringify({
          message: `Agenda actualizada desde el panel (${String(body.note || '').slice(0, 80) || 'cambios'}) · ${now} UTC`,
          content, branch: c.branch, ...(body.sha ? { sha: body.sha } : {})
        })
      });
      if (r.status === 409 || r.status === 422) return send(res, 409, { error: 'La agenda cambió mientras editabas. Recarga y vuelve a intentar.' });
      if (r.status !== 200 && r.status !== 201) return send(res, 502, { error: `No se pudo guardar en GitHub (código ${r.status}).` });
      return send(res, 200, { ok: true, sha: r.json.content.sha, data });
    }
    res.setHeader('Allow', 'GET, PUT');
    return send(res, 405, { error: 'Método no permitido.' });
  } catch (e) {
    return send(res, 400, { error: e.message || 'Error inesperado.' });
  }
};

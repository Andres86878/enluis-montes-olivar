/* =========================================================
   API del panel — Enluis Montes Olivar
   GET  /api/concerts?f=<seccion>   lee data/<seccion>.json desde GitHub
   PUT  /api/concerts?f=<seccion>   guarda la sección (commit en GitHub)
   POST /api/concerts?upload=1      sube una foto a img/panel/
   Secciones: agenda | videos | audios | prensa | textos | contacto | fotos
   Variables de entorno en Vercel:
     ADMIN_PASSWORD, GITHUB_TOKEN, GITHUB_REPO (usuario/repo), GITHUB_BRANCH (main)
   ========================================================= */
const crypto = require('crypto');
const B = require('../admin/agenda-builder.js');

const API = process.env.GITHUB_API || 'https://api.github.com';
const FILES = {
  agenda: 'data/concerts.json', videos: 'data/videos.json', audios: 'data/audios.json',
  prensa: 'data/prensa.json', textos: 'data/textos.json', contacto: 'data/contacto.json', fotos: 'data/fotos.json'
};
const cfg = () => ({
  repo: process.env.GITHUB_REPO, branch: process.env.GITHUB_BRANCH || 'main',
  token: process.env.GITHUB_TOKEN, pass: process.env.ADMIN_PASSWORD
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
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = []; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
async function gh(path, opts = {}) {
  const c = cfg();
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${c.token}`, 'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'enluis-panel',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) {}
  return { status: r.status, json };
}
const contentsPath = file => `/repos/${cfg().repo}/contents/${file.split('/').map(encodeURIComponent).join('/')}`;

/* ---------- limpieza ---------- */
const s = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max || 600);
const ALLOWED = /^(br|strong|em|b|i|span)$/i;
function cleanHtml(v, max) {
  v = String(v == null ? '' : v).slice(0, max || 6000);
  return v.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (m, tag, attrs) => {
    if (!ALLOWED.test(tag)) return '';
    const close = m.startsWith('</');
    if (tag.toLowerCase() === 'span' && !close) return /class\s*=\s*["']qa-sub["']/.test(attrs) ? "<span class='qa-sub'>" : '<span>';
    return close ? `</${tag.toLowerCase()}>` : (tag.toLowerCase() === 'br' ? '<br>' : `<${tag.toLowerCase()}>`);
  });
}
const isHttp = u => /^https:\/\/[^\s"'<>]+$/i.test(u);
const isLocal = u => /^\/?(img|data)?\/?[^"'<>:]*\.(jpg|jpeg|png|webp|mp3|m4a)$/i.test(u) && !u.includes('..');
const ytId = u => { const m = String(u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : null; };
function need(cond, msg) { if (!cond) throw new Error(msg); }
function arr(list, max) { need(Array.isArray(list), 'Formato inválido.'); need(list.length <= max, `Máximo ${max} elementos.`); return list; }

const SAN = {
  agenda(list) {
    return arr(list, 500).map((c, i) => {
      let item;
      if (c && c._f && typeof c._f === 'object') {
        const errs = B.validar(c._f);
        need(!errs.length, `Concierto ${i + 1}: ${errs.join(' ')}`);
        item = B.construir(JSON.parse(JSON.stringify(c._f, (k, v) => typeof v === 'string' ? v.slice(0, 4000) : v)));
      } else {
        item = {};
        ['title_en','title_es','dateDisplay_en','dateDisplay_es','role_en','role_es','soloists_en','soloists_es','program_en','program_es'].forEach(k => item[k] = cleanHtml(c && c[k]));
        item.dateStr = String(c && c.dateStr || '');
        item.ticketLink = isHttp(String(c && c.ticketLink || '')) ? String(c.ticketLink) : '#';
      }
      need(/^\d{4}-\d{2}-\d{2}$/.test(item.dateStr), `Concierto ${i + 1}: fecha inválida.`);
      ['title_en','title_es','dateDisplay_en','dateDisplay_es','role_en','role_es','soloists_en','soloists_es','program_en','program_es'].forEach(k => item[k] = cleanHtml(item[k]));
      return item;
    }).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  },
  videos(list) {
    return arr(list, 60).map((v, i) => {
      const id = ytId(v && v.url); need(id, `Video ${i + 1}: el link de YouTube no es válido.`);
      need(s(v.titulo), `Video ${i + 1}: falta el título.`);
      return { url: `https://youtu.be/${id}`, titulo: s(v.titulo, 200), compositor: s(v.compositor, 200), interpretes: s(v.interpretes, 600), anio: s(v.anio, 20) };
    });
  },
  audios(list) {
    return arr(list, 40).map((a, i) => {
      const tipo = a && a.tipo === 'spotify' ? 'spotify' : 'archivo';
      const url = s(a && a.url, 500);
      need(s(a && a.titulo), `Audio ${i + 1}: falta el título.`);
      if (tipo === 'spotify') need(/^https:\/\/open\.spotify\.com\/(embed\/)?(track|album|playlist|episode|show)\/[A-Za-z0-9]+/.test(url), `Audio ${i + 1}: el link de Spotify no es válido.`);
      else need(isHttp(url) || isLocal(url), `Audio ${i + 1}: el archivo de audio no es válido.`);
      return { tipo, titulo: s(a.titulo, 200), compositor: s(a.compositor, 200), interpretes: s(a.interpretes, 600), anio: s(a.anio, 20), url };
    });
  },
  prensa(list) {
    arr(list, 10); need(list.length >= 1, 'Debe haber al menos un artículo.');
    return list.map((p, i) => {
      need(s(p && p.medio), `Artículo ${i + 1}: falta el nombre del medio.`);
      need(s(p.titular_es) || s(p.titular_en), `Artículo ${i + 1}: falta el titular.`);
      const link = s(p.link, 800); need(!link || isHttp(link), `Artículo ${i + 1}: el link debe empezar por https://`);
      const foto = s(p.foto, 500); need(foto && (isHttp(foto) || isLocal(foto)), `Artículo ${i + 1}: falta la foto.`);
      const o = { medio: s(p.medio, 120), link: link || '#', foto };
      ['fecha_en','fecha_es','titular_en','titular_es','resumen_en','resumen_es'].forEach(k => o[k] = s(p[k], k.startsWith('resumen') ? 900 : 300));
      return o;
    });
  },
  textos(obj) {
    need(obj && typeof obj === 'object' && !Array.isArray(obj), 'Formato inválido.');
    const keys = Object.keys(obj); need(keys.length <= 400, 'Demasiados textos.');
    const out = {};
    keys.forEach(k => {
      need(/^[a-z0-9_]{1,60}$/i.test(k), 'Clave de texto inválida.');
      const v = obj[k] || {};
      out[k] = { en: cleanHtml(v.en, 8000), es: cleanHtml(v.es, 8000) };
    });
    return out;
  },
  contacto(list) {
    return arr(list, 12).map((c, i) => {
      need(s(c && c.nombre), `Contacto ${i + 1}: falta el nombre.`);
      const email = s(c.email, 200);
      need(!email || /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(email), `Contacto ${i + 1}: el correo no es válido.`);
      return { nombre: s(c.nombre, 120), rol_en: s(c.rol_en, 120), rol_es: s(c.rol_es, 120), email };
    });
  },
  fotos(obj) {
    need(obj && typeof obj === 'object' && !Array.isArray(obj), 'Formato inválido.');
    const out = {};
    ['inicio_computadora','inicio_celular','biografia','prensa','agenda','multimedia','contacto'].forEach(k => {
      const v = s(obj[k], 500); if (!v) return;
      need(isHttp(v) || isLocal(v), `La foto de "${k}" no es válida.`); out[k] = v;
    });
    return out;
  }
};

module.exports = async function handler(req, res) {
  const c = cfg();
  if (!c.pass || !c.token || !c.repo) {
    return send(res, 500, { error: 'El panel aún no está conectado: faltan las variables ADMIN_PASSWORD, GITHUB_TOKEN o GITHUB_REPO en Vercel.' });
  }
  const pw = req.headers['x-admin-password'] || '';
  if (!pw || !same(pw, c.pass)) { await wait(700); return send(res, 401, { error: 'Contraseña incorrecta.' }); }

  const url = new URL(req.url, 'http://x');
  const f = url.searchParams.get('f') || 'agenda';
  try {
    /* ---- subir foto ---- */
    if (req.method === 'POST' && url.searchParams.get('upload')) {
      const body = await readBody(req);
      const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ''));
      need(m, 'La imagen no es válida.');
      const buf = Buffer.from(m[2], 'base64');
      need(buf.length <= 3.2 * 1024 * 1024, 'La imagen es muy pesada (máx. 3 MB).');
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      const slug = s(body.name, 60).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'foto';
      const file = `img/panel/${slug}-${Date.now().toString(36)}.${ext}`;
      const r = await gh(contentsPath(file), { method: 'PUT', body: JSON.stringify({ message: `Foto subida desde el panel (${slug})`, content: buf.toString('base64'), branch: c.branch }) });
      if (r.status !== 201 && r.status !== 200) return send(res, 502, { error: `No se pudo subir la foto (código ${r.status}).` });
      return send(res, 200, { ok: true, path: '/' + file });
    }

    const file = FILES[f]; need(file, 'Sección desconocida.');
    if (req.method === 'GET') {
      const r = await gh(`${contentsPath(file)}?ref=${encodeURIComponent(c.branch)}`);
      if (r.status === 404) return send(res, 200, { data: null, sha: null });
      if (r.status !== 200) return send(res, 502, { error: `GitHub respondió ${r.status}. Revisa el token y el nombre del repositorio.` });
      let raw = r.json.content ? Buffer.from(r.json.content, 'base64').toString('utf8') : null;
      if (raw === null && r.json.download_url) raw = await (await fetch(r.json.download_url)).text();   // archivos grandes
      return send(res, 200, { data: JSON.parse(raw), sha: r.json.sha });
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      const data = SAN[f](body.data);
      const content = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64');
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const r = await gh(contentsPath(file), {
        method: 'PUT',
        body: JSON.stringify({ message: `Panel: ${f} (${s(body.note, 80) || 'cambios'}) · ${now} UTC`, content, branch: c.branch, ...(body.sha ? { sha: body.sha } : {}) })
      });
      if (r.status === 409 || r.status === 422) return send(res, 409, { error: 'Esto cambió mientras editabas. Recarga y vuelve a intentar.' });
      if (r.status !== 200 && r.status !== 201) return send(res, 502, { error: `No se pudo guardar en GitHub (código ${r.status}).` });
      return send(res, 200, { ok: true, sha: r.json.content.sha, data });
    }
    res.setHeader('Allow', 'GET, PUT, POST');
    return send(res, 405, { error: 'Método no permitido.' });
  } catch (e) {
    return send(res, 400, { error: e.message || 'Error inesperado.' });
  }
};

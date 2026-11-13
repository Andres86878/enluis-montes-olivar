/* =========================================================
   Armador de tarjetas de la agenda (Enluis Montes Olivar)
   Convierte los datos del formulario (_f) en los textos que
   usa la web, con el mismo formato de siempre.
   Lo usan el panel /admin y el servidor (/api/concerts).
   ========================================================= */
(function (root) {
  const MES_EN = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
  const MES_ES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'];

  const ROLES = {
    titular:   { es: 'Enluis Montes Olivar, director', en: 'Enluis Montes Olivar, Conductor', label: 'Director (titular)' },
    invitado:  { es: 'Enluis Montes Olivar, director invitado', en: 'Enluis Montes Olivar, Guest Conductor', label: 'Director invitado' },
    cover:     { es: 'Como director suplente (cover)', en: 'As cover conductor', label: 'Director suplente (cover)' },
    asistente: { es: 'Como director asistente', en: 'As assistant conductor', label: 'Director asistente' }
  };

  // Lugares y orquestas frecuentes (para traducir solos)
  const LUGARES = [
    ['Sala Simón Bolívar, Caracas-VE', 'Simon Bolivar Hall, Caracas-VE'],
    ['Wu Tsai Theater, David Geffen Hall', 'Wu Tsai Theater, David Geffen Hall'],
    ['Carnegie Hall, Nueva York', 'Carnegie Hall, New York'],
    ['Palacio de la Ópera, A Coruña, España', 'Palacio de la Ópera, A Coruña, Spain'],
    ['Teatro Teresa Carreño, Caracas-VE', 'Teresa Carreño Theater, Caracas-VE'],
    ['Bogotá, Colombia', 'Bogotá, Colombia']
  ];
  const ORQUESTAS = [
    ['Filarmónica de Nueva York', 'New York Philharmonic'],
    ['Orquesta Sinfónica Simón Bolívar de Venezuela', 'Simon Bolivar Symphony Orchestra of Venezuela'],
    ['Orquesta de Cámara Simón Bolívar', 'Simon Bolivar Chamber Orchestra'],
    ['Orquesta Sinfónica Juvenil Evencio Castellanos', 'Evencio Castellanos Youth Symphony Orchestra'],
    ['Orquesta Joven de la Sinfónica de Galicia', 'Youth Orchestra of the Galician Symphony'],
    ['Orquesta Filarmónica de Bogotá', 'Bogotá Philharmonic Orchestra'],
    ['Orquesta Sinfónica de la Juventud Zuliana «Rafael Urdaneta»', 'Rafael Urdaneta Zulia Youth Symphony Orchestra']
  ];

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const t = s => String(s == null ? '' : s).trim();
  const pad = n => String(n).padStart(2, '0');
  const lines = s => t(s).split(/\n+/).map(x => x.trim()).filter(Boolean);
  function parseD(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t(s)); return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null; }
  function hora12(h) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t(h)); if (!m) return '';
    let H = +m[1]; const ap = H >= 12 ? 'PM' : 'AM'; H = H % 12 || 12;
    return `${H}:${m[2]} ${ap}`;
  }

  function fechaTexto(f) {
    const fin = parseD(f.fecha), ini = parseD(f.fecha_inicio);
    if (!fin) return { en: '', es: '' };
    if (ini && (ini.y !== fin.y || ini.m !== fin.m || ini.d >= fin.d)) {
      // rango que cruza de mes/año: se escribe completo
      if (ini.y * 10000 + ini.m * 100 + ini.d < fin.y * 10000 + fin.m * 100 + fin.d) {
        return {
          en: `${MES_EN[ini.m]} ${pad(ini.d)} – ${MES_EN[fin.m]} ${pad(fin.d)}, ${fin.y}`,
          es: `${ini.d} ${MES_ES[ini.m]} – ${fin.d} ${MES_ES[fin.m]} ${fin.y}`
        };
      }
    }
    if (ini && ini.y === fin.y && ini.m === fin.m && ini.d < fin.d) {
      return { en: `${MES_EN[fin.m]} ${pad(ini.d)}–${pad(fin.d)}, ${fin.y}`, es: `${ini.d}–${fin.d} ${MES_ES[fin.m]} ${fin.y}` };
    }
    return { en: `${MES_EN[fin.m]} ${pad(fin.d)}, ${fin.y}`, es: `${pad(fin.d)} ${MES_ES[fin.m]} ${fin.y}` };
  }

  function lugarEn(es, en) {
    if (t(en)) return t(en);
    const k = LUGARES.find(l => l[0].toLowerCase() === t(es).toLowerCase());
    return k ? k[1] : t(es).replace(/, España$/, ', Spain').replace(/Nueva York/, 'New York');
  }
  function orquestaEn(es, en) {
    if (t(en)) return t(en);
    const k = ORQUESTAS.find(o => o[0].toLowerCase() === t(es).toLowerCase());
    return k ? k[1] : t(es);
  }

  function construir(f) {
    f = f || {};
    const fe = fechaTexto(f);
    const h = hora12(f.hora);
    const lEs = t(f.lugar_es), lEn = lEs ? lugarEn(lEs, f.lugar_en) : '';
    const sinSala = !!f.sala_por_confirmar;
    let dEn = fe.en, dEs = fe.es;
    if (h) { dEn += ` — ${h}`; dEs += ` — ${h}`; }
    if (lEs) {
      dEn += ` | ${lEn}`; dEs += ` | ${lEs}`;
      if (!h && sinSala) { dEn += ' — time and venue TBC'; dEs += ' — hora y lugar por confirmar'; }
      else if (!h && !f.sin_hora) { dEn += ' — time TBC'; dEs += ' — hora por confirmar'; }
      else if (sinSala) { dEn += ' — venue TBC'; dEs += ' — sala por confirmar'; }
    } else {
      if (h) { dEn += ' | Venue TBC'; dEs += ' | Lugar por confirmar'; }
      else { dEn += ' | Time and venue TBC'; dEs += ' | Hora y lugar por confirmar'; }
    }

    const oEs = t(f.orquesta_es), oEn = oEs ? orquestaEn(oEs, f.orquesta_en) : '';
    const tEs = t(f.titulo_es), tEn = t(f.titulo_en) || tEs;
    const titEs = tEs && oEs ? `${tEs} / ${oEs}` : (tEs || oEs);
    const titEn = tEn && oEn ? `${tEn} / ${oEn}` : (tEn || oEn);

    const rol = ROLES[f.rol] || ROLES.titular;
    const rEs = f.rol === 'otro' ? t(f.rol_es) : rol.es;
    const rEn = f.rol === 'otro' ? (t(f.rol_en) || t(f.rol_es)) : rol.en;

    const solEs = lines(f.solistas_es).map(esc).join('<br>');
    const solEn = (t(f.solistas_en) ? lines(f.solistas_en) : lines(f.solistas_es)).map(esc).join('<br>');

    const obras = (f.programa || []).filter(p => t(p.compositor) || t(p.obra_es));
    let pEs, pEn;
    if (obras.length) {
      const pieza = (p, lang) => {
        const obra = lang === 'es' ? t(p.obra_es) : (t(p.obra_en) || t(p.obra_es));
        const est = p.estreno ? (lang === 'es' ? ' <em>(Estreno mundial)</em>' : ' <em>(World Premiere)</em>') : '';
        const comp = lang === 'es' ? t(p.compositor) : (t(p.compositor_en) || t(p.compositor));
        return (comp ? `<strong>${esc(comp)}</strong><br>` : '') + lines(obra).map(esc).join('<br>') + est;
      };
      pEs = obras.map(p => pieza(p, 'es')).join('<br><br>');
      pEn = obras.map(p => pieza(p, 'en')).join('<br><br>');
    } else {
      pEs = t(f.programa_libre_es) ? esc(f.programa_libre_es) : 'Repertorio (por confirmar)';
      pEn = t(f.programa_libre_en) ? esc(f.programa_libre_en) : (t(f.programa_libre_es) ? esc(f.programa_libre_es) : 'Repertoire (TBC)');
    }

    const link = t(f.entradas);
    return {
      title_en: esc(titEn), title_es: esc(titEs),
      dateStr: t(f.fecha),
      dateDisplay_en: esc(dEn), dateDisplay_es: esc(dEs),
      role_en: esc(rEn), role_es: esc(rEs),
      soloists_en: solEn, soloists_es: solEs,
      program_en: pEn, program_es: pEs,
      ticketLink: /^https?:\/\//i.test(link) ? link : '#',
      _f: f
    };
  }

  function validar(f) {
    const e = [];
    if (!parseD(f.fecha)) e.push('Falta la fecha del concierto.');
    if (f.fecha_inicio && !parseD(f.fecha_inicio)) e.push('La fecha de inicio no es válida.');
    if (parseD(f.fecha_inicio) && t(f.fecha_inicio) >= t(f.fecha)) e.push('La fecha de inicio debe ser antes de la fecha final.');
    if (!t(f.orquesta_es) && !t(f.titulo_es)) e.push('Escribe la orquesta (o un título).');
    if (f.hora && !/^\d{1,2}:\d{2}$/.test(t(f.hora))) e.push('La hora no es válida.');
    if (t(f.entradas) && !/^https?:\/\/\S+$/i.test(t(f.entradas))) e.push('El link de entradas debe empezar por https://');
    if (f.rol === 'otro' && !t(f.rol_es)) e.push('Escribe el rol.');
    return e;
  }

  const api = { construir, validar, ROLES, LUGARES, ORQUESTAS, MES_EN, MES_ES, hora12 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AgendaBuilder = api;
})(typeof window !== 'undefined' ? window : globalThis);

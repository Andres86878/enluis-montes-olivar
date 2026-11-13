/* =========================================================
   Secciones extra del panel: Videos, Audio, Prensa, Textos,
   Contacto y Fotos. Usa la misma sesión que la Agenda.
   ========================================================= */
(function () {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const P = window.Panel; // expuesto por el panel principal

  /* ---------- definición de cada sección ---------- */
  const SECTIONS = {
    videos: {
      title: 'Videos', intro: 'Videos de YouTube en Multimedia. El orden de aquí es el orden de la web.', item: 'video', empty: [],
      fields: [
        { k: 'url', l: 'Link de YouTube', ph: 'https://youtu.be/…', req: true, type: 'url' },
        { k: 'titulo', l: 'Título de la obra', ph: 'Ej. Sinfonía India', req: true },
        { k: 'compositor', l: 'Compositor', ph: 'Ej. Carlos Chávez' },
        { k: 'interpretes', l: 'Orquesta / intérpretes', ph: 'Uno por línea', area: true },
        { k: 'anio', l: 'Año', ph: '2026' }
      ],
      row: v => [v.titulo, [v.compositor, v.anio].filter(Boolean).join(' · ')],
      thumb: v => { const m = String(v.url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? `https://i.ytimg.com/vi/${m[1]}/mqdefault.jpg` : ''; }
    },
    audios: {
      title: 'Audio', intro: 'Grabaciones de la sección Audio: pistas de Spotify o archivos de audio.', item: 'audio', empty: [],
      fields: [
        { k: 'tipo', l: 'Tipo', select: [['spotify', 'Spotify (link de la canción, álbum o playlist)'], ['archivo', 'Archivo de audio (.mp3)']] },
        { k: 'url', l: 'Link', ph: 'https://open.spotify.com/track/…  o  nombre-del-archivo.mp3', req: true },
        { k: 'titulo', l: 'Título', ph: 'Ej. Cantata Criolla (Parte 1)', req: true },
        { k: 'compositor', l: 'Compositor (solo archivos)', ph: 'Ej. Alberto Ginastera' },
        { k: 'interpretes', l: 'Orquesta / intérpretes (solo archivos)', area: true },
        { k: 'anio', l: 'Año (solo archivos)', ph: '2026' }
      ],
      row: a => [a.titulo, a.tipo === 'spotify' ? 'Spotify' : 'Archivo de audio'],
      hint: 'Para un archivo .mp3 nuevo: primero súbelo a GitHub junto a la página y aquí escribe su nombre exacto.'
    },
    prensa: {
      title: 'Prensa', intro: 'Artículos del carrusel de Prensa (de 1 a 10). El primero es el que aparece al entrar.', item: 'artículo', empty: [], min: 1,
      fields: [
        { k: 'medio', l: 'Medio', ph: 'Ej. El Nacional', req: true },
        { k: 'foto', l: 'Foto', photo: true, req: true },
        { k: 'titular_es', l: 'Titular (español)', req: true, area: true, small: true },
        { k: 'titular_en', l: 'Titular (inglés)', area: true, small: true, hint: 'Vacío = igual que en español.' },
        { k: 'fecha_es', l: 'Fecha o tipo (español)', ph: 'Ej. Junio 2026 · Entrevista' },
        { k: 'fecha_en', l: 'Fecha o tipo (inglés)', ph: 'Ej. June 2026 · Interview' },
        { k: 'resumen_es', l: 'Resumen (español)', area: true },
        { k: 'resumen_en', l: 'Resumen (inglés)', area: true, hint: 'Vacío = igual que en español.' },
        { k: 'link', l: 'Link del artículo', ph: 'https://…', type: 'url' }
      ],
      row: p => [p.medio, p.titular_es || p.titular_en],
      thumb: p => p.foto || ''
    },
    contacto: {
      title: 'Contacto', intro: 'Personas de contacto y management.', item: 'contacto', empty: [],
      fields: [
        { k: 'nombre', l: 'Nombre', req: true },
        { k: 'rol_es', l: 'Cargo (español)', ph: 'Ej. Consultor' },
        { k: 'rol_en', l: 'Cargo (inglés)', ph: 'Ej. Consultant' },
        { k: 'email', l: 'Correo', ph: 'nombre@dominio.com', type: 'email' }
      ],
      row: c => [c.nombre, [c.rol_es, c.email].filter(Boolean).join(' · ')]
    }
  };

  const PHOTOS = [
    ['inicio_computadora', 'Inicio (computadora)', '/inicio-hd.jpg?v=6'], ['inicio_celular', 'Inicio (celular)', '/inicio-movil-hd.jpg?v=6'],
    ['biografia', 'Biografía', '/biografia.jpg?v=5'], ['prensa', 'Prensa', '/prensa.jpg?v=5'], ['agenda', 'Agenda', '/agenda.jpg?v=5'],
    ['multimedia', 'Multimedia', '/multimedia.jpg?v=5'], ['contacto', 'Contacto', '/contacto.jpg?v=5']
  ];

  const TEXT_GROUPS = [
    ['Inicio', /^(home_|hs_|hm_)/], ['Biografía', /^bio_p/], ['Trayectoria (CV)', /^cv_/], ['Citas y testimonios', /^quote_/],
    ['Prensa', /^press_/], ['Agenda', /^(schedule_|past_|tab_)/], ['Multimedia', /^(media_|yt_)/], ['Contacto', /^contact_/],
    ['Menú y textos generales', /.*/]
  ];
  const LABELS = {
    home_title: 'Título principal', home_desc: 'Frase bajo el nombre', home_eyebrow: 'Texto sobre el nombre', home_quote: 'Cita de portada',
    bio_p1: 'Párrafo 1', bio_p2: 'Párrafo 2', bio_p3: 'Párrafo 3', bio_p4: 'Párrafo 4', bio_p5: 'Párrafo 5', bio_p6: 'Párrafo 6',
    press_intro: 'Frase de introducción', contact_desc: 'Regiones que cubre el management', footer_text: 'Pie de página'
  };
  const skipText = k => /^(press_c\d_meta|press_h\d|press_p\d|press_feat_dek|contact_role\d)$/.test(k); // ahora se editan en Prensa / Contacto

  /* ---------- estado ---------- */
  const ST = {};   // ST[f] = { data, sha }
  let cur = null;

  async function load(f) {
    const j = await P.api('GET', null, f);
    ST[f] = { data: j.data == null ? (f === 'textos' || f === 'fotos' ? {} : []) : j.data, sha: j.sha };
    return ST[f];
  }
  async function save(f, data, note) {
    const ok = await P.publishGeneric(f, data, ST[f].sha, note, f === 'agenda' ? '/data/concerts.json' : `/data/${f}.json`);
    if (ok) { ST[f].data = ok.data; ST[f].sha = ok.sha; }
    return !!ok;
  }

  /* ---------- navegación ---------- */
  window.PanelShow = async function (f) {
    cur = f;
    $$('.snav button').forEach(b => b.classList.toggle('on', b.dataset.s === f));
    $('#agendaView').classList.toggle('hidden', f !== 'agenda');
    $('#fab').classList.toggle('hidden', f !== 'agenda');
    const v = $('#extraView'); v.classList.toggle('hidden', f === 'agenda');
    if (f === 'agenda') return;
    v.oninput = null;
    v.innerHTML = '<p class="loadtxt">Cargando…</p>';
    try { await load(f); } catch (e) { v.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    if (SECTIONS[f]) renderList(f); else if (f === 'textos') renderTexts(); else if (f === 'fotos') renderPhotos();
    window.scrollTo(0, 0);
  };

  /* ---------- listas (videos, audio, prensa, contacto) ---------- */
  function renderList(f) {
    const S = SECTIONS[f], list = ST[f].data, v = $('#extraView');
    v.innerHTML = `
      <div class="intro"><div><h1>${S.title}</h1><p>${S.intro}</p></div>
        <button class="btn gold" id="xNew">+ Agregar ${S.item}</button></div>
      ${S.hint ? `<p class="hint" style="margin:-6px 0 16px">${S.hint}</p>` : ''}
      <div class="list">${list.length ? list.map((it, i) => {
        const [a, b] = S.row(it), th = S.thumb ? S.thumb(it) : '';
        return `<div class="row xrow">
          ${S.thumb ? `<div class="xth" style="${th ? `background-image:url('${esc(th)}')` : ''}"></div>` : `<div class="xnum">${String(i + 1).padStart(2, '0')}</div>`}
          <div class="info"><h3>${esc(a) || '<em style="color:#777">Sin título</em>'}</h3><div class="w">${esc(b)}</div></div>
          <div class="acts">
            <button class="ic" data-x="up" data-i="${i}" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="ic" data-x="down" data-i="${i}" title="Bajar" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="ic" data-x="edit" data-i="${i}" title="Editar">${P.IC.edit}</button>
            <button class="ic del" data-x="del" data-i="${i}" title="Borrar">${P.IC.del}</button>
          </div></div>`;
      }).join('') : `<div class="empty">Aún no hay elementos. Toca “Agregar ${S.item}”.</div>`}</div>`;
    $('#xNew').onclick = () => openItem(f, -1);
    v.querySelector('.list').onclick = async e => {
      const b = e.target.closest('[data-x]'); if (!b || b.disabled) return;
      const i = +b.dataset.i, L = ST[f].data.slice();
      if (b.dataset.x === 'edit') return openItem(f, i);
      if (b.dataset.x === 'del') {
        if (S.min && L.length <= S.min) return P.toast(`Debe quedar al menos un ${S.item}.`, 'bad');
        const [a] = S.row(L[i]);
        if (!(await P.confirmBox(`¿Borrar este ${S.item}?`, `${a || ''}. Se quitará de la web.`))) return;
        L.splice(i, 1);
      } else {
        const j = b.dataset.x === 'up' ? i - 1 : i + 1;[L[i], L[j]] = [L[j], L[i]];
      }
      if (await save(f, L, b.dataset.x)) renderList(f);
    };
  }

  function fieldHtml(fd, val) {
    const id = 'x_' + fd.k;
    if (fd.select) return `<label class="f">${fd.l}<select id="${id}">${fd.select.map(o => `<option value="${o[0]}"${o[0] === val ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;
    if (fd.photo) return `<div class="f">${fd.l}<div class="phbox"><div class="phprev" id="${id}_prev" style="${val ? `background-image:url('${esc(val)}')` : ''}">${val ? '' : '<span>Sin foto</span>'}</div>
        <div><input type="hidden" id="${id}" value="${esc(val || '')}"><label class="btn sm"><input type="file" accept="image/*" id="${id}_file" hidden>Elegir foto…</label>
        <small style="display:block;margin-top:8px">JPG o PNG. Se ajusta sola al tamaño correcto.</small></div></div></div>`;
    const ph = fd.ph ? ` placeholder="${esc(fd.ph)}"` : '';
    return `<label class="f">${fd.l}${fd.area ? `<textarea id="${id}"${ph}${fd.small ? ' style="min-height:64px"' : ''}>${esc(val || '')}</textarea>` : `<input type="${fd.type || 'text'}" id="${id}" value="${esc(val || '')}"${ph} autocomplete="off">`}${fd.hint ? `<small>${fd.hint}</small>` : ''}</label>`;
  }

  function openItem(f, i) {
    const S = SECTIONS[f], it = i >= 0 ? ST[f].data[i] : (f === 'audios' ? { tipo: 'spotify' } : {});
    const box = $('#xEditor');
    box.innerHTML = `<div class="xsheet">
      <div class="ed-head"><button class="mini" data-c>✕</button><h2>${i >= 0 ? 'Editar' : 'Agregar'} ${S.item}</h2></div>
      <form class="ed-body" onsubmit="return false"><fieldset>${S.fields.map(fd => fieldHtml(fd, it[fd.k])).join('')}</fieldset></form>
      <div class="xfoot"><div class="msg" id="xMsg"></div><button class="btn ghost" data-c>Cancelar</button><button class="btn gold" id="xSave">Guardar y publicar</button></div></div>`;
    box.classList.remove('hidden'); document.body.style.overflow = 'hidden';
    let dirty = false; box.querySelector('form').addEventListener('input', () => dirty = true);
    const close = async force => { if (!force && dirty && !(await P.confirmBox('¿Salir sin guardar?', 'Los cambios no se publicarán.', 'Salir'))) return; box.classList.add('hidden'); document.body.style.overflow = ''; };
    box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => close());
    S.fields.filter(fd => fd.photo).forEach(fd => {
      const inp = $('#x_' + fd.k + '_file');
      inp.onchange = async () => {
        const file = inp.files[0]; if (!file) return;
        $('#xMsg').textContent = ''; P.toast('Subiendo foto…', 'wait', 0);
        try {
          const dataUrl = await resizeImage(file, 1600, 0.84);
          $('#x_' + fd.k + '_prev').style.backgroundImage = `url('${dataUrl}')`; $('#x_' + fd.k + '_prev').innerHTML = '';
          const j = await P.api('POST', { data: dataUrl, name: ($('#x_medio') && $('#x_medio').value) || 'foto' }, null, 'upload=1');
          $('#x_' + fd.k).value = j.path; dirty = true; P.toast('Foto lista ✓ Ahora toca “Guardar y publicar”.', 'ok');
        } catch (e) { P.toast(e.message, 'bad', 7000); }
      };
    });
    $('#xSave').onclick = async () => {
      const o = {}; S.fields.forEach(fd => o[fd.k] = ($('#x_' + fd.k).value || '').trim());
      const miss = S.fields.find(fd => fd.req && !o[fd.k]); if (miss) { $('#xMsg').textContent = `Falta: ${miss.l}.`; return; }
      const L = ST[f].data.slice(); if (i >= 0) L[i] = o; else L.push(o);
      const btn = $('#xSave'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Publicando…';
      const ok = await save(f, L, (i >= 0 ? 'editado: ' : 'nuevo: ') + (S.row(o)[0] || ''));
      btn.disabled = false; btn.textContent = 'Guardar y publicar';
      if (ok) { close(true); renderList(f); } else $('#xMsg').textContent = 'No se pudo guardar. Revisa el aviso.';
    };
  }

  function resizeImage(file, max, q) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, max / Math.max(im.width, im.height));
          const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', q));
        };
        im.onerror = () => rej(new Error('No se pudo leer la imagen.'));
        im.src = fr.result;
      };
      fr.onerror = () => rej(new Error('No se pudo leer la imagen.'));
      fr.readAsDataURL(file);
    });
  }

  /* ---------- textos ---------- */
  const toEdit = v => String(v || '').replace(/<br\s*\/?>/gi, '\n').replace(/<strong>(.*?)<\/strong>/gi, '**$1**').replace(/&amp;/g, '&').replace(/&rarr;/g, '→').replace(/&copy;/g, '©');
  const fromEdit = v => esc(v).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  const authToEdit = v => toEdit(String(v || '').replace(/<span class=['"]qa-sub['"]>/i, '\n').replace(/<\/span>/i, '')).replace(/\n\n/g, '\n');
  const authFromEdit = v => { const l = String(v).split('\n').map(x => x.trim()).filter(Boolean); return l.length > 1 ? esc(l[0]) + "<br><span class='qa-sub'>" + l.slice(1).map(esc).join('<br>') + '</span>' : esc(l[0] || ''); };
  const isAuth = k => /^quote_\d+_auth$/.test(k);

  function renderTexts() {
    const T = ST.textos.data, keys = Object.keys(T).filter(k => !skipText(k) && typeof T[k].en === 'string');
    const groups = TEXT_GROUPS.map(([name, re]) => ({ name, keys: [] }));
    keys.forEach(k => { const gi = TEXT_GROUPS.findIndex(([, re]) => re.test(k)); groups[gi].keys.push(k); });
    const v = $('#extraView');
    v.innerHTML = `
      <div class="intro"><div><h1>Textos</h1><p>Biografía, inicio, trayectoria, citas y demás textos, en español e inglés.</p></div>
        <button class="btn gold" id="tSave" disabled>Guardar y publicar</button></div>
      <p class="hint" style="margin:-6px 0 16px">Para <b>negrita</b> escribe **así**. Cada línea nueva es un salto de línea.</p>
      <input type="text" class="search" id="tq" placeholder="Buscar un texto…" style="margin-bottom:14px">
      ${groups.filter(g => g.keys.length).map(g => `<details class="tg"${g.name === 'Biografía' ? ' open' : ''}><summary>${g.name} <b>${g.keys.length}</b></summary>
        ${g.keys.map(k => `<div class="titem" data-k="${k}"><div class="tk">${LABELS[k] || k.replace(/_/g, ' ')}</div>
          <div class="g2"><label class="f">Español<textarea data-l="es">${esc(isAuth(k) ? authToEdit(T[k].es) : toEdit(T[k].es))}</textarea></label>
          <label class="f">Inglés<textarea data-l="en">${esc(isAuth(k) ? authToEdit(T[k].en) : toEdit(T[k].en))}</textarea></label></div></div>`).join('')}
      </details>`).join('')}`;
    v.querySelectorAll('textarea').forEach(t => { const fit = () => { t.style.height = 'auto'; t.style.height = Math.min(520, Math.max(58, t.scrollHeight + 2)) + 'px'; }; t.addEventListener('input', fit); setTimeout(fit, 0); v.querySelectorAll('details').forEach(d => d.addEventListener('toggle', fit)); });
    const changed = new Set();
    v.oninput = e => { const it = e.target.closest('.titem'); if (it) { changed.add(it.dataset.k); $('#tSave').disabled = false; P.setDirty(true); } };
    $('#tq').oninput = e => { const q = e.target.value.toLowerCase(); v.querySelectorAll('.titem').forEach(it => { it.style.display = !q || it.textContent.toLowerCase().includes(q) || [...it.querySelectorAll('textarea')].some(t => t.value.toLowerCase().includes(q)) ? '' : 'none'; }); if (q) v.querySelectorAll('details').forEach(d => d.open = true); };
    $('#tSave').onclick = async () => {
      const T2 = JSON.parse(JSON.stringify(ST.textos.data));
      changed.forEach(k => { const it = v.querySelector(`.titem[data-k="${k}"]`);
        ['es', 'en'].forEach(l => { const val = it.querySelector(`[data-l=${l}]`).value; T2[k][l] = isAuth(k) ? authFromEdit(val) : fromEdit(val); }); });
      const b = $('#tSave'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Publicando…';
      const ok = await save('textos', T2, [...changed].slice(0, 4).join(', '));
      b.textContent = 'Guardar y publicar';
      if (ok) { changed.clear(); P.setDirty(false); } else b.disabled = false;
    };
  }

  /* ---------- fotos ---------- */
  function renderPhotos() {
    const F = ST.fotos.data, v = $('#extraView');
    v.innerHTML = `<div class="intro"><div><h1>Fotos de fondo</h1><p>La foto grande de cada sección. Toca “Cambiar” para subir otra.</p></div></div>
      <div class="pgrid">${PHOTOS.map(([k, l, def]) => `<div class="pcard">
        <div class="pimg" style="background-image:url('${esc(F[k] || def)}')"></div>
        <div class="pinfo"><b>${l}</b><span>${F[k] ? 'Foto nueva (si no se ve aún, aparece en 1 minuto)' : 'Foto original'}</span></div>
        <div class="pacts"><label class="btn sm"><input type="file" accept="image/*" data-k="${k}" hidden>Cambiar</label>
        ${F[k] ? `<button class="btn sm ghost" data-r="${k}">Volver a la original</button>` : ''}</div></div>`).join('')}</div>
      <p class="hint" style="margin-top:16px">Para el inicio en celular usa una foto vertical. En las demás, mejor fotos horizontales con Enluis al centro.</p>`;
    v.querySelectorAll('input[type=file]').forEach(inp => inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return; const k = inp.dataset.k;
      P.toast('Subiendo foto…', 'wait', 0);
      try {
        const dataUrl = await resizeImage(file, k === 'inicio_celular' ? 1600 : 2400, 0.84);
        const j = await P.api('POST', { data: dataUrl, name: 'fondo-' + k }, null, 'upload=1');
        const F2 = Object.assign({}, ST.fotos.data, { [k]: j.path });
        if (await save('fotos', F2, 'foto ' + k)) renderPhotos();
      } catch (e) { P.toast(e.message, 'bad', 7000); }
    });
    v.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => {
      if (!(await P.confirmBox('¿Volver a la foto original?', 'Se quitará la foto nueva de esta sección.', 'Volver'))) return;
      const F2 = Object.assign({}, ST.fotos.data); delete F2[b.dataset.r];
      if (await save('fotos', F2, 'foto original ' + b.dataset.r)) renderPhotos();
    });
  }
})();

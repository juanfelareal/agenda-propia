/*!
 * AGENDA PROPIA — ventana para agendar citas (tipo Calendly) conectada a tu Google Calendar.
 * Un solo archivo: trae su propio diseño. Se configura con window.AGENDA antes de cargarlo.
 * Cualquier botón con  data-agenda  o enlace a  #agendar  abre la ventana.
 *   data-agenda=""                  → sin servicio
 *   data-agenda="Asesoría de imagen" → muestra ese servicio arriba y lo guarda con la cita
 * Instrucciones: README del repositorio.
 */
(() => {
  const C = Object.assign({
    url: '',                         // URL de tu Apps Script (termina en /exec). Vacío = modo demostración
    anfitriona: 'conmigo',           // "Agenda una cita con ___"
    subtitulo: 'Videollamada de 30 minutos. Cuéntame un poco para llegar preparada.',
    titulo: 'Agenda una cita',
    textoConfirmada: 'Tu cita quedó agendada. Te llegó la invitación a tu correo.',
    correoContacto: '',              // aparece si algo falla
    preguntas: [                     // además de nombre, correo y celular (que siempre van)
      { pregunta: '¿Qué quieres resolver?', tipo: 'texto-largo', ejemplo: 'Cuéntame en pocas palabras' },
    ],
    pedirCelular: true,
    colores: {},                     // { fondo, tarjeta, texto, acento, boton, textoBoton }
    fuente: '',                      // ej. "'Poppins', sans-serif" (la fuente debe estar cargada en tu sitio)
  }, window.AGENDA || {});

  const DEMO = !C.url;
  const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const ICON_X = '<svg viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5"/></svg>';
  const ICON_OK = '<svg viewBox="0 0 22 22" fill="none"><path d="M4 11.5l4.5 4.5L18 6.5" stroke="currentColor" stroke-width="2"/></svg>';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Campos: los fijos + las preguntas que configures
  const FIELDS = [
    { k: 'name', label: 'Nombre', type: 'text', auto: 'name' },
    { k: 'email', label: 'Correo', type: 'email', auto: 'email' },
    ...(C.pedirCelular ? [{ k: 'phone', label: 'Celular', type: 'tel', auto: 'tel' }] : []),
    ...C.preguntas.map((p, i) => ({
      k: `q${i}`, label: p.pregunta, extra: true, optional: p.opcional,
      options: p.opciones, textarea: p.tipo === 'texto-largo', type: 'text', placeholder: p.ejemplo || '',
      full: p.tipo === 'texto-largo' || p.anchoCompleto,
    })),
  ];
  // En dos columnas, si el número de campos cortos es impar, el último corto ocupa todo el ancho
  const shorts = FIELDS.filter((f) => !f.full);
  if (shorts.length % 2) shorts[shorts.length - 1].full = true;

  // ---------- Estilos ----------
  const col = C.colores;
  const style = document.createElement('style');
  style.textContent = `
.ag{--ag-bg:${col.fondo || '#F3F1ED'};--ag-surface:${col.tarjeta || '#FBFAF8'};--ag-ink:${col.texto || '#121212'};--ag-accent:${col.acento || '#44BF47'};--ag-btn:${col.boton || col.texto || '#121212'};--ag-btn-ink:${col.textoBoton || col.fondo || '#F3F1ED'};
  --ag-ink-2:color-mix(in srgb,var(--ag-ink) 78%,transparent);--ag-muted:color-mix(in srgb,var(--ag-ink) 55%,transparent);--ag-line:color-mix(in srgb,var(--ag-ink) 9%,transparent);--ag-line-2:color-mix(in srgb,var(--ag-ink) 17%,transparent);--ag-r:14px;--ag-gutter:18px;
  position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;background:rgba(18,18,18,.42);opacity:0;transition:opacity .25s ease;font-family:${C.fuente || "inherit"};line-height:1.5;color:var(--ag-ink);text-align:left;}
.ag *,.ag *::before,.ag *::after{box-sizing:border-box;margin:0;}
.ag[hidden]{display:none;}
.ag.open{opacity:1;}
.ag-panel{position:relative;width:100%;max-height:94dvh;overflow-y:auto;overscroll-behavior:contain;background:var(--ag-bg);border-radius:24px 24px 0 0;padding:22px var(--ag-gutter) calc(24px + env(safe-area-inset-bottom));transform:translateY(24px);transition:transform .3s cubic-bezier(.2,.8,.2,1);}
.ag.open .ag-panel{transform:none;}
.ag-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.ag-step{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ag-muted);}
.ag-close{width:38px;height:38px;border-radius:50%;border:1px solid var(--ag-line-2);background:transparent;cursor:pointer;display:grid;place-items:center;color:var(--ag-ink);padding:0;}
.ag-close svg{width:14px;height:14px;}
.ag h3{font-family:inherit;font-size:28px;font-weight:400;letter-spacing:-.03em;line-height:1.1;color:var(--ag-ink);text-transform:none;}
.ag h3 b{font-weight:600;}
.ag-sub{color:var(--ag-ink-2);font-size:15px;margin-top:8px;}
.ag-section{margin-top:22px;}
.ag-section>.ag-step{display:block;margin-bottom:10px;}
.ag-svc{display:inline-flex;align-items:center;gap:8px;margin-bottom:14px;padding:7px 13px;border-radius:999px;background:var(--ag-surface);border:1px solid var(--ag-line);font-size:13px;font-weight:500;}
.ag-svc::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ag-accent);}
.ag-fields{display:grid;gap:12px;}
.ag-field label{display:block;font-size:13px;color:var(--ag-ink-2);margin-bottom:6px;font-weight:400;}
.ag-field input,.ag-field select,.ag-field textarea{width:100%;font:inherit;font-size:16px;color:var(--ag-ink);background:var(--ag-surface);border:1px solid var(--ag-line-2);border-radius:var(--ag-r);padding:13px 14px;outline:none;transition:border-color .15s;-webkit-appearance:none;appearance:none;box-shadow:none;height:auto;min-height:0;}
.ag-field select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%23777' stroke-width='1.4'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px;}
.ag-field textarea{min-height:96px;resize:vertical;}
.ag-field input:focus,.ag-field select:focus,.ag-field textarea:focus{border-color:var(--ag-ink);}
.ag-field.err input,.ag-field.err select,.ag-field.err textarea{border-color:#C2410C;}
.ag-msg{display:none;font-size:12px;color:#C2410C;margin-top:5px;}
.ag-field.err .ag-msg{display:block;}
.ag-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;}
.ag-days{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 calc(var(--ag-gutter) * -1);padding:2px var(--ag-gutter);scroll-snap-type:x proximity;}
.ag-days::-webkit-scrollbar{display:none;}
.ag-day{flex:none;width:68px;padding:10px 0 11px;border-radius:var(--ag-r);border:1px solid var(--ag-line-2);background:var(--ag-surface);font:inherit;color:var(--ag-ink);cursor:pointer;text-align:center;scroll-snap-align:start;}
.ag-day small{display:block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ag-muted);}
.ag-day b{display:block;font-size:22px;font-weight:500;letter-spacing:-.02em;margin-top:2px;}
.ag-day span{display:block;font-size:12px;color:var(--ag-muted);}
.ag-day[aria-pressed="true"],.ag-slot[aria-pressed="true"]{background:var(--ag-btn);border-color:var(--ag-btn);color:var(--ag-btn-ink);}
.ag-day[aria-pressed="true"] small,.ag-day[aria-pressed="true"] span{color:inherit;opacity:.7;}
.ag-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;min-height:52px;}
.ag-slot{height:48px;border-radius:var(--ag-r);border:1px solid var(--ag-line-2);background:var(--ag-surface);font:inherit;font-size:15px;font-variant-numeric:tabular-nums;color:var(--ag-ink);cursor:pointer;padding:0;}
.ag-note{grid-column:1 / -1;font-size:14px;color:var(--ag-muted);padding:12px 0;}
.ag-skel{height:48px;border-radius:var(--ag-r);background:linear-gradient(90deg,var(--ag-surface),var(--ag-line),var(--ag-surface));background-size:200% 100%;animation:ag-sh 1.2s linear infinite;}
@keyframes ag-sh{to{background-position:-200% 0;}}
.ag-actions{display:flex;flex-direction:column;gap:10px;margin-top:24px;}
.ag-btn{border:0;font:inherit;font-size:15px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;height:52px;padding:0 24px;border-radius:999px;background:var(--ag-btn);color:var(--ag-btn-ink);text-decoration:none;width:100%;transition:transform .2s ease;}
.ag-btn:active{transform:scale(.98);}
.ag-btn[disabled]{opacity:.35;cursor:not-allowed;}
.ag-back{background:none;border:0;font:inherit;font-size:14px;color:var(--ag-ink-2);cursor:pointer;padding:8px;text-decoration:underline;text-underline-offset:3px;}
.ag-alert{margin-top:16px;padding:12px 14px;border-radius:var(--ag-r);background:#FBEDE5;color:#9A3412;font-size:14px;}
.ag-done{text-align:center;padding:12px 0 4px;}
.ag-check{width:56px;height:56px;border-radius:50%;background:var(--ag-btn);color:var(--ag-btn-ink);display:grid;place-items:center;margin:0 auto 20px;}
.ag-check svg{width:22px;height:22px;}
.ag-when{margin:20px 0 4px;padding:16px;border-radius:var(--ag-r);background:var(--ag-surface);border:1px solid var(--ag-line);font-size:15px;}
.ag-when b{display:block;font-size:18px;font-weight:500;letter-spacing:-.01em;}
.ag-when b::first-letter{text-transform:uppercase;}
.ag-when a{display:inline-block;margin-top:8px;font-size:14px;color:inherit;text-decoration:underline;text-underline-offset:3px;word-break:break-all;}
.ag-demo{margin-top:14px;font-size:12px;color:var(--ag-muted);text-align:center;}
body.ag-lock{overflow:hidden;}
@media (min-width:720px){
  .ag{align-items:center;padding:24px;}
  .ag-panel{max-width:560px;border-radius:28px;padding:30px 34px 32px;max-height:90vh;}
  .ag-fields{grid-template-columns:1fr 1fr;}
  .ag-field.full{grid-column:1 / -1;}
  .ag-days{margin:0;padding:2px 0;}
  .ag-slots{grid-template-columns:repeat(4,1fr);}
  .ag-actions{flex-direction:row-reverse;justify-content:space-between;align-items:center;}
  .ag-btn{width:auto;}
}
@media (prefers-reduced-motion:reduce){.ag,.ag-panel{transition:none;}.ag-skel{animation:none;}}`;
  document.head.appendChild(style);

  // ---------- Conexión con el Apps Script ----------
  async function api(params, body) {
    if (DEMO) return demo(params, body);
    const url = `${C.url}?${new URLSearchParams(params)}`;
    // Sin encabezados extra: así el navegador no hace la consulta previa (CORS) que Apps Script no responde
    const r = body ? await fetch(C.url, { method: 'POST', body: JSON.stringify(body) }) : await fetch(url);
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }
  // Modo demostración: horarios inventados, nada se guarda
  function demo(params) {
    return new Promise((res) => setTimeout(() => {
      if (params.action === 'dias') {
        const out = [];
        for (let i = 0; out.length < 15; i++) {
          const d = new Date(Date.now() + i * 86400e3);
          if (d.getDay() % 6) out.push(d.toISOString().slice(0, 10));
        }
        return res({ dias: out, duracion: 30, zona: 'GMT-5' });
      }
      if (params.action === 'horarios') {
        const all = ['09:00', '09:45', '10:30', '11:15', '12:00', '14:00', '14:45', '15:30', '16:15'];
        return res({ horarios: all.filter((_, i) => (i + Number(params.fecha.slice(-1))) % 3) });
      }
      return res({ ok: true, enlace: 'https://meet.google.com/xxx-demo-xxx' });
    }, 450));
  }

  // ---------- Fechas ----------
  const parts = (iso) => { const d = new Date(`${iso}T12:00:00Z`); return { dow: d.getUTCDay(), day: d.getUTCDate(), month: d.getUTCMonth() }; };
  function timeLabel(t) {
    const [h, m] = t.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  }
  const dayLabel = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  // ---------- Ventana ----------
  const state = { step: 'form', data: { service: '' }, day: null, time: null, days: null, info: {}, result: null };
  const root = document.createElement('div');
  root.className = 'ag';
  root.hidden = true;
  root.innerHTML = '<div class="ag-panel" role="dialog" aria-modal="true" aria-labelledby="ag-title"></div>';
  const panel = root.firstElementChild;
  let lastFocus = null;
  const mount = () => document.body.appendChild(root);
  document.body ? mount() : document.addEventListener('DOMContentLoaded', mount);

  function open(service) {
    lastFocus = document.activeElement;
    if (state.step === 'done') reset();
    // Si cambia de servicio se conservan los datos, pero vuelve al paso 1
    if (state.data.service !== service) { state.data.service = service; state.step = 'form'; state.time = null; }
    render();
    root.hidden = false;
    document.body.classList.add('ag-lock');
    requestAnimationFrame(() => root.classList.add('open'));
    panel.querySelector('.ag-close').focus({ preventScroll: true });
  }
  function close() {
    root.classList.remove('open');
    document.body.classList.remove('ag-lock');
    setTimeout(() => { root.hidden = true; }, 250);
    lastFocus && lastFocus.focus({ preventScroll: true });
  }
  function reset() {
    state.step = 'form'; state.data = { service: '' }; state.day = null; state.time = null; state.result = null;
  }
  window.abrirAgenda = (service = '') => open(service);

  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-agenda], a[href$="#agendar"]');
    if (b) { e.preventDefault(); open(b.dataset.agenda || ''); }
  });

  const head = (t) => `<div class="ag-head"><span class="ag-step">${t}</span><button class="ag-close" type="button" aria-label="Cerrar">${ICON_X}</button></div>`;
  const svc = () => (state.data.service ? `<p class="ag-svc">${esc(state.data.service)}</p>` : '');
  const demoNote = () => (DEMO ? '<p class="ag-demo">Modo demostración: falta conectar la URL del Apps Script.</p>' : '');

  function render() {
    if (state.step === 'form') renderForm();
    else if (state.step === 'time') renderTime();
    else renderDone();
    panel.querySelector('.ag-close').addEventListener('click', close);
    panel.scrollTop = 0;
  }

  // ---------- Paso 1: datos ----------
  function renderForm() {
    const d = state.data;
    panel.innerHTML = `${head('Paso 1 de 2')}${svc()}
      <h3 id="ag-title">${esc(C.titulo)} <b>${esc(C.anfitriona)}.</b></h3>
      <p class="ag-sub">${esc(C.subtitulo)}</p>
      <form class="ag-section ag-fields" novalidate>
        ${FIELDS.map((f) => {
          const v = esc(d[f.k] || '');
          const ctl = f.options
            ? `<select id="ag-${f.k}" name="${f.k}"><option value="">Elige una opción</option>${f.options.map((o) => `<option${d[f.k] === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
            : f.textarea
              ? `<textarea id="ag-${f.k}" name="${f.k}" placeholder="${esc(f.placeholder)}">${v}</textarea>`
              : `<input id="ag-${f.k}" name="${f.k}" type="${f.type}" value="${v}"${f.auto ? ` autocomplete="${f.auto}"` : ''}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}${f.type === 'tel' ? ' inputmode="tel"' : ''}>`;
          return `<div class="ag-field${f.full ? ' full' : ''}" data-f="${f.k}"><label for="ag-${f.k}">${esc(f.label)}${f.optional ? ' (opcional)' : ''}</label>${ctl}<p class="ag-msg">${f.k === 'email' ? 'Revisa tu correo.' : 'Completa este campo.'}</p></div>`;
        }).join('')}
        <div class="ag-hp" aria-hidden="true"><input name="empresa_web" tabindex="-1" autocomplete="off"></div>
      </form>
      <div class="ag-actions"><button class="ag-btn" type="button" data-next>Elegir día y hora</button></div>${demoNote()}`;

    const form = panel.querySelector('form');
    form.addEventListener('input', (e) => {
      state.data[e.target.name] = e.target.value;
      e.target.closest('.ag-field')?.classList.remove('err');
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    panel.querySelector('[data-next]').addEventListener('click', () => {
      let first = null;
      FIELDS.forEach((f) => {
        const v = (state.data[f.k] || '').trim();
        const bad = (!v && !f.optional) || (f.k === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) || (f.k === 'phone' && v.replace(/\D/g, '').length < 7);
        if (bad) { const el = panel.querySelector(`[data-f="${f.k}"]`); el.classList.add('err'); first = first || el; }
      });
      if (first) { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      state.step = 'time';
      window.fbq && fbq('track', 'Lead', { content_name: state.data.service });
      render();
    });
  }

  // ---------- Paso 2: día y hora ----------
  const cache = {};
  async function renderTime(alert) {
    panel.innerHTML = `${head('Paso 2 de 2')}${svc()}
      <h3 id="ag-title">Elige <b>día y hora.</b></h3>
      <p class="ag-sub" data-zone>&nbsp;</p>
      <div class="ag-section"><span class="ag-step">Día</span><div class="ag-days">${'<div class="ag-skel" style="flex:none;width:68px;height:72px"></div>'.repeat(6)}</div></div>
      <div class="ag-section"><span class="ag-step">Hora</span><div class="ag-slots" aria-live="polite">${'<div class="ag-skel"></div>'.repeat(6)}</div></div>
      ${alert ? `<div class="ag-alert">${esc(alert)}</div>` : ''}
      <div class="ag-actions"><button class="ag-btn" type="button" data-confirm disabled>Confirmar cita</button><button class="ag-back" type="button" data-back>Volver a mis datos</button></div>${demoNote()}`;
    panel.querySelector('[data-back]').addEventListener('click', () => { state.step = 'form'; render(); });
    panel.querySelector('[data-confirm]').addEventListener('click', confirm);

    if (!state.days) {
      try {
        const r = await api({ action: 'dias' });
        if (!r.dias) throw new Error();
        state.days = r.dias; state.info = r;
      } catch {
        panel.querySelector('.ag-days').innerHTML = '';
        panel.querySelector('.ag-slots').innerHTML = `<p class="ag-note">No pudimos cargar la agenda. Intenta de nuevo en un momento.</p>`;
        return;
      }
    }
    if (state.step !== 'time') return;
    panel.querySelector('[data-zone]').textContent = `Horarios en hora local (${state.info.zona}). La cita dura ${state.info.duracion} minutos.`;
    if (!state.days.includes(state.day)) state.day = state.days[0];
    const box = panel.querySelector('.ag-days');
    box.innerHTML = state.days.map((iso) => {
      const p = parts(iso);
      return `<button type="button" class="ag-day" data-day="${iso}" aria-pressed="${state.day === iso}"><small>${DOW[p.dow]}</small><b>${p.day}</b><span>${MONTHS[p.month]}</span></button>`;
    }).join('');
    box.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
      state.day = b.dataset.day; state.time = null;
      box.querySelectorAll('[data-day]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      loadSlots();
    }));
    box.querySelector(`[data-day="${state.day}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
    loadSlots();
  }

  async function loadSlots(autoAdvance = true) {
    const box = panel.querySelector('.ag-slots');
    const day = state.day;
    box.innerHTML = '<div class="ag-skel"></div>'.repeat(6);
    updateConfirm();
    let slots = cache[day];
    if (!slots) {
      try {
        const r = await api({ action: 'horarios', fecha: day });
        if (!r.horarios) throw new Error();
        slots = cache[day] = r.horarios;
      } catch {
        if (state.day === day) box.innerHTML = '<p class="ag-note">No pudimos cargar los horarios. Intenta de nuevo en un momento.</p>';
        return;
      }
    }
    if (state.day !== day) return;
    // Si el primer día ya no tiene cupos, salta solo al siguiente
    if (!slots.length && autoAdvance) {
      const btns = [...panel.querySelectorAll('[data-day]')];
      const i = btns.findIndex((b) => b.dataset.day === day);
      if (i === 0 && btns[1]) { btns[1].click(); return; }
    }
    box.innerHTML = slots.length
      ? slots.map((t) => `<button type="button" class="ag-slot" data-time="${t}" aria-pressed="${state.time === t}">${timeLabel(t)}</button>`).join('')
      : '<p class="ag-note">No hay horarios libres este día. Prueba con otro.</p>';
    box.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => {
      state.time = b.dataset.time;
      box.querySelectorAll('[data-time]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      updateConfirm();
    }));
  }

  function updateConfirm() {
    const b = panel.querySelector('[data-confirm]');
    if (b) b.disabled = !state.time;
  }

  async function confirm() {
    const b = panel.querySelector('[data-confirm]');
    b.disabled = true; b.textContent = 'Agendando…';
    const d = state.data;
    const payload = {
      service: d.service, name: d.name, email: d.email, phone: d.phone || '',
      respuestas: FIELDS.filter((f) => f.extra).map((f) => ({ pregunta: f.label, valor: d[f.k] || '' })),
      fecha: state.day, hora: state.time, empresa_web: d.empresa_web || '',
    };
    try {
      const json = await api({}, payload);
      if (json.ocupado) {
        delete cache[state.day]; state.time = null;
        renderTime(json.error);
        return;
      }
      if (!json.ok) throw new Error();
      state.result = json; state.step = 'done';
      window.fbq && fbq('track', 'Schedule', { content_name: d.service });
      render();
    } catch {
      b.disabled = false; b.textContent = 'Confirmar cita';
      const extra = C.correoContacto ? ` o escríbenos a ${C.correoContacto}` : '';
      if (!panel.querySelector('.ag-alert')) b.closest('.ag-actions').insertAdjacentHTML('beforebegin', `<div class="ag-alert">No pudimos agendar la cita. Intenta de nuevo${esc(extra)}.</div>`);
    }
  }

  // ---------- Confirmación ----------
  function renderDone() {
    const { data, day, time, result } = state;
    const link = result.enlace || '';
    panel.innerHTML = `${head('Cita confirmada')}
      <div class="ag-done">
        <div class="ag-check">${ICON_OK}</div>
        <h3 id="ag-title">Listo, <b>${esc(data.name.trim().split(' ')[0])}.</b></h3>
        <p class="ag-sub">${esc(C.textoConfirmada)}</p>
        <div class="ag-when"><b>${esc(dayLabel(day))} · ${timeLabel(time)}</b>${esc(state.info.zona || '')}${link ? `<br><a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a>` : ''}</div>
      </div>
      <div class="ag-actions"><button class="ag-btn" type="button" data-done>Cerrar</button></div>${demoNote()}`;
    panel.querySelector('[data-done]').addEventListener('click', close);
  }

  // Un enlace a tusitio.com/#agendar (por ejemplo, desde Instagram) abre la agenda al cargar
  const fromHash = () => { if (location.hash === '#agendar') open(''); };
  window.addEventListener('hashchange', fromHash);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fromHash) : fromHash();
})();

'use strict';
/* Radiografía del precio de los carburantes en España
   Dashboard estático: lee data/dataset.json + data/provincias.json (mismos
   datos que analiza analyze.py). Sin dependencias, sin llamadas de red. */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* si algo falla, que se vea en pantalla en vez de quedarse en la consola */
function showErr(msg) {
  let b = document.getElementById('errbox');
  if (!b) {
    b = document.createElement('div');
    b.id = 'errbox';
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:999;background:#4a0d1a;color:#ffd9e0;' +
      'padding:10px 16px;font:13px/1.4 ui-monospace,Consolas,monospace;border-top:1px solid #ff8fa3';
    document.body.appendChild(b);
  }
  b.textContent = '⚠ ' + msg;
}
window.addEventListener('error', e => showErr(e.message + ' @' + (e.filename || '') + ':' + (e.lineno || '')));
window.addEventListener('unhandledrejection', e => showErr((e.reason && e.reason.message) || String(e.reason)));

/* índices del registro compacto de estación */
const F = { ID:0, LAT:1, LON:2, PROV:3, CCAA:4, MUNI:5, BR:6, ROT:7,
            ADDR:8, CP:9, HORA:10, D24:11, PR:12, IPROV:13 };

const ZONA_DE = { 'Canarias':'Canarias', 'Baleares':'Baleares', 'Ceuta':'Ceuta', 'Melilla':'Melilla' };
const RAMP = [[45,212,167],[163,230,53],[250,204,21],[251,146,60],[239,68,68]];

const S = {
  fuel: 0, zona: '', ccaa: '', prov: '', marca: '', d24: false, q: '',
  maxC: 0, sort: 'precio', rankGroup: 'prov', rankSide: 'baratas',
  sel: null, focus: null, pos: null, view: [], sorted: []
};

let DATA = null, GEO = null, CAN = null;
let PROVCODE = null, I_G95 = 0, I_GA = 1;
const dom = { lo: 0, hi: 0 };          // dominio de color / histograma (milésimas)
const mapView = { k: 1, tx: 0, ty: 0 };
let panelMain = null, panelCan = null, projMain = null, projCan = null;
let screenPts = [];                     // {x,y,st} de la última pintura

/* ------------------------------------------------------------------ utils */
const norm = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const x = t * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i;
  const a = RAMP[i], b = RAMP[i + 1];
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
}
const fmt3 = c => (c / 1000).toFixed(3).replace('.', ',');
const fmt2 = c => (c / 1000).toFixed(2).replace('.', ',');
const eur  = c => fmt3(c) + ' €';
const price = st => st[F.PR][S.fuel];
const pct = (sorted, q) => {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};
const median = a => pct(a, .5);
function haversine(a, b, c, d) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (c - a) * r, dLon = (d - b) * r;
  const h = Math.sin(dLat/2)**2 + Math.cos(a*r)*Math.cos(c*r)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const esc = s => (s || '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

function zonaOf(st) { return ZONA_DE[DATA.ccaas[st[F.CCAA]]] || 'Península'; }
function distOf(st) {
  return S.pos ? haversine(S.pos.lat, S.pos.lon, st[F.LAT], st[F.LON]) : null;
}

/* ---------------------------------------------------------------- arranque */
async function init() {
  const [ds, geo] = await Promise.all([
    fetch('data/dataset.json').then(r => r.json()),
    fetch('data/provincias.json').then(r => r.json()).catch(() => ({ provincias: [] }))
  ]);
  DATA = ds; GEO = geo.provincias || [];
  CAN = DATA.estaciones.map(st => DATA.ccaas[st[F.CCAA]] === 'Canarias');
  PROVCODE = DATA.provincias.map(() => null);
  DATA.estaciones.forEach((st, i) => {
    st.__i = i;
    st._q = norm(`${DATA.municipios[st[F.MUNI]]} ${st[F.ADDR]} ${st[F.ROT]} ${DATA.marcas[st[F.BR]]} ${st[F.CP]}`);
    if (!PROVCODE[st[F.PROV]]) PROVCODE[st[F.PROV]] = st[F.IPROV];
  });
  I_G95 = DATA.combustibles.findIndex(c => c.key === 'Gasolina 95');
  I_GA  = DATA.combustibles.findIndex(c => c.key === 'Gasoleo A');
  if (I_G95 < 0) I_G95 = 0;
  if (I_GA < 0) I_GA = 1;

  /* cabecera y pie */
  $('#subtitulo').innerHTML =
    `<b>${DATA.meta.n.toLocaleString('es-ES')}</b> estaciones de servicio · ` +
    `${DATA.combustibles.length} carburantes · foto fija del <b>${DATA.meta.fecha}</b>`;
  $('#fuente-txt').textContent = DATA.meta.fuente;
  $('#fuente-url').href = DATA.meta.url;
  $('#fecha-datos').textContent = DATA.meta.fecha;

  /* selects */
  $('#f-fuel').innerHTML = DATA.combustibles
    .map((c, i) => `<option value="${i}">${c.label} — ${c.n.toLocaleString('es-ES')} EESS</option>`).join('');
  const zonas = [...new Set(DATA.estaciones.map(zonaOf))].sort();
  $('#f-zona').innerHTML = `<option value="">Toda España</option>` +
    zonas.map(z => `<option>${z}</option>`).join('');
  const ccaas = [...new Set(DATA.estaciones.map(s => DATA.ccaas[s[F.CCAA]]))].sort((a,b)=>a.localeCompare(b,'es'));
  $('#f-ccaa').innerHTML = `<option value="">Todas</option>` + ccaas.map(c => `<option>${c}</option>`).join('');
  const provs = [...new Set(DATA.estaciones.map(s => DATA.provincias[s[F.PROV]]))].sort((a,b)=>a.localeCompare(b,'es'));
  $('#f-prov').innerHTML = `<option value="">Todas</option>` + provs.map(p => `<option>${p}</option>`).join('');
  const marcas = [...new Set([...DATA.marca_destacada, 'Independiente (sin marca)', 'Otras marcas'])];
  $('#f-marca').innerHTML = `<option value="">Todas</option>` +
    marcas.map(m => `<option>${esc(m)}</option>`).join('');

  bindEvents();
  setFuelDomain();
  readHash();
  syncControls();
  render();
  new ResizeObserver(() => { sizeCanvas(); drawMap(); }).observe($('#map-hold'));
  new ResizeObserver(() => drawHist()).observe($('#hist').parentElement);
  window.addEventListener('resize', () => { drawHist(); });
}

/* --------------------------------------------------------------- dominio */
function setFuelDomain() {
  const all = DATA.estaciones.filter(s => s[F.PR][S.fuel] > 0).map(s => s[F.PR][S.fuel]).sort((a,b)=>a-b);
  dom.lo = Math.floor(pct(all, .01)); dom.hi = Math.ceil(pct(all, .99));
  const sl = $('#f-max');
  sl.min = dom.lo; sl.max = dom.hi; sl.step = 1;
  S.maxC = dom.hi; sl.value = dom.hi;
  $('#lbl-max').textContent = 'sin tope';
  paintScaleLegend();
}

/* ------------------------------------------------------------- filtrado */
function currentView(skip) {
  const q = norm(S.q.trim());
  const out = [];
  for (const st of DATA.estaciones) {
    if (!st[F.PR][S.fuel]) continue;
    if (S.maxC < dom.hi && st[F.PR][S.fuel] > S.maxC) continue;
    if (S.zona && zonaOf(st) !== S.zona) continue;
    if (skip !== 'ccaa' && S.ccaa && DATA.ccaas[st[F.CCAA]] !== S.ccaa) continue;
    if (skip !== 'prov' && S.prov && DATA.provincias[st[F.PROV]] !== S.prov) continue;
    if (S.marca && DATA.marcas[st[F.BR]] !== S.marca) continue;
    if (S.d24 && !st[F.D24]) continue;
    if (q && st._q.indexOf(q) === -1) continue;
    out.push(st);
  }
  return out;
}

/* -------------------------------------------------- panel de indicadores */
function drawKpis() {
  const v = S.view;
  const prices = v.map(price).sort((a,b)=>a-b);
  const n = prices.length;
  const kpi = (k, val, sub) => `<div class="kpi"><div class="v">${val}${sub ? `<small>${sub}</small>` : ''}</div><div class="k">${k}</div></div>`;
  if (!n) {
    $('#kpis').innerHTML = kpi('Estaciones', '0') + kpi('Mediana', '—');
    return;
  }
  const med = median(prices), lo = prices[0], hi = prices[n-1];
  const p25 = pct(prices,.25), p75 = pct(prices,.75);
  $('#kpis').innerHTML =
    kpi('Estaciones', n.toLocaleString('es-ES')) +
    kpi('Mediana', fmt3(med), '€/L') +
    kpi('Mínimo', fmt3(lo), '€/L') +
    kpi('Máximo', fmt3(hi), '€/L') +
    kpi('Amplitud', fmt2(hi - lo), '€/L') +
    kpi('Depósito 50 L', fmt2((hi - lo) * 50), '€ de diferencia') +
    `<div class="kpi"><div class="v" style="font-size:14px;font-weight:600">p25 ${fmt3(p25)} · p75 ${fmt3(p75)}</div><div class="k">rango intercuartílico</div></div>`;
}

/* ------------------------------------------------------------------ mapa */
function sizeCanvas() {
  const cv = $('#map'), hold = $('#map-hold');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = hold.clientWidth, h = cv.clientHeight || 420;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

function makeProj(bbox, box) {
  const [lo0, la0, lo1, la1] = bbox;
  const kx = Math.cos(((la0 + la1) / 2) * Math.PI / 180);
  const spanX = (lo1 - lo0) * kx, spanY = (la1 - la0);
  const s = Math.min(box.w / spanX, box.h / spanY) * .95;
  const ox = box.x + (box.w - spanX * s) / 2, oy = box.y + (box.h - spanY * s) / 2;
  return { lo0, la0, kx, s, ox, oy, box,
           x: lon => ox + (lon - lo0) * kx * s,
           y: lat => oy + (la1 - lat) * s };
}

function layout(w, h) {
  const mainBox = { x: 8, y: 8, w: Math.max(140, w * .775 - 14), h: h - 16 };
  const ch = Math.max(78, Math.min(150, h * .30));
  const canBox = { x: w * .775 + 6, y: h - ch - 10, w: Math.max(90, w * .225 - 16), h: ch };
  projMain = makeProj([-9.9, 35.05, 4.6, 43.95], mainBox);
  projCan  = makeProj([-18.45, 27.45, -13.15, 29.65], canBox);
  panelMain = mainBox; panelCan = canBox;
}

const mapPt = (p, lat, lon, zoom) => {
  const x = p.x(lon), y = p.y(lat);
  return zoom ? [x * mapView.k + mapView.tx, y * mapView.k + mapView.ty] : [x, y];
};

function drawMap() {
  const cv = $('#map'); if (!cv || !DATA) return;
  const { w, h } = sizeCanvas();
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  layout(w, h);

  const k = mapView.k, tx = mapView.tx, ty = mapView.ty;
  const activeCode = S.prov ? PROVCODE[DATA.provincias.indexOf(S.prov)] : null;
  const drawPanel = (proj, zoom) => {
    /* contornos provinciales */
    ctx.lineWidth = 1;
    for (const pv of GEO) {
      const activa = activeCode && pv.c === activeCode;
      ctx.beginPath();
      for (const ring of pv.r) {
        for (let i = 0; i < ring.length; i += 2) {
          const [x, y] = mapPt(proj, ring[i + 1], ring[i], zoom);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
      ctx.fillStyle = 'rgba(255,255,255,.035)';
      ctx.fill();
      ctx.strokeStyle = activa ? 'rgba(56,189,248,.85)' : 'rgba(255,255,255,.13)';
      ctx.lineWidth = activa ? 1.6 : 1;
      ctx.stroke();
    }
  };
  drawPanel(projMain, true);
  drawPanel(projCan, false);

  /* puntos: agrupados por color para pintar rápido.
     El color es la posición relativa (percentil) dentro de la selección:
     así el mapa muestra estructura geográfica en vez de un bloque naranja. */
  const nb = 24, buckets = Array.from({ length: nb }, () => []);
  for (const st of S.view) {
    const t = cdfT(price(st));
    const b = Math.max(0, Math.min(nb - 1, Math.floor(t * nb)));
    buckets[b].push(st);
  }
  const zoomR = Math.min(1.55, Math.pow(k, .35));
  for (let b = 0; b < nb; b++) {
    const arr = buckets[b]; if (!arr.length) continue;
    ctx.fillStyle = ramp((b + .5) / nb);
    ctx.globalAlpha = .88;
    for (const st of arr) {
      const [x, y] = CAN[st.__i] ? mapPt(projCan, st[F.LAT], st[F.LON], false)
                                 : mapPt(projMain, st[F.LAT], st[F.LON], true);
      const r = (CAN[st.__i] ? 1.9 : 2.5) * (CAN[st.__i] ? 1 : zoomR);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* estaciones destacadas (dispersión municipal) */
  if (S.focus) {
    S.focus.forEach((st, i) => {
      if (!st) return;
      const can = CAN[st.__i];
      const [x, y] = mapPt(can ? projCan : projMain, st[F.LAT], st[F.LON], !can);
      ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.2832);
      ctx.strokeStyle = i === 0 ? '#2dd4a7' : '#fb7185';
      ctx.lineWidth = 2.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.2832);
      ctx.fillStyle = i === 0 ? '#2dd4a7' : '#fb7185'; ctx.fill();
    });
  }
  if (S.sel) {
    const can = CAN[S.sel.__i];
    const [x, y] = mapPt(can ? projCan : projMain, S.sel[F.LAT], S.sel[F.LON], !can);
    ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.2832);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  }

  /* etiquetas de panel */
  ctx.fillStyle = 'rgba(159,176,204,.85)';
  ctx.font = '600 11px "Segoe UI",system-ui,sans-serif';
  ctx.fillText('Península, Baleares, Ceuta y Melilla', panelMain.x + 4, panelMain.y + 12);
  ctx.fillText('Canarias', panelCan.x + 2, panelCan.y + 11);
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.strokeRect(panelCan.x, panelCan.y, panelCan.w, panelCan.h);

  /* índice para el hit-test */
  screenPts = [];
  for (const st of S.view) {
    const can = CAN[st.__i];
    const [x, y] = mapPt(can ? projCan : projMain, st[F.LAT], st[F.LON], !can);
    screenPts.push({ x, y, st, can });
  }
}

/* ---------------------------------------------------------- interacción mapa */
function hitTest(px, py) {
  let best = null, bd = 12 * 12;
  for (const p of screenPts) {
    const dx = p.x - px, dy = p.y - py, d = dx*dx + dy*dy;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function tooltipHTML(st) {
  const d = distOf(st);
  const p = price(st);
  const otras = DATA.combustibles
    .map((c, i) => ({ c, v: st[F.PR][i] }))
    .filter(o => o.v && o.c.key !== DATA.combustibles[S.fuel].key)
    .slice(0, 3)
    .map(o => `<div class="r">${o.c.label}: <b>${fmt3(o.v)}</b></div>`).join('');
  return `<div class="p">${eur(p)}/L · ${esc(DATA.combustibles[S.fuel].label)}</div>
    <div><b>${esc(DATA.marcas[st[F.BR]] === 'Independiente (sin marca)' ? st[F.ROT] : DATA.marcas[st[F.BR]])}</b></div>
    <div class="r">${esc(st[F.ADDR])}</div>
    <div class="r">${esc(st[F.CP])} ${esc(DATA.municipios[st[F.MUNI]])} (${esc(DATA.provincias[st[F.PROV]])})</div>
    <div class="r">${st[F.D24] ? '🕐 Abierta 24 h' : '🕐 ' + esc(st[F.HORA] || 'horario no indicado')}</div>
    ${otras}${d !== null ? `<div class="r">a ${d.toFixed(1)} km de ti</div>` : ''}`;
}

function showDetail(st) {
  const box = $('#detail'); if (!st) { box.hidden = true; return; }
  const filas = DATA.combustibles.map((c, i) =>
    st[F.PR][i] ? `<tr><td>${c.label}</td><td>${eur(st[F.PR][i])}</td></tr>` : '').join('');
  const d = distOf(st);
  box.hidden = false;
  box.innerHTML = `<button class="x" title="Cerrar">×</button>
    <h3>${esc(DATA.marcas[st[F.BR]] === 'Independiente (sin marca)' ? st[F.ROT] : DATA.marcas[st[F.BR]])}</h3>
    <div class="muted">${esc(st[F.ADDR])} · ${esc(st[F.CP])} ${esc(DATA.municipios[st[F.MUNI]])} (${esc(DATA.provincias[st[F.PROV]])})</div>
    <div class="muted">${st[F.D24] ? 'Abierta 24 h' : esc(st[F.HORA] || '—')}${d !== null ? ` · a ${d.toFixed(1)} km` : ''}</div>
    <table>${filas}</table>`;
  $('.x', box).onclick = () => { S.sel = null; box.hidden = true; drawMap(); };
}

function focusStation(st, zoomTo) {
  S.sel = st;
  if (zoomTo && !CAN[st.__i]) {
    mapView.k = Math.max(3.2, mapView.k);
    const cx = panelMain.x + panelMain.w / 2, cy = panelMain.y + panelMain.h / 2;
    mapView.tx = cx - projMain.x(st[F.LON]) * mapView.k;
    mapView.ty = cy - projMain.y(st[F.LAT]) * mapView.k;
    clampView();
  }
  drawMap(); showDetail(st);
  $('#map-hold').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clampView() {
  const bx = panelMain.x, by = panelMain.y, w = panelMain.w, h = panelMain.h, k = mapView.k;
  if (k <= 1.001) { mapView.k = 1; mapView.tx = 0; mapView.ty = 0; return; }
  const loX = (bx + w) * (1 - k), hiX = bx * (1 - k);
  const loY = (by + h) * (1 - k), hiY = by * (1 - k);
  mapView.tx = Math.max(loX, Math.min(hiX, mapView.tx));
  mapView.ty = Math.max(loY, Math.min(hiY, mapView.ty));
}

/* ------------------------------------------------------------ histograma */
function drawHist() {
  const svg = $('#hist'); if (!DATA) return;
  const W = Math.max(260, Math.round(svg.clientWidth || (svg.parentElement.clientWidth - 32) || 600));
  const H = 210, pad = { l: 46, r: 16, t: 16, b: 28 };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W); svg.setAttribute('height', H);

  const a = S.sorted;
  /* el eje se ajusta a la selección; solo se recorta si hay colas muy extremas */
  let lo0 = dom.lo, hi0 = dom.hi, recortado = 0;
  if (a.length) {
    lo0 = a[0]; hi0 = a[a.length - 1];
    const p1 = pct(a, .01), p99 = pct(a, .99);
    if (hi0 - lo0 > 4 * Math.max(1, p99 - p1)) {
      lo0 = Math.floor(p1); hi0 = Math.ceil(p99);
      recortado = a.filter(v => v < lo0 || v > hi0).length;
    }
  }
  if (hi0 <= lo0) hi0 = lo0 + 1;
  const range = hi0 - lo0;
  const nb = Math.max(16, Math.min(60, Math.round(range / 5)));
  const step = range / nb;
  const counts = new Array(nb).fill(0);
  for (const p of a) {
    const b = Math.max(0, Math.min(nb - 1, Math.floor((p - lo0) / step)));
    counts[b]++;
  }
  const maxC = Math.max(1, ...counts);
  const capOn = S.maxC < dom.hi;          // el tope solo existe si es menor que el máximo del combustible
  const x = i => pad.l + (i / nb) * (W - pad.l - pad.r);
  const bw = (W - pad.l - pad.r) / nb;
  const y = c => H - pad.b - (c / maxC) * (H - pad.t - pad.b);
  let s = '';
  if (capOn) {
    const xCut = x(Math.max(0, Math.min(nb, (S.maxC - lo0) / step)));
    s += `<rect class="cut-band" x="${xCut.toFixed(1)}" y="${pad.t}" width="${Math.max(0, W - pad.r - xCut).toFixed(1)}" height="${H - pad.t - pad.b}"/>`;
  }
  counts.forEach((c, i) => {
    if (!c) return;
    const hi = lo0 + (i + 1) * step, lo = lo0 + i * step;
    const out = capOn && hi > S.maxC ? ' out' : '';
    s += `<rect class="bar${out}" x="${(x(i) + .6).toFixed(1)}" y="${y(c).toFixed(1)}" width="${(bw - 1.2).toFixed(1)}" height="${(H - pad.b - y(c)).toFixed(1)}" data-hi="${hi}"><title>${fmt3(lo)} – ${fmt3(hi)} €/L · ${c} estaciones</title></rect>`;
  });
  const ticks = 6;
  for (let t = 0; t <= ticks; t++) {
    const v = lo0 + (t / ticks) * range, xx = pad.l + (t / ticks) * (W - pad.l - pad.r);
    s += `<line class="hgrid" x1="${xx.toFixed(1)}" y1="${pad.t}" x2="${xx.toFixed(1)}" y2="${H - pad.b}"/>`;
    s += `<text class="hax" x="${xx.toFixed(1)}" y="${H - pad.b + 15}" text-anchor="middle">${fmt2(v)}</text>`;
  }
  s += `<text class="hax" x="${pad.l}" y="${H - 4}" text-anchor="start">€/L</text>`;
  s += `<text class="hax" x="${pad.l - 6}" y="${pad.t + 8}" text-anchor="end">${maxC}</text>`;
  s += `<text class="hax" x="${pad.l - 6}" y="${H - pad.b}" text-anchor="end">0</text>`;
  if (a.length) {
    const med = median(a), mean = a.reduce((p, q) => p + q, 0) / a.length;
    const mx = v => pad.l + ((v - lo0) / range) * (W - pad.l - pad.r);
    if (med > lo0 && med < hi0)
      s += `<line class="hline med" x1="${mx(med)}" y1="${pad.t}" x2="${mx(med)}" y2="${H - pad.b}"/>
            <text class="hlab med" x="${mx(med) + 4}" y="${pad.t + 11}">mediana ${fmt3(med)}</text>`;
    if (mean > lo0 && mean < hi0)
      s += `<line class="hline mean" x1="${mx(mean)}" y1="${pad.t + 15}" x2="${mx(mean)}" y2="${H - pad.b}"/>
            <text class="hlab mean" x="${mx(mean) + 4}" y="${pad.t + 26}">media ${fmt3(mean)}</text>`;
  }
  if (capOn) {
    const mx = pad.l + ((S.maxC - lo0) / range) * (W - pad.l - pad.r);
    s += `<line class="hline cut" x1="${mx}" y1="${pad.t}" x2="${mx}" y2="${H - pad.b}"/>
          <text class="hlab cut" x="${mx - 4}" y="${H - pad.b - 6}" text-anchor="end">tope ${fmt3(S.maxC)}</text>`;
  }
  if (!a.length) s += `<text class="hax" x="${W/2}" y="${H/2}" text-anchor="middle">Sin estaciones con estos filtros</text>`;
  svg.innerHTML = s;
  $('#hist-note').textContent = recortado ? `· eje recortado (${recortado} estaciones en los extremos fuera de escala)` : '';
  $$('.bar', svg).forEach(r => r.addEventListener('click', () => {
    const hi = Number(r.dataset.hi);
    S.maxC = Math.abs(hi - S.maxC) < 1.5 ? dom.hi : Math.round(hi);
    $('#f-max').value = S.maxC;
    $('#lbl-max').textContent = S.maxC >= dom.hi ? 'sin tope' : '≤ ' + fmt3(S.maxC) + ' €/L';
    render();
  }));
}

/* ------------------------------------------------------- rankings y listas */
/* mediana redondeada a la milésima: así el orden coincide con el número que se muestra */
const med3 = arr => Math.round(median(arr) * 1000) / 1000;

function barList(items, opts = {}) {
  if (!items.length) return `<p class="empty">Sin datos con estos filtros.</p>`;
  const vals = items.map(d => d.v);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const norm01 = v => (hi - lo < 1e-9 ? .5 : (v - lo) / (hi - lo));
  return items.map(d => {
    const t = norm01(d.v);
    const col = ramp(t);
    return `<div class="row${d.sel ? ' sel' : ''}" data-k="${esc(d.k)}" data-kind="${opts.kind || ''}">
      <div class="nm"><span class="t">${esc(d.label)}</span><i>${d.n !== undefined ? d.n + ' EESS' : ''}</i></div>
      <div class="vl" style="color:${col}">${fmt3(d.v)}</div>
      <div class="track"><div class="fill" style="width:${(6 + 94 * t).toFixed(1)}%;background:${col}"></div></div>
    </div>`;
  }).join('');
}

function drawRank() {
  /* el ranking es contexto: ignora el filtro de su propia dimensión para poder comparar */
  const v = currentView(S.rankGroup === 'prov' ? 'prov' : 'ccaa');
  const key = S.rankGroup === 'prov'
    ? st => DATA.provincias[st[F.PROV]]
    : st => DATA.ccaas[st[F.CCAA]];
  const act = S.rankGroup === 'prov' ? S.prov : S.ccaa;
  const groups = new Map();
  for (const st of v) {
    const k = key(st);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(price(st));
  }
  let items = [...groups.entries()]
    .filter(([, a]) => a.length >= (S.rankGroup === 'prov' ? 8 : 20))
    .map(([k, a]) => { const s = a.sort((x, y) => x - y); return { k, label: k, v: med3(s), n: a.length, sel: k === act }; });
  items.sort((a, b) => a.v - b.v);
  if (S.rankSide === 'caras') items.reverse();
  const todos = items;
  items = items.slice(0, 12);
  /* si la provincia/comunidad filtrada no está en el top, se añade al final */
  if (act && !items.some(d => d.sel)) {
    const m = todos.find(d => d.sel);
    if (m) items.push(m);
  }
  $('#rank').innerHTML = barList(items, { kind: S.rankGroup })
    + `<p class="hint" style="margin:8px 0 0">Mediana de ${esc(DATA.combustibles[S.fuel].label)} · ${v.length.toLocaleString('es-ES')} estaciones${act ? ` · ${esc(act)} resaltada` : ''}</p>`;
  $$('#rank .row').forEach(r => r.onclick = () => {
    if (S.rankGroup === 'prov') { S.prov = S.prov === r.dataset.k ? '' : r.dataset.k; $('#f-prov').value = S.prov; }
    else { S.ccaa = S.ccaa === r.dataset.k ? '' : r.dataset.k; $('#f-ccaa').value = S.ccaa; }
    render();
  });
}

function drawBrands() {
  const groups = new Map();
  for (const st of S.view) {
    const k = DATA.marcas[st[F.BR]];
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(price(st));
  }
  let items = [...groups.entries()].filter(([, a]) => a.length >= 15)
    .map(([k, a]) => ({ k, label: k, v: med3(a.sort((x, y) => x - y)), n: a.length }));
  items.sort((a, b) => a.v - b.v);
  $('#brands').innerHTML = items.length ? barList(items, { kind: 'marca' })
    : `<p class="empty">Ninguna marca llega a 15 estaciones con estos filtros.</p>`;
  $$('#brands .row').forEach(r => r.onclick = () => {
    S.marca = S.marca === r.dataset.k ? '' : r.dataset.k;
    $('#f-marca').value = S.marca; render();
  });
}

function drawDisp() {
  const g = new Map();
  for (const st of S.view) {
    const k = DATA.municipios[st[F.MUNI]] + '|' + DATA.provincias[st[F.PROV]];
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(st);
  }
  const items = [...g.values()].filter(a => a.length >= 4).map(a => {
    const arr = [...a].sort((x, y) => price(x) - price(y));
    const lo = arr[0], hi = arr[arr.length - 1];
    return { muni: DATA.municipios[lo[F.MUNI]], prov: DATA.provincias[lo[F.PROV]], n: a.length,
             lo, hi, gap: price(hi) - price(lo) };
  }).sort((x, y) => y.gap - x.gap).slice(0, 6);

  $('#disp').innerHTML = items.length ? items.map((d, i) => `
    <div class="disp-item" data-i="${i}">
      <div class="disp-top"><b>${esc(d.muni)} <span class="muted">(${esc(d.prov)})</span></b>
        <span class="disp-gap">+${fmt3(d.gap)} €/L</span></div>
      <div class="disp-lines">
        <span class="b">▾ ${eur(price(d.lo))} · ${esc(nombre(d.lo))} — ${esc(d.lo[F.ADDR])}</span>
        <span class="c">▴ ${eur(price(d.hi))} · ${esc(nombre(d.hi))} — ${esc(d.hi[F.ADDR])}</span>
        <span class="muted">${d.n} estaciones · ${fmt2(d.gap * 50)} € de diferencia en un depósito de 50 L</span>
      </div>
    </div>`).join('') : `<p class="empty">Sin municipios con 4 o más estaciones en la selección.</p>`;
  $$('#disp .disp-item').forEach(el => el.onclick = () => {
    const d = items[+el.dataset.i];
    S.focus = [d.lo, d.hi];
    focusStation(d.lo, true);
    drawMap();
  });
}

const nombre = st => DATA.marcas[st[F.BR]] === 'Independiente (sin marca)' ? st[F.ROT] : DATA.marcas[st[F.BR]];

function drawTabla() {
  let arr = [...S.view];
  if (S.sort === 'precio') arr.sort((a, b) => price(a) - price(b));
  else if (S.sort === 'caras') arr.sort((a, b) => price(b) - price(a));
  else if (S.sort === 'cerca' && S.pos) arr.sort((a, b) => distOf(a) - distOf(b));
  else arr.sort((a, b) => price(a) - price(b));
  const total = arr.length, shown = arr.slice(0, 120);
  const rows = shown.map((st, i) => {
    const d = distOf(st);
    return `<tr>
      <td class="muted">${i + 1}</td>
      <td class="num">${eur(price(st))}</td>
      <td>${esc(nombre(st))}</td>
      <td>${esc(st[F.ADDR])}</td>
      <td>${esc(DATA.municipios[st[F.MUNI]])}<div class="muted">${esc(DATA.provincias[st[F.PROV]])}</div></td>
      <td>${st[F.D24] ? '<span class="pill g">24 h</span>' : `<span class="pill">${esc((st[F.HORA] || '—').slice(0, 26))}</span>`}</td>
      ${S.pos ? `<td class="num">${d.toFixed(1)} km</td>` : ''}
      <td class="ver"><button class="linkmap" data-id="${st[F.ID]}">ver</button></td>
    </tr>`;
  }).join('');
  $('#tabla').innerHTML = `<table class="data"><thead><tr>
      <th>#</th><th>Precio</th><th>Rótulo</th><th>Dirección</th><th>Municipio</th><th>Horario</th>
      ${S.pos ? '<th>Distancia</th>' : ''}<th class="ver"></th></tr></thead><tbody>${rows}</tbody></table>
      ${total > 120 ? `<p class="tbl-note">Mostrando 120 de ${total.toLocaleString('es-ES')} estaciones. Afina los filtros para ver el resto.</p>` : ''}`;
  $$('#tabla .linkmap').forEach(b => b.onclick = () => {
    const st = S.view.find(s => String(s[F.ID]) === b.dataset.id);
    if (st) focusStation(st, true);
  });
  $('#tabla-titulo').textContent = S.sort === 'caras' ? 'Las más caras de la selección'
    : S.sort === 'cerca' ? 'Las más cercanas a tu posición' : 'Las más baratas de la selección';
}

/* -------------------------------------------------------------- hallazgos */
function drawInsights() {
  const v = S.view, out = [];
  const card = (tipo, titulo, txt) => out.push(`<div class="ins ${tipo}"><h3>${titulo}</h3><p>${txt}</p></div>`);
  if (v.length < 5) {
    $('#insights').innerHTML = `<p class="empty">Selecciona más estaciones para ver conclusiones.</p>`;
    $('#insights-hint').textContent = '';
    return;
  }
  const fuelLbl = DATA.combustibles[S.fuel].label;
  const prices = v.map(price).sort((a, b) => a - b);
  const lo = prices[0], hi = prices[prices.length - 1], med = median(prices);
  const stLo = v.reduce((a, b) => price(b) < price(a) ? b : a);
  const stHi = v.reduce((a, b) => price(b) > price(a) ? b : a);

  card('good', 'La más barata', `${eur(lo)}/L en <b>${esc(nombre(stLo))}</b> — ${esc(stLo[F.ADDR])}, ${esc(DATA.municipios[stLo[F.MUNI]])} (${esc(DATA.provincias[stLo[F.PROV]])}).`);
  card('bad', 'La más cara', `${eur(hi)}/L en <b>${esc(nombre(stHi))}</b> — ${esc(DATA.municipios[stHi[F.MUNI]])} (${esc(DATA.provincias[stHi[F.PROV]])}). Es un <b>${(((hi/lo)-1)*100).toFixed(1)} %</b> más cara: <b>${fmt2((hi-lo)*50)} €</b> de más en un depósito de 50 litros.`);

  /* dispersión municipal */
  const g = new Map();
  for (const st of v) {
    const k = DATA.municipios[st[F.MUNI]] + '|' + DATA.provincias[st[F.PROV]];
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(st);
  }
  const gaps = [...g.values()].filter(a => a.length >= 4).map(a => {
    const p = a.map(price).sort((x,y)=>x-y);
    return { a, gap: p[p.length-1] - p[0], muni: DATA.municipios[a[0][F.MUNI]], prov: DATA.provincias[a[0][F.PROV]] };
  }).sort((x, y) => y.gap - x.gap);
  if (gaps.length) {
    const t = gaps[0];
    const media = gaps.reduce((s, d) => s + d.gap, 0) / gaps.length;
    card('warn', 'Mismo municipio, precios distintos',
      `En <b>${esc(t.muni)} (${esc(t.prov)})</b> la diferencia entre la estación más cara y la más barata es de <b>${fmt3(t.gap)} €/L</b> (${fmt2(t.gap*50)} € por depósito). Entre los ${gaps.length} municipios con 4+ estaciones, la brecha media es de ${fmt3(media)} €/L.`);
  }
  /* zonas */
  const zg = new Map();
  for (const st of v) {
    const z = zonaOf(st);
    if (!zg.has(z)) zg.set(z, []);
    zg.get(z).push(price(st));
  }
  const zi = [...zg.entries()].filter(([, a]) => a.length >= 20)
    .map(([z, a]) => ({ z, v: median(a.sort((x,y)=>x-y)) })).sort((a, b) => a.v - b.v);
  if (zi.length >= 2) {
    const a = zi[0], b = zi[zi.length - 1];
    card('', 'Geografía del precio',
      `<b>${esc(a.z)}</b> es la zona más barata de la selección (mediana ${fmt3(a.v)} €/L) y <b>${esc(b.z)}</b> la más cara (${fmt3(b.v)} €/L): <b>${fmt3(b.v - a.v)} €/L</b> de diferencia (${fmt2((b.v-a.v)*50)} € por depósito de 50 L).`);
  }
  /* 24 h */
  const si = v.filter(s => s[F.D24]).map(price), no = v.filter(s => !s[F.D24]).map(price);
  if (si.length >= 20 && no.length >= 20) {
    const m1 = median(si.sort((a,b)=>a-b)), m2 = median(no.sort((a,b)=>a-b));
    const d = m1 - m2;
    card(d < 0 ? 'good' : 'warn', '¿Abrir 24 h sale más caro?',
      `Las ${si.length.toLocaleString('es-ES')} estaciones abiertas 24 h tienen una mediana de <b>${fmt3(m1)} €/L</b>, frente a <b>${fmt3(m2)} €/L</b> de las ${no.length.toLocaleString('es-ES')} con horario limitado: ${d < 0 ? '<b>' + fmt3(-d) + ' €/L más baratas</b>' : '<b>' + fmt3(d) + ' €/L más caras</b>'}.`);
  }
  /* diésel vs gasolina */
  const par = v.filter(s => s[F.PR][I_G95] && s[F.PR][I_GA]);
  if (par.length >= 20) {
    const iG = I_G95, iD = I_GA;
    const masCaro = par.filter(s => s[F.PR][iD] > s[F.PR][iG]).length;
    const dif = par.reduce((a, s) => a + (s[F.PR][iD] - s[F.PR][iG]), 0) / par.length;
    card('', 'Diésel frente a gasolina 95',
      `En el <b>${(100*masCaro/par.length).toFixed(1)} %</b> de las ${par.length.toLocaleString('es-ES')} estaciones con ambos precios el diésel es <b>más caro</b> que la gasolina 95. De media el diésel está ${dif < 0 ? fmt3(-dif) + ' €/L por debajo' : fmt3(dif) + ' €/L por encima'} de la gasolina.`);
  }
  /* marcas */
  const bg = new Map();
  for (const st of v) {
    const k = DATA.marcas[st[F.BR]];
    if (!bg.has(k)) bg.set(k, []);
    bg.get(k).push(price(st));
  }
  const bi = [...bg.entries()].filter(([, a]) => a.length >= 15)
    .map(([k, a]) => ({ k, v: median(a.sort((x,y)=>x-y)), n: a.length })).sort((a, b) => a.v - b.v);
  if (bi.length >= 2) {
    const a = bi[0], b = bi[bi.length - 1];
    card('', 'Marcas: del más barato al más caro',
      `<b>${esc(a.k)}</b> (${a.n} EESS) marca la mediana más baja con <b>${fmt3(a.v)} €/L</b>; <b>${esc(b.k)}</b> (${b.n} EESS) la más alta con ${fmt3(b.v)} €/L. Ojo: parte de la diferencia es geográfica, no solo de marca.`);
  }
  /* cuartiles */
  const p25 = pct(prices, .25), p75 = pct(prices, .75);
  card('', 'Dónde está el ahorro',
    `La mitad central del mercado está entre <b>${fmt3(p25)}</b> y <b>${fmt3(p75)} €/L</b>. Bajar del percentil 25 (${fmt3(p25)}) ya te pone en el cuarto más barato: ahorras ${fmt2((med - p25) * 50)} € por depósito respecto a la mediana.`);
  $('#insights').innerHTML = out.join('');
  $('#insights-hint').textContent = `Calculado sobre ${v.length.toLocaleString('es-ES')} estaciones · ${fuelLbl}`;
}

/* ------------------------------------------------------ leyenda de color */
/* posición relativa de un precio dentro de la selección actual (0 = más barata, 1 = más cara) */
function cdfT(c) {
  const a = S.sorted || [];
  const n = a.length;
  if (n < 2 || a[0] === a[n - 1]) return .5;
  let lo = 0, hi = n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= c) lo = m + 1; else hi = m; }
  return Math.max(0, Math.min(1, (lo - 1) / (n - 1)));
}

function paintScaleLegend() {
  const cv = $('#scale-canvas'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < w; i++) { ctx.fillStyle = ramp(i / (w - 1)); ctx.fillRect(i, 0, 1, h); }
  const a = S.sorted || [];
  const ticks = [0, .25, .5, .75, 1];
  $('#scale-labels').innerHTML = a.length
    ? ticks.map(t => `<span>${fmt2(a[Math.round(t * (a.length - 1))])}</span>`).join('')
    : '<span>—</span>';
  $('#legend-note').innerHTML = a.length
    ? `Color = posición relativa de cada estación dentro de la selección (de la más barata a la más cara, ${a.length.toLocaleString('es-ES')} puntos). Los números son el precio en €/L en cada tramo.`
    : 'Sin estaciones en la selección.';
}

/* ------------------------------------------------------- estado en la URL */
function readHash() {
  const h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  if (!h.toString()) return false;
  const f = h.get('fuel');
  if (f !== null && DATA.combustibles[+f]) S.fuel = +f;
  S.zona = h.get('zona') || '';   S.ccaa = h.get('ccaa') || '';
  S.prov = h.get('prov') || '';   S.marca = h.get('marca') || '';
  S.q = h.get('q') || '';         S.d24 = h.get('d24') === '1';
  if (h.get('sort')) S.sort = h.get('sort');
  return true;
}
function writeHash() {
  const p = new URLSearchParams();
  if (S.fuel) p.set('fuel', S.fuel);
  if (S.zona) p.set('zona', S.zona);
  if (S.ccaa) p.set('ccaa', S.ccaa);
  if (S.prov) p.set('prov', S.prov);
  if (S.marca) p.set('marca', S.marca);
  if (S.d24) p.set('d24', '1');
  if (S.q) p.set('q', S.q);
  if (S.sort !== 'precio') p.set('sort', S.sort);
  const s = p.toString();
  history.replaceState(null, '', location.pathname + (s ? '#' + s : ''));
}
function syncControls() {
  $('#f-fuel').value = S.fuel;
  $('#f-zona').value = S.zona;
  $('#f-ccaa').value = S.ccaa;
  $('#f-prov').value = S.prov;
  $('#f-marca').value = S.marca;
  $('#f-24').checked = S.d24;
  $('#f-q').value = S.q;
  $$('#tabla-tabs .tab').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sort === S.sort)));
  $$('#rank-tabs .tab').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.g === S.rankGroup)));
  $$('#rank-side .tab').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.s === S.rankSide)));
}

/* ------------------------------------------------------------- render all */
function render() {
  S.view = currentView();
  S.sorted = S.view.map(price).sort((a, b) => a - b);
  drawKpis(); drawMap(); drawHist(); drawRank(); drawBrands(); drawDisp(); drawTabla(); drawInsights();
  paintScaleLegend();
  writeHash();
  if ($('#detail').hidden) S.sel = null;
}

/* ---------------------------------------------------------------- eventos */
function bindEvents() {
  $('#f-fuel').onchange = e => { S.fuel = +e.target.value; setFuelDomain(); S.focus = null; render(); };
  $('#f-zona').onchange = e => { S.zona = e.target.value; render(); };
  $('#f-ccaa').onchange = e => {
    S.ccaa = e.target.value;
    if (S.ccaa) {
      const ok = DATA.estaciones.some(s => DATA.ccaas[s[F.CCAA]] === S.ccaa && (!S.prov || DATA.provincias[s[F.PROV]] === S.prov));
      if (!ok) { S.prov = ''; $('#f-prov').value = ''; }
    }
    render();
  };
  $('#f-prov').onchange = e => {
    S.prov = e.target.value;
    if (S.prov) {
      const st = DATA.estaciones.find(s => DATA.provincias[s[F.PROV]] === S.prov);
      if (st) { S.ccaa = DATA.ccaas[st[F.CCAA]]; $('#f-ccaa').value = S.ccaa; }
    }
    render();
  };
  $('#f-marca').onchange = e => { S.marca = e.target.value; render(); };
  $('#f-24').onchange = e => { S.d24 = e.target.checked; render(); };
  let t = null;
  $('#f-q').oninput = e => { S.q = e.target.value; clearTimeout(t); t = setTimeout(render, 160); };
  $('#f-max').oninput = e => {
    S.maxC = +e.target.value;
    $('#lbl-max').textContent = S.maxC >= dom.hi ? 'sin tope' : '≤ ' + fmt3(S.maxC) + ' €/L';
    render();
  };
  $('#btn-reset').onclick = () => {
    Object.assign(S, { zona:'', ccaa:'', prov:'', marca:'', d24:false, q:'', sort:'precio', focus:null, sel:null });
    $('#detail').hidden = true;
    $('#f-max').value = dom.hi; S.maxC = dom.hi; $('#lbl-max').textContent = 'sin tope';
    mapView.k = 1; mapView.tx = 0; mapView.ty = 0;
    syncControls();
    render();
  };
  $('#btn-geo').onclick = () => {
    if (!navigator.geolocation) { $('#map-hint').textContent = 'Tu navegador no soporta geolocalización.'; return; }
    $('#btn-geo').textContent = '📍 Localizando…';
    navigator.geolocation.getCurrentPosition(p => {
      S.pos = { lat: p.coords.latitude, lon: p.coords.longitude };
      $('#btn-geo').textContent = '📍 Cerca de mí';
      $('#btn-geo').classList.add('on');
      S.sort = 'cerca';
      $$('#tabla-tabs .tab').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sort === 'cerca')));
      $('#map-hint').textContent = `Posición detectada (${S.pos.lat.toFixed(3)}, ${S.pos.lon.toFixed(3)}): la tabla se ordena por distancia.`;
      render();
    }, err => {
      $('#btn-geo').textContent = '📍 Cerca de mí';
      $('#map-hint').textContent = 'No se pudo obtener tu ubicación (' + err.message + '). Puedes seguir usando los filtros.';
    }, { timeout: 8000 });
  };
  $$('#rank-tabs .tab').forEach(b => b.onclick = () => {
    S.rankGroup = b.dataset.g;
    $$('#rank-tabs .tab').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    drawRank();
  });
  $$('#rank-side .tab').forEach(b => b.onclick = () => {
    S.rankSide = b.dataset.s;
    $$('#rank-side .tab').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    drawRank();
  });
  $$('#tabla-tabs .tab').forEach(b => b.onclick = () => {
    S.sort = b.dataset.sort;
    $$('#tabla-tabs .tab').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    drawTabla();
  });

  /* mapa: zoom, paneo, tooltip */
  const cv = $('#map'), hold = $('#map-hold'), tip = $('#tip');
  let drag = null;
  cv.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, tx: mapView.tx, ty: mapView.ty, moved: false };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      mapView.tx = drag.tx + dx; mapView.ty = drag.ty + dy;
      clampView(); drawMap();
      tip.hidden = true;
      return;
    }
    const h = hitTest(px, py);
    if (h) {
      tip.hidden = false;
      tip.innerHTML = tooltipHTML(h.st);
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.min(hold.clientWidth - tw - 8, Math.max(4, px + 14)) + 'px';
      tip.style.top = Math.min(hold.clientHeight - th - 8, Math.max(4, py + 14)) + 'px';
      cv.style.cursor = 'pointer';
    } else { tip.hidden = true; cv.style.cursor = 'crosshair'; }
  });
  cv.addEventListener('pointerup', e => {
    const wasDrag = drag && drag.moved;
    drag = null;
    if (wasDrag) return;
    const r = cv.getBoundingClientRect();
    const h = hitTest(e.clientX - r.left, e.clientY - r.top);
    if (h) { S.focus = null; focusStation(h.st, false); } else { $('#detail').hidden = true; S.sel = null; drawMap(); }
  });
  cv.addEventListener('pointerleave', () => { tip.hidden = true; drag = null; });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    if (mx > panelMain.x + panelMain.w) return;             // sobre el recuadro de Canarias
    const k2 = Math.max(1, Math.min(14, mapView.k * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
    const f = k2 / mapView.k;
    mapView.tx = mx - (mx - mapView.tx) * f;
    mapView.ty = my - (my - mapView.ty) * f;
    mapView.k = k2; clampView(); drawMap();
  }, { passive: false });
  cv.addEventListener('dblclick', () => { mapView.k = 1; mapView.tx = 0; mapView.ty = 0; drawMap(); });
  $('#z-in').onclick  = () => { mapView.k = Math.min(14, mapView.k * 1.3); clampView(); drawMap(); };
  $('#z-out').onclick = () => { mapView.k = Math.max(1, mapView.k / 1.3); clampView(); drawMap(); };
  $('#z-reset').onclick = () => { mapView.k = 1; mapView.tx = 0; mapView.ty = 0; drawMap(); };
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { $('#detail').hidden = true; S.sel = null; S.focus = null; drawMap(); }
  });
}

init().catch(err => {
  document.body.insertAdjacentHTML('afterbegin',
    `<pre style="background:#3b0d16;color:#ffd7de;padding:14px;margin:0;white-space:pre-wrap">Error cargando los datos: ${esc(err.message)}</pre>`);
  console.error(err);
});

/* API mínima de la app (útil para pruebas automatizadas y para depurar) */
window.__app = { S, price, focusStation, drawMap, render, currentView, DATA: () => DATA };

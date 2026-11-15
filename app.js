'use strict';
/* Nacht im Finsterwald – Werwolf-Spielleiter. Läuft komplett im Browser, ohne Server. */

// ---------- kleine Helfer ----------
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  const keep = props && /\b(roleicon|badge|em|iconbtn)\b/.test(props.class || '');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(keep ? String(kid) : String(kid).replace(DECO, '')));
  }
  return el;
}
const DECO = /[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/gu; // schmückende Emojis
const wait = ms => new Promise(r => setTimeout(r, ms));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privater Modus */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* egal */ } },
};
const list = names => names.length <= 1 ? names.join('') : names.slice(0, -1).join(', ') + ' und ' + names[names.length - 1];

// ---------- Rollen ----------
const ROLES = {
  werwolf: { name: 'Werwolf', plural: 'Werwölfe', emoji: '🐺', team: 'wolf', color: '#8e2440', weight: -6,
    kurz: 'Sucht jede Nacht ein Opfer aus.',
    lang: 'Du gehörst zum Wolfsrudel. Jede Nacht wachst du mit den anderen Werwölfen auf. Zusammen sucht ihr leise einen Spieler aus, der ausscheidet. Am Tag tust du so, als wärst du ein ganz normaler Dorfbewohner.',
    tipp: 'Bleib ruhig und beschuldige ab und zu jemand anderen – aber nicht zu auffällig!' },
  dorfbewohner: { name: 'Dorfbewohner', plural: 'Dorfbewohner', emoji: '🧑‍🌾', team: 'dorf', color: '#5c7f3a', weight: 1,
    kurz: 'Schläft nachts und sucht am Tag die Wölfe.',
    lang: 'Du hast keine besondere Fähigkeit. Nachts schläfst du. Am Tag hörst du gut zu, beobachtest die anderen und stimmst mit ab, wer ein Werwolf sein könnte.',
    tipp: 'Achte darauf, wer sich komisch verhält oder schnell jemanden beschuldigt.' },
  seherin: { name: 'Seherin', plural: 'Seherinnen', emoji: '🔮', team: 'dorf', color: '#6a3fb5', weight: 7,
    kurz: 'Erfährt jede Nacht, ob ein Spieler ein Werwolf ist.',
    lang: 'Jede Nacht darfst du auf einen Spieler tippen. Die App zeigt dir, ob dieser Spieler ein Werwolf ist oder nicht. Du hilfst dem Dorf mit deinem Wissen.',
    tipp: 'Verrate nicht zu früh, dass du die Seherin bist – sonst holen dich die Wölfe!' },
  hexe: { name: 'Hexe', plural: 'Hexen', emoji: '🧙‍♀️', team: 'dorf', color: '#1f8a70', weight: 4,
    kurz: 'Hat einen Heiltrank und einen Gifttrank.',
    lang: 'Du hast zwei Zaubertränke. Jeden Trank darfst du nur einmal im ganzen Spiel benutzen. Mit dem Heiltrank rettest du das Opfer der Werwölfe. Mit dem Gifttrank lässt du einen Spieler ausscheiden.',
    tipp: 'Heb dir den Gifttrank auf, bis du dir bei einem Werwolf ziemlich sicher bist.' },
  jaeger: { name: 'Jäger', plural: 'Jäger', emoji: '🏹', team: 'dorf', color: '#a8651b', weight: 3,
    kurz: 'Nimmt beim Ausscheiden einen Spieler mit.',
    lang: 'Wenn du ausscheidest – egal ob in der Nacht oder am Tag – darfst du sofort einen anderen Spieler bestimmen, der mit dir ausscheidet.',
    tipp: 'Überleg dir schon vorher, wen du für einen Werwolf hältst.' },
  amor: { name: 'Amor', plural: 'Amors', emoji: '💘', team: 'dorf', color: '#d6457f', weight: -1,
    kurz: 'Verliebt in der ersten Nacht zwei Spieler.',
    lang: 'In der ersten Nacht bestimmst du zwei Spieler, die sich ineinander verlieben. Scheidet einer von beiden aus, scheidet der andere aus Liebeskummer auch aus. Du darfst dich auch selbst aussuchen. Danach bist du ein normaler Dorfbewohner.',
    tipp: 'Sind ein Werwolf und ein Dorfbewohner verliebt, gewinnen die beiden nur, wenn sie als Letzte übrig bleiben.' },
  beschuetzer: { name: 'Beschützer', plural: 'Beschützer', emoji: '🛡️', team: 'dorf', color: '#2d6cdf', weight: 3,
    kurz: 'Schützt jede Nacht einen Spieler vor den Wölfen.',
    lang: 'Jede Nacht suchst du einen Spieler aus, den du beschützt. Greifen die Werwölfe genau diesen Spieler an, passiert ihm nichts. Du darfst dich auch selbst schützen – aber nie zweimal hintereinander denselben Spieler.',
    tipp: 'Schütze Spieler, die dem Dorf besonders helfen.' },
  maedchen: { name: 'Kleines Mädchen', plural: 'Kleine Mädchen', emoji: '👧', team: 'dorf', color: '#e08a2b', weight: 1,
    kurz: 'Darf nachts heimlich blinzeln.',
    lang: 'Wenn die Werwölfe wach sind, darfst du ganz vorsichtig blinzeln und versuchen, sie zu erkennen. Aber Achtung: Wenn die Werwölfe dich dabei erwischen, suchen sie vielleicht dich aus!',
    tipp: 'Blinzle nur ganz wenig – und nicht in jeder Nacht.' },
};
const ROLE_ORDER = ['werwolf', 'seherin', 'hexe', 'jaeger', 'amor', 'beschuetzer', 'maedchen', 'dorfbewohner'];
const SPECIALS = ['seherin', 'hexe', 'jaeger', 'amor', 'beschuetzer', 'maedchen'];
// Monogramm statt Bildchen: Anfangsbuchstaben oder Platznummer
const initials = (name, i) => { const n = (name || '').trim(); return !n || /^Spieler \d+$/.test(n) ? String(i + 1) : n[0].toUpperCase() + (n[1] || '').toLowerCase(); };
const av = p => h('span', { class: 'av', style: `--h:${(p.id * 47 + 210) % 360}` }, initials(p.name, p.id));
const MIN_P = 5, MAX_P = 20;

const LEVELS = {
  einfach: { name: 'Einfach', emoji: '🌱', desc: 'Für Einsteiger und jüngere Kinder' },
  klassisch: { name: 'Klassisch', emoji: '⭐', desc: 'Die beliebteste Mischung' },
  abenteuer: { name: 'Abenteuer', emoji: '🔥', desc: 'Viele Sonderrollen für Profis' },
};
const wolvesFor = n => n <= 5 ? 1 : n <= 11 ? 2 : n <= 17 ? 3 : 4;
function recommend(n, level) {
  const r = { werwolf: wolvesFor(n), seherin: 1, hexe: 0, jaeger: 0, amor: 0, beschuetzer: 0, maedchen: 0 };
  if (level === 'einfach') { if (n >= 8) r.hexe = 1; }
  if (level === 'klassisch') { if (n >= 6) r.hexe = 1; if (n >= 8) r.jaeger = 1; if (n >= 10) r.amor = 1; }
  if (level === 'abenteuer') { if (n >= 6) r.hexe = 1; if (n >= 7) r.jaeger = 1; if (n >= 8) r.amor = 1; if (n >= 9) r.beschuetzer = 1; if (n >= 10) r.maedchen = 1; }
  return r;
}
const villagers = (n, r) => n - Object.values(r).reduce((a, b) => a + b, 0);
function balance(n, r) {
  let s = villagers(n, r) * ROLES.dorfbewohner.weight;
  for (const k in r) s += r[k] * ROLES[k].weight;
  return s;
}

// ---------- Einstellungen & Sprachausgabe ----------
const settings = Object.assign({ voiceOn: true, rate: 0.9, voiceURI: null }, store.get('fw_settings', {}));
const saveSettings = () => store.set('fw_settings', settings);

const Speech = {
  id: 0, voices: [],
  ok: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  init() {
    if (!this.ok) return;
    const load = () => { this.voices = speechSynthesis.getVoices().filter(v => /^de/i.test(v.lang)); };
    load();
    if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', load);
  },
  pick() {
    const vs = this.voices;
    return vs.find(v => v.voiceURI === settings.voiceURI)
      || vs.find(v => /premium|enhanced|erweitert|natural|neural/i.test(v.name))
      || vs.find(v => /google/i.test(v.name))
      || vs.find(v => /anna|petra|katja|markus|viktor/i.test(v.name))
      || vs[0] || null;
  },
  stop() { this.id++; if (this.ok) speechSynthesis.cancel(); setTalking(false); },
  // Liest einen Text vor. Das Promise endet, wenn fertig gelesen (oder abgebrochen) wurde.
  speak(text) {
    const my = ++this.id;
    const clean = String(text).replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s+/g, ' ').trim();
    if (!settings.voiceOn || !this.ok) {
      if (this.ok) speechSynthesis.cancel();
      // Ohne Stimme: Zeit lassen, damit jemand laut vorlesen kann.
      return wait(Math.min(12000, 1200 + clean.length * 60));
    }
    speechSynthesis.cancel();
    const parts = clean.match(/[^.!?…]+[.!?…]*/g) || [clean]; // satzweise, sonst bricht Chrome lange Texte ab
    setTalking(true);
    return new Promise(res => {
      let i = 0;
      const next = () => {
        if (my !== this.id) return res(false);
        if (i >= parts.length) { setTalking(false); return res(true); }
        const part = parts[i++].trim();
        if (!part) return next();
        const u = new SpeechSynthesisUtterance(part);
        u.lang = 'de-DE'; u.rate = settings.rate; u.pitch = 1;
        const v = this.pick(); if (v) u.voice = v;
        let done = false;
        const fin = () => { if (done) return; done = true; clearTimeout(guard); next(); };
        const guard = setTimeout(fin, 3000 + part.length * 140 / settings.rate);
        u.onend = fin; u.onerror = fin;
        this._keep = u; // verhindert, dass der Browser die Ansage vorzeitig wegräumt
        speechSynthesis.speak(u);
      };
      setTimeout(next, 80);
    });
  },
};
function setTalking(on) { document.querySelectorAll('.narrator').forEach(n => n.classList.toggle('talking', on)); }

// ---------- Zustand ----------
let S = null;             // laufendes Spiel
let run = 0;              // erhöht sich bei Abbruch – stoppt laufende Abläufe
let helpKey = 'home';
let timerInt = null;
let wakeLock = null;
const setup = Object.assign({ n: 8, names: [], level: 'klassisch', roles: null, captain: false, mode: 'app', timer: 3 }, store.get('fw_setup', {}));
const saveSetup = () => store.set('fw_setup', setup);
const P = id => S.players[id];
const living = () => S.players.filter(p => p.alive);
const livingRole = r => S.players.some(p => p.alive && p.role === r);
const save = () => store.set('fw_save', S);

async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { /* nicht schlimm */ }
}
document.addEventListener('visibilitychange', () => { if (S && document.visibilityState === 'visible') keepAwake(); });

// ---------- Bildschirm-Bausteine ----------
const root = document.getElementById('app');
const SVG = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_ON = SVG('<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>');
const ICON_OFF = SVG('<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>');
function show({ theme = 'night', title = '', help = 'home', body }) {
  clearInterval(timerInt);
  document.body.dataset.theme = theme;
  document.body.classList.toggle('is-home', help === 'home');
  helpKey = help;
  const left = S
    ? h('button', { class: 'iconbtn', 'aria-label': 'Menü', onclick: menuModal }, '☰')
    : h('button', { class: 'iconbtn', 'aria-label': 'Startseite', onclick: () => { Speech.stop(); home(); } }, '⌂');
  const vbtn = h('button', { class: 'iconbtn', 'aria-label': 'Stimme an oder aus', onclick: () => {
    settings.voiceOn = !settings.voiceOn; saveSettings();
    if (!settings.voiceOn) Speech.stop();
    vbtn.innerHTML = settings.voiceOn ? ICON_ON : ICON_OFF;
  } });
  vbtn.innerHTML = settings.voiceOn ? ICON_ON : ICON_OFF;
  root.replaceChildren(
    h('header', { class: 'topbar' }, left, h('div', { class: 'title' }, title), vbtn,
      h('button', { class: 'iconbtn', 'aria-label': 'Hilfe', onclick: helpModal }, '?')),
    h('main', { class: 'main' }, body));
  window.scrollTo(0, 0);
}
// Sprechblase des Erzählers. Mit speak=true wird der Text sofort vorgelesen.
function narrator(text, speak = true) {
  const el = h('div', { class: 'narrator' },
    h('div', { class: 'who' }, 'Erzähler', h('span', { class: 'wave' }, h('i'), h('i'), h('i'))),
    h('p', { class: 'say' }, text),
    h('button', { class: 'again', onclick: () => Speech.speak(text) }, 'Nochmal vorlesen'));
  if (speak) Speech.speak(text);
  return el;
}
function chip(p, { badge, sub, cls = '', onclick } = {}) {
  return h('button', { class: `chip ${cls}`, onclick },
    badge && h('span', { class: 'badge' }, badge),
    av(p), h('span', { class: 'nm' }, p.name), sub && h('span', { class: 'sub' }, sub));
}
function roleIcon(r) { return h('div', { class: 'roleicon', style: `--rc:${ROLES[r].color}` }, ROLES[r].emoji); }
function modal(title, content) {
  const close = () => ov.remove();
  const ov = h('div', { class: 'overlay', onclick: e => { if (e.target === ov) close(); } },
    h('div', { class: 'sheet' },
      h('div', { class: 'head' }, h('h2', {}, title), h('button', { class: 'iconbtn', 'aria-label': 'Schließen', onclick: close }, '✕')),
      content));
  document.getElementById('modals').append(ov);
  return close;
}
function roleInfo(r) {
  const R = ROLES[r];
  modal(`${R.emoji} ${R.name}`, [
    h('p', {}, R.lang),
    h('div', { class: 'now' }, h('b', {}, '💡 Tipp: '), R.tipp),
    h('p', { class: 'soft' }, R.team === 'wolf' ? 'Gehört zu den Werwölfen.' : 'Gehört zum Dorf.'),
    h('button', { class: 'btn', onclick: () => Speech.speak(`${R.name}. ${R.lang} Tipp: ${R.tipp}`) }, '🔊 Vorlesen'),
  ]);
}
// Auswahl-Bildschirm: lebende Spieler antippen, dann bestätigen.
function picker({ theme = 'night', title, help, text, count = 1, rule, confirm = '✔ Fertig', extra, onDone }) {
  const sel = [];
  const btn = h('button', { class: 'btn primary big', disabled: true, onclick: () => onDone(count === 1 ? sel[0] : [...sel]) }, confirm);
  const chips = new Map();
  const refresh = () => { chips.forEach((el, id) => el.classList.toggle('sel', sel.includes(id))); btn.disabled = sel.length !== count; };
  const grid = h('div', { class: 'grid' }, living().map(p => {
    const r = rule ? rule(p) : {};
    const el = chip(p, { badge: r.badge, sub: r.sub, cls: r.off ? 'off' : '', onclick: () => {
      const i = sel.indexOf(p.id);
      if (i >= 0) sel.splice(i, 1); else { if (sel.length >= count) sel.shift(); sel.push(p.id); }
      refresh();
    } });
    chips.set(p.id, el);
    return el;
  }));
  show({ theme, title, help, body: [narrator(text), grid, h('div', { class: 'spacer' }), extra, btn] });
}

// ---------- Start ----------
function home() {
  S = null; run++;
  const saved = store.get('fw_save', null);
  show({ theme: 'night', title: '', help: 'home', body: [
    h('div', { class: 'hero' },
      h('div', { class: 'kicker' }, 'Ein Dorf · Eine Nacht · Ein Verdacht'),
      h('h1', {}, 'Nacht im Finsterwald'),
      h('div', { class: 'sub' }, 'Der Spielleiter für eure Werwolf-Runde')),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn primary big', onclick: () => { Speech.speak('Willkommen im Finsterwald! Wie viele Spieler seid ihr?'); playersScreen(); } }, '▶️ Neues Spiel'),
    saved && h('button', { class: 'btn big', onclick: () => resume(saved) }, '⏩ Spiel fortsetzen'),
    h('div', { class: 'row' },
      h('button', { class: 'btn grow', onclick: helpModal }, '📖 So geht\'s'),
      h('button', { class: 'btn grow', onclick: settingsModal }, '🗣️ Stimme')),
    h('p', { class: 'center small soft' }, 'Ab 5 Spielern · Legt das Gerät in die Mitte und dreht den Ton laut.'),
  ] });
}

// ---------- Spieler ----------
function playersScreen() {
  const names = h('div', { class: 'names' });
  const num = h('div', { class: 'num' }, setup.n);
  const minus = h('button', { 'aria-label': 'Weniger', onclick: () => set(setup.n - 1) }, '−');
  const plus = h('button', { 'aria-label': 'Mehr', onclick: () => set(setup.n + 1) }, '+');
  function set(n) {
    setup.n = Math.max(MIN_P, Math.min(MAX_P, n));
    num.textContent = setup.n; minus.disabled = setup.n <= MIN_P; plus.disabled = setup.n >= MAX_P;
    names.replaceChildren(...Array.from({ length: setup.n }, (_, i) =>
      h('label', { class: 'namefield' }, h('span', { class: 'av' }, i + 1),
        h('input', { type: 'text', maxlength: 14, placeholder: `Spieler ${i + 1}`, value: setup.names[i] || '', autocomplete: 'off',
          'aria-label': `Name von Spieler ${i + 1}`, oninput: e => { setup.names[i] = e.target.value; } }))));
  }
  set(setup.n);
  show({ theme: 'night', title: 'Schritt 1 von 3', help: 'players', body: [
    h('h2', { class: 'center' }, '👥 Wie viele spielen mit?'),
    h('div', { class: 'card' }, h('div', { class: 'stepper' }, minus, num, plus)),
    h('div', { class: 'card stack' },
      h('h3', {}, '✏️ Wie heißt ihr?'),
      h('p', { class: 'small soft' }, 'Tragt die Namen so ein, wie ihr im Kreis sitzt. Leere Felder heißen einfach „Spieler 1“, „Spieler 2“ …'),
      names),
    h('button', { class: 'btn primary big', onclick: () => {
      setup.names = setup.names.slice(0, MAX_P).map(s => (s || '').trim());
      setup.roles = recommend(setup.n, setup.level);
      saveSetup(); rolesScreen();
    } }, 'Weiter ➜'),
  ] });
}

// ---------- Rollen ----------
function rolesScreen() {
  const n = setup.n;
  if (!setup.roles) setup.roles = recommend(n, setup.level);
  const r = setup.roles;
  const maxWolves = Math.max(1, Math.floor((n - 1) / 2));
  const body = h('div', { class: 'stack' });
  const sameAsPreset = lvl => { const q = recommend(n, lvl); return Object.keys(q).every(k => q[k] === r[k]); };

  function draw() {
    const v = villagers(n, r), score = balance(n, r);
    const pos = Math.max(4, Math.min(96, 50 + score * 4));
    const verdict = score < -5 ? '🐺 Die Werwölfe haben es leichter. Nehmt eine Dorf-Rolle dazu oder einen Wolf weniger.'
      : score > 9 ? '🏡 Das Dorf hat es deutlich leichter. Für mehr Spannung: eine Sonderrolle weglassen.'
      : score > 5 ? '🏡 Das Dorf hat es etwas leichter – gut für die ersten Runden.'
      : '⚖️ Schön ausgeglichen!';
    body.replaceChildren(
      h('h2', { class: 'center' }, `🎭 Welche Rollen für ${n} Spieler?`),
      h('p', { class: 'center soft small' }, 'Tippt einfach einen Vorschlag an – oder stellt die Rollen unten selbst zusammen.'),
      h('div', { class: 'presets' }, Object.entries(LEVELS).map(([k, L]) =>
        h('button', { class: 'preset' + (sameAsPreset(k) && setup.level === k ? ' sel' : ''), onclick: () => { setup.level = k; setup.roles = recommend(n, k); Object.assign(r, setup.roles); draw(); } },
          k === 'klassisch' && h('span', { class: 'tag' }, 'Empfohlen'),
          h('span', { class: 'em' }, L.emoji), h('span', { class: 't' }, L.name), h('span', { class: 'd' }, L.desc)))),
      h('div', { class: 'card' },
        h('div', { class: 'rolerow' }, roleIcon('werwolf'),
          h('div', { class: 'rtxt' }, h('b', {}, 'Werwölfe'), h('span', {}, `Empfohlen bei ${n} Spielern: ${wolvesFor(n)}`)),
          h('button', { class: 'infobtn', 'aria-label': 'Erklärung', onclick: () => roleInfo('werwolf') }, 'i'),
          h('div', { class: 'stepper mini' },
            h('button', { disabled: r.werwolf <= 1, 'aria-label': 'Ein Wolf weniger', onclick: () => { r.werwolf--; draw(); } }, '−'),
            h('div', { class: 'num' }, r.werwolf),
            h('button', { disabled: r.werwolf >= maxWolves || v <= 0, 'aria-label': 'Ein Wolf mehr', onclick: () => { r.werwolf++; draw(); } }, '+'))),
        SPECIALS.map(k => h('div', { class: 'rolerow' + (r[k] ? '' : ' zero') }, roleIcon(k),
          h('div', { class: 'rtxt' }, h('b', {}, ROLES[k].name), h('span', {}, ROLES[k].kurz)),
          h('button', { class: 'infobtn', 'aria-label': 'Erklärung', onclick: () => roleInfo(k) }, 'i'),
          h('button', { class: 'switch' + (r[k] ? ' on' : ''), role: 'switch', 'aria-checked': String(!!r[k]), 'aria-label': ROLES[k].name,
            disabled: !r[k] && v <= 0, onclick: () => { r[k] = r[k] ? 0 : 1; draw(); } }))),
        h('div', { class: 'rolerow' + (v ? '' : ' zero') }, roleIcon('dorfbewohner'),
          h('div', { class: 'rtxt' }, h('b', {}, 'Dorfbewohner'), h('span', {}, 'Alle übrigen Spieler – wird automatisch aufgefüllt.')),
          h('button', { class: 'infobtn', 'aria-label': 'Erklärung', onclick: () => roleInfo('dorfbewohner') }, 'i'),
          h('div', { class: 'count' }, v))),
      h('div', { class: 'card stack' },
        h('h3', {}, 'Ist das fair?'),
        h('div', { class: 'meter' }, h('i', { style: `left:${pos}%` })),
        h('div', { class: 'meterlabels' }, h('span', {}, '🐺 Wölfe stärker'), h('span', {}, 'Dorf stärker 🏡')),
        h('p', {}, verdict)),
      h('div', { class: 'card stack' },
        h('h3', {}, '⚙️ Extras'),
        h('div', { class: 'row' }, h('div', { class: 'roleicon', style: '--rc:#b8891a' }, '🎖️'),
          h('div', { class: 'rtxt' }, h('b', {}, 'Hauptmann wählen'), h('span', {}, 'Das Dorf wählt am ersten Tag einen Hauptmann. Seine Stimme zählt doppelt.')),
          h('button', { class: 'switch' + (setup.captain ? ' on' : ''), role: 'switch', 'aria-checked': String(setup.captain), 'aria-label': 'Hauptmann', onclick: () => { setup.captain = !setup.captain; draw(); } })),
        h('div', { class: 'stack' }, h('b', {}, '⏱️ Zeit zum Beraten'),
          h('div', { class: 'seg' }, [[0, 'Ohne Uhr'], [2, '2 Min.'], [3, '3 Min.'], [5, '5 Min.']].map(([m, t]) =>
            h('button', { class: setup.timer === m ? 'on' : '', onclick: () => { setup.timer = m; draw(); } }, t)))),
        h('div', { class: 'stack' }, h('b', {}, '🃏 Wie werden die Rollen verteilt?'),
          h('div', { class: 'seg' },
            h('button', { class: setup.mode === 'app' ? 'on' : '', onclick: () => { setup.mode = 'app'; draw(); } }, '📱 Die App verteilt'),
            h('button', { class: setup.mode === 'cards' ? 'on' : '', onclick: () => { setup.mode = 'cards'; draw(); } }, '🃏 Mit echten Karten')),
          h('p', { class: 'small soft' }, setup.mode === 'app'
            ? 'Das Gerät geht reihum. Jeder schaut sich heimlich seine Rolle an.'
            : 'Ihr verteilt eure Spielkarten. Danach geht das Gerät reihum und jeder tippt heimlich an, welche Karte er hat.'))),
      h('button', { class: 'btn primary big', onclick: () => { saveSetup(); startGame(); } }, setup.mode === 'app' ? '🎲 Rollen verteilen' : '🃏 Karten eintragen'),
      h('button', { class: 'btn block', onclick: playersScreen }, '⬅ Zurück'));
  }
  show({ theme: 'night', title: 'Schritt 2 von 3', help: 'roles', body });
  draw();
}

// ---------- Rollen verteilen ----------
function startGame() {
  const n = setup.n, r = setup.roles;
  const deck = [];
  for (const k in r) for (let i = 0; i < r[k]; i++) deck.push(k);
  while (deck.length < n) deck.push('dorfbewohner');
  const roles = shuffle(deck);
  run++;
  S = {
    players: Array.from({ length: n }, (_, i) => ({ id: i, name: setup.names[i] || `Spieler ${i + 1}`, role: setup.mode === 'app' ? roles[i] : null, alive: true })),
    opt: { captain: setup.captain, timer: setup.timer, mode: setup.mode }, deck,
    night: 0, phase: 'deal', heal: true, poison: true, lastProtected: null, lovers: [], captain: null, pendingHunters: [], nd: null,
  };
  keepAwake();
  handover(0);
}
function handover(i) {
  if (i >= S.players.length) return dealDone();
  const p = P(i);
  const text = `Gib das Gerät an ${p.name}. Alle anderen schauen weg!`;
  show({ theme: 'night', title: `Schritt 3 von 3 · ${i + 1}/${S.players.length}`, help: 'deal', body: [
    narrator(text),
    h('div', { class: 'handover card' }, av(p), h('div', { class: 'nm' }, p.name)),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn primary big', onclick: () => { Speech.stop(); S.opt.mode === 'app' ? showCard(i) : chooseCard(i); } }, `👀 Ich bin ${p.name}`),
  ] });
}
function showCard(i) {
  const p = P(i), R = ROLES[p.role];
  show({ theme: 'night', title: p.name, help: 'deal', body: [
    h('div', { class: 'bigcard', style: `--rc:${R.color}` },
      h('div', { class: 'em' }, R.emoji), h('p', {}, 'Du bist:'), h('h2', {}, R.name), h('p', {}, R.lang),
      h('div', { class: 'team' }, R.team === 'wolf' ? '🐺 Team Werwölfe' : '🏡 Team Dorf')),
    h('p', { class: 'center soft small' }, '🤫 Psst! Niemand darf deine Rolle sehen. Die App liest sie nicht laut vor.'),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn primary big', onclick: () => handover(i + 1) }, '🙈 Gemerkt – verstecken'),
  ] });
}
function chooseCard(i) {
  const p = P(i);
  const kinds = ROLE_ORDER.filter(k => S.deck.includes(k));
  show({ theme: 'night', title: p.name, help: 'deal', body: [
    h('h2', { class: 'center' }, 'Welche Karte hast du?'),
    h('p', { class: 'center soft small' }, '🤫 Tippe heimlich deine Karte an.'),
    h('div', { class: 'grid' }, kinds.map(k => h('button', { class: 'chip', onclick: () => { p.role = k; handover(i + 1); } },
      h('span', { class: 'av' }, ROLES[k].emoji), h('span', { class: 'nm' }, ROLES[k].name)))),
  ] });
}
function dealDone() {
  if (S.opt.mode === 'cards') {
    const want = [...S.deck].sort().join(), got = S.players.map(p => p.role).sort().join();
    if (want !== got) {
      S.players.forEach(p => { p.role = null; });
      return show({ theme: 'night', title: 'Ups!', help: 'deal', body: [
        narrator('Die eingetippten Karten passen nicht zu den ausgewählten Rollen. Bitte tragt eure Karten noch einmal ein.'),
        h('div', { class: 'card' }, h('p', {}, 'Im Spiel sollten sein: ' + ROLE_ORDER.filter(k => S.deck.includes(k)).map(k => `${S.deck.filter(d => d === k).length}× ${ROLES[k].name}`).join(', ') + '.')),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn primary big', onclick: () => handover(0) }, '🔁 Noch einmal eintragen'),
        h('button', { class: 'btn block', onclick: () => { S = null; rolesScreen(); } }, '⬅ Rollen ändern'),
      ] });
    }
  }
  show({ theme: 'dusk', title: 'Gleich geht es los', help: 'ready', body: [
    narrator('Alle kennen jetzt ihre Rolle. Legt das Gerät in die Mitte, sodass jeder es erreichen kann. Dreht den Ton laut. Wenn ihr bereit seid, beginnt die erste Nacht.'),
    h('div', { class: 'card stack' }, h('h3', {}, '📋 So läuft das Spiel'),
      h('ul', { class: 'tips' },
        h('li', {}, 'In der Nacht machen alle die Augen zu. Der Erzähler ruft die Rollen einzeln auf.'),
        h('li', {}, 'Wer aufgerufen wird, öffnet leise die Augen und tippt auf dem Gerät.'),
        h('li', {}, 'Am Tag beraten alle zusammen und stimmen ab, wer ein Werwolf sein könnte.'),
        h('li', {}, 'Wer ausgeschieden ist, verrät nichts mehr und schaut still zu.'))),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn primary big', onclick: beginNight }, '🌙 Die Nacht beginnt'),
  ] });
}

// ---------- Nacht ----------
function beginNight() { S.night++; S.phase = 'night'; save(); runNight(); }
function sleepScreen(text, emoji = '😴') {
  show({ theme: 'night', title: `🌙 Nacht ${S.night}`, help: 'night', body: [
    h('div', { class: 'sleep' }, h('div', { class: 'em' }, emoji), h('h2', {}, 'Alle Augen bleiben zu!')),
    narrator(text, false),
  ] });
}
async function runNight() {
  const t = run;
  S.nd = { protect: null, victim: null, healed: false, poison: null };
  const intro = S.night === 1
    ? 'Es wird Nacht im Finsterwald. Der Mond steigt über die Bäume, und im Dorf wird es ganz still. Alle schließen jetzt die Augen.'
    : 'Der Tag geht zu Ende. Es wird wieder Nacht im Finsterwald. Alle schließen die Augen.';
  sleepScreen(intro, '🌙');
  await Speech.speak(intro); await wait(1500);
  if (t !== run) return;
  const steps = [];
  if (S.night === 1 && livingRole('amor')) steps.push('amor', 'lovers');
  if (livingRole('beschuetzer')) steps.push('beschuetzer');
  if (livingRole('seherin')) steps.push('seherin');
  steps.push('werwolf');
  if (livingRole('hexe') && (S.heal || S.poison)) steps.push('hexe');
  nightStep(steps, 0);
}
// Rolle schläft ein, kurze Pause, dann ist die nächste Rolle dran.
function sleepThen(steps, i, line) {
  const t = run;
  sleepScreen(line);
  Speech.speak(line).then(() => wait(1800)).then(() => { if (t === run) nightStep(steps, i + 1); });
}
function nightStep(steps, i) {
  if (i >= steps.length) return morning();
  const title = `🌙 Nacht ${S.night}`;
  const next = line => sleepThen(steps, i, line);
  switch (steps[i]) {
    case 'amor':
      return picker({ title, help: 'amor', count: 2, confirm: '💘 Diese zwei verlieben',
        text: 'Amor, wach auf! Tippe zwei Spieler an, die sich ineinander verlieben sollen. Du darfst auch dich selbst wählen.',
        onDone: ids => { S.lovers = ids; nightStep(steps, i + 1); } });
    case 'lovers': {
      const text = 'Amor, steh leise auf und tippe den beiden Verliebten sanft auf die Schulter. Setz dich dann wieder hin und drücke auf den Knopf.';
      return show({ theme: 'night', title, help: 'amor', body: [
        narrator(text),
        h('div', { class: 'card center' }, h('div', { class: 'pair' }, S.lovers.map(id => av(P(id)))), h('h2', {}, S.lovers.map(id => P(id).name).join(' & '))),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn primary big', onclick: async () => {
          const t = run;
          const a = 'Amor schläft wieder ein. Wer eben an der Schulter berührt wurde, ist jetzt verliebt. Die Verliebten wachen auf und schauen sich an.';
          sleepScreen(a, '💕'); await Speech.speak(a); await wait(5000); if (t !== run) return;
          next('Die Verliebten schlafen wieder ein.');
        } }, '✔ Erledigt'),
      ] });
    }
    case 'beschuetzer':
      return picker({ title, help: 'beschuetzer', confirm: '🛡️ Beschützen',
        text: 'Beschützer, wach auf! Wen möchtest du heute Nacht beschützen?',
        rule: p => p.id === S.lastProtected ? { off: true, sub: 'letzte Nacht' } : {},
        onDone: id => { S.nd.protect = id; next('Der Beschützer schläft wieder ein.'); } });
    case 'seherin':
      return picker({ title, help: 'seherin', confirm: '🔮 Ansehen',
        text: 'Seherin, wach auf! Tippe einen Spieler an, über den du die Wahrheit wissen möchtest.',
        rule: p => p.role === 'seherin' ? { off: true, sub: 'das bist du' } : {},
        onDone: id => {
          Speech.stop();
          const p = P(id), wolf = p.role === 'werwolf';
          show({ theme: 'night', title, help: 'seherin', body: [
            h('div', { class: 'reveal ' + (wolf ? 'bad' : 'ok') }, h('span', { class: 'em' }, wolf ? '🐺' : '😇'),
              `${p.name} ist ${wolf ? 'ein WERWOLF!' : 'KEIN Werwolf.'}`),
            h('p', { class: 'center soft' }, '🤫 Merk es dir gut – das wird nicht vorgelesen.'),
            h('div', { class: 'spacer' }),
            h('button', { class: 'btn primary big', onclick: () => next('Die Seherin schläft wieder ein.') }, '✔ Gemerkt'),
          ] });
        } });
    case 'werwolf': {
      const girl = livingRole('maedchen');
      const first = S.night === 1 ? ' Schaut euch um und erkennt euch.' : '';
      return picker({ title, help: 'werwolf', confirm: '🐺 Auswählen',
        text: `Werwölfe, wacht auf!${first} Einigt euch leise mit Handzeichen auf ein Opfer und tippt es an.${girl ? ' Das kleine Mädchen darf jetzt vorsichtig blinzeln.' : ''}`,
        rule: p => p.role === 'werwolf' ? { off: true, badge: '🐺', sub: 'Wolf' } : {},
        onDone: id => { S.nd.victim = id; next('Die Werwölfe schlafen wieder ein.'); } });
    }
    case 'hexe': return witchScreen(next);
  }
}
function witchScreen(next) {
  const nd = S.nd, title = `🌙 Nacht ${S.night}`;
  const hit = nd.victim != null && nd.victim !== nd.protect ? P(nd.victim) : null;
  const text = 'Hexe, wach auf! Auf dem Bildschirm siehst du, wen die Werwölfe angegriffen haben. Möchtest du einen deiner Zaubertränke benutzen?';
  function draw(speak) {
    show({ theme: 'night', title, help: 'hexe', body: [
      narrator(text, speak),
      h('div', { class: 'card center' }, hit
        ? [h('div', { class: 'pair' }, av(hit)), h('h2', {}, `${hit.name} wurde angegriffen!`)]
        : h('h2', {}, '🌟 Heute Nacht wurde niemand verletzt.')),
      S.heal
        ? h('button', { class: 'btn big ' + (nd.healed ? 'good' : ''), disabled: !hit, onclick: () => { nd.healed = !nd.healed; draw(false); } },
          nd.healed ? `💚 ${hit.name} wird gerettet ✔` : hit ? `💚 Heiltrank: ${hit.name} retten` : '💚 Heiltrank (heute nicht nötig)')
        : h('p', { class: 'center soft' }, '💚 Heiltrank ist schon verbraucht.'),
      S.poison
        ? h('button', { class: 'btn big ' + (nd.poison != null ? 'danger' : ''), onclick: () => {
          if (nd.poison != null) { nd.poison = null; return draw(false); }
          picker({ title, help: 'hexe', confirm: '☠️ Vergiften', text: 'Hexe, wen möchtest du vergiften?',
            rule: p => p.role === 'hexe' ? { off: true, sub: 'das bist du' } : {},
            extra: h('button', { class: 'btn block', onclick: () => draw(false) }, '⬅ Doch nicht'),
            onDone: id => { nd.poison = id; Speech.stop(); draw(false); } });
        } }, nd.poison != null ? `☠️ ${P(nd.poison).name} wird vergiftet ✔ (antippen zum Ändern)` : '☠️ Gifttrank benutzen')
        : h('p', { class: 'center soft' }, '☠️ Gifttrank ist schon verbraucht.'),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn primary big', onclick: () => {
        if (nd.healed) S.heal = false;
        if (nd.poison != null) S.poison = false;
        next('Die Hexe schläft wieder ein.');
      } }, nd.healed || nd.poison != null ? '✔ Fertig' : '✔ Fertig – nichts tun'),
    ] });
  }
  draw(true);
}

// ---------- Ausscheiden ----------
// Lässt Spieler ausscheiden (inklusive Liebeskummer) und gibt die Liste zurück.
function kill(entries) {
  const out = [], q = [...entries];
  while (q.length) {
    const e = q.shift(), p = P(e.id);
    if (!p.alive) continue;
    p.alive = false; out.push(e);
    if (S.lovers.includes(p.id)) { const o = S.lovers.find(x => x !== p.id); if (P(o).alive) q.push({ id: o, cause: 'liebe' }); }
    if (p.role === 'jaeger') S.pendingHunters.push(p.id);
  }
  return out;
}
const CAUSE = {
  wolf: n => `Die Werwölfe haben ${n} erwischt.`,
  gift: n => `${n} wurde vergiftet.`,
  liebe: n => `${n} ist vor Liebeskummer mitgegangen.`,
  jaeger: n => `Der Jäger hat ${n} getroffen.`,
  dorf: n => `Das Dorf schickt ${n} fort.`,
};
function announce({ theme, title, intro, none, deaths, next }) {
  const lines = deaths.map(d => `${CAUSE[d.cause](P(d.id).name)} ${P(d.id).name} hatte die Rolle: ${ROLES[P(d.id).role].name}.`);
  const text = intro + ' ' + (deaths.length ? lines.join(' ') : none || '');
  show({ theme, title, help: 'deaths', body: [
    narrator(text),
    deaths.map(d => { const p = P(d.id);
      return h('div', { class: 'card death' }, av(p),
        h('div', {}, h('h3', {}, p.name), h('p', { class: 'soft small' }, CAUSE[d.cause](p.name))),
        h('div', { class: 'ro' }, roleIcon(p.role), ROLES[p.role].name)); }),
    !deaths.length && h('div', { class: 'card center' }, h('h2', {}, 'Alle sind noch da!')),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn primary big', onclick: () => { Speech.stop(); next(); } }, 'Weiter ➜'),
  ] });
}
// Erst Jäger, dann Spielende prüfen, dann Hauptmann-Nachfolge, dann weiter.
function afterDeaths(next) {
  const theme = S.phase === 'night' ? 'dusk' : 'day';
  if (S.pendingHunters.length) {
    const hunter = P(S.pendingHunters.shift());
    if (living().length === 0) return afterDeaths(next);
    return picker({ theme, title: '🏹 Der Jäger', help: 'jaeger', confirm: '🏹 Mitnehmen',
      text: `${hunter.name} war der Jäger! ${hunter.name}, du darfst jetzt einen Spieler bestimmen, der mit dir ausscheidet. Tippe ihn an.`,
      onDone: id => announce({ theme, title: '🏹 Der Jäger', intro: 'Der Jäger hat sich entschieden.', deaths: kill([{ id, cause: 'jaeger' }]), next: () => afterDeaths(next) }) });
  }
  const w = winner();
  if (w) return gameOver(w);
  if (S.opt.captain && S.captain != null && !P(S.captain).alive) {
    const old = P(S.captain);
    return picker({ theme, title: '🎖️ Neuer Hauptmann', help: 'hauptmann', confirm: '🎖️ Ernennen',
      text: `${old.name} war der Hauptmann. ${old.name}, bestimme deinen Nachfolger und tippe ihn an.`,
      onDone: id => { S.captain = id; afterDeaths(next); } });
  }
  next();
}
function winner() {
  const al = living(), wolves = al.filter(p => p.role === 'werwolf').length;
  if (!al.length) return 'niemand';
  if (al.length === 2 && S.lovers.length === 2 && al.every(p => S.lovers.includes(p.id)) && wolves === 1) return 'liebe';
  if (!wolves) return 'dorf';
  if (wolves >= al.length - wolves) return 'wolf';
  return null;
}

// ---------- Tag ----------
function morning() {
  const nd = S.nd, hits = [];
  if (nd.victim != null && nd.victim !== nd.protect && !nd.healed) hits.push({ id: nd.victim, cause: 'wolf' });
  if (nd.poison != null) hits.push({ id: nd.poison, cause: 'gift' });
  S.lastProtected = nd.protect;
  S.phase = 'day';
  announce({ theme: 'day', title: `☀️ Tag ${S.night}`, deaths: kill(shuffle(hits)),
    intro: 'Die Sonne geht auf über dem Finsterwald. Alle wachen auf und öffnen die Augen!',
    none: 'Gute Nachricht: In dieser Nacht ist niemand ausgeschieden!',
    next: () => afterDeaths(startDay) });
}
function startDay() {
  S.phase = 'day'; save();
  if (S.opt.captain && S.captain == null) {
    return picker({ theme: 'day', title: '🎖️ Hauptmann-Wahl', help: 'hauptmann', confirm: '🎖️ Zum Hauptmann machen',
      text: 'Das Dorf wählt einen Hauptmann. Wer möchte, stellt sich kurz vor. Dann zählt ihr bis drei und alle zeigen auf ihren Wunsch-Hauptmann. Tippt den Spieler mit den meisten Stimmen an.',
      onDone: id => { S.captain = id; save(); discussion(); } });
  }
  discussion();
}
function badgeFor(p) { return S.captain === p.id ? '🎖️' : null; }
function discussion() {
  const mins = S.opt.timer;
  let left = mins * 60, running = false;
  const clock = h('div', { class: 'timer' });
  const fmt = () => { clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; clock.classList.toggle('low', left <= 15 && left > 0); };
  const tbtn = h('button', { class: 'btn block', onclick: () => {
    running = !running; tbtn.textContent = running ? '⏸ Pause' : '▶️ Uhr starten';
    clearInterval(timerInt);
    if (running) timerInt = setInterval(() => {
      if (--left <= 0) { left = 0; clearInterval(timerInt); running = false; tbtn.textContent = '⏰ Zeit ist um!'; tbtn.disabled = true; Speech.speak('Die Zeit ist um! Jetzt wird abgestimmt.'); }
      fmt();
    }, 1000);
  } }, '▶️ Uhr starten');
  fmt();
  const wolves = living().filter(p => p.role === 'werwolf').length;
  show({ theme: 'day', title: `☀️ Tag ${S.night}`, help: 'discussion', body: [
    narrator(`Jetzt wird beraten! Im Dorf leben noch ${living().length} Spieler. Wer von euch könnte ein Werwolf sein? Redet miteinander und hört gut zu.`),
    mins > 0 && h('div', { class: 'card stack' }, clock, tbtn),
    h('div', { class: 'card stack' }, h('h3', {}, `👥 Noch im Spiel: ${living().length}`),
      h('div', { class: 'grid' }, S.players.map(p => chip(p, { cls: 'static' + (p.alive ? '' : ' dead'), badge: p.alive ? badgeFor(p) : '†', sub: p.alive ? null : ROLES[p.role].name }))),
      h('p', { class: 'small soft' }, `Es sind noch ${wolves === 1 ? 'ein Werwolf' : wolves + ' Werwölfe'} unter euch.`)),
    h('div', { class: 'card stack' }, h('h3', {}, '💡 Fragen, die helfen'),
      h('ul', { class: 'tips' }, h('li', {}, 'Wer war in der Nacht unruhig oder hat Geräusche gemacht?'), h('li', {}, 'Wer beschuldigt andere besonders schnell?'), h('li', {}, 'Wer sagt auffällig wenig?'))),
    h('button', { class: 'btn primary big', onclick: () => { Speech.stop(); vote(); } }, '🗳️ Zur Abstimmung'),
  ] });
}
function vote() {
  const cap = S.captain != null ? ` Die Stimme vom Hauptmann ${P(S.captain).name} zählt doppelt.` : '';
  picker({ theme: 'day', title: `🗳️ Abstimmung · Tag ${S.night}`, help: 'vote', confirm: '✔ Dieser Spieler scheidet aus',
    text: `Abstimmung! Ich zähle: eins, zwei, drei! Jetzt zeigen alle gleichzeitig auf den Spieler, den sie für einen Werwolf halten.${cap} Tippt den Spieler mit den meisten Stimmen an.`,
    rule: p => ({ badge: badgeFor(p) }),
    extra: h('button', { class: 'btn block', onclick: () => { Speech.stop(); noVote(); } }, '🤝 Gleichstand – niemand scheidet aus'),
    onDone: id => { S.phase = 'night'; announce({ theme: 'dusk', title: `🗳️ Tag ${S.night}`, intro: 'Das Dorf hat entschieden.', deaths: kill([{ id, cause: 'dorf' }]), next: () => afterDeaths(beginNight) }); } });
}
function noVote() {
  show({ theme: 'dusk', title: `🗳️ Tag ${S.night}`, help: 'vote', body: [
    narrator('Das Dorf konnte sich nicht einigen. Heute scheidet niemand aus.'),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn primary big', onclick: beginNight }, '🌙 Weiter zur Nacht'),
  ] });
}

// ---------- Spielende ----------
function gameOver(w) {
  store.del('fw_save');
  const W = {
    dorf: { em: '🏡', t: 'Das Dorf gewinnt!', s: 'Alle Werwölfe sind entdeckt. Das Dorf hat gewonnen und im Finsterwald ist es wieder friedlich.', theme: 'day' },
    wolf: { em: '🐺', t: 'Die Werwölfe gewinnen!', s: 'Die Werwölfe haben das Dorf überlistet. Das Wolfsrudel hat gewonnen!', theme: 'night' },
    liebe: { em: '💕', t: 'Das Liebespaar gewinnt!', s: 'Nur die beiden Verliebten sind übrig. Das Liebespaar hat gewonnen!', theme: 'dusk' },
    niemand: { em: '🍃', t: 'Niemand gewinnt', s: 'Niemand ist mehr im Dorf. Diese Runde hat keiner gewonnen.', theme: 'dusk' },
  }[w];
  const players = S.players, lovers = S.lovers;
  S.phase = 'over';
  show({ theme: W.theme, title: 'Spielende', help: 'over', body: [
    h('div', { class: 'winner' }, h('div', { class: 'em' }, W.em), h('h1', {}, W.t)),
    narrator(W.s),
    h('div', { class: 'card stack' }, h('h3', {}, '🎭 Wer war wer?'),
      h('div', { class: 'grid' }, players.map(p => chip(p, { cls: 'static' + (p.alive ? '' : ' dead'), badge: ROLES[p.role].emoji, sub: ROLES[p.role].name + (lovers.includes(p.id) ? ' · verliebt' : '') })))),
    h('button', { class: 'btn primary big', onclick: () => { Speech.stop(); S = null; rolesScreen(); } }, '🔁 Noch eine Runde'),
    h('button', { class: 'btn block', onclick: () => { Speech.stop(); home(); } }, '🏠 Zur Startseite'),
  ] });
}
function resume(saved) {
  S = saved; run++; S.pendingHunters = [];
  keepAwake();
  if (S.phase === 'night') runNight(); else startDay();
}

// ---------- Hilfe ----------
const HELP = {
  home: ['Tippe auf „Neues Spiel“. Die App führt euch Schritt für Schritt durch alles.', 'Legt das Gerät in die Mitte und dreht den Ton laut, damit alle den Erzähler hören.'],
  players: ['Stellt mit Plus und Minus ein, wie viele mitspielen.', 'Tragt eure Namen ein – am besten in der Reihenfolge, in der ihr sitzt. Dann auf „Weiter“.'],
  roles: ['Tippt oben einen Vorschlag an: „Einfach“ für die ersten Runden, „Klassisch“ ist die empfohlene Mischung, „Abenteuer“ hat viele Sonderrollen.', 'Mit den Schaltern könnt ihr Rollen dazunehmen oder weglassen. Das kleine „i“ erklärt jede Rolle.', 'Die Waage zeigt, ob das Spiel fair ist.'],
  deal: ['Das Gerät geht reihum. Nur der Spieler, dessen Name angezeigt wird, schaut auf den Bildschirm.', 'Merke dir deine Rolle und verrate sie niemandem. Dann tippe auf „Verstecken“ und gib das Gerät weiter.'],
  ready: ['Legt das Gerät in die Mitte. Wenn alle bereit sind, tippt auf „Die Nacht beginnt“ und schließt die Augen.'],
  night: ['Alle haben die Augen zu. Wartet, bis der Erzähler eure Rolle aufruft.', 'Nur wer aufgerufen wird, öffnet leise die Augen und tippt auf dem Gerät.'],
  amor: ['Amor tippt zwei Spieler an und bestätigt. Danach tippt Amor den beiden leise auf die Schulter, damit sie wissen, dass sie verliebt sind.'],
  beschuetzer: ['Der Beschützer tippt einen Spieler an und bestätigt. Dieser Spieler ist heute Nacht sicher vor den Werwölfen.', 'Derselbe Spieler darf nicht zweimal hintereinander beschützt werden.'],
  seherin: ['Die Seherin tippt einen Spieler an und bestätigt. Die App zeigt, ob dieser Spieler ein Werwolf ist.', 'Danach auf „Gemerkt“ tippen und wieder die Augen schließen.'],
  werwolf: ['Nur die Werwölfe haben die Augen offen. Sie einigen sich ohne Worte – mit Zeigen und Nicken.', 'Ein Werwolf tippt das Opfer an und bestätigt. Werwölfe sind mit 🐺 markiert und können nicht gewählt werden.'],
  hexe: ['Die Hexe sieht, wen die Werwölfe angegriffen haben.', 'Grüner Knopf: Heiltrank benutzen und das Opfer retten. Roter Knopf: Gifttrank benutzen und einen Spieler aussuchen.', 'Jeder Trank geht nur einmal im ganzen Spiel. Wer nichts tun will, tippt einfach auf „Fertig“.'],
  deaths: ['Der Erzähler sagt, wer ausgeschieden ist und welche Rolle der Spieler hatte.', 'Wer ausgeschieden ist, darf nichts mehr verraten und schaut still zu. Dann auf „Weiter“ tippen.'],
  jaeger: ['Der Jäger ist ausgeschieden und darf einen Spieler mitnehmen. Der Jäger tippt den Spieler an und bestätigt.'],
  hauptmann: ['Alle zeigen gleichzeitig auf ihren Wunsch-Hauptmann. Tippt den Spieler mit den meisten Stimmen an.', 'Die Stimme des Hauptmanns zählt bei jeder Abstimmung doppelt. Scheidet er aus, bestimmt er einen Nachfolger.'],
  discussion: ['Jetzt reden alle miteinander: Wer könnte ein Werwolf sein?', 'Werwölfe tun so, als wären sie Dorfbewohner. Wenn ihr fertig seid, tippt auf „Zur Abstimmung“.'],
  vote: ['Zählt bis drei. Dann zeigen alle gleichzeitig auf einen Spieler.', 'Tippt den Spieler mit den meisten Stimmen an und bestätigt. Bei Gleichstand entscheidet der Hauptmann – gibt es keinen, tippt auf „Gleichstand“.'],
  over: ['Das Spiel ist vorbei. Hier seht ihr, wer welche Rolle hatte.', '„Noch eine Runde“ startet ein neues Spiel mit denselben Spielern.'],
};
function helpModal() {
  const now = HELP[helpKey] || HELP.home;
  modal('❓ Hilfe', [
    h('div', { class: 'now stack' }, h('h3', {}, '👉 Was mache ich jetzt?'), now.map(t => h('p', {}, t)),
      h('button', { class: 'btn', onclick: () => Speech.speak(now.join(' ')) }, '🔊 Vorlesen')),
    h('details', {}, h('summary', {}, '📖 Die Spielregeln – kurz erklärt'), h('div', { class: 'in' },
      h('p', {}, 'Im Dorf Finsterwald verstecken sich Werwölfe. Niemand weiß, wer sie sind!'),
      h('p', {}, h('b', {}, '🌙 In der Nacht '), 'schließen alle die Augen. Die Werwölfe wachen auf und suchen heimlich einen Spieler aus, der ausscheidet. Manche Dorfbewohner haben besondere Kräfte und werden auch aufgerufen.'),
      h('p', {}, h('b', {}, '☀️ Am Tag '), 'wachen alle auf. Das Dorf berät und stimmt ab, wer ein Werwolf sein könnte. Der Spieler mit den meisten Stimmen scheidet aus und zeigt seine Rolle.'),
      h('p', {}, h('b', {}, '🏆 Wer gewinnt? '), 'Das Dorf gewinnt, wenn alle Werwölfe gefunden sind. Die Werwölfe gewinnen, wenn sie mindestens so viele sind wie die übrigen Spieler.'),
      h('p', {}, h('b', {}, '🤫 Wichtig: '), 'Wer ausgeschieden ist, verrät nichts mehr. Und in der Nacht gilt: Augen zu und leise sein!'))),
    h('details', {}, h('summary', {}, '🎭 Alle Rollen'), h('div', { class: 'in' },
      ROLE_ORDER.map(k => h('div', { class: 'row' }, roleIcon(k), h('div', { class: 'rtxt' }, h('b', {}, ROLES[k].name), h('span', {}, ROLES[k].lang)))))),
    h('details', {}, h('summary', {}, '👥 Welche Rollen bei wie vielen Spielern?'), h('div', { class: 'in' },
      h('p', {}, h('b', {}, 'Werwölfe: '), '5 Spieler: 1 · 6 bis 11 Spieler: 2 · 12 bis 17 Spieler: 3 · ab 18 Spielern: 4'),
      h('p', {}, h('b', {}, 'Immer dabei: '), 'die Seherin. Ab 6 Spielern passt die Hexe gut dazu, ab 8 der Jäger, ab 10 Amor.'),
      h('p', {}, h('b', {}, 'Für jüngere Kinder: '), 'Nehmt „Einfach“. Dann gibt es nur Werwölfe, die Seherin und Dorfbewohner (ab 8 Spielern auch die Hexe).'),
      h('p', {}, 'Die App schlägt euch bei der Rollenauswahl automatisch eine passende Mischung vor.'))),
    h('details', {}, h('summary', {}, '💡 Tipps für die Runde'), h('div', { class: 'in' },
      h('p', {}, '🔊 Dreht den Ton laut und legt das Gerät in die Mitte.'),
      h('p', {}, '🥁 In der Nacht können alle leise auf die Oberschenkel trommeln. So hört niemand, wer sich bewegt.'),
      h('p', {}, '👶 Bei kleineren Kindern kann ein Erwachsener helfen, der selbst nicht mitspielt: Das Kind zeigt, der Erwachsene tippt.'),
      h('p', {}, '📱 Versehentlich neu geladen? Auf der Startseite gibt es „Spiel fortsetzen“.'))),
  ]);
}

// ---------- Stimme einstellen ----------
function settingsModal() {
  const vs = Speech.voices;
  const sample = 'Es wird Nacht im Finsterwald. Alle schließen die Augen.';
  modal('🗣️ Stimme des Erzählers', [
    !Speech.ok && h('div', { class: 'now' }, 'Dieser Browser kann leider nicht vorlesen. Dann liest einfach jemand die Texte des Erzählers laut vor.'),
    h('div', { class: 'row' }, h('div', { class: 'rtxt' }, h('b', {}, 'Vorlesen'), h('span', {}, 'Alle Erzähler-Texte werden laut vorgelesen.')),
      (() => { const b = h('button', { class: 'switch' + (settings.voiceOn ? ' on' : ''), role: 'switch', 'aria-checked': String(settings.voiceOn), 'aria-label': 'Vorlesen', onclick: () => {
        settings.voiceOn = !settings.voiceOn; saveSettings(); b.classList.toggle('on', settings.voiceOn); b.setAttribute('aria-checked', String(settings.voiceOn)); if (!settings.voiceOn) Speech.stop();
      } }); return b; })()),
    Speech.ok && h('div', { class: 'stack' }, h('b', {}, 'Stimme'),
      vs.length
        ? h('select', { 'aria-label': 'Stimme auswählen', onchange: e => { settings.voiceURI = e.target.value; saveSettings(); Speech.speak(sample); } },
          vs.map(v => h('option', { value: v.voiceURI, selected: (Speech.pick() || {}).voiceURI === v.voiceURI }, v.name)))
        : h('p', { class: 'soft small' }, 'Es wurde keine deutsche Stimme gefunden. Das Gerät benutzt seine Standard-Stimme. In den Geräte-Einstellungen unter „Sprachausgabe“ könnt ihr deutsche Stimmen laden.')),
    Speech.ok && h('div', { class: 'stack' }, h('b', {}, 'Tempo'),
      h('input', { type: 'range', min: '0.6', max: '1.3', step: '0.05', value: settings.rate, 'aria-label': 'Sprechtempo', onchange: e => { settings.rate = +e.target.value; saveSettings(); Speech.speak(sample); } }),
      h('div', { class: 'meterlabels' }, h('span', {}, '🐢 langsam'), h('span', {}, 'schnell 🐇'))),
    Speech.ok && h('button', { class: 'btn primary', onclick: () => { settings.voiceOn = true; saveSettings(); Speech.speak(sample); } }, '🔊 Ausprobieren'),
  ]);
}

// ---------- Menü im Spiel ----------
function menuModal() {
  let close;
  const secret = h('div', { class: 'stack' });
  let hold;
  const holdBtn = h('button', { class: 'btn block',
    onpointerdown: () => { holdBtn.textContent = '… weiter halten …'; hold = setTimeout(() => {
      secret.replaceChildren(h('div', { class: 'grid' }, S.players.map(p => chip(p, { cls: 'static' + (p.alive ? '' : ' dead'), badge: p.role ? ROLES[p.role].emoji : '❔', sub: (p.role ? ROLES[p.role].name : '?') + (S.lovers.includes(p.id) ? ' · verliebt' : '') }))));
      holdBtn.remove();
    }, 2000); },
    onpointerup: () => { clearTimeout(hold); holdBtn.textContent = '🔐 Geheime Übersicht (2 Sekunden halten)'; },
    onpointerleave: () => clearTimeout(hold),
  }, '🔐 Geheime Übersicht (2 Sekunden halten)');
  close = modal('☰ Menü', [
    h('button', { class: 'btn primary big', onclick: () => close() }, '▶️ Weiterspielen'),
    h('div', { class: 'card stack' }, h('h3', {}, `👥 Noch im Spiel: ${living().length} von ${S.players.length}`),
      h('div', { class: 'grid' }, S.players.map(p => chip(p, { cls: 'static' + (p.alive ? '' : ' dead'), badge: p.alive ? badgeFor(p) : '†' })))),
    h('p', { class: 'small soft' }, 'Nur für Erwachsene, die nicht mitspielen: Die geheime Übersicht zeigt alle Rollen.'),
    holdBtn, secret,
    h('button', { class: 'btn block', onclick: () => { close(); settingsModal(); } }, '🗣️ Stimme einstellen'),
    h('button', { class: 'btn danger block', onclick: () => {
      close();
      const c2 = modal('Spiel wirklich beenden?', [
        h('p', {}, 'Das laufende Spiel wird abgebrochen.'),
        h('button', { class: 'btn danger big', onclick: () => { c2(); Speech.stop(); store.del('fw_save'); home(); } }, '🛑 Ja, beenden'),
        h('button', { class: 'btn big', onclick: () => c2() }, 'Nein, weiterspielen'),
      ]);
    } }, '🛑 Spiel beenden'),
  ]);
}

// ---------- Kulisse ----------
function scenery() {
  const stars = document.getElementById('stars');
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('i'), size = 1 + Math.random() * 2.5;
    s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 70}%;width:${size}px;height:${size}px;animation-delay:${Math.random() * 3}s`;
    stars.append(s);
  }
  const trees = (count, minH, maxH, seed) => {
    let d = 'M0 220 ', x = -20; let r = seed;
    const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    const step = 1240 / count;
    for (let i = 0; i < count; i++) {
      const hgt = minH + rnd() * (maxH - minH), w = step * (0.9 + rnd() * 0.5), top = 220 - hgt;
      d += `L${x} 220 L${x + w * 0.15} ${top + hgt * 0.62} L${x + w * 0.05} ${top + hgt * 0.62} L${x + w * 0.3} ${top + hgt * 0.32} L${x + w * 0.2} ${top + hgt * 0.32} L${x + w / 2} ${top} L${x + w * 0.8} ${top + hgt * 0.32} L${x + w * 0.7} ${top + hgt * 0.32} L${x + w * 0.95} ${top + hgt * 0.62} L${x + w * 0.85} ${top + hgt * 0.62} L${x + w} 220 `;
      x += step;
    }
    return d + 'L1200 220 Z';
  };
  document.getElementById('forest').innerHTML =
    `<path class="back" d="${trees(22, 110, 200, 7)}"/><path class="front" d="${trees(15, 70, 150, 23)}"/>`;
}

Speech.init();
scenery();
home();

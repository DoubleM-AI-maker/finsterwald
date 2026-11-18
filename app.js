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
let SPEED = 1; // Tests setzen das auf 0
const wait = ms => new Promise(r => setTimeout(r, ms * SPEED));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privater Modus */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* egal */ } },
};
const list = names => names.length <= 1 ? names.join('') : names.slice(0, -1).join(', ') + ' und ' + names[names.length - 1];

// Monogramm statt Bildchen: Anfangsbuchstaben oder Platznummer
const initials = (name, i) => { const n = (name || '').trim(); return !n || /^Spieler \d+$/.test(n) ? String(i + 1) : n[0].toUpperCase() + (n[1] || '').toLowerCase(); };
const av = p => h('span', { class: 'av', style: `--h:${(p.id * 47 + 210) % 360}` }, initials(p.name, p.id));
const MIN_P = 5, MAX_P = 24;

// ---------- Einstellungen & Sprachausgabe ----------
const settings = Object.assign({ voiceOn: true, rate: 0.85, voiceURI: null }, store.get('fw_settings', {}));
const saveSettings = () => store.set('fw_settings', settings);

// Kennung eines Satzes (FNV-1a). Dieselbe Rechnung steht in tools/stimme-erzeugen.js.
function clipId(sentence) {
  let x = 0x811c9dc5;
  for (let i = 0; i < sentence.length; i++) { x ^= sentence.charCodeAt(i); x = Math.imul(x, 0x01000193); }
  return (x >>> 0).toString(16).padStart(8, '0');
}
const CLIPS = new Set(window.CLIPS || []); // vorhandene Erzähler-Aufnahmen im Ordner audio/
const player = typeof Audio === 'function' ? new Audio() : null;
// Safari und mobile Browser erlauben Ton nur, wenn er einmal direkt in einer Berührung gestartet wurde.
// Deshalb beim ersten Tippen einen kurzen stillen Ton abspielen; danach darf der Abspieler jederzeit starten.
let unlocked = false;
const SILENCE = (() => {
  const n = 400, buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const w = (o, t) => [...t].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true); dv.setUint32(28, 16000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
  try { return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })); } catch { return ''; }
})();
function unlockAudio() {
  if (unlocked || !player || !CLIPS.size || !SILENCE) return;
  unlocked = true;
  player.src = SILENCE;
  const p = player.play();
  if (p) p.catch(e => { if (e && e.name === 'NotAllowedError') unlocked = false; });
}
['click', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, true));

const Speech = {
  id: 0, voices: [], clipError: '',
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
      || vs.find(v => /premium/i.test(v.name))
      || vs.find(v => /natural|neural|online/i.test(v.name))
      || vs.find(v => /enhanced|erweitert|siri/i.test(v.name))
      || vs.find(v => /google/i.test(v.name))
      || vs.find(v => /anna|petra|katja|markus|viktor/i.test(v.name))
      || vs[0] || null;
  },
  stop() { this.id++; if (this.ok) speechSynthesis.cancel(); if (player) player.pause(); setTalking(false); },
  // Liest einen Text vor. Das Promise endet, wenn fertig gelesen (oder abgebrochen) wurde.
  speak(text) {
    const my = ++this.id;
    const clean = String(text).replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s+/g, ' ').trim();
    if (player) player.pause();
    if (!settings.voiceOn || (!this.ok && !CLIPS.size)) {
      if (this.ok) speechSynthesis.cancel();
      // Ohne Stimme: Zeit lassen, damit jemand laut vorlesen kann.
      return wait(Math.min(12000, 1200 + clean.length * 60));
    }
    if (this.ok) speechSynthesis.cancel();
    const parts = clean.match(/[^.!?…]+[.!?…]*/g) || [clean]; // satzweise, sonst bricht Chrome lange Texte ab
    setTalking(true);
    return new Promise(res => {
      let i = 0;
      const next = () => {
        if (my !== this.id) return res(false);
        if (i >= parts.length) { setTalking(false); return res(true); }
        const first = i === 0;
        const part = parts[i++].trim();
        if (!part) return next();
        let done = false;
        const fin = () => { if (done) return; done = true; clearTimeout(guard); setTimeout(next, 420); }; // Atempause zwischen den Sätzen
        let guard;
        const device = () => { // Gerätestimme: für Sätze ohne Aufnahme, etwa mit Spielernamen
          if (!this.ok) return fin();
        const u = new SpeechSynthesisUtterance(part);
        u.lang = 'de-DE'; u.rate = settings.rate; u.pitch = 0.9;
        const v = this.pick(); if (v) u.voice = v;
        guard = setTimeout(fin, 3000 + part.length * 140 / settings.rate);
        u.onend = fin; u.onerror = fin;
        this._keep = u; // verhindert, dass der Browser die Ansage vorzeitig wegräumt
        setTimeout(() => { if (my === this.id) speechSynthesis.speak(u); else fin(); }, first ? 80 : 0);
        };
        const id = clipId(part);
        if (player && CLIPS.has(id)) {
          guard = setTimeout(fin, 30000);
          player.onended = fin;
          let fell = false; // Aufnahme lässt sich nicht abspielen: einmalig auf die Gerätestimme ausweichen
          const fallback = e => { if (fell || done || my !== this.id) return; fell = true; clearTimeout(guard); this.clipError = (e && e.name) || 'Datei nicht ladbar'; device(); };
          player.onerror = () => { CLIPS.delete(id); fallback(); };
          player.onplaying = () => { this.clipError = ''; };
          player.src = `audio/${id}.mp3`;
          player.play().catch(fallback);
        } else if (CLIPS.size) next();
        else device();
      };
      next();
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
const setup = Object.assign({ n: 8, names: [], level: 'klassisch', roles: null, captain: false, mode: 'app', timer: 3, mod: true, quick: false, events: false, gPool: [], groups: [] }, store.get('fw_setup', {}));
const saveSetup = () => store.set('fw_setup', setup);
const P = id => S.players[id];
const living = () => S.players.filter(p => p.alive);
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
// Erzähler. text: fester Erzählertext. read: Satz mit Spielernamen – den liest der Spielleiter selbst vor.
// Gibt es Aufnahmen, werden Sätze ohne Aufnahme nicht gesprochen, sondern ebenfalls zum Vorlesen angezeigt.
const sentences = t => (String(t || '').replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]*/g) || []).map(x => x.trim()).filter(Boolean);
const hasClip = x => CLIPS.has(clipId(x));
const allClips = t => !CLIPS.size || sentences(t).every(hasClip); // läuft der Text ganz ohne Vorleser?
function narrator(text, speak = true, hint, read) {
  const all = sentences(text);
  const spoken = CLIPS.size ? all.filter(hasClip).join(' ') : all.join(' ');
  const aloud = [CLIPS.size ? all.filter(x => !hasClip(x)).join(' ') : '', read || ''].filter(Boolean).join(' ');
  const full = CLIPS.size ? spoken : [spoken, read].filter(Boolean).join(' ');
  const el = h('div', { class: 'narrator' },
    spoken && h('div', { class: 'who' }, 'Erzähler', h('span', { class: 'wave' }, h('i'), h('i'), h('i'))),
    spoken && h('p', { class: 'say' }, spoken),
    spoken && h('button', { class: 'again', onclick: () => Speech.speak(full) }, 'Nochmal vorlesen'),
    aloud && h('div', { class: 'read' }, h('b', {}, CLIPS.size ? 'Jetzt laut vorlesen' : 'Ansage'), h('p', {}, aloud)),
    hint && h('p', { class: 'hint' }, h('b', {}, S && S.opt.mod ? 'Moderator: ' : 'Hinweis: '), hint));
  if (speak) { if (full) Speech.speak(full); else Speech.stop(); }
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
    h('p', { class: 'soft' }, `${TEAMS[R.team]} · ${SETS[R.set]}`),
    allClips(`${R.lang} ${R.tipp}`) && h('button', { class: 'btn', onclick: () => Speech.speak(`${R.lang} ${R.tipp}`) }, 'Vorlesen'),
  ]);
}
// Auswahl-Bildschirm: lebende Spieler antippen, dann bestätigen.
function picker({ theme = 'night', title, help, text, hint, read, speak = true, count = 1, min = count, multi = count > 1, rule, confirm = 'Fertig', extra, onDone }) {
  const sel = [];
  const btn = h('button', { class: 'btn primary big', disabled: min > 0, onclick: () => { Speech.stop(); onDone(multi ? [...sel] : sel[0]); } }, confirm);
  const chips = new Map();
  const refresh = () => { chips.forEach((el, id) => el.classList.toggle('sel', sel.includes(id))); btn.disabled = sel.length < min || sel.length > count; };
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
  show({ theme, title, help, body: [narrator(text, speak, hint, read), grid, h('div', { class: 'spacer' }), extra, btn] });
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
    h('p', { class: 'center small soft' }, 'Ab 5 Spielern · Am besten mit einem Moderator, der das Gerät hält.'),
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
      h('p', { class: 'small soft' }, 'Tragt die Namen im Uhrzeigersinn so ein, wie ihr im Kreis sitzt – einige Rollen wirken auf Sitznachbarn. Leere Felder heißen einfach „Spieler 1“, „Spieler 2“ …'),
      names),
    h('button', { class: 'btn primary big', onclick: () => {
      setup.names = setup.names.slice(0, MAX_P).map(s => (s || '').trim());
      setup.roles = recommend(setup.n, setup.level);
      saveSetup(); rolesScreen();
    } }, 'Weiter ➜'),
  ] });
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
    h('div', { class: 'now' }, CLIPS.size
      ? `Erzähler-Aufnahmen: ${CLIPS.size} geladen. Sätze mit Spielernamen liest der Spielleiter selbst vor – sie stehen dann unter „Jetzt laut vorlesen“.`
      : 'Erzähler-Aufnahmen: keine gefunden. Es spricht die Stimme des Geräts.',
      Speech.clipError && h('p', { class: 'small soft' }, `Letzte Aufnahme konnte nicht abgespielt werden (${Speech.clipError}). Tippe auf „Ausprobieren“.`)),
    Speech.ok && !CLIPS.size && h('div', { class: 'stack' }, h('b', {}, 'Stimme'),
      vs.length
        ? h('select', { 'aria-label': 'Stimme auswählen', onchange: e => { settings.voiceURI = e.target.value; saveSettings(); Speech.speak(sample); } },
          vs.map(v => h('option', { value: v.voiceURI, selected: (Speech.pick() || {}).voiceURI === v.voiceURI }, v.name)))
        : h('p', { class: 'soft small' }, 'Es wurde keine deutsche Stimme gefunden. Das Gerät benutzt seine Standard-Stimme. In den Geräte-Einstellungen unter „Sprachausgabe“ könnt ihr deutsche Stimmen laden.')),
    Speech.ok && !CLIPS.size && h('div', { class: 'stack' }, h('b', {}, 'Tempo'),
      h('input', { type: 'range', min: '0.6', max: '1.3', step: '0.05', value: settings.rate, 'aria-label': 'Sprechtempo', onchange: e => { settings.rate = +e.target.value; saveSettings(); Speech.speak(sample); } }),
      h('div', { class: 'meterlabels' }, h('span', {}, '🐢 langsam'), h('span', {}, 'schnell 🐇'))),
    (Speech.ok || CLIPS.size > 0) && h('button', { class: 'btn primary', onclick: () => { settings.voiceOn = true; saveSettings(); Speech.speak(sample); } }, 'Ausprobieren'),
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


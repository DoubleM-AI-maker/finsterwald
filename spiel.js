'use strict';
/* Spielablauf von "Nacht im Finsterwald": Rollenwahl, Nacht, Tag, Spielende.
   Reihenfolge und Regeln folgen dem offiziellen Regelheft der Gesamtausgabe (2014). */

// ---------- Rollen-Helfer ----------
const MOD = () => !!S.opt.mod;
const UNKNOWN = () => S.opt.mode === 'cards' && S.opt.mod;      // Moderator kennt die echten Karten anfangs nicht
const eff = p => p.actAs || p.role;                              // der Gaukler spielt zeitweise eine andere Rolle
const isWolf = p => WOLF_ROLES.includes(p.role) || !!p.infected || (p.role === 'wildkind' && !!p.turned) || (p.role === 'wolfshund' && p.side === 'wolf');
const deckCount = r => S.deck.filter(d => d === r).length;
const open = r => UNKNOWN() ? Math.max(0, deckCount(r) - S.players.filter(p => p.role === r).length) : 0; // Karten, deren Besitzer noch unbekannt ist
const holders = r => living().filter(p => eff(p) === r);
const holder = r => holders(r)[0];
// Rolle ist noch im Spiel und hat ihre Fähigkeit (stirbt der Alte durch das Dorf, verlieren Dorfbewohner ihre Fähigkeiten)
const can = r => (holders(r).length > 0 || open(r) > 0) && !(S.powerless && ROLES[r].team === 'dorf');
function neighbor(p, dir) { // nächster Spieler im Spiel, dir = 1: links (im Uhrzeigersinn), -1: rechts
  const n = S.players.length;
  for (let i = 1; i < n; i++) { const q = S.players[(p.id + dir * i + n * i) % n]; if (q.alive) return q; }
  return null;
}
function freshRole(k, p) { // Rolle wird neu übernommen (Gaukler, Magd): Fähigkeiten wie zu Spielbeginn
  if (k === 'hexe') { S.heal = true; S.poison = true; }
  if (k === 'fuchs') S.foxOut = false;
  if (k === 'beschuetzer') S.lastProtected = null;
  if (k === 'richter') S.judgeUsed = false;
  if (k === 'urwolf') S.infectUsed = false;
  if (k === 'alter') p.lives = 2;
  if (k === 'wildkind') { S.model = null; p.turned = false; }
  if (k === 'wolfshund') p.side = null;
}
const roleChip = (k, onclick) => h('button', { class: 'chip' + (onclick ? '' : ' static'), onclick }, roleIcon(k), h('span', { class: 'nm' }, ROLES[k].name));
// Einfacher Bildschirm: Erzähler, Inhalt, Knöpfe
function ask({ title, theme = 'night', help = 'night', text, speak = true, hint, read, body, buttons }) {
  show({ theme, title: title || `Nacht ${S.night}`, help, body: [narrator(text, speak, hint, read), body, h('div', { class: 'spacer' }),
    buttons.filter(Boolean).map(([label, fn, cls]) => h('button', { class: 'btn big ' + (cls || ''), onclick: () => { Speech.stop(); fn(); } }, label))] });
}

// Inhalt ersetzen; Listen und leere Einträge sind erlaubt
const put = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(Boolean));

// ---------- Rollen auswählen ----------
const openSets = new Set(['grund']);
function rolesScreen() {
  const n = setup.n;
  if (!setup.roles) setup.roles = recommend(n, setup.level);
  const r = setup.roles;
  const body = h('div', { class: 'stack' });
  const same = lvl => { const q = recommend(n, lvl); return [...new Set([...Object.keys(q), ...Object.keys(r)])].every(k => (q[k] || 0) === (r[k] || 0)); };
  const wolves = () => WOLF_ROLES.reduce((a, k) => a + (r[k] || 0), 0);

  function row(k) {
    const R = ROLES[k], c = R.count || 1, v = villagers(n, r);
    const blocked = !r[k] && k !== 'dieb' && v < c;
    const lastWolf = R.wolf && r[k] && wolves() <= 1;
    return h('div', { class: 'rolerow' + (r[k] ? '' : ' zero') }, roleIcon(k),
      h('div', { class: 'rtxt' }, h('b', {}, R.name + (c > 1 ? ` (${c} Karten)` : '')), h('span', {}, R.kurz)),
      h('button', { class: 'infobtn', 'aria-label': 'Erklärung', onclick: () => roleInfo(k) }, 'i'),
      k === 'werwolf'
        ? h('div', { class: 'stepper mini' },
          h('button', { disabled: !r.werwolf || wolves() <= 1, 'aria-label': 'Ein Wolf weniger', onclick: () => { r.werwolf--; draw(); } }, '−'),
          h('div', { class: 'num' }, r.werwolf || 0),
          h('button', { disabled: v <= 0, 'aria-label': 'Ein Wolf mehr', onclick: () => { r.werwolf = (r.werwolf || 0) + 1; draw(); } }, '+'))
        : h('button', { class: 'switch' + (r[k] ? ' on' : ''), role: 'switch', 'aria-checked': String(!!r[k]), 'aria-label': R.name,
          disabled: blocked || lastWolf, onclick: () => { r[k] = r[k] ? 0 : c; if (k === 'dieb' && villagers(n, r) < 0) r.dieb = 1; draw(); } }));
  }
  function draw() {
    const v = villagers(n, r), score = balance(n, r);
    const pos = Math.max(4, Math.min(96, 50 + score * 4));
    const verdict = v < 0 ? 'Es sind mehr Rollen gewählt, als Karten verteilt werden. Nehmt eine Rolle heraus.'
      : score < -5 ? 'Die Werwölfe haben es leichter. Nehmt eine Dorf-Rolle dazu oder einen Wolf weniger.'
      : score > 9 ? 'Das Dorf hat es deutlich leichter. Für mehr Spannung: eine Sonderrolle weglassen.'
      : score > 5 ? 'Das Dorf hat es etwas leichter – gut für die ersten Runden.'
      : 'Schön ausgeglichen!';
    if (r.gaukler) { const ok = GAUKLER_POOL.filter(k => !r[k]); setup.gPool = (setup.gPool || []).filter(k => ok.includes(k)); for (const k of ok) if (setup.gPool.length < 3 && !setup.gPool.includes(k)) setup.gPool.push(k); }
    put(body, 
      h('h2', { class: 'center' }, `Welche Rollen für ${n} Spieler?`),
      h('p', { class: 'center soft small' }, 'Tippt einen Vorschlag an – oder stellt die Rollen unten selbst zusammen.'),
      h('div', { class: 'presets four' }, Object.entries(LEVELS).map(([k, L]) =>
        h('button', { class: 'preset' + (same(k) ? ' sel' : ''), onclick: () => { setup.level = k; for (const x in r) delete r[x]; Object.assign(r, recommend(n, k)); draw(); } },
          k === 'klassisch' && h('span', { class: 'tag' }, 'Empfohlen'),
          h('span', { class: 't' }, L.name), h('span', { class: 'd' }, L.desc)))),
      Object.entries(SET_ROLES).map(([set, keys]) => {
        const on = keys.filter(k => r[k]).length;
        return h('details', { class: 'set', open: openSets.has(set), ontoggle: e => { e.target.open ? openSets.add(set) : openSets.delete(set); } },
          h('summary', {}, SETS[set], h('span', { class: 'soft small' }, on ? ` · ${on} gewählt` : '')),
          h('div', { class: 'in' }, keys.map(row)));
      }),
      h('div', { class: 'card' }, h('div', { class: 'rolerow' + (v > 0 ? '' : ' zero') }, roleIcon('dorfbewohner'),
        h('div', { class: 'rtxt' }, h('b', {}, 'Dorfbewohner'), h('span', {}, 'Alle übrigen Karten – wird automatisch aufgefüllt.' + (r.dieb ? ' Mit dem Dieb sind es zwei Karten mehr als Spieler.' : ''))),
        h('button', { class: 'infobtn', 'aria-label': 'Erklärung', onclick: () => roleInfo('dorfbewohner') }, 'i'),
        h('div', { class: 'count' }, Math.max(0, v)))),
      r.gaukler && h('div', { class: 'card stack' }, h('h3', {}, 'Auslage des Gauklers'),
        h('p', { class: 'small soft' }, 'Drei Rollen liegen offen aus. Tippt an, welche drei es sein sollen.'),
        h('div', { class: 'grid' }, GAUKLER_POOL.filter(k => !r[k]).map(k => { const on = setup.gPool.includes(k);
          const el = roleChip(k, () => { if (on) setup.gPool = setup.gPool.filter(x => x !== k); else { if (setup.gPool.length >= 3) setup.gPool.shift(); setup.gPool.push(k); } draw(); });
          if (on) el.classList.add('sel'); return el; }))),
      h('div', { class: 'card stack' },
        h('h3', {}, 'Ist das fair?'),
        h('div', { class: 'meter' }, h('i', { style: `left:${pos}%` })),
        h('div', { class: 'meterlabels' }, h('span', {}, 'Wölfe stärker'), h('span', {}, 'Dorf stärker')),
        h('p', {}, verdict)),
      h('div', { class: 'card stack' },
        h('h3', {}, 'Extras'),
        toggle('Hauptmann wählen', 'Das Dorf wählt vor der ersten Nacht einen Hauptmann. Seine Stimme zählt doppelt.', 'captain'),
        toggle('Seherin erfährt nur: Werwolf oder nicht', 'Hausregel statt der offiziellen Regel: Die Seherin sieht nicht die Karte, sondern erfährt nur, ob der Spieler zum Rudel gehört. Infizierte und Seitenwechsler auf Wolfsseite zählen als Werwolf.', 'seerSimple'),
        toggle('Schnelles Ende', 'Abweichend von der Regel endet das Spiel schon, sobald die Werwölfe nicht mehr überstimmt werden können.', 'quick'),
        toggle('Ereigniskarten „Neumond“', 'Die App erinnert jeden Morgen ab dem zweiten Tag daran, eine Ereigniskarte zu ziehen. Die Wirkung setzt der Spielleiter um.', 'events'),
        h('div', { class: 'stack' }, h('b', {}, 'Zeit zum Beraten'),
          h('div', { class: 'seg' }, [[0, 'Ohne Uhr'], [2, '2 Min.'], [3, '3 Min.'], [5, '5 Min.']].map(([m, t]) =>
            h('button', { class: setup.timer === m ? 'on' : '', onclick: () => { setup.timer = m; draw(); } }, t)))),
        h('div', { class: 'stack' }, h('b', {}, 'Wer bedient das Gerät?'),
          h('div', { class: 'seg' },
            h('button', { class: setup.mod ? 'on' : '', onclick: () => { setup.mod = true; draw(); } }, 'Ein Spielleiter (wie in der Regel)'),
            h('button', { class: !setup.mod ? 'on' : '', onclick: () => { setup.mod = false; draw(); } }, 'Niemand – Gerät in der Mitte')),
          h('p', { class: 'small soft' }, setup.mod
            ? 'Eine Person spielt nicht mit und hält das Gerät. Nachts zeigen die Spieler nur stumm, der Spielleiter tippt. So verrät sich niemand.'
            : 'Das Gerät liegt in der Mitte und die aufgerufene Rolle tippt selbst. Das geht ohne Spielleiter, ist aber leichter zu bemerken.')),
        h('div', { class: 'stack' }, h('b', {}, 'Wie werden die Rollen verteilt?'),
          h('div', { class: 'seg' },
            h('button', { class: setup.mode === 'app' ? 'on' : '', onclick: () => { setup.mode = 'app'; draw(); } }, 'Die App verteilt'),
            h('button', { class: setup.mode === 'cards' ? 'on' : '', onclick: () => { setup.mode = 'cards'; draw(); } }, 'Mit echten Karten')),
          h('p', { class: 'small soft' }, setup.mode === 'app'
            ? 'Das Gerät geht reihum. Jeder schaut sich heimlich seine Rolle an.'
            : setup.mod ? 'Ihr verteilt eure Spielkarten. In der ersten Nacht tippt der Spielleiter an, wer bei welcher Rolle aufwacht.'
            : 'Ihr verteilt eure Spielkarten. Danach geht das Gerät reihum und jeder tippt heimlich an, welche Karte er hat.'))),
      h('button', { class: 'btn primary big', disabled: v < 0 || (r.gaukler && setup.gPool.length !== 3), onclick: () => { saveSetup(); r.greis ? groupsScreen() : startGame(); } },
        r.greis ? 'Weiter' : setup.mode === 'app' ? 'Rollen verteilen' : setup.mod ? 'Spiel starten' : 'Karten eintragen'),
      h('button', { class: 'btn block', onclick: playersScreen }, 'Zurück'));
  }
  function toggle(name, desc, key) {
    return h('div', { class: 'row' }, h('div', { class: 'rtxt' }, h('b', {}, name), h('span', {}, desc)),
      h('button', { class: 'switch' + (setup[key] ? ' on' : ''), role: 'switch', 'aria-checked': String(!!setup[key]), 'aria-label': name, onclick: () => { setup[key] = !setup[key]; draw(); } }));
  }
  show({ theme: 'night', title: 'Schritt 2 von 3', help: 'roles', body });
  draw();
}
// Verbitterter Greis: Das Dorf wird offen in zwei Gruppen geteilt.
function groupsScreen() {
  const n = setup.n;
  setup.groups = Array.from({ length: n }, (_, i) => (setup.groups || [])[i] || (i < n / 2 ? 'A' : 'B'));
  const body = h('div', { class: 'stack' });
  const draw = () => put(body, 
    h('h2', { class: 'center' }, 'Zwei Gruppen für den Verbitterten Greis'),
    h('p', { class: 'center soft small' }, 'Teilt das Dorf nach einem sichtbaren Merkmal in zwei Gruppen, zum Beispiel Brille oder keine Brille. Tippt einen Spieler an, um die Gruppe zu wechseln. Sagt die Einteilung laut an.'),
    h('div', { class: 'grid' }, setup.groups.map((g, i) => {
      const el = chip({ id: i, name: setup.names[i] || `Spieler ${i + 1}` }, { sub: 'Gruppe ' + g, cls: g === 'A' ? 'sel' : '', onclick: () => { setup.groups[i] = g === 'A' ? 'B' : 'A'; draw(); } });
      return el; })),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn primary big', disabled: !setup.groups.includes('A') || !setup.groups.includes('B'), onclick: () => { saveSetup(); startGame(); } }, setup.mode === 'app' ? 'Rollen verteilen' : setup.mod ? 'Spiel starten' : 'Karten eintragen'),
    h('button', { class: 'btn block', onclick: rolesScreen }, 'Zurück'));
  show({ theme: 'night', title: 'Schritt 2 von 3', help: 'roles', body });
  draw();
}

// ---------- Rollen verteilen ----------
function startGame() {
  const n = setup.n, r = setup.roles, deck = [];
  for (const k in r) for (let i = 0; i < (r[k] || 0); i++) deck.push(k);
  while (deck.length < cardsFor(n, r)) deck.push('dorfbewohner');
  let dealt = null;
  if (setup.mode === 'app') {
    dealt = shuffle(deck);
    while (r.dieb && dealt.indexOf('dieb') >= n) dealt = shuffle(deck); // der Dieb soll bei einem Spieler landen
  }
  run++;
  S = {
    players: Array.from({ length: n }, (_, i) => ({ id: i, name: setup.names[i] || `Spieler ${i + 1}`, role: dealt ? dealt[i] : null, alive: true, group: r.greis ? setup.groups[i] : null })),
    opt: { captain: setup.captain, timer: setup.timer, mode: setup.mode, mod: setup.mod, quick: setup.quick, events: setup.events, seerSimple: !!setup.seerSimple },
    deck, middle: dealt ? dealt.slice(n) : [], thief: !!r.dieb, gPool: r.gaukler ? [...setup.gPool] : [],
    night: 0, day: 0, phase: 'deal', heal: true, poison: true, lastProtected: null, lovers: [], captain: null, pendingHunters: [], nd: null,
    engelLive: !!r.engel, model: null,
  };
  keepAwake();
  if (UNKNOWN()) dealDone(); else handover(0);
}
function handover(i) {
  if (i >= S.players.length) return dealDone();
  const p = P(i);
  show({ theme: 'night', title: `Schritt 3 von 3 · ${i + 1}/${S.players.length}`, help: 'deal', body: [
    narrator('Das Gerät geht jetzt weiter. Alle anderen schauen weg!'),
    h('div', { class: 'handover card' }, av(p), h('div', { class: 'nm' }, p.name)),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn primary big', onclick: () => { Speech.stop(); S.opt.mode === 'app' ? showCard(i) : chooseCard(i); } }, `Ich bin ${p.name}`),
  ] });
}
function showCard(i) {
  const p = P(i), R = ROLES[p.role];
  show({ theme: 'night', title: p.name, help: 'deal', body: [
    h('div', { class: 'bigcard', style: `--rc:${R.color}` },
      h('div', { class: 'em' }, R.emoji), h('p', {}, 'Du bist:'), h('h2', {}, R.name), h('p', {}, R.lang),
      h('div', { class: 'team' }, TEAMS[R.team])),
    h('p', { class: 'center soft small' }, 'Niemand darf deine Rolle sehen. Die App liest sie nicht laut vor.'),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn primary big', onclick: () => handover(i + 1) }, 'Gemerkt – verstecken'),
  ] });
}
function chooseCard(i) {
  const p = P(i);
  show({ theme: 'night', title: p.name, help: 'deal', body: [
    h('h2', { class: 'center' }, 'Welche Karte hast du?'),
    h('p', { class: 'center soft small' }, 'Tippe heimlich deine Karte an.'),
    h('div', { class: 'grid' }, ROLE_ORDER.filter(k => S.deck.includes(k)).map(k => roleChip(k, () => { p.role = k; handover(i + 1); }))),
  ] });
}
function dealDone() {
  if (S.opt.mode === 'cards' && !S.opt.mod) { // eingetippte Karten müssen zu den gewählten Rollen passen
    const rest = [...S.deck];
    const ok = S.players.every(p => { const ix = rest.indexOf(p.role); if (ix < 0) return false; rest.splice(ix, 1); return true; });
    if (!ok) {
      S.players.forEach(p => { p.role = null; });
      return show({ theme: 'night', title: 'Bitte noch einmal', help: 'deal', body: [
        narrator('Die eingetippten Karten passen nicht zu den ausgewählten Rollen. Bitte tragt eure Karten noch einmal ein.'),
        h('div', { class: 'card' }, h('p', {}, 'Im Spiel sollten sein: ' + ROLE_ORDER.filter(k => S.deck.includes(k)).map(k => `${deckCount(k)}× ${ROLES[k].name}`).join(', ') + '.')),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn primary big', onclick: () => handover(0) }, 'Noch einmal eintragen'),
        h('button', { class: 'btn block', onclick: () => { S = null; rolesScreen(); } }, 'Rollen ändern'),
      ] });
    }
    S.middle = rest;
  }
  const pure = S.players.find(p => p.role === 'reineseele');
  const notes = [
    S.opt.mod && (S.opt.mode === 'cards' ? 'Verteilt jetzt die Karten. Nur du schaust ab hier auf den Bildschirm. In der Nacht zeigen die Spieler stumm, du tippst.' : 'Nur du schaust ab hier auf den Bildschirm. In der Nacht zeigen die Spieler stumm, du tippst.'),
    S.thief && S.opt.mode === 'cards' && 'Legt die zwei übrigen Karten verdeckt in die Mitte.',
    S.gPool.length && `Legt für den Gaukler offen aus: ${list(S.gPool.map(k => ROLES[k].name))}.`,
    S.engelLive && 'Der Engel spielt mit: Das Spiel beginnt deshalb mit einem Tag und einer Abstimmung.',
  ].filter(Boolean).join(' ');
  show({ theme: 'dusk', title: 'Gleich geht es los', help: 'ready', body: [
    narrator(S.opt.mod ? 'Alle kennen jetzt ihre Rolle. Der Moderator behält das Gerät in der Hand. Wenn ihr bereit seid, beginnt die erste Nacht.' : 'Alle kennen jetzt ihre Rolle. Legt das Gerät in die Mitte, sodass jeder es erreichen kann. Dreht den Ton laut. Wenn ihr bereit seid, beginnt die erste Nacht.',
      true, notes, pure ? `${pure.name} ist die Reine Seele: ein einfacher Dorfbewohner, dem alle vertrauen können.` : null),
    h('div', { class: 'card stack' }, h('h3', {}, 'So läuft das Spiel'),
      h('ul', { class: 'tips' },
        h('li', {}, 'In der Nacht machen alle die Augen zu. Der Erzähler ruft die Rollen einzeln auf.'),
        h('li', {}, S.opt.mod ? 'Wer aufgerufen wird, öffnet leise die Augen und zeigt stumm. Der Spielleiter tippt.' : 'Wer aufgerufen wird, öffnet leise die Augen und tippt auf dem Gerät.'),
        h('li', {}, 'Am Tag beraten alle zusammen und stimmen ab, wer ein Werwolf sein könnte.'),
        h('li', {}, 'Wer ausgeschieden ist, deckt seine Karte auf, verrät nichts mehr und schaut still zu.'))),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn primary big', onclick: () => electCaptain('dusk', () => S.engelLive ? startDay() : beginNight()) }, S.opt.captain ? 'Hauptmann wählen' : S.engelLive ? 'Der erste Tag beginnt' : 'Die Nacht beginnt'),
  ] });
}
// Der Hauptmann wird laut Regel vor Spielbeginn gewählt (relative Mehrheit, Amt darf nicht abgelehnt werden).
function electCaptain(theme, next) {
  if (!S.opt.captain || S.captain != null || S.noCaptain) return next();
  picker({ theme, title: 'Hauptmann-Wahl', help: 'hauptmann', confirm: 'Zum Hauptmann machen',
    text: 'Das Dorf wählt einen Hauptmann. Wer möchte, stellt sich kurz vor. Dann zählt ihr bis drei und alle zeigen auf ihren Wunsch-Hauptmann. Tippt den Spieler mit den meisten Stimmen an.',
    onDone: id => { S.captain = id; next(); } });
}

// ---------- Nacht ----------
// Aufrufreihenfolge nach der Übersicht im Regelheft. Welche Schritte anfallen, wird laufend neu geprüft.
const NIGHT = ['dieb', 'gaukler', 'amor', 'seherin', 'fuchs', 'lovers', 'richter', 'schwestern', 'brueder', 'wildkind', 'wolfshund', 'baerenfuehrer', 'greis',
  'rabe', 'beschuetzer', 'werwolf', 'weisserwolf', 'urwolf', 'grosserwolf', 'fuchs2', 'seherin2', 'hexe', 'floetenspieler', 'verzaubert'];
function due(id) {
  const n1 = S.night === 1, nd = S.nd;
  switch (id) {
    case 'dieb': return n1 && can('dieb');
    case 'gaukler': return can('gaukler') && S.gPool.length > 0;
    case 'amor': return n1 && can('amor');
    case 'lovers': return S.lovers.length === 2 && !S.loversMet;
    case 'seherin': return can('seherin') && !(S.opt.seerSimple && UNKNOWN() && n1);
    case 'seherin2': return can('seherin') && S.opt.seerSimple && UNKNOWN() && n1; // Hausregel: erst wenn die Wölfe bekannt sind
    case 'fuchs': return can('fuchs') && !S.foxOut && !(UNKNOWN() && n1);
    case 'fuchs2': return can('fuchs') && !S.foxOut && UNKNOWN() && n1; // mit echten Karten erst, wenn die Wölfe bekannt sind
    case 'richter': return n1 && MOD() && can('richter');
    case 'schwestern': case 'brueder': return n1 && can(id);
    case 'wildkind': return can('wildkind') && S.model == null && !holders('wildkind').some(p => p.turned);
    case 'wolfshund': return can('wolfshund') && ((n1 && open('wolfshund') > 0) || holders('wolfshund').some(p => !p.side));
    case 'baerenfuehrer': case 'greis': return n1 && open(id) > 0; // nur damit der Spielleiter weiß, wer es ist
    case 'werwolf': return living().some(isWolf) || WOLF_ROLES.some(r => open(r) > 0);
    case 'weisserwolf': return S.night % 2 === 0 && can('weisserwolf');
    case 'urwolf': return can('urwolf') && !S.infectUsed && nd.victims.length > 0;
    case 'grosserwolf': return can('grosserwolf') && !S.wolfLost;
    case 'hexe': return can('hexe') && (S.heal || S.poison);
    case 'verzaubert': return nd.enchant.length > 0;
    default: return can(id); // rabe, beschuetzer, floetenspieler
  }
}
function beginNight() { S.night++; S.phase = 'night'; save(); runNight(); }
function sleepScreen(text, onNext) {
  show({ theme: 'night', title: `Nacht ${S.night}`, help: 'night', body: [
    h('div', { class: 'sleep' }, h('h2', {}, 'Alle Augen bleiben geschlossen')),
    narrator(text, false),
    onNext && h('div', { class: 'spacer' }),
    onNext && h('button', { class: 'btn primary big', onclick: onNext }, 'Weiter'),
  ] });
}
async function runNight() {
  const t = run;
  S.players.forEach(p => { p.actAs = null; });
  S.nd = { protect: null, victims: [], infect: null, healed: null, poison: null, white: null, enchant: [], raven: null };
  const intro = S.night === 1
    ? 'Es wird Nacht im Finsterwald. Der Mond steigt über die Bäume, und im Dorf wird es ganz still. Alle schließen jetzt die Augen.'
    : 'Der Tag geht zu Ende. Es wird wieder Nacht im Finsterwald. Alle schließen die Augen.';
  sleepScreen(intro);
  await Speech.speak(intro); await wait(1500);
  if (t === run) nightStep(0);
}
function nightStep(k) {
  let i = k;
  while (i < NIGHT.length && !due(NIGHT[i])) i++;
  if (i >= NIGHT.length) return morning();
  const id = NIGHT[i].replace(/2$/, ''); // fuchs2 und seherin2 sind dieselben Schritte an späterer Stelle
  STEP[id](line => sleepThen(i, line), () => nightStep(i + 1));
}
// Rolle schläft ein, kurze Pause, dann ist die nächste dran. Ohne Aufnahme liest der Spielleiter und tippt weiter.
function sleepThen(i, line) {
  const t = run;
  if (!allClips(line)) return sleepScreen(line, () => nightStep(i + 1));
  sleepScreen(line);
  Speech.speak(line).then(() => wait(1800)).then(() => { if (t === run) nightStep(i + 1); });
}
// Mit echten Karten kennt der Spielleiter die Rollen nicht: beim ersten Aufwachen antippen, wer es ist.
// go(gesprochen, niemand): niemand = die Karte liegt beim Dieb in der Mitte.
function register(role, text, go, { pool, n } = {}) {
  const cand = living().filter(pool || (p => p.role == null));
  n = Math.min(n == null ? open(role) : n, cand.length);
  if (!UNKNOWN() || n <= 0) return go(false, false);
  const R = ROLES[role], min = S.thief ? 0 : n;
  picker({ title: `Nacht ${S.night}`, help: 'register', count: n, min, multi: true, text, confirm: 'Weiter',
    hint: (n === 1 ? `Wer hat die Augen geöffnet? Tippe an, wer die Rolle „${R.name}“ hat.` : `Wer hat die Augen geöffnet? Tippe die ${n} ${R.plural} an.`)
      + (min === 0 ? ' Wacht niemand auf, liegt die Karte in der Mitte: dann ohne Auswahl bestätigen.' : ''),
    rule: p => cand.includes(p) ? {} : { off: true },
    onDone: ids => {
      ids.forEach(id => { P(id).role = role; });
      for (let x = ids.length; x < n; x++) { const ix = S.deck.findIndex(d => d === role || (role === 'werwolf' && WOLF_ROLES.includes(d))); if (ix >= 0) S.deck.splice(ix, 1); }
      go(true, ids.length === 0);
    } });
}
// Rolle wacht auf und zeigt auf einen Spieler.
function pickStep(role, { text, sleep, help, confirm, hint, rule, skipLabel, pool, onPick }, next) {
  register(role, text, (spoken, none) => {
    if (none) return next(sleep);
    picker({ title: `Nacht ${S.night}`, help: help || 'night', confirm, text, speak: !spoken, hint: MOD() && hint, rule,
      extra: skipLabel && h('button', { class: 'btn block', onclick: () => { Speech.stop(); next(sleep); } }, skipLabel),
      onDone: id => onPick(id) !== false && next(sleep) });
  }, pool ? { pool } : undefined);
}
const STEP = {
  dieb(next) {
    const text = 'Dieb, wach auf! Sieh dir die beiden Karten in der Mitte an. Du darfst deine Karte gegen eine davon tauschen.';
    const done = () => next('Der Dieb schläft wieder ein.');
    if (!UNKNOWN()) {
      const p = S.players.find(q => q.role === 'dieb'), forced = S.middle.every(k => WOLF_ROLES.includes(k));
      const settle = k => { if (k) p.role = k; S.deck = S.players.map(q => q.role); S.middle = []; done(); };
      return ask({ help: 'dieb', text,
        hint: (MOD() ? `Zeige ${p.name} diesen Bildschirm. ` : '') + (forced ? 'Beide Karten sind Werwölfe: Der Dieb muss tauschen.' : 'Der Dieb darf tauschen oder seine Karte behalten.'),
        body: h('div', { class: 'grid' }, S.middle.map(k => roleChip(k))),
        buttons: [...S.middle.map((k, i) => [`${ROLES[k].name} nehmen`, () => settle(k), i ? '' : 'primary']), !forced && ['Eigene Karte behalten', () => settle(null)]] });
    }
    register('dieb', text, (spoken, none) => {
      if (none) return done();
      const p = S.players.find(q => q.alive && q.role === 'dieb');
      const swap = k => { p.role = k; const ix = S.deck.indexOf('dieb'); if (ix >= 0) S.deck.splice(ix, 1); done(); };
      ask({ help: 'dieb', text, speak: !spoken,
        hint: `Zeige ${p.name} die beiden Karten aus der Mitte. Sind beide Werwölfe, muss der Dieb tauschen. Welche Karte hat ${p.name} danach?`,
        body: h('div', { class: 'grid' }, ROLE_ORDER.filter(k => k !== 'dieb' && open(k) > 0).map(k => roleChip(k, () => { Speech.stop(); swap(k); }))),
        buttons: [['Behält die eigene Karte', done, 'primary']] });
    });
  },
  gaukler(next) {
    const text = 'Gaukler, wach auf! Wähle eine der ausliegenden Rollen. Du spielst sie bis zur nächsten Nacht.';
    const sleep = 'Der Gaukler schläft wieder ein.';
    register('gaukler', text, (spoken, none) => {
      if (none) return next(sleep);
      const p = S.players.find(q => q.alive && q.role === 'gaukler');
      ask({ help: 'gaukler', text, speak: !spoken, hint: MOD() && `Tippe die Rolle an, auf die ${p.name} zeigt, und nimm die Karte danach aus der Auslage.`,
        body: h('div', { class: 'grid' }, S.gPool.map(k => roleChip(k, () => { Speech.stop(); p.actAs = k; S.gPool = S.gPool.filter(x => x !== k); freshRole(k, p); next(sleep); }))),
        buttons: [['Heute keine Rolle', () => next(sleep)]] });
    });
  },
  amor(next, skip) {
    const text = MOD() ? 'Amor, wach auf! Zeige mir zwei Spieler, die sich ineinander verlieben sollen. Du darfst auch auf dich selbst zeigen.'
      : 'Amor, wach auf! Tippe zwei Spieler an, die sich ineinander verlieben sollen. Du darfst auch dich selbst wählen.';
    register('amor', text, (spoken, none) => {
      if (none) return next('Amor schläft wieder ein.');
      picker({ title: `Nacht ${S.night}`, help: 'amor', count: 2, confirm: 'Diese zwei verlieben', text, speak: !spoken,
        hint: MOD() && 'Tippe die beiden Spieler an, auf die Amor zeigt.',
        onDone: ids => { S.lovers = ids; MOD() ? next('Amor schläft wieder ein.') : STEP.lovers(next); } });
    });
  },
  lovers(next) {
    const m = MOD(), names = list(S.lovers.map(id => P(id).name));
    S.loversMet = true;
    const text = m ? 'Ich gehe nun durch das Dorf und berühre die beiden Verliebten an der Schulter.'
      : 'Amor, steh leise auf und tippe den beiden Verliebten sanft auf die Schulter. Setz dich dann wieder hin und drücke auf den Knopf.';
    ask({ help: 'amor', text, hint: m && `Geh leise herum und tippe ${names} auf die Schulter. Drücke danach auf „Erledigt“.`,
      body: h('div', { class: 'card center' }, h('div', { class: 'pair' }, S.lovers.map(id => av(P(id)))), h('h2', {}, S.lovers.map(id => P(id).name).join(' & '))),
      buttons: [['Erledigt', async () => {
        const t = run, a = (m ? '' : 'Amor schläft wieder ein. ') + 'Wer eben an der Schulter berührt wurde, ist jetzt verliebt. Die Verliebten wachen auf und schauen sich an.';
        sleepScreen(a); await Speech.speak(a); await wait(5000);
        if (t === run) next('Die Verliebten schlafen wieder ein.');
      }, 'primary']] });
  },
  seherin(next) {
    const m = MOD(), sleep = 'Die Seherin schläft wieder ein.';
    pickStep('seherin', { sleep, help: 'seherin', confirm: 'Ansehen',
      text: m ? 'Seherin, wach auf! Zeige auf einen Spieler, dessen wahre Gestalt du sehen möchtest.' : 'Seherin, wach auf! Tippe einen Spieler an, über den du die Wahrheit wissen möchtest.',
      hint: 'Tippe den Spieler an, auf den die Seherin zeigt.',
      rule: p => eff(p) === 'seherin' ? { off: true, sub: m ? 'Seherin' : 'das bist du' } : {},
      onPick: id => {
        const p = P(id), R = p.role && ROLES[p.role]; // mit echten Karten kann die Rolle noch unbekannt sein
        if (S.opt.seerSimple) { // Hausregel: nur Werwolf oder nicht – wer nachts mit dem Rudel aufwacht, zählt als Werwolf
          const wolf = isWolf(p);
          show({ theme: 'night', title: `Nacht ${S.night}`, help: 'seherin', body: [
            m && narrator('Seherin, ich gebe dir jetzt ein Zeichen. Daumen nach unten bedeutet: ein Werwolf. Daumen nach oben bedeutet: kein Werwolf.', true,
              wolf ? 'Zeige der Seherin den Daumen nach unten.' : 'Zeige der Seherin den Daumen nach oben.'),
            h('div', { class: 'reveal ' + (wolf ? 'bad' : 'ok') }, `${p.name} ist ${wolf ? 'ein Werwolf' : 'kein Werwolf'}`),
            !m && h('p', { class: 'center soft' }, 'Merk es dir gut – das wird nicht vorgelesen.'),
            h('div', { class: 'spacer' }),
            h('button', { class: 'btn primary big', onclick: () => { Speech.stop(); next(sleep); } }, m ? 'Erledigt' : 'Gemerkt'),
          ] });
          return false;
        }
        const sign = 'Seherin, ich zeige dir jetzt die Karte dieses Spielers.';
        show({ theme: 'night', title: `Nacht ${S.night}`, help: 'seherin', body: [
          m && narrator(sign, true, R ? `Zeige der Seherin kurz diesen Bildschirm: ${p.name} hat die Rolle „${R.name}“.` : `Hebe die Karte von ${p.name} verdeckt an und zeige sie nur der Seherin.`),
          R && h('div', { class: 'reveal ' + (R.wolf ? 'bad' : 'ok') }, h('div', { class: 'pair' }, roleIcon(p.role)), `${p.name}: ${R.name}`),
          !m && h('p', { class: 'center soft' }, 'Merk es dir gut – das wird nicht vorgelesen.'),
          h('div', { class: 'spacer' }),
          h('button', { class: 'btn primary big', onclick: () => { Speech.stop(); next(sleep); } }, m ? 'Erledigt' : 'Gemerkt'),
        ] });
        return false;
      } }, next);
  },
  fuchs(next) {
    const m = MOD(), sleep = 'Der Fuchs schläft wieder ein.';
    pickStep('fuchs', { sleep, help: 'fuchs', confirm: 'Prüfen', skipLabel: 'Der Fuchs verzichtet heute',
      text: m ? 'Fuchs, wach auf! Zeige auf einen Spieler. Ich verrate dir, ob er oder einer seiner beiden Nachbarn ein Werwolf ist.'
        : 'Fuchs, wach auf! Tippe einen Spieler an. Du erfährst, ob er oder einer seiner beiden Nachbarn ein Werwolf ist.',
      hint: 'Tippe den Spieler in der Mitte der Dreiergruppe an, auf den der Fuchs zeigt.',
      onPick: id => {
        const p = P(id), grp = [...new Set([neighbor(p, -1), p, neighbor(p, 1)].filter(Boolean))], wolf = grp.some(isWolf);
        if (!wolf) S.foxOut = true;
        const sign = 'Fuchs, ich gebe dir jetzt ein Zeichen. Daumen nach unten bedeutet: Hier ist mindestens ein Werwolf. Daumen nach oben bedeutet: kein Werwolf.';
        show({ theme: 'night', title: `Nacht ${S.night}`, help: 'fuchs', body: [
          m && narrator(sign, true, wolf ? 'Zeige dem Fuchs den Daumen nach unten.' : 'Zeige dem Fuchs den Daumen nach oben. Er verliert damit seine Fähigkeit.'),
          h('div', { class: 'reveal ' + (wolf ? 'bad' : 'ok') }, `${list(grp.map(q => q.name))}: ${wolf ? 'mindestens ein Werwolf' : 'kein Werwolf'}`),
          !m && h('p', { class: 'center soft' }, wolf ? 'Du darfst deine Fähigkeit in der nächsten Nacht wieder nutzen.' : 'Diese drei sind unschuldig. Deine Fähigkeit ist damit verbraucht.'),
          h('div', { class: 'spacer' }),
          h('button', { class: 'btn primary big', onclick: () => { Speech.stop(); next(sleep); } }, m ? 'Erledigt' : 'Gemerkt'),
        ] });
        return false;
      } }, next);
  },
  richter(next) {
    const text = 'Stotternder Richter, wach auf! Zeige mir das geheime Zeichen, mit dem du am Tag eine zweite Abstimmung verlangst.';
    register('richter', text, spoken => ask({ text, speak: !spoken, hint: 'Merke dir das Zeichen. Gibt der Richter es während einer Abstimmung, folgt sofort eine zweite.',
      buttons: [['Zeichen gemerkt', () => next('Der Richter schläft wieder ein.'), 'primary']] }));
  },
  schwestern(next) { STEP.family('schwestern', 'Die zwei Schwestern wachen auf und erkennen sich.', 'Die Schwestern schlafen wieder ein.', next); },
  brueder(next) { STEP.family('brueder', 'Die drei Brüder wachen auf und erkennen sich.', 'Die Brüder schlafen wieder ein.', next); },
  family(role, text, sleep, next) {
    register(role, text, (spoken, none) => none ? next(sleep) : ask({ text, speak: !spoken,
      hint: MOD() && `${list(holders(role).map(p => p.name))} sehen sich an. Gib ihnen einen Moment.`, buttons: [['Weiter', () => next(sleep), 'primary']] }));
  },
  wildkind(next) {
    pickStep('wildkind', { sleep: 'Das Wilde Kind schläft wieder ein.', confirm: 'Vorbild festlegen',
      text: MOD() ? 'Wildes Kind, wach auf! Zeige auf den Spieler, den du dir zum Vorbild nimmst.' : 'Wildes Kind, wach auf! Tippe den Spieler an, den du dir zum Vorbild nimmst.',
      hint: 'Tippe den Spieler an, auf den das Wilde Kind zeigt.',
      rule: p => eff(p) === 'wildkind' ? { off: true } : {},
      onPick: id => { S.model = id; } }, next);
  },
  wolfshund(next) {
    const text = MOD() ? 'Wolfshund, wach auf! Entscheide dich: Daumen nach oben für das Dorf, Daumen nach unten für die Werwölfe.'
      : 'Wolfshund, wach auf! Entscheide dich, ob du für das Dorf oder für die Werwölfe spielst.';
    const sleep = 'Der Wolfshund schläft wieder ein.';
    register('wolfshund', text, (spoken, none) => {
      if (none) return next(sleep);
      const p = S.players.find(q => q.alive && q.role === 'wolfshund' && !q.side);
      ask({ text, speak: !spoken, hint: MOD() && `Tippe an, wie sich ${p.name} entscheidet.`,
        buttons: [['Spielt für das Dorf', () => { p.side = 'dorf'; next(sleep); }, 'primary'], ['Spielt mit den Werwölfen', () => { p.side = 'wolf'; next(sleep); }]] });
    });
  },
  baerenfuehrer(next) { register('baerenfuehrer', 'Bärenführer, wach kurz auf und gib mir ein Zeichen.', () => next('Der Bärenführer schläft wieder ein.')); },
  greis(next) { register('greis', 'Verbitterter Greis, wach kurz auf und gib mir ein Zeichen.', () => next('Der Greis schläft wieder ein.')); },
  rabe(next) {
    pickStep('rabe', { sleep: 'Der Rabe schläft wieder ein.', confirm: 'Anschwärzen', skipLabel: 'Der Rabe verzichtet heute',
      text: MOD() ? 'Rabe, wach auf! Zeige auf den Spieler, den du anschwärzen möchtest.' : 'Rabe, wach auf! Tippe den Spieler an, den du anschwärzen möchtest.',
      hint: 'Tippe den Spieler an, auf den der Rabe zeigt.',
      onPick: id => { S.nd.raven = id; } }, next);
  },
  beschuetzer(next) {
    pickStep('beschuetzer', { sleep: 'Der Heiler schläft wieder ein.', help: 'beschuetzer', confirm: 'Beschützen',
      text: MOD() ? 'Heiler, wach auf! Zeige auf den Spieler, den du heute Nacht beschützen möchtest.' : 'Heiler, wach auf! Wen möchtest du heute Nacht beschützen?',
      hint: 'Tippe den Spieler an, auf den der Heiler zeigt.',
      rule: p => p.id === S.lastProtected ? { off: true, sub: 'letzte Nacht' } : {},
      onPick: id => { S.nd.protect = id; } }, next);
  },
  werwolf(next) {
    const m = MOD();
    const girl = can('maedchen') ? ' Das kleine Mädchen darf jetzt vorsichtig blinzeln.' : '';
    const first = S.night === 1 ? ' Schaut euch um und erkennt euch.' : '';
    const text = m ? `Werwölfe, wacht auf!${first} Einigt euch lautlos auf ein Opfer und zeigt gemeinsam darauf.${girl}`
      : `Werwölfe, wacht auf!${first} Einigt euch leise mit Handzeichen auf ein Opfer und tippt es an.${girl}`;
    register('werwolf', text, spoken => {
      const joined = living().filter(p => isWolf(p) && !p.pack && !WOLF_ROLES.includes(p.role));
      living().forEach(p => { if (isWolf(p)) p.pack = true; });
      picker({ title: `Nacht ${S.night}`, help: 'werwolf', confirm: 'Opfer festlegen', text, speak: !spoken,
        hint: [m && 'Tippe das Opfer an, auf das die Werwölfe zeigen.',
          joined.length && `Neu im Rudel: ${list(joined.map(p => p.name))}. Tippt ${joined.length > 1 ? 'ihnen' : 'dieser Person'} zum Aufwachen leise auf die Schulter.`].filter(Boolean).join(' '),
        rule: p => isWolf(p) ? { off: true, badge: '🐺', sub: 'Wolf' } : {},
        onDone: id => { S.nd.victims = [id]; next('Die Werwölfe schlafen wieder ein.'); } });
    }, { n: WOLF_ROLES.reduce((a, r) => a + open(r), 0) });
  },
  weisserwolf(next) {
    pickStep('weisserwolf', { sleep: 'Der Weiße Werwolf schläft wieder ein.', confirm: 'Ausschalten', skipLabel: 'Der Weiße Werwolf verzichtet',
      pool: p => p.role === 'werwolf',
      text: MOD() ? 'Weißer Werwolf, wach auf! Wenn du möchtest, zeige auf einen Werwolf, den du ausschalten willst.' : 'Weißer Werwolf, wach auf! Wenn du möchtest, tippe einen Werwolf an, den du ausschalten willst.',
      hint: 'Tippe den Werwolf an, auf den der Weiße Werwolf zeigt.',
      rule: p => isWolf(p) && p.role !== 'weisserwolf' ? {} : { off: true },
      onPick: id => { S.nd.white = id; } }, next);
  },
  urwolf(next) {
    const v = P(S.nd.victims[0]), sleep = 'Der Urwolf schläft wieder ein.';
    const text = MOD() ? 'Urwolf, wach auf! Möchtest du das Opfer dieser Nacht infizieren, statt es zu fressen? Nicke oder schüttle den Kopf.'
      : 'Urwolf, wach auf! Möchtest du das Opfer dieser Nacht infizieren, statt es zu fressen?';
    register('urwolf', text, (spoken, none) => none ? next(sleep) : ask({ text, speak: !spoken,
      hint: `Das Opfer ist ${v.name}. Das Infizieren geht nur einmal im Spiel.`,
      buttons: [[`${v.name} infizieren`, () => { S.nd.infect = v.id; S.infectUsed = true; next(sleep); }], ['Nicht infizieren', () => next(sleep), 'primary']] }),
    { pool: p => p.role === 'werwolf' });
  },
  grosserwolf(next) {
    pickStep('grosserwolf', { sleep: 'Der Große böse Wolf schläft wieder ein.', confirm: 'Zweites Opfer festlegen', skipLabel: 'Kein zweites Opfer',
      pool: p => p.role === 'werwolf',
      text: MOD() ? 'Großer böser Wolf, wach auf! Zeige auf ein zweites Opfer.' : 'Großer böser Wolf, wach auf! Tippe ein zweites Opfer an.',
      hint: 'Tippe das Opfer an, auf das der Große böse Wolf zeigt.',
      rule: p => isWolf(p) ? { off: true, badge: '🐺', sub: 'Wolf' } : S.nd.victims.includes(p.id) ? { off: true, sub: 'schon Opfer' } : {},
      onPick: id => { S.nd.victims.push(id); } }, next);
  },
  hexe(next) {
    const nd = S.nd, m = MOD(), title = `Nacht ${S.night}`, sleep = 'Die Hexe schläft wieder ein.';
    // Opfer, die die Hexe retten könnte: nicht infiziert und nicht ohnehin vom Heiler geschützt
    const hits = nd.victims.filter(v => v !== nd.infect && !(v === nd.protect && eff(P(v)) !== 'maedchen')).map(P);
    const text = m ? 'Hexe, wach auf! Ich zeige dir jetzt, wen die Werwölfe ausgewählt haben. Möchtest du dein Opfer heilen, dann nicke. Möchtest du jemanden vergiften, dann zeige auf diesen Spieler. Möchtest du nichts tun, dann schüttle den Kopf.'
      : 'Hexe, wach auf! Auf dem Bildschirm siehst du, wen die Werwölfe angegriffen haben. Möchtest du einen deiner Zaubertränke benutzen?';
    const hint = m && (hits.length ? `Zeige stumm auf ${list(hits.map(p => p.name))}. Tippe dann an, was die Hexe entscheidet.` : 'Heute Nacht wurde niemand verletzt. Warte kurz ab, ob die Hexe jemanden vergiften möchte.');
    const draw = speak => show({ theme: 'night', title, help: 'hexe', body: [
      narrator(text, speak, hint),
      h('div', { class: 'card center' }, hits.length
        ? [h('div', { class: 'pair' }, hits.map(av)), h('h2', {}, `${list(hits.map(p => p.name))} wurde${hits.length > 1 ? 'n' : ''} angegriffen`)]
        : h('h2', {}, 'Heute Nacht wurde niemand verletzt')),
      S.heal
        ? (hits.length ? hits.map(p => h('button', { class: 'btn big ' + (nd.healed === p.id ? 'good' : ''), onclick: () => { nd.healed = nd.healed === p.id ? null : p.id; draw(false); } },
          nd.healed === p.id ? `${p.name} wird gerettet (antippen zum Ändern)` : `Heiltrank: ${p.name} retten`))
          : h('button', { class: 'btn big', disabled: true }, 'Heiltrank (heute nicht nötig)'))
        : h('p', { class: 'center soft' }, 'Der Heiltrank ist schon verbraucht.'),
      S.poison
        ? h('button', { class: 'btn big ' + (nd.poison != null ? 'danger' : ''), onclick: () => {
          if (nd.poison != null) { nd.poison = null; return draw(false); }
          picker({ title, help: 'hexe', confirm: 'Vergiften', text: '', speak: false,
            hint: m ? 'Wen möchte die Hexe vergiften? Tippe den Spieler an, auf den sie zeigt.' : 'Tippe leise den Spieler an, den du vergiften möchtest.',
            rule: p => eff(p) === 'hexe' ? { off: true, sub: m ? 'Hexe' : 'das bist du' } : {},
            extra: h('button', { class: 'btn block', onclick: () => draw(false) }, 'Doch nicht'),
            onDone: id => { nd.poison = id; draw(false); } });
        } }, nd.poison != null ? `${P(nd.poison).name} wird vergiftet (antippen zum Ändern)` : 'Gifttrank benutzen')
        : h('p', { class: 'center soft' }, 'Der Gifttrank ist schon verbraucht.'),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn primary big', onclick: () => {
        Speech.stop();
        if (nd.healed != null) S.heal = false;
        if (nd.poison != null) S.poison = false;
        next(sleep);
      } }, nd.healed != null || nd.poison != null ? 'Fertig' : 'Fertig – nichts tun'),
    ] });
    register('hexe', text, (spoken, none) => none ? next(sleep) : draw(!spoken));
  },
  floetenspieler(next, skip) {
    const text = MOD() ? 'Flötenspieler, wach auf! Zeige auf zwei Spieler, die du verzaubern möchtest.' : 'Flötenspieler, wach auf! Tippe zwei Spieler an, die du verzaubern möchtest.';
    register('floetenspieler', text, (spoken, none) => {
      const cand = living().filter(p => eff(p) !== 'floetenspieler' && !p.enchanted);
      if (none || !cand.length) return next('Der Flötenspieler schläft wieder ein.');
      picker({ title: `Nacht ${S.night}`, count: Math.min(2, cand.length), multi: true, confirm: 'Verzaubern', text, speak: !spoken,
        hint: MOD() && 'Tippe die Spieler an, auf die der Flötenspieler zeigt.',
        rule: p => cand.includes(p) ? {} : { off: true, sub: p.enchanted ? 'verzaubert' : '' },
        onDone: ids => { S.nd.enchant = ids; skip(); } });
    });
  },
  verzaubert(next) {
    const fresh = S.nd.enchant.map(P), old = living().filter(p => p.enchanted);
    fresh.forEach(p => { p.enchanted = true; });
    S.nd.enchant = [];
    ask({ text: 'Der Flötenspieler schläft wieder ein. Alle Verzauberten wachen auf und erkennen sich.',
      hint: `Neu verzaubert: ${list(fresh.map(p => p.name))}. Tippt ihnen leise auf die Schulter.` + (old.length ? ` Schon vorher verzaubert: ${list(old.map(p => p.name))}.` : ''),
      buttons: [['Erledigt', () => next('Die Verzauberten schlafen wieder ein.'), 'primary']] });
  },
};

// ---------- Ausscheiden ----------
// Unbekannte Karte (Spiel mit echten Karten): Der Spielleiter sieht nach und tippt die Rolle an.
function askRole(p, cb, title) {
  const kinds = ROLE_ORDER.filter(k => open(k) > 0);
  if (kinds.length <= 1) { p.role = kinds[0] || 'dorfbewohner'; return cb(); }
  show({ theme: S.phase === 'night' ? 'dusk' : 'day', title: 'Karte ansehen', help: 'deaths', body: [
    h('div', { class: 'card center' }, h('div', { class: 'pair' }, av(p)), h('h2', {}, title || `${p.name} scheidet aus`)),
    h('p', { class: 'hint' }, h('b', {}, 'Moderator: '), `Sieh dir die Karte von ${p.name} an. Welche Rolle ist es?`),
    h('div', { class: 'grid' }, kinds.map(k => roleChip(k, () => { p.role = k; cb(); }))),
  ] });
}
// Lässt Spieler ausscheiden – mit allen Folgen (Liebeskummer, Jäger, Wildes Kind …) – und übergibt die Liste an done.
function kill(entries, done) {
  const out = [], q = [...entries];
  const step = () => {
    while (q.length) {
      const e = q.shift(), p = P(e.id);
      if (!p.alive) continue;
      if (p.role == null) return askRole(p, () => { q.unshift(e); step(); });
      const role = eff(p), wasWolf = isWolf(p);
      p.alive = false; out.push(e);
      if (role === 'alter' && !e.wolf && e.cause !== 'liebe' && e.cause !== 'hand' && !S.powerless) { S.powerless = true; S.powerNote = true; }
      if (S.lovers.includes(p.id)) { const o = S.lovers.find(x => x !== p.id); if (P(o).alive) q.push({ id: o, cause: 'liebe' }); }
      if (role === 'jaeger' && !S.powerless && !e.hidden) S.pendingHunters.push(p.id);
      if (role === 'engel' && S.engelLive && !e.hidden) S.engelWin = true;
      if (role === 'ritter' && e.wolf && !S.powerless) { // der nächste Werwolf zur Linken stirbt in der folgenden Nacht
        const n = S.players.length;
        for (let i = 1; i < n; i++) { const w = S.players[(p.id + i) % n]; if (w.alive && isWolf(w)) { S.rust = { id: w.id, night: S.night + 1 }; break; } }
      }
      if (wasWolf) S.wolfLost = true;
      if (S.model === p.id) holders('wildkind').forEach(w => { w.turned = true; });
    }
    done(out);
  };
  step();
}
const CAUSE = {
  nacht: n => `${n} ist in dieser Nacht ausgeschieden.`, // ob Werwölfe oder Gift, bleibt geheim
  liebe: n => `${n} ist vor Liebeskummer mitgegangen.`,
  jaeger: n => `Der Jäger hat ${n} getroffen.`,
  dorf: n => `Das Dorf schickt ${n} fort.`,
  suende: n => `${n} muss als Sündenbock gehen.`,
  rost: n => `${n} ist an der Wunde durch die rostige Klinge gestorben.`,
  hand: n => `${n} scheidet aus.`,
};
function announce({ theme, title, intro, some, none, extra, hint, deaths, next }) {
  const lines = deaths.map(d => { const p = P(d.id);
    return d.hidden ? `${CAUSE[d.cause](p.name)} Die Karte bleibt verdeckt: ${d.hidden} übernimmt sie als Ergebene Magd.` : `${CAUSE[d.cause](p.name)} ${p.name} hatte die Rolle: ${ROLES[p.role].name}.`; });
  if (S.powerNote) { lines.push('Das Dorf hat den Alten verloren. Alle Dorfbewohner verlieren ihre besonderen Fähigkeiten.'); S.powerNote = false; }
  const text = [intro, (deaths.length ? some : none) || '', extra || ''].filter(Boolean).join(' ');
  show({ theme, title, help: 'deaths', body: [
    narrator(text, true, hint, lines.join(' ') || null),
    deaths.map(d => { const p = P(d.id);
      return h('div', { class: 'card death' }, av(p),
        h('div', {}, h('h3', {}, p.name), h('p', { class: 'soft small' }, CAUSE[d.cause](p.name))),
        d.hidden ? h('div', { class: 'ro' }, 'Karte verdeckt') : h('div', { class: 'ro' }, roleIcon(p.role), ROLES[p.role].name)); }),
    !deaths.length && h('div', { class: 'card center' }, h('h2', {}, 'Alle sind noch da')),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn primary big', onclick: () => { Speech.stop(); next(); } }, 'Weiter'),
  ] });
}
// Erst Jäger, dann Spielende prüfen, dann Hauptmann-Nachfolge, dann weiter.
function afterDeaths(next) {
  const theme = S.phase === 'night' ? 'dusk' : 'day';
  if (S.pendingHunters.length) {
    const hunter = P(S.pendingHunters.shift());
    if (living().length === 0) return afterDeaths(next);
    return picker({ theme, title: 'Der Jäger', help: 'jaeger', confirm: 'Mitnehmen',
      text: 'Unter den Ausgeschiedenen ist der Jäger! Jäger, du darfst jetzt einen Spieler bestimmen, der mit dir ausscheidet.',
      hint: `Der Jäger ist ${hunter.name}.` + (MOD() ? ' Tippe den Spieler an, auf den er zeigt.' : ''),
      onDone: id => kill([{ id, cause: 'jaeger' }], deaths => announce({ theme, title: 'Der Jäger', intro: 'Der Jäger hat sich entschieden.', deaths, next: () => afterDeaths(next) })) });
  }
  const w = S.engelWin ? 'engel' : winner();
  if (w) return gameOver(w);
  if (S.opt.captain && S.captain != null && !P(S.captain).alive) {
    const old = P(S.captain);
    return picker({ theme, title: 'Neuer Hauptmann', help: 'hauptmann', confirm: 'Ernennen',
      text: 'Der Hauptmann ist ausgeschieden. Hauptmann, bestimme deinen Nachfolger.',
      hint: `${old.name} war der Hauptmann.`,
      onDone: id => { S.captain = id; afterDeaths(next); } });
  }
  next();
}
function winner() {
  const al = living(), wolves = al.filter(isWolf);
  if (!al.length) return 'niemand';
  const piper = al.find(p => p.role === 'floetenspieler');
  if (piper && al.length > 1 && al.every(p => p === piper || p.enchanted)) return 'floete';
  const greis = al.find(p => p.role === 'greis');
  if (greis && S.players.filter(p => p.group !== greis.group).every(p => !p.alive)) return 'greis';
  if (al.length === 1 && al[0].role === 'weisserwolf') return 'weiss';
  const couple = S.lovers.length === 2 && S.lovers.every(id => P(id).alive) && isWolf(P(S.lovers[0])) !== isWolf(P(S.lovers[1]));
  if (couple && al.length === 2) return 'liebe'; // Werwolf und Dorfbewohner verliebt: nur gemeinsam als Letzte
  if (!wolves.length) return 'dorf';
  if (wolves.length === al.length) return 'wolf';
  if (S.opt.quick && !couple && wolves.length >= al.length - wolves.length) return 'wolf';
  return null;
}

// ---------- Tag ----------
function morning() {
  const nd = S.nd;
  S.phase = 'day';
  // Mit echten Karten: Bei Angegriffenen nachsehen, wenn ihre Rolle den Angriff verändert (Alter, Kleines Mädchen)
  const peek = nd.victims.map(P).find(p => p.role == null && (open('alter') > 0 || (nd.protect === p.id && open('maedchen') > 0)));
  if (peek) return askRole(peek, morning, `${peek.name} wurde angegriffen`);
  const hits = [];
  for (const v of new Set(nd.victims)) {
    const p = P(v), old = eff(p) === 'alter' && !S.powerless && (p.lives == null ? 2 : p.lives) > 1;
    if (nd.infect === v) { if (old) p.lives = 1; else p.infected = true; continue; } // gegen die Infektion hilft kein Heiler
    if (nd.protect === v && eff(p) !== 'maedchen') continue;                          // der Heiler schützt – nur nicht das Kleine Mädchen
    if (nd.healed === v) continue;
    if (old) { p.lives = 1; continue; }                                               // der Alte übersteht den ersten Angriff
    hits.push({ id: v, cause: 'nacht', wolf: true });
  }
  if (nd.poison != null) hits.push({ id: nd.poison, cause: 'nacht' });
  if (nd.white != null) hits.push({ id: nd.white, cause: 'nacht' });
  if (S.rust && S.rust.night <= S.night) { hits.push({ id: S.rust.id, cause: 'rost' }); S.rust = null; }
  S.lastProtected = nd.protect;
  S.raven = nd.raven;
  nd.victims = []; nd.poison = null; nd.white = null; nd.infect = null;
  kill(shuffle(hits), deaths => {
    const bear = !S.powerless && holder('baerenfuehrer');
    const growl = bear && (bear.infected || [neighbor(bear, -1), neighbor(bear, 1)].some(q => q && isWolf(q)));
    announce({ theme: 'day', title: `Tag ${S.day + 1}`, deaths,
      intro: 'Die Sonne geht auf über dem Finsterwald. Alle wachen auf und öffnen die Augen!',
      some: 'Doch nicht alle haben die Nacht überstanden.',
      none: 'Gute Nachricht: In dieser Nacht ist niemand ausgeschieden!',
      extra: growl ? 'Der Bär brummt!' : '',
      hint: growl ? 'Brumme jetzt wie ein Bär: Neben dem Bärenführer sitzt ein Werwolf.' : null,
      next: () => afterDeaths(startDay) });
  });
}
function startDay() {
  S.day++; S.phase = 'day';
  if (S.night >= 1) S.engelLive = false; // der Engel hat die erste Abstimmung und die erste Nacht überstanden
  save();
  electCaptain('day', discussion);
}
function badgeFor(p) { return S.captain === p.id ? '🎖️' : null; }
function dayNotes() {
  const raven = S.raven != null && P(S.raven).alive ? P(S.raven) : null;
  const mute = living().filter(p => p.noVote);
  return [
    S.opt.events && S.night >= 2 && 'Ereigniskarte: Der zuletzt ausgeschiedene Spieler zieht die oberste Karte und liest sie vor.',
    raven && `${raven.name} wurde vom Raben angeschwärzt und hat bei der Abstimmung zwei Stimmen gegen sich.`,
    mute.length && `${list(mute.map(p => p.name))} ${mute.length > 1 ? 'dürfen' : 'darf'} nicht mehr abstimmen (Dorfdepp).`,
    S.scapeNote && 'Der Sündenbock hat festgelegt, wer heute abstimmen darf.',
    S.engelLive && 'Der Engel könnte unter euch sein: Scheidet er jetzt aus, gewinnt er sofort.',
  ].filter(Boolean);
}
function discussion() {
  const mins = S.opt.timer;
  let left = mins * 60, running = false;
  const clock = h('div', { class: 'timer' });
  const fmt = () => { clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; clock.classList.toggle('low', left <= 15 && left > 0); };
  const tbtn = h('button', { class: 'btn block', onclick: () => {
    running = !running; tbtn.textContent = running ? 'Pause' : 'Uhr starten';
    clearInterval(timerInt);
    if (running) timerInt = setInterval(() => {
      if (--left <= 0) { left = 0; clearInterval(timerInt); running = false; tbtn.textContent = 'Zeit ist um!'; tbtn.disabled = true; Speech.speak('Die Zeit ist um! Jetzt wird abgestimmt.'); }
      fmt();
    }, 1000);
  } }, 'Uhr starten');
  fmt();
  const notes = dayNotes();
  show({ theme: 'day', title: `Tag ${S.day}`, help: 'discussion', body: [
    narrator('Jetzt wird beraten! Wer von euch könnte ein Werwolf sein? Redet miteinander und hört gut zu.', true, notes.join(' ') || null),
    mins > 0 && h('div', { class: 'card stack' }, clock, tbtn),
    h('div', { class: 'card stack' }, h('h3', {}, `Noch im Spiel: ${living().length}`),
      h('div', { class: 'grid' }, S.players.map(p => chip(p, { cls: 'static' + (p.alive ? '' : ' dead'), badge: p.alive ? badgeFor(p) : '†', sub: p.alive ? (p.noVote ? 'Dorfdepp' : null) : (p.shown || ROLES[p.role].name) })))),
    h('div', { class: 'card stack' }, h('h3', {}, 'Fragen, die helfen'),
      h('ul', { class: 'tips' }, h('li', {}, 'Wer war in der Nacht unruhig oder hat Geräusche gemacht?'), h('li', {}, 'Wer beschuldigt andere besonders schnell?'), h('li', {}, 'Wer sagt auffällig wenig?'))),
    h('button', { class: 'btn primary big', onclick: () => { Speech.stop(); vote(); } }, 'Zur Abstimmung'),
  ] });
}
function vote(second) {
  const cap = S.captain != null ? ' Die Stimme des Hauptmanns zählt doppelt.' : '';
  const goat = !S.powerless && holder('suendenbock');
  picker({ theme: 'day', title: `Abstimmung · Tag ${S.day}`, help: 'vote', confirm: 'Dieser Spieler hat die meisten Stimmen',
    text: second ? 'Der Richter verlangt eine zweite Abstimmung – sofort und ohne Beratung. Ich zähle: eins, zwei, drei!'
      : `Abstimmung! Ich zähle: eins, zwei, drei! Jetzt zeigen alle gleichzeitig auf den Spieler, den sie für einen Werwolf halten.${cap} Tippt den Spieler mit den meisten Stimmen an.`,
    hint: dayNotes().join(' ') || null,
    rule: p => ({ badge: badgeFor(p), sub: p.noVote ? 'ohne Stimme' : S.raven === p.id ? '+2 Stimmen' : null }),
    extra: h('button', { class: 'btn block', onclick: () => { Speech.stop(); S.raven = null; S.scapeNote = false; goat ? tieGoat(goat) : noVote(); } },
      goat || open('suendenbock') > 0 ? 'Gleichstand – der Sündenbock muss gehen' : 'Gleichstand – niemand scheidet aus'),
    onDone: id => { S.raven = null; S.scapeNote = false; convict(P(id)); } });
}
function tieGoat(goat) {
  S.phase = 'night';
  if (!goat) { // echte Karten: Der Sündenbock gibt sich zu erkennen
    return picker({ theme: 'dusk', title: `Tag ${S.day}`, help: 'vote', confirm: 'Das ist der Sündenbock', text: 'Das Dorf konnte sich nicht einigen.', hint: 'Wer ist der Sündenbock? Tippe ihn an.',
      rule: p => p.role == null ? {} : { off: true }, onDone: id => { P(id).role = 'suendenbock'; tieGoat(P(id)); } });
  }
  S.scapeNote = true;
  kill([{ id: goat.id, cause: 'suende' }], deaths => announce({ theme: 'dusk', title: `Tag ${S.day}`, deaths, intro: 'Das Dorf konnte sich nicht einigen.',
    hint: 'Der Sündenbock bestimmt jetzt laut, wer am nächsten Tag abstimmen darf und wer nicht.', next: () => afterDeaths(afterVote) }));
}
function noVote() {
  S.phase = 'night';
  ask({ theme: 'dusk', title: `Tag ${S.day}`, help: 'vote', text: 'Das Dorf konnte sich nicht einigen. Heute scheidet niemand aus.', buttons: [['Weiter', afterVote, 'primary']] });
}
// Das Dorf hat einen Spieler gewählt: Dorfdepp, Ergebene Magd und Engel können das Ergebnis verändern.
function convict(p) {
  S.phase = 'night';
  if (p.role == null && ['dorfdepp', 'engel', 'magd'].some(k => open(k) > 0)) return askRole(p, () => convict(p), `${p.name} wurde gewählt`);
  if (eff(p) === 'dorfdepp' && !S.powerless && !p.noVote) {
    p.noVote = true;
    if (S.captain === p.id) { S.captain = null; S.noCaptain = true; } // das Amt des Hauptmanns ist damit endgültig verloren
    return ask({ theme: 'dusk', title: `Tag ${S.day}`, help: 'vote', text: 'Das Dorf hat entschieden.',
      read: `${p.name} deckt die Karte auf: Es ist der Dorfdepp. Das Dorf erkennt seinen Irrtum und begnadigt ihn. ${p.name} bleibt im Spiel, darf aber nicht mehr abstimmen.`,
      buttons: [['Weiter', afterVote, 'primary']] });
  }
  const maid = !S.powerless && living().find(q => q.role === 'magd' && q.id !== p.id && !S.lovers.includes(q.id));
  const out = hidden => kill([{ id: p.id, cause: 'dorf', hidden }], deaths => announce({ theme: 'dusk', title: `Tag ${S.day}`, intro: 'Das Dorf hat entschieden.', deaths, next: () => afterDeaths(afterVote) }));
  const takeOver = m => { // die Magd bekommt verdeckt die Rolle des Verurteilten, mit frischen Fähigkeiten
    const k = p.role;
    p.shown = 'Karte verdeckt'; p.role = 'magd';
    Object.assign(m, { role: k, pack: false, noVote: false });
    if (S.captain === m.id) S.captain = null;
    freshRole(k, m);
    out(m.name);
  };
  if (!maid && !(open('magd') > 0 && !S.powerless && p.role !== 'magd')) return out();
  ask({ theme: 'dusk', title: `Tag ${S.day}`, help: 'vote', text: 'Das Dorf hat entschieden. Bevor die Karte aufgedeckt wird: Möchte sich die Ergebene Magd zu erkennen geben?',
    hint: `Gewählt wurde ${p.name}. Warte einen Moment, ob sich die Magd meldet. Wer verliebt ist, darf das nicht.`,
    buttons: [['Niemand meldet sich', () => out(), 'primary'], ['Die Magd übernimmt die Rolle', () => {
      if (maid) return takeOver(maid);
      picker({ theme: 'dusk', title: `Tag ${S.day}`, help: 'vote', confirm: 'Das ist die Magd', text: '', speak: false, hint: 'Wer hat sich als Ergebene Magd gemeldet? Tippe den Spieler an.',
        rule: q => q.role == null && q.id !== p.id && !S.lovers.includes(q.id) ? {} : { off: true }, onDone: id => takeOver(P(id)) });
    }]] });
}
// Nach der Abstimmung: Der Stotternde Richter kann einmal eine zweite Abstimmung verlangen.
function afterVote() {
  if (S.secondVote || S.judgeUsed || !can('richter')) { S.secondVote = false; return beginNight(); }
  ask({ theme: 'dusk', title: `Tag ${S.day}`, help: 'vote', text: '', speak: false,
    hint: MOD() ? 'Verlangt der Stotternde Richter eine zweite Abstimmung? Hat er während der Abstimmung sein geheimes Zeichen gegeben?' : 'Verlangt der Stotternde Richter eine zweite Abstimmung? Er darf das einmal im Spiel und meldet sich jetzt selbst.',
    buttons: [['Nein, weiter zur Nacht', beginNight, 'primary'], ['Ja, zweite Abstimmung', () => { S.judgeUsed = true; S.secondVote = true; S.phase = 'day'; vote(true); }]] });
}

// ---------- Spielende ----------
function gameOver(w) {
  store.del('fw_save');
  const W = {
    dorf: { t: 'Das Dorf gewinnt!', s: 'Alle Werwölfe sind entdeckt. Das Dorf hat gewonnen und im Finsterwald ist es wieder friedlich.', theme: 'day' },
    wolf: { t: 'Die Werwölfe gewinnen!', s: 'Die Werwölfe haben das Dorf überlistet. Das Wolfsrudel hat gewonnen!', theme: 'night' },
    liebe: { t: 'Das Liebespaar gewinnt!', s: 'Nur die beiden Verliebten sind übrig. Das Liebespaar hat gewonnen!', theme: 'dusk' },
    niemand: { t: 'Niemand gewinnt', s: 'Niemand ist mehr im Dorf. Diese Runde hat keiner gewonnen.', theme: 'dusk' },
    floete: { t: 'Der Flötenspieler gewinnt!', s: 'Alle im Dorf folgen der Melodie. Der Flötenspieler hat gewonnen!', theme: 'dusk' },
    greis: { t: 'Der Verbitterte Greis gewinnt!', s: 'Von der anderen Gruppe ist niemand mehr im Dorf. Der Verbitterte Greis hat gewonnen!', theme: 'dusk' },
    weiss: { t: 'Der Weiße Werwolf gewinnt!', s: 'Nur ein Wolf ist noch übrig. Der Weiße Werwolf hat gewonnen!', theme: 'night' },
    engel: { t: 'Der Engel gewinnt!', s: 'Der Engel ist gleich zu Beginn ausgeschieden und hat damit gewonnen!', theme: 'day' },
  }[w];
  const extra = p => [p.role ? ROLES[p.role].name : 'nicht aufgedeckt', p.infected && 'infiziert', p.turned && 'wurde Wolf', p.side === 'wolf' && 'spielte als Wolf',
    S.lovers.includes(p.id) && 'verliebt', p.enchanted && 'verzaubert'].filter(Boolean).join(' · ');
  S.phase = 'over';
  show({ theme: W.theme, title: 'Spielende', help: 'over', body: [
    h('div', { class: 'winner' }, h('h1', {}, W.t)),
    narrator(W.s),
    h('div', { class: 'card stack' }, h('h3', {}, 'Wer war wer?'),
      h('div', { class: 'grid' }, S.players.map(p => chip(p, { cls: 'static' + (p.alive ? '' : ' dead'), badge: p.role ? ROLES[p.role].emoji : '?', sub: extra(p) })))),
    h('button', { class: 'btn primary big', onclick: () => { Speech.stop(); S = null; rolesScreen(); } }, 'Noch eine Runde'),
    h('button', { class: 'btn block', onclick: () => { Speech.stop(); home(); } }, 'Zur Startseite'),
  ] });
}
function resume(saved) {
  S = saved; run++; S.pendingHunters = [];
  keepAwake();
  restartPhase();
}
function restartPhase() {
  if (S.phase === 'night') runNight(); else { S.day = Math.max(0, S.day - 1); startDay(); }
}

// ---------- Hilfe ----------
const HELP = {
  home: ['Tippe auf „Neues Spiel“. Die App führt euch Schritt für Schritt durch alles.', 'Am besten hält ein Spielleiter das Gerät, der selbst nicht mitspielt. Dreht den Ton laut, damit alle den Erzähler hören.'],
  players: ['Stellt mit Plus und Minus ein, wie viele mitspielen.', 'Tragt eure Namen im Uhrzeigersinn ein, so wie ihr sitzt. Einige Rollen (Fuchs, Bärenführer, Ritter) wirken auf Sitznachbarn. Dann auf „Weiter“.'],
  roles: ['Tippt oben einen Vorschlag an: „Einfach“ für die ersten Runden, „Klassisch“ ist die empfohlene Mischung, „Experten“ nimmt Rollen aus den Erweiterungen dazu.', 'Die Rollen sind nach Grundspiel und Erweiterungen sortiert. Tippt eine Überschrift an, um sie aufzuklappen. Das kleine „i“ erklärt jede Rolle.', 'Die Waage zeigt, ob das Spiel fair ist.'],
  deal: ['Das Gerät geht reihum. Nur der Spieler, dessen Name angezeigt wird, schaut auf den Bildschirm.', 'Merke dir deine Rolle und verrate sie niemandem. Dann tippe auf „Verstecken“ und gib das Gerät weiter.'],
  ready: ['Wenn alle bereit sind, geht es los. Mit Hauptmann wird er jetzt gewählt – so sieht es die Regel vor.'],
  register: ['Die aufgerufene Rolle hat die Augen geöffnet. Tippe an, wer wach ist, damit die App die Rollen kennt. Das ist nur beim ersten Aufwachen nötig.'],
  night: ['Alle haben die Augen zu. Wartet, bis der Erzähler eure Rolle aufruft.', 'Nur wer aufgerufen wird, öffnet leise die Augen. Steht ein Text unter „Jetzt laut vorlesen“, liest ihn der Spielleiter vor.'],
  dieb: ['Der Dieb sieht die beiden Karten in der Mitte und darf seine Karte gegen eine davon tauschen. Sind beide Werwölfe, muss er tauschen.'],
  gaukler: ['Der Gaukler wählt eine der drei offen ausliegenden Rollen und spielt sie bis zur nächsten Nacht. Die Karte kommt danach aus dem Spiel.'],
  amor: ['Amor bestimmt zwei Verliebte. Danach werden beide an der Schulter berührt, wachen kurz auf und erkennen sich.', 'Scheidet einer aus, geht der andere mit. Verliebte stimmen nie gegeneinander.'],
  beschuetzer: ['Der Heiler schützt einen Spieler vor den Werwölfen – auch sich selbst, aber nie zweimal hintereinander denselben.', 'Das Kleine Mädchen kann er nicht schützen, und gegen die Infektion des Urwolfs hilft er nicht.'],
  seherin: ['Die Seherin sucht einen Spieler aus. Sie erfährt, welche Rolle dieser Spieler wirklich hat – auf dem Bildschirm oder über die echte Karte.', 'Mit der Hausregel unter „Extras“ erfährt sie stattdessen nur, ob der Spieler ein Werwolf ist. Infizierte und Seitenwechsler auf Wolfsseite zählen dabei als Werwolf.'],
  fuchs: ['Der Fuchs zeigt auf einen Spieler. Geprüft werden dieser Spieler und seine beiden Nachbarn, die noch im Spiel sind.', 'Ist kein Werwolf dabei, verliert der Fuchs seine Fähigkeit.'],
  werwolf: ['Nur die Werwölfe haben die Augen offen. Sie einigen sich ohne Worte auf ein Opfer.', 'Werwölfe sind markiert und können nicht gewählt werden. Neue Rudelmitglieder (infiziert, Wildes Kind) werden zum Aufwachen an der Schulter berührt.'],
  hexe: ['Die Hexe sieht, wen die Werwölfe angegriffen haben.', 'Heiltrank: rettet ein Opfer der Werwölfe, auch die Hexe selbst. Gifttrank: lässt einen beliebigen Spieler ausscheiden.', 'Jeder Trank geht nur einmal im ganzen Spiel, beide dürfen in derselben Nacht benutzt werden.'],
  deaths: ['Der Spielleiter sagt, wer ausgeschieden ist. Die Karte wird aufgedeckt.', 'Wer ausgeschieden ist, darf nichts mehr verraten und schaut still zu.'],
  jaeger: ['Der Jäger ist ausgeschieden und bestimmt sofort einen Spieler, der mit ihm ausscheidet.'],
  hauptmann: ['Alle zeigen gleichzeitig auf ihren Wunsch-Hauptmann. Wer die meisten Stimmen hat, wird es und darf nicht ablehnen.', 'Die Stimme des Hauptmanns zählt bei jeder Abstimmung doppelt. Scheidet er aus, bestimmt er einen Nachfolger.'],
  discussion: ['Jetzt reden alle miteinander: Wer könnte ein Werwolf sein?', 'Jeder darf behaupten, was er will – nur die Karte zeigen darf niemand. Wenn ihr fertig seid, tippt auf „Zur Abstimmung“.'],
  vote: ['Auf ein Zeichen zeigen alle gleichzeitig auf einen Spieler. Tippt den Spieler mit den meisten Stimmen an.', 'Gleichstand: Mit Sündenbock scheidet dieser aus. Ohne ihn regelt das Heft nichts – üblich ist, dass der Hauptmann entscheidet oder niemand ausscheidet.'],
  over: ['Das Spiel ist vorbei. Hier seht ihr, wer welche Rolle hatte.', '„Noch eine Runde“ startet ein neues Spiel mit denselben Spielern.'],
};
function helpModal() {
  const now = [...(HELP[helpKey] || HELP.home)];
  if (S && S.opt.mod) now.unshift('Du bist der Spielleiter: Nur du schaust auf das Gerät. Die Spieler zeigen stumm, du tippst für sie. Hinweise an dich stehen unter dem Erzählertext.');
  const text = now.join(' ');
  modal('Hilfe', [
    h('div', { class: 'now stack' }, h('h3', {}, 'Was mache ich jetzt?'), now.map(t => h('p', {}, t)),
      !CLIPS.size && h('button', { class: 'btn', onclick: () => Speech.speak(text) }, 'Vorlesen')),
    h('details', {}, h('summary', {}, 'Die Spielregeln – kurz erklärt'), h('div', { class: 'in' },
      h('p', {}, 'Im Dorf verstecken sich Werwölfe. Niemand weiß, wer sie sind. Ein Spielleiter führt durch die Partie und spielt selbst nicht mit.'),
      h('p', {}, h('b', {}, 'In der Nacht '), 'schließen alle die Augen. Der Spielleiter ruft die Rollen in fester Reihenfolge auf. Die Werwölfe bestimmen ein Opfer.'),
      h('p', {}, h('b', {}, 'Am Tag '), 'werden die Opfer der Nacht genannt und ihre Karten aufgedeckt. Dann berät das Dorf und stimmt ab. Wer die meisten Stimmen hat, scheidet aus.'),
      h('p', {}, h('b', {}, 'Wer gewinnt? '), 'Das Dorf, wenn alle Werwölfe ausgeschieden sind. Die Werwölfe, wenn außer ihnen niemand mehr im Spiel ist. Sind ein Werwolf und ein Dorfbewohner verliebt, gewinnen die beiden nur gemeinsam als letzte zwei Spieler. Einzelgänger wie der Flötenspieler haben ein eigenes Ziel.'),
      h('p', {}, h('b', {}, 'Wichtig: '), 'Niemand zeigt seine Karte, solange er im Spiel ist. Wer ausgeschieden ist, verrät nichts mehr. Verliebte stimmen nie gegeneinander.'))),
    h('details', {}, h('summary', {}, 'Reihenfolge in der Nacht'), h('div', { class: 'in' },
      h('p', {}, h('b', {}, 'Nur in der ersten Nacht: '), 'Dieb, Amor und die Verliebten, Stotternder Richter, Schwestern, Brüder, Wildes Kind, Wolfshund.'),
      h('p', {}, h('b', {}, 'Jede Nacht: '), 'Gaukler, Seherin, Fuchs, Rabe, Heiler, alle Werwölfe (das Kleine Mädchen blinzelt), Weißer Werwolf (jede zweite Nacht), Urwolf, Großer böser Wolf, Hexe, Flötenspieler und die Verzauberten.'),
      h('p', {}, h('b', {}, 'Am Tag: '), 'Opfer nennen, Bärenbrummen, Beratung, Abstimmung, eventuell Ergebene Magd und zweite Abstimmung des Richters.'))),
    Object.entries(SET_ROLES).map(([set, keys]) => h('details', {}, h('summary', {}, 'Rollen: ' + SETS[set]), h('div', { class: 'in' },
      (set === 'grund' ? [...keys, 'dorfbewohner'] : keys).map(k => h('div', { class: 'row' }, roleIcon(k), h('div', { class: 'rtxt' }, h('b', {}, ROLES[k].name), h('span', {}, ROLES[k].lang))))))),
    h('details', {}, h('summary', {}, 'Welche Rollen bei wie vielen Spielern?'), h('div', { class: 'in' },
      h('p', {}, 'Das Regelheft gibt keine feste Tabelle vor; die Zahl der Werwölfe richtet sich nach der Spielerzahl. Die Vorschläge der App:'),
      h('p', {}, h('b', {}, 'Werwölfe: '), 'bis 5 Spieler: 1 · 6 bis 11 Spieler: 2 · 12 bis 17 Spieler: 3 · ab 18 Spielern: 4'),
      h('p', {}, h('b', {}, 'Immer dabei: '), 'die Seherin. Ab 6 Spielern passt die Hexe gut dazu, ab 8 der Jäger, ab 10 Amor.'),
      h('p', {}, h('b', {}, 'Erweiterungen: '), 'Nehmt neue Rollen nach und nach dazu. Drei Brüder und Zwei Schwestern lohnen sich erst in großen Runden.'))),
    h('details', {}, h('summary', {}, 'Was die App nicht abbildet'), h('div', { class: 'in' },
      h('p', {}, 'Die Gebäude und Berufe aus „Die Gemeinde“ samt Brandstifter, die 36 Ereigniskarten aus „Neumond“ mit Büttel und Wahrsagerin sowie die Spielvarianten werden nicht automatisch gespielt.'),
      h('p', {}, 'Ihr könnt sie trotzdem mit eurem Material nutzen: Über das Menü lässt der Spielleiter Spieler von Hand ausscheiden oder holt sie zurück.'))),
    h('details', {}, h('summary', {}, 'Tipps für die Runde'), h('div', { class: 'in' },
      h('p', {}, 'Dreht den Ton laut.'),
      h('p', {}, 'In der Nacht können alle leise auf die Oberschenkel trommeln. So hört niemand, wer sich bewegt.'),
      h('p', {}, 'Versehentlich neu geladen? Auf der Startseite gibt es „Spiel fortsetzen“.'))),
  ]);
}

// ---------- Menü im Spiel ----------
function menuModal() {
  let close, hold;
  const secret = h('div', { class: 'stack' });
  const label = 'Geheime Übersicht (2 Sekunden halten)';
  const info = p => [p.role ? ROLES[p.role].name : '?', p.actAs && 'spielt ' + ROLES[p.actAs].name, p.infected && 'infiziert', p.turned && 'Wolf', p.side === 'wolf' && 'Wolf',
    S.lovers.includes(p.id) && 'verliebt', p.enchanted && 'verzaubert', S.model === p.id && 'Vorbild', p.group && 'Gruppe ' + p.group].filter(Boolean).join(' · ');
  const holdBtn = h('button', { class: 'btn block',
    onpointerdown: () => { holdBtn.textContent = '… weiter halten …'; hold = setTimeout(() => {
      secret.replaceChildren(h('div', { class: 'grid' }, S.players.map(p => chip(p, { cls: 'static' + (p.alive ? '' : ' dead'), badge: p.role ? ROLES[p.role].emoji : '?', sub: info(p) }))));
      holdBtn.remove();
    }, 2000); },
    onpointerup: () => { clearTimeout(hold); holdBtn.textContent = label; },
    onpointerleave: () => clearTimeout(hold),
  }, label);
  // Für Ereigniskarten, Gebäude und Missgeschicke: von Hand eingreifen, danach beginnt die laufende Phase neu.
  const manual = (title, cand, act) => { close(); const c2 = modal(title, [
    h('p', { class: 'small soft' }, 'Danach beginnt die laufende Nacht oder der laufende Tag von vorn.'),
    h('div', { class: 'grid' }, S.players.filter(cand).map(p => chip(p, { onclick: () => { c2(); Speech.stop(); run++; act(p); } }))),
  ]); };
  close = modal('Menü', [
    h('button', { class: 'btn primary big', onclick: () => close() }, 'Weiterspielen'),
    h('div', { class: 'card stack' }, h('h3', {}, `Noch im Spiel: ${living().length} von ${S.players.length}`),
      h('div', { class: 'grid' }, S.players.map(p => chip(p, { cls: 'static' + (p.alive ? '' : ' dead'), badge: p.alive ? badgeFor(p) : '†' })))),
    h('p', { class: 'small soft' }, 'Nur für den Spielleiter: Die geheime Übersicht zeigt alle Rollen.'),
    holdBtn, secret,
    S.phase !== 'deal' && S.phase !== 'over' && h('button', { class: 'btn block', onclick: () => manual('Wer scheidet aus?', p => p.alive,
      p => kill([{ id: p.id, cause: 'hand' }], deaths => announce({ theme: 'dusk', title: 'Eingriff', intro: '', deaths, next: () => afterDeaths(restartPhase) }))) }, 'Spieler von Hand ausscheiden lassen'),
    S.phase !== 'deal' && S.phase !== 'over' && S.players.some(p => !p.alive) && h('button', { class: 'btn block', onclick: () => manual('Wer kommt zurück?', p => !p.alive,
      p => { p.alive = true; restartPhase(); }) }, 'Ausgeschiedenen Spieler zurückholen'),
    h('button', { class: 'btn block', onclick: () => { close(); settingsModal(); } }, 'Stimme einstellen'),
    h('button', { class: 'btn danger block', onclick: () => {
      close();
      const c2 = modal('Spiel wirklich beenden?', [
        h('p', {}, 'Das laufende Spiel wird abgebrochen.'),
        h('button', { class: 'btn danger big', onclick: () => { c2(); Speech.stop(); store.del('fw_save'); home(); } }, 'Ja, beenden'),
        h('button', { class: 'btn big', onclick: () => c2() }, 'Nein, weiterspielen'),
      ]);
    } }, 'Spiel beenden'),
  ]);
}

Speech.init();
scenery();
home();

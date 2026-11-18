'use strict';
/* Rollen von "Nacht im Finsterwald". Regeln nach dem offiziellen Regelheft der Gesamtausgabe (2014),
   Erklärtexte in eigenen Worten. Die Texte der ersten acht Rollen bleiben wortgleich: Dazu gibt es Aufnahmen. */

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
    kurz: 'Erfährt jede Nacht die wahre Rolle eines Spielers.',
    lang: 'Jede Nacht darfst du dir einen Spieler aussuchen. Du erfährst dann, welche Rolle dieser Spieler wirklich hat. Du hilfst dem Dorf mit deinem Wissen.',
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
Object.assign(ROLES, {
  // ----- Grundspiel -----
  dieb: { name: 'Dieb', plural: 'Diebe', emoji: '🗝️', team: 'wechsel', color: '#6b6f7a', weight: 0,
    kurz: 'Darf in der ersten Nacht seine Karte tauschen.',
    lang: 'Zwei Karten liegen verdeckt in der Mitte. In der ersten Nacht siehst du sie dir an und darfst deine Karte gegen eine davon tauschen. Sind beide Karten Werwölfe, musst du tauschen. Behältst du deine Karte, bist du ein einfacher Dorfbewohner.',
    tipp: 'Mit dem Dieb kommen zwei zusätzliche Dorfbewohner-Karten ins Spiel.' },
  // ----- Neumond -----
  alter: { name: 'Der Alte', plural: 'Alte', emoji: '👴', team: 'dorf', color: '#7a6a55', weight: 2,
    kurz: 'Übersteht den ersten Angriff der Werwölfe.',
    lang: 'Die Werwölfe müssen dich zweimal angreifen, um dich auszuschalten. Scheidest du aber durch die Abstimmung, das Gift der Hexe oder den Schuss des Jägers aus, verlieren alle Dorfbewohner ihre besonderen Fähigkeiten.',
    tipp: 'Mach dem Dorf klar, dass es dich besser nicht fortschickt.' },
  suendenbock: { name: 'Sündenbock', plural: 'Sündenböcke', emoji: '🐐', team: 'dorf', color: '#8a5a3c', weight: 0,
    kurz: 'Muss gehen, wenn die Abstimmung unentschieden endet.',
    lang: 'Endet die Abstimmung des Dorfes unentschieden, scheidest du anstelle der Beschuldigten aus. Dafür legst du beim Ausscheiden fest, wer am nächsten Tag abstimmen darf und wer nicht.',
    tipp: 'Sorge dafür, dass Abstimmungen eindeutig ausgehen.' },
  dorfdepp: { name: 'Dorfdepp', plural: 'Dorfdeppen', emoji: '🤪', team: 'dorf', color: '#b08a2e', weight: 2,
    kurz: 'Wird vom Dorf begnadigt, verliert aber sein Stimmrecht.',
    lang: 'Stimmt das Dorf gegen dich, deckst du deine Karte auf und bleibst im Spiel. Ab dann darfst du aber nicht mehr abstimmen. Gegen die Werwölfe, die Hexe und den Jäger hilft dir das nicht.',
    tipp: 'Warst du Hauptmann, ist das Amt nach der Begnadigung für den Rest des Spiels verloren.' },
  floetenspieler: { name: 'Flötenspieler', plural: 'Flötenspieler', emoji: '🎶', team: 'solo', color: '#3f7f8a', weight: -3,
    kurz: 'Verzaubert jede Nacht zwei Spieler und spielt für sich allein.',
    lang: 'Jede Nacht verzauberst du zwei Spieler. Du gewinnst allein, sobald alle anderen Spieler, die noch im Spiel sind, verzaubert sind. Dich selbst kannst du nicht verzaubern. Verzauberte behalten alle ihre Fähigkeiten.',
    tipp: 'Bleib unauffällig – wer dich entdeckt, schickt dich fort.' },
  // ----- Die Gemeinde -----
  rabe: { name: 'Rabe', plural: 'Raben', emoji: '🪶', team: 'dorf', color: '#3b3f52', weight: 2,
    kurz: 'Hängt einem Spieler zwei Stimmen an.',
    lang: 'Jede Nacht darfst du einen Spieler anschwärzen. Bei der nächsten Abstimmung hat dieser Spieler automatisch zwei Stimmen gegen sich.',
    tipp: 'Nutze den Brief gegen Spieler, die du für Werwölfe hältst.' },
  weisserwolf: { name: 'Weißer Werwolf', plural: 'Weiße Werwölfe', emoji: '🤍', team: 'solo', color: '#9aa3b5', weight: -5, wolf: true,
    kurz: 'Spielt gegen alle – auch gegen die anderen Wölfe.',
    lang: 'Du wachst mit den Werwölfen auf und suchst mit ihnen ein Opfer. Jede zweite Nacht wachst du zusätzlich allein auf und darfst einen Werwolf ausschalten. Du gewinnst nur, wenn du als Einziger übrig bleibst.',
    tipp: 'Schwäche das Rudel erst, wenn das Dorf schon klein geworden ist.' },
  // ----- Charaktere -----
  grosserwolf: { name: 'Großer böser Wolf', plural: 'Große böse Wölfe', emoji: '🦷', team: 'wolf', color: '#6e1730', weight: -9, wolf: true,
    kurz: 'Frisst ein zweites Opfer, solange kein Wolf ausgeschieden ist.',
    lang: 'Du wachst mit den Werwölfen auf und suchst mit ihnen ein Opfer. Solange noch kein Werwolf ausgeschieden ist, wachst du danach noch einmal allein auf und bestimmst ein zweites Opfer.',
    tipp: 'Wähle das zweite Opfer so, dass kein Verdacht auf dich fällt.' },
  urwolf: { name: 'Urwolf', plural: 'Urwölfe', emoji: '🩸', team: 'wolf', color: '#7d2a1d', weight: -8, wolf: true,
    kurz: 'Kann einmal im Spiel sein Opfer zum Werwolf machen.',
    lang: 'Du wachst mit den Werwölfen auf. Einmal im Spiel darfst du das Opfer der Nacht infizieren, statt es zu fressen. Der Spieler bleibt im Spiel, behält seine Fähigkeit und gehört ab der nächsten Nacht heimlich zum Rudel.',
    tipp: 'Infiziere einen Spieler mit einer starken Fähigkeit.' },
  reineseele: { name: 'Reine Seele', plural: 'Reine Seelen', emoji: '🕊️', team: 'dorf', color: '#5d8fa8', weight: 2,
    kurz: 'Ist für alle sichtbar ein einfacher Dorfbewohner.',
    lang: 'Deine Karte liegt offen: Alle wissen sicher, dass du ein einfacher Dorfbewohner bist. Dein Wort hat deshalb besonderes Gewicht.',
    tipp: 'Du bist ein guter Hauptmann – dir kann das Dorf vertrauen.' },
  schwestern: { name: 'Zwei Schwestern', plural: 'Schwestern', emoji: '👭', team: 'dorf', color: '#a8557f', weight: 2, count: 2,
    kurz: 'Kennen sich und können einander vertrauen.',
    lang: 'In der ersten Nacht wacht ihr gemeinsam auf und erkennt euch. Ihr wisst sicher, dass die andere Schwester zum Dorf gehört.',
    tipp: 'Sprecht euch am Tag unauffällig ab.' },
  brueder: { name: 'Drei Brüder', plural: 'Brüder', emoji: '👬', team: 'dorf', color: '#55718f', weight: 2, count: 3,
    kurz: 'Kennen sich und können einander vertrauen.',
    lang: 'In der ersten Nacht wacht ihr gemeinsam auf und erkennt euch. Ihr wisst sicher, dass eure Brüder zum Dorf gehören.',
    tipp: 'Die Brüder passen vor allem in große Runden.' },
  fuchs: { name: 'Fuchs', plural: 'Füchse', emoji: '🦊', team: 'dorf', color: '#c26a1f', weight: 4,
    kurz: 'Prüft nachts drei Nachbarn auf Werwölfe.',
    lang: 'Jede Nacht darfst du auf einen Spieler zeigen. Du erfährst, ob er oder einer seiner beiden Nachbarn ein Werwolf ist. Ist keiner dabei, verlierst du deine Fähigkeit – weißt aber, dass diese drei unschuldig sind.',
    tipp: 'Du musst deine Fähigkeit nicht in jeder Nacht einsetzen.' },
  baerenfuehrer: { name: 'Bärenführer', plural: 'Bärenführer', emoji: '🐻', team: 'dorf', color: '#70513a', weight: 3,
    kurz: 'Sein Bär brummt, wenn ein Werwolf neben ihm sitzt.',
    lang: 'Jeden Morgen brummt dein Bär, wenn einer deiner direkten Nachbarn, die noch im Spiel sind, ein Werwolf ist.',
    tipp: 'Achte darauf, wer neben dir sitzt, wenn Spieler ausscheiden.' },
  richter: { name: 'Stotternder Richter', plural: 'Richter', emoji: '⚖️', team: 'dorf', color: '#4f5d78', weight: 1,
    kurz: 'Darf einmal eine zweite Abstimmung verlangen.',
    lang: 'Einmal im Spiel darfst du mit einem geheimen Zeichen verlangen, dass direkt nach der Abstimmung ein zweites Mal abgestimmt wird – ohne weitere Beratung.',
    tipp: 'Heb dir das Zeichen für einen Tag auf, an dem zwei Werwölfe verdächtig sind.' },
  ritter: { name: 'Ritter der rostigen Klinge', plural: 'Ritter', emoji: '🗡️', team: 'dorf', color: '#8a8f99', weight: 3,
    kurz: 'Verletzt einen Werwolf tödlich, wenn er gefressen wird.',
    lang: 'Fressen dich die Werwölfe, scheidest du aus. Der nächste Werwolf zu deiner Linken wird dabei aber von deiner rostigen Klinge verletzt und scheidet in der folgenden Nacht aus.',
    tipp: 'Alle Spieler zwischen dir und dem verletzten Werwolf sind unschuldig.' },
  magd: { name: 'Ergebene Magd', plural: 'Mägde', emoji: '🧹', team: 'wechsel', color: '#8f6f8a', weight: 1,
    kurz: 'Kann die Rolle eines Verurteilten übernehmen.',
    lang: 'Schickt das Dorf einen Spieler fort, darfst du dich zu erkennen geben, bevor seine Karte aufgedeckt wird. Du übernimmst dann verdeckt seine Rolle mit frischen Fähigkeiten. Bist du verliebt, geht das nicht.',
    tipp: 'Übernimmst du einen Werwolf, spielst du ab dann für das Rudel.' },
  gaukler: { name: 'Gaukler', plural: 'Gaukler', emoji: '🎪', team: 'wechsel', color: '#a04a8c', weight: 2,
    kurz: 'Schlüpft jede Nacht in eine andere Rolle.',
    lang: 'Drei Rollen liegen offen aus. Jede Nacht darfst du eine davon wählen und bis zur nächsten Nacht spielen. Jede dieser Rollen kannst du nur einmal benutzen.',
    tipp: 'Wähle die Rolle, die dem Dorf gerade am meisten hilft.' },
  wildkind: { name: 'Wildes Kind', plural: 'Wilde Kinder', emoji: '🌿', team: 'wechsel', color: '#4f7a4a', weight: -1,
    kurz: 'Wird zum Werwolf, wenn sein Vorbild ausscheidet.',
    lang: 'In der ersten Nacht wählst du ein Vorbild. Solange es im Spiel ist, gehörst du zum Dorf. Scheidet es aus, wirst du zum Werwolf und wachst ab dann mit dem Rudel auf.',
    tipp: 'Du darfst sogar selbst gegen dein Vorbild stimmen.' },
  wolfshund: { name: 'Wolfshund', plural: 'Wolfshunde', emoji: '🐕', team: 'wechsel', color: '#6a5a4a', weight: -2,
    kurz: 'Entscheidet sich in der ersten Nacht für Dorf oder Rudel.',
    lang: 'In der ersten Nacht entscheidest du, ob du als einfacher Dorfbewohner oder als Werwolf spielst. Die Entscheidung gilt für das ganze Spiel.',
    tipp: 'Als Werwolf wachst du jede Nacht mit dem Rudel auf.' },
  engel: { name: 'Engel', plural: 'Engel', emoji: '😇', team: 'solo', color: '#b9a44c', weight: -1,
    kurz: 'Gewinnt, wenn er gleich zu Beginn ausscheidet.',
    lang: 'Mit dir beginnt das Spiel mit einem Tag und einer Abstimmung. Scheidest du bei dieser ersten Abstimmung oder in der ersten Nacht aus, gewinnst du sofort. Sonst wirst du ein einfacher Dorfbewohner.',
    tipp: 'Mach dich am ersten Tag ruhig ein wenig verdächtig.' },
  greis: { name: 'Verbitterter Greis', plural: 'Greise', emoji: '🧓', team: 'solo', color: '#5a5a66', weight: -1,
    kurz: 'Will die andere Hälfte des Dorfes loswerden.',
    lang: 'Der Spielleiter teilt das Dorf in zwei Gruppen. Du gewinnst allein, wenn alle Spieler der anderen Gruppe ausgeschieden sind. Eine besondere Fähigkeit hast du nicht.',
    tipp: 'Lenke den Verdacht geschickt auf die andere Gruppe.' },
});
// Offizielle Namen und Zuordnung zu den Ausgaben
Object.assign(ROLES.beschuetzer, { name: 'Heiler', plural: 'Heiler' });
ROLES.werwolf.wolf = true;
const SETS = { grund: 'Grundspiel', neumond: 'Erweiterung „Neumond“', gemeinde: 'Erweiterung „Die Gemeinde“', charaktere: 'Erweiterung „Charaktere“' };
const SET_ROLES = {
  grund: ['werwolf', 'seherin', 'hexe', 'jaeger', 'amor', 'maedchen', 'dieb'],
  neumond: ['beschuetzer', 'alter', 'suendenbock', 'dorfdepp', 'floetenspieler'],
  charaktere: ['grosserwolf', 'urwolf', 'reineseele', 'schwestern', 'brueder', 'fuchs', 'baerenfuehrer', 'richter', 'ritter', 'magd', 'gaukler', 'wildkind', 'wolfshund', 'engel', 'greis'],
  gemeinde: ['rabe', 'weisserwolf'],
};
for (const set in SET_ROLES) SET_ROLES[set].forEach(k => { ROLES[k].set = set; });
ROLES.dorfbewohner.set = 'grund';
const TEAMS = { wolf: 'Gehört zu den Werwölfen', dorf: 'Gehört zum Dorf', wechsel: 'Kann die Seite wechseln', solo: 'Spielt für sich allein' };
const WOLF_ROLES = Object.keys(ROLES).filter(k => ROLES[k].wolf);
const ROLE_ORDER = [...SET_ROLES.grund, ...SET_ROLES.neumond, ...SET_ROLES.charaktere, ...SET_ROLES.gemeinde, 'dorfbewohner'];
// Rollen, die der Gaukler ausliegen haben darf (keine Wölfe, nur Rollen mit eigener Fähigkeit)
const GAUKLER_POOL = ['seherin', 'hexe', 'beschuetzer', 'jaeger', 'fuchs', 'rabe', 'alter', 'dorfdepp', 'suendenbock', 'baerenfuehrer', 'ritter', 'maedchen'];

// ---------- Empfehlungen je Spielerzahl ----------
const LEVELS = {
  einfach: { name: 'Einfach', desc: 'Für Einsteiger: Werwölfe und Seherin' },
  klassisch: { name: 'Klassisch', desc: 'Die bewährte Mischung aus dem Grundspiel' },
  abenteuer: { name: 'Abenteuer', desc: 'Alle Sonderrollen des Grundspiels' },
  experten: { name: 'Experten', desc: 'Mit Rollen aus den Erweiterungen' },
};
const wolvesFor = n => n <= 5 ? 1 : n <= 11 ? 2 : n <= 17 ? 3 : 4;
const cardsFor = (n, r) => n + (r.dieb ? 2 : 0); // mit dem Dieb liegen zwei Karten in der Mitte
const villagers = (n, r) => cardsFor(n, r) - Object.keys(r).reduce((a, k) => a + (r[k] || 0), 0);
function recommend(n, level) {
  const r = { werwolf: wolvesFor(n), seherin: 1 };
  // Sonderrollen der Reihe nach dazunehmen, solange noch einfache Dorfbewohner übrig bleiben
  const add = (k, from, keep = 2) => { const c = ROLES[k].count || 1; if (n >= from && villagers(n, r) - c >= keep) r[k] = c; };
  if (level === 'einfach') add('hexe', 8);
  if (level === 'klassisch') { add('hexe', 6); add('jaeger', 8); add('amor', 10); }
  if (level === 'abenteuer') { add('hexe', 6); add('jaeger', 7); add('amor', 8); add('beschuetzer', 9); add('maedchen', 10); add('dorfdepp', 12); add('alter', 13); }
  if (level === 'experten') {
    if (n >= 9) { r.werwolf--; r.grosserwolf = 1; }
    add('hexe', 6); add('beschuetzer', 7); add('fuchs', 8); add('baerenfuehrer', 9); add('alter', 10); add('dorfdepp', 11);
    add('wildkind', 12); add('ritter', 13); add('richter', 14); add('schwestern', 15); add('rabe', 16);
  }
  return r;
}
function balance(n, r) {
  let s = villagers(n, r) * ROLES.dorfbewohner.weight;
  for (const k in r) s += (r[k] || 0) * ROLES[k].weight;
  return s;
}

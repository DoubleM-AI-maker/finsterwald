#!/usr/bin/env node
/* Erzeugt die Erzähler-Aufnahmen für "Nacht im Finsterwald" mit ElevenLabs.
 *
 * Aufruf (im Projektordner):
 *   node tools/stimme-erzeugen.js
 *
 * - Der Schlüssel kommt aus dem macOS-Schlüsselbund (Eintrag "finsterwald-elevenlabs") oder aus der
 *   Umgebungsvariable ELEVENLABS_API_KEY. Einmalig im Terminal hinterlegen (fragt verdeckt nach dem Schlüssel):
 *     security add-generic-password -U -s finsterwald-elevenlabs -a elevenlabs -w
 *   Er wird nie in eine Datei des Projekts geschrieben.
 * - Die Stimme steht in audio/stimme.json oder in ELEVENLABS_VOICE_ID.
 * - Gesendet werden ausschließlich die Sätze aus audio/texte.json an api.elevenlabs.io.
 * - Vorhandene Aufnahmen werden übersprungen; mit --neu werden alle neu erzeugt.
 * - Mit --pruefen wird nur geprüft, ob die Textliste noch zur App passt (kein Netzwerkzugriff).
 * - Mit --stimmen werden die Stimmen deines Kontos aufgelistet (nur der Schlüssel ist nötig).
 * - Mit --probe wird nur ein Probesatz erzeugt (audio/probe-<Voice-ID>.mp3), um Stimmen zu vergleichen.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'audio');
const texts = [...new Set(JSON.parse(fs.readFileSync(path.join(dir, 'texte.json'), 'utf8')))];
const app = ['app.js', 'rollen.js', 'spiel.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const args = process.argv.slice(2);

// Muss exakt zu clipId() in app.js passen.
function clipId(sentence) {
  let x = 0x811c9dc5;
  for (let i = 0; i < sentence.length; i++) { x ^= sentence.charCodeAt(i); x = Math.imul(x, 0x01000193); }
  return (x >>> 0).toString(16).padStart(8, '0');
}
function writeManifest() {
  const have = texts.map(clipId).filter(id => fs.existsSync(path.join(dir, id + '.mp3')));
  fs.writeFileSync(path.join(dir, 'clips.js'),
    '// Liste der vorhandenen Erzähler-Aufnahmen. Wird von tools/stimme-erzeugen.js neu geschrieben.\n' +
    'window.CLIPS = ' + JSON.stringify(have) + ';\n');
  return have.length;
}

const stale = texts.filter(t => !app.includes(t));
if (stale.length) console.warn('Hinweis: Diese Sätze stehen nicht mehr im Programm und würden nie abgespielt:\n  ' + stale.join('\n  '));
if (args.includes('--pruefen')) {
  console.log(`${texts.length} Sätze, ${texts.join(' ').length} Zeichen, ${writeManifest()} Aufnahmen vorhanden.`);
  process.exit(stale.length ? 1 : 0);
}

function keychain() { // macOS-Schlüsselbund; gibt '' zurück, wenn dort nichts liegt
  try { return require('child_process').execFileSync('security', ['find-generic-password', '-s', 'finsterwald-elevenlabs', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}
function savedVoice() { try { return JSON.parse(fs.readFileSync(path.join(dir, 'stimme.json'), 'utf8')).voice || ''; } catch { return ''; } }
const key = process.env.ELEVENLABS_API_KEY || keychain(), voice = process.env.ELEVENLABS_VOICE_ID || savedVoice();
if (key && args.includes('--stimmen')) {
  fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } }).then(async res => {
    if (!res.ok) { console.error(`Fehler ${res.status}: ${(await res.text()).slice(0, 300)}`); process.exit(1); }
    const voices = (await res.json()).voices || [];
    const free = v => v.category === 'premade';
    voices.sort((a, b) => free(b) - free(a) || a.name.localeCompare(b.name));
    console.log('Voice-ID               Name                 Art         Beschreibung');
    for (const v of voices) {
      const l = v.labels || {};
      console.log([v.voice_id.padEnd(22), v.name.slice(0, 20).padEnd(20), (free(v) ? 'Standard' : v.category || '?').padEnd(11),
        [l.gender, l.age, l.accent, l.description, l.use_case].filter(Boolean).join(', ')].join(' '));
    }
    console.log('\n„Standard“-Stimmen sind die mitgelieferten; nur sie lassen sich im kostenlosen Tarif per Skript nutzen.');
  }).catch(e => { console.error(e); process.exit(1); });
  return;
}
if (!key || !voice) {
  if (!key) console.error('Kein ElevenLabs-Schlüssel gefunden. Bitte einmalig im Terminal (nicht im Chat) hinterlegen:\n\n  security add-generic-password -U -s finsterwald-elevenlabs -a elevenlabs -w\n\nDer Befehl fragt verdeckt nach dem Schlüssel. Danach diesen Aufruf wiederholen.');
  if (!voice) console.error('Keine Stimme festgelegt: audio/stimme.json fehlt und ELEVENLABS_VOICE_ID ist nicht gesetzt.');
  process.exit(1);
}
const model = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (args.includes('--probe')) { // ein Satz zum Probehören, verbraucht nur wenige Zeichen
    texts.length = 0;
    texts.push('Es wird Nacht im Finsterwald. Der Mond steigt über die Bäume, und im Dorf wird es ganz still.');
  }
  let made = 0;
  for (const text of texts) {
    const probe = args.includes('--probe');
    const file = path.join(dir, (probe ? 'probe-' + voice : clipId(text)) + '.mp3');
    if (fs.existsSync(file) && !args.includes('--neu') && !probe) continue;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      // Ruhiger, erzählender Vortrag: etwas Ausdruck, aber gleichmäßig über alle Sätze.
      body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true } }),
    });
    if (!res.ok) {
      console.error(`Fehler ${res.status} bei „${text}“: ${(await res.text()).slice(0, 300)}`);
      break;
    }
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    made++;
    console.log(`✓ ${text}`);
    if (probe) { console.log('Probe gespeichert: ' + path.relative(root, file)); return; }
    await sleep(400);
  }
  const n = writeManifest();
  console.log(`\n${made} neu erzeugt, ${n} von ${texts.length} Aufnahmen vorhanden.`);
})().catch(e => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/* Erzeugt die Erzähler-Aufnahmen für "Nacht im Finsterwald" mit ElevenLabs.
 *
 * Aufruf (im Projektordner):
 *   ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... node tools/stimme-erzeugen.js
 *
 * - Der Schlüssel wird nur aus der Umgebungsvariable gelesen und nirgends gespeichert.
 * - Gesendet werden ausschließlich die Sätze aus audio/texte.json an api.elevenlabs.io.
 * - Vorhandene Aufnahmen werden übersprungen; mit --neu werden alle neu erzeugt.
 * - Mit --pruefen wird nur geprüft, ob die Textliste noch zur App passt (kein Netzwerkzugriff).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'audio');
const texts = [...new Set(JSON.parse(fs.readFileSync(path.join(dir, 'texte.json'), 'utf8')))];
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
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
if (stale.length) console.warn('Hinweis: Diese Sätze stehen nicht mehr in app.js und würden nie abgespielt:\n  ' + stale.join('\n  '));
if (args.includes('--pruefen')) {
  console.log(`${texts.length} Sätze, ${texts.join(' ').length} Zeichen, ${writeManifest()} Aufnahmen vorhanden.`);
  process.exit(stale.length ? 1 : 0);
}

const key = process.env.ELEVENLABS_API_KEY, voice = process.env.ELEVENLABS_VOICE_ID;
if (!key || !voice) {
  console.error('Bitte ELEVENLABS_API_KEY und ELEVENLABS_VOICE_ID als Umgebungsvariablen setzen (siehe Kopf dieser Datei).');
  process.exit(1);
}
const model = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let made = 0;
  for (const text of texts) {
    const file = path.join(dir, clipId(text) + '.mp3');
    if (fs.existsSync(file) && !args.includes('--neu')) continue;
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
    await sleep(400);
  }
  const n = writeManifest();
  console.log(`\n${made} neu erzeugt, ${n} von ${texts.length} Aufnahmen vorhanden.`);
})().catch(e => { console.error(e); process.exit(1); });

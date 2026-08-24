import fs from 'node:fs';

const path = 'src/styles/highfly.native.css';
let css = fs.readFileSync(path, 'utf8');
const marker = '/* HIGHFLY v0.6.4 — two-step creator. One job per phone-landscape screen. */';
const markerIndex = css.indexOf(marker);
if (markerIndex < 0) throw new Error('HIGHFLY v0.6.4 creator CSS marker not found');

// v0.6.4 appended this block through String.raw, which preserved the source
// escape sequences (\\n / \") as literal CSS bytes. LightningCSS then sees the
// leading `n` token instead of line breaks. Normalize only this appended block.
let start = markerIndex;
while (start >= 2 && css.slice(start - 2, start) === '\\n') start -= 2;
const head = css.slice(0, start);
let tail = css.slice(start);
tail = tail.replaceAll('\\n', '\n').replaceAll('\\"', '"');
css = head + tail;

fs.writeFileSync(path, css, 'utf8');

// v0.6.3 authors the workout routines as Readonly<Record<...>>. The v0.6.5
// structural/RM pass replaces the complete routine table and intentionally uses
// a mutable local Record while building the new five-day HIGHFLY prescription.
// Normalize only this declaration so the next patch can anchor deterministically.
const trainingPath = 'src/highfly/training_ui.ts';
let training = fs.readFileSync(trainingPath, 'utf8');
const readonlyRoutineDecl = 'const ROUTINES: Readonly<Record<string, readonly string[]>> = {';
const recordRoutineDecl = 'const ROUTINES: Record<string, readonly string[]> = {';
if (training.includes(readonlyRoutineDecl)) {
  training = training.replace(readonlyRoutineDecl, recordRoutineDecl);
  fs.writeFileSync(trainingPath, training, 'utf8');
} else if (!training.includes(recordRoutineDecl)) {
  throw new Error('HIGHFLY training routine declaration not found for v0.6.5 compatibility');
}

console.log('[HIGHFLY v0.6.4.3] creator CSS + v0.6.5 training anchor compatibility applied.');

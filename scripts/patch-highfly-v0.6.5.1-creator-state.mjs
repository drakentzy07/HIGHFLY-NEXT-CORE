import fs from 'node:fs';

const path = 'src/highfly/creator_steps.ts';
let source = fs.readFileSync(path, 'utf8');
const before = "    // Always recover to Appearance when the offline creator is reopened.\n    if (!root.dataset.hfCreatorStep || root.hidden === false) setStep('appearance');";
const after = "    // Initialize once. MutationObserver scans must never reset the stage after\n    // the player presses Next/Back; doing so makes the two-step UI appear stuck.\n    if (!root.dataset.hfCreatorStep) setStep('appearance');";
if (!source.includes(before)) throw new Error('Anchor not found: creator stage initialization');
source = source.replace(before, after);
fs.writeFileSync(path, source, 'utf8');
console.log('[HIGHFLY v0.6.5.1] creator stage state stabilized.');

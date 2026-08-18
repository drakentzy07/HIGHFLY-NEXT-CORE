import fs from 'node:fs';

const path = 'src/game/mobile_controls.ts';
const before = fs.readFileSync(path, 'utf8');
let after = before;

// HIGHFLY extends MobileControls, but ClaudeCraft's upstream tests and any older
// callers do not know about the new dash callback. Keep the extension optional
// at the interface boundary while the real HIGHFLY runtime still supplies it.
after = after.replace(
  '  onDash(): void;',
  '  onDash?(): void;',
);
after = after.replace(
  "this.bindButton('mobile-dash', () => this.callbacks.onDash(), { pressFirst: true });",
  "this.bindButton('mobile-dash', () => this.callbacks.onDash?.(), { pressFirst: true });",
);

if (after === before) {
  throw new Error('HIGHFLY v0.4 dash compatibility anchors not found');
}
if (!after.includes('onDash?(): void;') || !after.includes('this.callbacks.onDash?.()')) {
  throw new Error('HIGHFLY v0.4 dash compatibility patch incomplete');
}

fs.writeFileSync(path, after, 'utf8');
console.log('[HIGHFLY] v0.4 dash callback compatibility patch complete');

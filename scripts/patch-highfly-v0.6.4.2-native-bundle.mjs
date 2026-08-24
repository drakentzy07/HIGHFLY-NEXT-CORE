import fs from 'node:fs';

const path = 'vite.config.ts';
let source = fs.readFileSync(path, 'utf8');

const needle = `    closeBundle() {\n      const { map } = templateModulepreload({ root, outDir, base });`;
const replacement = `    closeBundle() {\n      // HIGHFLY native/offline does not need the web-only first-paint locale\n      // modulepreload optimization. More importantly, this hook is known to\n      // mask an earlier Vite failure by throwing on a missing dist manifest.\n      // Keep ClaudeCraft's runtime locale prefetch intact and let the native\n      // build surface its real error (or finish) without this web-only hook.\n      if (process.env.VITE_NATIVE_APP === '1') {\n        console.log('[HIGHFLY] native bundle: skipping web i18n modulepreload templating');\n        return;\n      }\n      const { map } = templateModulepreload({ root, outDir, base });`;

if (!source.includes(needle)) {
  throw new Error('Anchor not found: i18n modulepreload closeBundle');
}
source = source.replace(needle, replacement);
fs.writeFileSync(path, source, 'utf8');
console.log('[HIGHFLY v0.6.4.2] native Vite modulepreload guard applied.');

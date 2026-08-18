import fs from 'node:fs';

function patch(path, fn) {
  const before = fs.readFileSync(path, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`No changes applied to ${path}`);
  fs.writeFileSync(path, after, 'utf8');
  console.log(`[HIGHFLY] patched ${path}`);
}

patch('src/main.ts', (s) => {
  const oldLine = '  const offlineAvailable = isOfflineModeAvailable(import.meta.env.DEV);';
  const newLine = "  const offlineAvailable = isOfflineModeAvailable(import.meta.env.DEV) || (NATIVE_APP && import.meta.env.VITE_HIGHFLY_OFFLINE === '1');";
  if (!s.includes(oldLine) && !s.includes('VITE_HIGHFLY_OFFLINE')) {
    throw new Error('Offline gate anchor not found in src/main.ts');
  }
  return s.includes(oldLine) ? s.replace(oldLine, newLine) : s;
});

patch('capacitor.config.ts', (s) => {
  let out = s;
  out = out.replace(/CapacitorUpdater:\s*\{[\s\S]*?\n\s*\},/, "CapacitorUpdater: {\n      autoUpdate: false,\n      statsUrl: '',\n    },");
  return out;
});

const strings = 'android/app/src/main/res/values/strings.xml';
if (fs.existsSync(strings)) {
  const s = fs.readFileSync(strings, 'utf8');
  const out = s.replaceAll('World of ClaudeCraft', 'HIGHFLY NEXT CORE').replaceAll('World of Claudecraft', 'HIGHFLY NEXT CORE');
  fs.writeFileSync(strings, out, 'utf8');
}

console.log('[HIGHFLY] Native offline patch complete');

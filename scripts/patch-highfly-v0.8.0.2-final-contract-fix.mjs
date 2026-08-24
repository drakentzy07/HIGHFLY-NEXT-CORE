import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.0.2] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// #129 proved the FINAL runtime creator contract at the S23 target viewport:
// - Appearance 50/50
// - Class 425px | 425px
// - 9 class buttons in a 94px 3x3 grid
// - dossier clientHeight === scrollHeight === 128px (nothing hidden)
// - full 425x283 character preview
// - world boot OK
//
// The only failing assertion was inherited from v0.7.1, when the dossier still
// needed overflow:auto as a safety valve. The final design deliberately fits all
// content and uses overflow:hidden. Align ONLY that stale test contract.
// Runtime, combat, Action Sweep and Fitness Core are intentionally untouched.
{
  const path = 'tests/highfly_v071_combat_matrix_creator.test.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `expect(creator).toContain("important(refs.classDetails, 'overflow', 'auto')")`,
    `expect(creator).toContain("important(refs.classDetails, 'overflow', 'hidden')")`,
    'v0.7.1 stale dossier overflow expectation',
  );

  write(path, source);
}

console.log('[HIGHFLY v0.8.0.2] final creator contract aligned; runtime/combat/fitness untouched.');

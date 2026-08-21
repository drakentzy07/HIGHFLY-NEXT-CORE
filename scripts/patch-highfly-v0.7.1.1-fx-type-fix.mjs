import fs from 'node:fs';

const lifecyclePath = 'src/sim/combat/casting_lifecycle.ts';
let source = fs.readFileSync(lifecyclePath, 'utf8');

const invalidFx = `      fx: ability.projectileFx ?? 'burst',`;
const safeFx = `      fx: 'burst',`;

if (!source.includes(invalidFx)) {
  throw new Error('Anchor not found: v0.7.1 manual miss projectile FX');
}
source = source.replace(invalidFx, safeFx);
fs.writeFileSync(lifecyclePath, source, 'utf8');

// v0.7.1 intentionally reallocates a few pixels from the class preview to the
// dossier so all six stats and the class description fit on phone landscape.
// Keep the old v0.6.6 regression test useful, but align its literal geometry
// expectations with the current runtime-owned layout instead of failing on an
// obsolete 128/143 split that the real smoke test no longer uses.
const legacyCreatorTestPath = 'tests/highfly_v066_creator_combat_flow.test.ts';
let legacyCreatorTest = fs.readFileSync(legacyCreatorTestPath, 'utf8');
const creatorContractReplacements = [
  [
    "important(right, 'grid-template-rows', 'minmax(128px, 0.92fr) minmax(143px, 1.08fr)')",
    "important(right, 'grid-template-rows', 'minmax(120px, 0.88fr) minmax(158px, 1.12fr)')",
  ],
  [
    "important(refs.preview, 'min-height', '128px')",
    "important(refs.preview, 'min-height', '120px')",
  ],
  [
    "important(refs.classDetails, 'min-height', '143px')",
    "important(refs.classDetails, 'min-height', '158px')",
  ],
];

for (const [oldContract, currentContract] of creatorContractReplacements) {
  if (legacyCreatorTest.includes(oldContract)) {
    legacyCreatorTest = legacyCreatorTest.replace(oldContract, currentContract);
  } else if (!legacyCreatorTest.includes(currentContract)) {
    throw new Error(`Anchor not found: legacy creator contract ${oldContract}`);
  }
}
fs.writeFileSync(legacyCreatorTestPath, legacyCreatorTest, 'utf8');

const testPath = 'tests/highfly_v0711_fx_type_fix.test.ts';
const test = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY v0.7.1.1 manual miss FX typing', () => {
  it('uses a ground-impact FX accepted by spellfxAt', () => {
    const lifecycle = fs.readFileSync('src/sim/combat/casting_lifecycle.ts', 'utf8');
    expect(lifecycle).toContain("fx: 'burst'");
    expect(lifecycle).not.toContain("fx: ability.projectileFx ?? 'burst'");
  });

  it('keeps the inherited v0.6.6 creator contract aligned with the current phone layout', () => {
    const creatorTest = fs.readFileSync('tests/highfly_v066_creator_combat_flow.test.ts', 'utf8');
    expect(creatorTest).toContain("minmax(120px, 0.88fr) minmax(158px, 1.12fr)");
    expect(creatorTest).toContain("important(refs.preview, 'min-height', '120px')");
    expect(creatorTest).toContain("important(refs.classDetails, 'min-height', '158px')");
    expect(creatorTest).not.toContain("minmax(128px, 0.92fr) minmax(143px, 1.08fr)");
  });
});
`;
fs.writeFileSync(testPath, test, 'utf8');

console.log('[HIGHFLY v0.7.1.1] manual miss FX + inherited creator contracts aligned.');

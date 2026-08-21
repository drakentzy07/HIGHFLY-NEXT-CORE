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
// v0.6.6.2 added only TWO literal runtime-geometry assertions to the inherited
// test: the right-column split and the dossier minimum height. Align exactly
// those two contracts; do not invent or require anchors that never existed.
const legacyCreatorTestPath = 'tests/highfly_v066_creator_combat_flow.test.ts';
let legacyCreatorTest = fs.readFileSync(legacyCreatorTestPath, 'utf8');

const legacyGridContract =
  "important(right, 'grid-template-rows', 'minmax(128px, 0.92fr) minmax(143px, 1.08fr)')";
const currentGridContract =
  "important(right, 'grid-template-rows', 'minmax(120px, 0.88fr) minmax(158px, 1.12fr)')";
const legacyDetailsContract =
  "important(refs.classDetails, 'min-height', '143px')";
const currentDetailsContract =
  "important(refs.classDetails, 'min-height', '158px')";

if (legacyCreatorTest.includes(legacyGridContract)) {
  legacyCreatorTest = legacyCreatorTest.replace(legacyGridContract, currentGridContract);
} else if (!legacyCreatorTest.includes(currentGridContract)) {
  throw new Error('Anchor not found: inherited creator grid contract');
}

if (legacyCreatorTest.includes(legacyDetailsContract)) {
  legacyCreatorTest = legacyCreatorTest.replace(legacyDetailsContract, currentDetailsContract);
} else if (!legacyCreatorTest.includes(currentDetailsContract)) {
  throw new Error('Anchor not found: inherited creator dossier contract');
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
    expect(creatorTest).toContain("important(refs.classDetails, 'min-height', '158px')");
    expect(creatorTest).not.toContain("minmax(128px, 0.92fr) minmax(143px, 1.08fr)");
  });
});
`;
fs.writeFileSync(testPath, test, 'utf8');

console.log('[HIGHFLY v0.7.1.1] manual miss FX + inherited creator contracts aligned.');

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

const testPath = 'tests/highfly_v0711_fx_type_fix.test.ts';
const test = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY v0.7.1.1 manual miss FX typing', () => {
  it('uses a ground-impact FX accepted by spellfxAt', () => {
    const lifecycle = fs.readFileSync('src/sim/combat/casting_lifecycle.ts', 'utf8');
    expect(lifecycle).toContain("fx: 'burst'");
    expect(lifecycle).not.toContain("fx: ability.projectileFx ?? 'burst'");
  });
});
`;
fs.writeFileSync(testPath, test, 'utf8');

console.log('[HIGHFLY v0.7.1.1] spellfxAt-compatible manual miss FX applied.');

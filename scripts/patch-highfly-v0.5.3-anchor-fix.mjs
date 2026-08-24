import fs from 'node:fs';

const path = '../scripts/patch-highfly-v0.5.3-mobile-skill-aim.mjs';
const before = fs.readFileSync(path, 'utf8');

const oldAnchor = "const explicitDefAnchor = `  private highflyExplicitAimDef(barSlot: number): ReturnType<Hud['abilityForSlot']> | null {`;";
const newAnchor = "const explicitDefAnchor = `  private highflyExplicitAimDef(barSlot: number): ResolvedAbility | null {`;";

if (!before.includes(oldAnchor)) {
  throw new Error('HIGHFLY v0.5.3 anchor-fix target not found');
}

fs.writeFileSync(path, before.replace(oldAnchor, newAnchor), 'utf8');
console.log('[HIGHFLY] v0.5.3 anchor compatibility fix applied.');

import fs from 'node:fs';

const path = 'src/sim/sim.ts';
let source = fs.readFileSync(path, 'utf8');

const methodStart = source.indexOf('  meleeSwing(\n');
const methodEnd = source.indexOf('\n  // -------------------------------------------------------------------------\n  // Damage / death', methodStart);
if (methodStart < 0 || methodEnd < 0) {
  throw new Error('ClaudeCraft 0.40 Sim.meleeSwing wrapper not found');
}

let block = source.slice(methodStart, methodEnd);
const anchor = `      onEffectiveDamage?: (amount: number) => void;\n    },`;

if (!block.includes('abilityId?: string | null;')) {
  if (!block.includes(anchor)) {
    throw new Error('ClaudeCraft 0.40 Sim.meleeSwing option seam not found');
  }
  block = block.replace(
    anchor,
    `      onEffectiveDamage?: (amount: number) => void;\n      // Keep the Sim facade structurally aligned with SimContext/auto_attack.\n      abilityId?: string | null;\n    },`,
  );
  source = source.slice(0, methodStart) + block + source.slice(methodEnd);
  fs.writeFileSync(path, source, 'utf8');
  console.log('[HIGHFLY Foundation preflight] normalized ClaudeCraft 0.40 Sim.meleeSwing seam');
} else {
  console.log('[HIGHFLY Foundation preflight] Sim.meleeSwing seam already normalized');
}

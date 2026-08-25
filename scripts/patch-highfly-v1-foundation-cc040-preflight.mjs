import fs from 'node:fs';

const path = 'src/sim/sim.ts';
let source = fs.readFileSync(path, 'utf8');

// ClaudeCraft 0.40 keeps this adapter private inside Sim. Anchor the real
// wrapper rather than assuming the interface/facade use identical text.
const methodStart = source.indexOf('  private meleeSwing(\n');
const returnAnchor = '    return meleeSwingImpl(this.ctx, attacker, target, bonus, abilityName, opts);';
const returnPos = source.indexOf(returnAnchor, methodStart);
if (methodStart < 0 || returnPos < 0) {
  throw new Error('ClaudeCraft 0.40 private Sim.meleeSwing wrapper not found');
}

const methodEnd = source.indexOf('\n  }', returnPos);
if (methodEnd < 0) {
  throw new Error('ClaudeCraft 0.40 private Sim.meleeSwing wrapper end not found');
}

let block = source.slice(methodStart, methodEnd + 4);
const anchor = `      onEffectiveDamage?: (amount: number) => void;\n    },`;

if (!block.includes('abilityId?: string | null;')) {
  if (!block.includes(anchor)) {
    throw new Error('ClaudeCraft 0.40 Sim.meleeSwing option seam not found');
  }
  // Keep this exact two-line seam because the single Foundation layer threads
  // guaranteedActionHit through it immediately afterwards.
  block = block.replace(
    anchor,
    `      onEffectiveDamage?: (amount: number) => void;\n      abilityId?: string | null;\n    },`,
  );
  source = source.slice(0, methodStart) + block + source.slice(methodEnd + 4);
  fs.writeFileSync(path, source, 'utf8');
  console.log('[HIGHFLY Foundation preflight] normalized ClaudeCraft 0.40 private Sim.meleeSwing seam');
} else {
  console.log('[HIGHFLY Foundation preflight] Sim.meleeSwing seam already normalized');
}

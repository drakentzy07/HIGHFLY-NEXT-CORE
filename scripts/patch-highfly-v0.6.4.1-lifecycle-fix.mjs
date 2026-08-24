import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content, 'utf8'); }
function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

const path = 'src/sim/combat/casting_lifecycle.ts';
let source = read(path);

// v0.6.4 accidentally inserted the finish-side MISS block into castAbility's
// start-side target resolution. Remove that misplaced copy first.
const misplaced = `  const highflyManualMiss =\n    castTarget === -1 &&\n    p.castAim !== null &&\n    highflyManualAimMissAllowed(ability, res, { x: p.castAim.x, z: p.castAim.z }, -1);\n\n  if (highflyManualMiss && p.castAim) {\n    const missCost = billableCost();\n    if (p.resource < missCost) {\n      ctx.error(p.id, \`Not enough \${p.resourceType ?? 'resource'}!\`);\n      return;\n    }\n    spendResource(p, missCost);\n    armAbilityCooldownWithReflection(ctx, p, meta, res, togglingOff);\n    ctx.emit({\n      type: 'spellfxAt',\n      x: p.castAim.x,\n      z: p.castAim.z,\n      school: ability.school,\n      fx: ability.projectileFx ?? 'projectile',\n      ability: ability.id,\n      sourceId: p.id,\n    });\n    if (!ability.offGcd) {\n      const gcd = Math.max(MIN_GCD, ctx.playerGcdFor(meta.cls) / spellHasteMult(p));\n      p.gcdRemaining = Math.max(p.gcdRemaining, gcd);\n    }\n    if (p.kind === 'player' && ability.school !== 'physical') ctx.applySetProcs(p, null, 'spellCast');\n    if (p.kind === 'player') onCastCompleted(ctx, p, ability.id, null);\n    return;\n  }\n\n  let target: Entity | null = null;\n  if (ability.id === 'unleash_weapon') {`;
source = replaceRequired(
  source,
  misplaced,
  `  let target: Entity | null = null;\n  if (ability.id === 'unleash_weapon') {`,
  'remove misplaced manual miss finish block',
);

// The manual-miss hostile branch guarantees target=p, while the normal branch
// returns on a missing target. Make that guarantee explicit for TypeScript and
// keep the rest of ClaudeCraft's target validation unchanged.
const targetGate = `    if (!highflyManualMiss && (!target || target.dead || !ctx.isHostileTo(p, target) || hasEscapeStealth(target))) {\n      ctx.error(p.id, 'You have no target.', target?.dead ? 'target_dead' : undefined);\n      return;\n    }\n    const d = dist2d(p.pos, target.pos);`;
source = replaceRequired(
  source,
  targetGate,
  `    if (!highflyManualMiss && (!target || target.dead || !ctx.isHostileTo(p, target) || hasEscapeStealth(target))) {\n      ctx.error(p.id, 'You have no target.', target?.dead ? 'target_dead' : undefined);\n      return;\n    }\n    if (!target) return;\n    const d = dist2d(p.pos, target.pos);`,
  'manual miss target narrowing',
);

// Resolve the sentinel in applyAbility, after billableCost exists and before
// normal entity target validation. GCD was already armed at cast start; this
// branch only bills the authored cost/cooldown and emits an impact at castAim.
const applyAnchor = `  const billableCost = (): number => {\n    if (res.cost <= 0 || togglingOff) return res.cost;\n    if (consumeFreeCostFor(ctx, p, ability.id)) return 0;\n    const cheap = consumeNextCastCheap(ctx, p, ability.id);\n    return cheap !== null ? Math.ceil(res.cost * cheap) : res.cost;\n  };\n  if (ability.id === 'conjure_water') {`;
const applyReplacement = `  const billableCost = (): number => {\n    if (res.cost <= 0 || togglingOff) return res.cost;\n    if (consumeFreeCostFor(ctx, p, ability.id)) return 0;\n    const cheap = consumeNextCastCheap(ctx, p, ability.id);\n    return cheap !== null ? Math.ceil(res.cost * cheap) : res.cost;\n  };\n\n  const highflyManualMiss =\n    castTarget === -1 &&\n    p.castAim !== null &&\n    highflyManualAimMissAllowed(ability, res, { x: p.castAim.x, z: p.castAim.z }, -1);\n  if (highflyManualMiss && p.castAim) {\n    const missCost = billableCost();\n    if (p.resource < missCost) {\n      ctx.error(p.id, \`Not enough \${p.resourceType ?? 'resource'}!\`);\n      return;\n    }\n    spendResource(p, missCost);\n    armAbilityCooldownWithReflection(ctx, p, meta, res, togglingOff);\n    ctx.emit({\n      type: 'spellfxAt',\n      x: p.castAim.x,\n      z: p.castAim.z,\n      school: ability.school,\n      fx: 'burst',\n      ability: ability.id,\n      sourceId: p.id,\n    });\n    if (p.kind === 'player' && ability.school !== 'physical') ctx.applySetProcs(p, null, 'spellCast');\n    if (p.kind === 'player') onCastCompleted(ctx, p, ability.id, null);\n    return;\n  }\n\n  if (ability.id === 'conjure_water') {`;
source = replaceRequired(source, applyAnchor, applyReplacement, 'manual miss applyAbility resolution');

write(path, source);
console.log('[HIGHFLY v0.6.4.1] manual miss lifecycle hotfix applied.');

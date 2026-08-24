import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.5.1] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// Reaver Strike is now authored as a real action-combat sweep. Once the player is
// in range/facing and the slash is released, the old MMO white-hit miss/dodge/parry
// lottery must not silently consume the queued skill before its spatial sweep can
// resolve. Other attacks retain ClaudeCraft's hit table unchanged for now.
{
  const path = 'src/sim/combat/auto_attack.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `  const missChance =
    swingMissChance(attacker, target) +
    blindMissBonus(attacker) +
    (opts.whiteDualWieldPenalty ? DUAL_WIELD_WHITE_MISS_PENALTY : 0);
  const dodgeChance = opts.cannotBeDodged
    ? 0
    : target.kind === 'player'
      ? target.dodgeChance
      : 0.05 + Math.max(0, target.level - attacker.level) * 0.005;
  const { parryChance, blockChance } = warriorMeleeDefense(target, attacker);`,
    `  // HIGHFLY action-hit authority: Reaver's 100-degree sweep is body/geometry
  // driven. Do not let the inherited MMO random hit table eat the skill before
  // the already-authored multi-body propagation below can execute.
  const highflyGuaranteedActionHit = opts.abilityId === 'heroic_strike';
  const missChance = highflyGuaranteedActionHit
    ? 0
    : swingMissChance(attacker, target) +
      blindMissBonus(attacker) +
      (opts.whiteDualWieldPenalty ? DUAL_WIELD_WHITE_MISS_PENALTY : 0);
  const dodgeChance =
    highflyGuaranteedActionHit || opts.cannotBeDodged
      ? 0
      : target.kind === 'player'
        ? target.dodgeChance
        : 0.05 + Math.max(0, target.level - attacker.level) * 0.005;
  const highflyDefense = highflyGuaranteedActionHit
    ? { parryChance: 0, blockChance: 0 }
    : warriorMeleeDefense(target, attacker);
  const { parryChance, blockChance } = highflyDefense;`,
    'Reaver deterministic action-hit table',
  );

  // The inherited melee driver deliberately skips generic world LOS at point blank
  // and only protects the arena's thin walls. v0.8.5 accidentally made Reaver's
  // secondary bodies stricter than its primary by requiring hasLineOfSight() in
  // every world location. A prop/collider could therefore allow the primary melee
  // hit while silently rejecting a second body in the exact same slash volume.
  // Mirror the real melee contract: only arena walls gate the extra bodies.
  source = replaceRequired(
    source,
    `        if (hostile.id === t.id || hostile.dead) continue;
        if (!ctx.hasLineOfSight(p, hostile)) continue;
        const highflyReaverDiff = Math.abs(`,
    `        if (hostile.id === t.id || hostile.dead) continue;
        if (isArenaPos(p.pos.x) && !ctx.hasLineOfSight(p, hostile)) continue;
        const highflyReaverDiff = Math.abs(`,
    'Reaver secondary bodies follow the same melee LOS contract as the primary',
  );

  write(path, source);
}

console.log('[HIGHFLY v0.8.5.1] Reaver uses geometry/action-hit authority; legacy random miss/dodge/parry no longer consumes the sweep, and secondary bodies share the primary melee LOS contract.');

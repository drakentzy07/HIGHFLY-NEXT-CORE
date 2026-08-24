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

// Reaver Strike is a real action-combat sweep. Its geometry decides which bodies
// are struck; the inherited MMO random miss/dodge/parry table must not eat the
// action after the slash already intersects a hostile body.
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
  // driven. Every body intersected by that authored action uses the same guaranteed
  // action-hit contract; ordinary attacks retain the inherited hit table.
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

  // v0.8.5 originally captured the primary dealDamage return through onDealt and
  // manually copied that number to secondary bodies. The real test proved that
  // bridge was the only remaining broken piece: the primary landed, while the
  // secondary never received damage. Resolve every intersected body through the
  // same melee engine that already powers the proven Wicked Slash fan-out instead.
  // Resource/cooldown are still consumed only once by the queued primary swing.
  source = replaceRequired(
    source,
    `    let highflyReaverPrimaryDamage = 0;
    const connected = meleeSwing(ctx, p, t, bonus, abilityName, {
      autoAttackHand: 'mainhand',
      abilityId,
      threatFlat,
      threatMult,
      weaponMult,
      whiteDualWieldPenalty: dualWieldWhiteMissPenalty && abilityName === null,
      autoAttack: true,
      onDealt:
        abilityId === 'heroic_strike'
          ? (amount) => {
              highflyReaverPrimaryDamage = amount;
            }
          : undefined,
    });

    // HIGHFLY Combatant starter: Reaver Strike is spatial, not target-exclusive.
    // The primary owns the hit roll; secondary bodies inside the connected slash
    // inherit that landed physical hit without another miss/dodge/proc roll.
    if (connected && abilityId === 'heroic_strike' && highflyReaverPrimaryDamage > 0) {
      const highflyReaverHalfAngle = (50 * Math.PI) / 180;
      let highflyReaverBodies = 0;
      for (const hostile of ctx.hostilesInRadius(p, p.pos, MELEE_RANGE + 1.25)) {
        if (highflyReaverBodies >= 4) break;
        if (hostile.id === t.id || hostile.dead) continue;
        if (!ctx.hasLineOfSight(p, hostile)) continue;
        const highflyReaverDiff = Math.abs(
          normAngle(angleTo(p.pos, hostile.pos) - p.facing),
        );
        if (highflyReaverDiff > highflyReaverHalfAngle) continue;
        highflyReaverBodies += 1;
        ctx.dealDamage(
          p,
          hostile,
          highflyReaverPrimaryDamage,
          false,
          'physical',
          abilityName,
          'hit',
          false,
          { flat: 0, mult: threatMult },
          true,
          false,
          false,
          abilityId,
        );
      }
    }`,
    `    const connected = meleeSwing(ctx, p, t, bonus, abilityName, {
      autoAttackHand: 'mainhand',
      abilityId,
      threatFlat,
      threatMult,
      weaponMult,
      whiteDualWieldPenalty: dualWieldWhiteMissPenalty && abilityName === null,
      autoAttack: true,
    });

    // HIGHFLY Combatant starter: Reaver Strike is spatial, not target-exclusive.
    // Once the primary connects, every other hostile body in the same 100-degree
    // sweep is resolved through meleeSwing as a skill hit. This mirrors the proven
    // Wicked Slash multi-body architecture instead of manually copying damage.
    if (connected && abilityId === 'heroic_strike') {
      const highflyReaverHalfAngle = (50 * Math.PI) / 180;
      let highflyReaverBodies = 0;
      for (const hostile of ctx.hostilesInRadius(p, p.pos, MELEE_RANGE + 1.25)) {
        if (highflyReaverBodies >= 4) break;
        if (hostile.id === t.id || hostile.dead) continue;
        if (isArenaPos(p.pos.x) && !ctx.hasLineOfSight(p, hostile)) continue;
        const highflyReaverDiff = Math.abs(
          normAngle(angleTo(p.pos, hostile.pos) - p.facing),
        );
        if (highflyReaverDiff > highflyReaverHalfAngle) continue;

        const highflySecondaryConnected = meleeSwing(ctx, p, hostile, bonus, abilityName, {
          autoAttackHand: 'mainhand',
          abilityId,
          threatFlat: 0,
          threatMult,
          weaponMult,
          whiteDualWieldPenalty: false,
          autoAttack: false,
        });
        if (highflySecondaryConnected) highflyReaverBodies += 1;
      }
    }`,
    'Reaver multi-body fan-out uses the proven melee resolver',
  );

  write(path, source);
}

console.log('[HIGHFLY v0.8.5.1] Reaver now resolves every intersected body through the proven melee engine; no fragile primary-damage callback/copy bridge remains.');

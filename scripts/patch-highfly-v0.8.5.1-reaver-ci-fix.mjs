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

// ---------------------------------------------------------------------------
// 1) REAVER STRIKE: ONE CONNECTED SLASH, MANY BODIES
//
// v0.8.5 correctly found secondary bodies inside the 100-degree sweep, but then
// rolled a fresh meleeSwing for every secondary. That allowed a body visibly
// intersecting an already-landed slash to independently miss/dodge. HIGHFLY's
// action geometry contract is different: once the primary Reaver swing connects,
// every hostile body intersecting that slash volume receives the spatial hit.
// Secondary bodies intentionally do NOT reroll weapon hit-table/procs.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/auto_attack.ts';
  let source = read(path);

  source = replaceRequired(
    source,
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
    // The queued ability spends rage/cooldown once above; secondary bodies only
    // resolve the same weapon hit inside the authored frontal sweep.
    if (connected && abilityId === 'heroic_strike') {
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
        meleeSwing(ctx, p, hostile, bonus, abilityName, {
          autoAttackHand: 'mainhand',
          abilityId,
          threatFlat,
          threatMult,
          weaponMult,
          whiteDualWieldPenalty: false,
          autoAttack: false,
        });
      }
    }
`,
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

    // HIGHFLY Combatant starter: one connected Reaver slash owns one physical
    // volume. Secondary bodies inside that volume receive the landed slash damage
    // directly; they do not get a second independent miss/dodge roll.
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
    }
`,
    'Reaver secondary bodies inherit connected slash instead of rerolling melee hit table',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) CLAUDECRAFT LEGACY HOTBAR TEST -> HIGHFLY ACTION CONTRACT
//
// The upstream test deliberately expects the old mobile behavior (idle ATTACK calls
// attackNearest). HIGHFLY has intentionally removed that behavior. Update the test
// itself so the inherited suite guards the new contract instead of rejecting it.
// ---------------------------------------------------------------------------
{
  const path = 'tests/hotbar.test.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `  it('acquires the nearest target when idle and a resolver is available', () => {
    const calls: string[] = [];

    handleMobileAttackTap(
      { autoAttack: false, hasLiveHostileTarget: false },
      {
        activateAttack: () => calls.push('toggle'),
        attackNearest: () => calls.push('nearest'),
      },
    );

    expect(calls).toEqual(['nearest']);
  });`,
    `  it('starts the HIGHFLY attack action directly when idle even if a nearest resolver exists', () => {
    const calls: string[] = [];

    handleMobileAttackTap(
      { autoAttack: false, hasLiveHostileTarget: false },
      {
        activateAttack: () => calls.push('toggle'),
        attackNearest: () => calls.push('nearest'),
      },
    );

    expect(calls).toEqual(['toggle']);
  });`,
    'legacy target-first hotbar expectation',
  );

  write(path, source);
}

console.log('[HIGHFLY v0.8.5.1] Reaver connected sweep is deterministic across intersected bodies; legacy mobile target-first test aligned to HIGHFLY action combat.');

import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.5] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// 1) REAL MOBILE ATTACK BUTTON PATH
//
// v0.8.4 fixed Sim.startAutoAttack(), but ClaudeCraft's real mobile ring never
// reached it when no target was selected: handleMobileAttackTap intercepted the
// tap and called attackNearest(), which explicitly targetEntity()'d a mob first.
// HIGHFLY removes that MMO target-first branch. The real button now ALWAYS invokes
// the fixed Attack action; the Sim itself performs the restrained frontal assist.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud/action_bar/hotbar.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `export function handleMobileAttackTap(
  state: { autoAttack: boolean; hasLiveHostileTarget: boolean },
  actions: { activateAttack: () => void; attackNearest: (() => void) | null },
): void {
  if (!state.autoAttack && !state.hasLiveHostileTarget && actions.attackNearest) {
    actions.attackNearest();
    return;
  }
  actions.activateAttack();
}`,
    `export function handleMobileAttackTap(
  state: { autoAttack: boolean; hasLiveHostileTarget: boolean },
  actions: { activateAttack: () => void; attackNearest: (() => void) | null },
): void {
  // HIGHFLY action-combat contract: the Attack button is an ACTION, never a
  // disguised Target/Tab button. Sim.startAutoAttack owns soft acquisition.
  void state;
  void actions.attackNearest;
  actions.activateAttack();
}`,
    'real mobile Attack bypasses attackNearest target-first interception',
  );

  write(path, source);
}

// ClaudeCraft's inherited hotbar unit test pins the OLD contract (idle Attack
// invokes attackNearest). HIGHFLY intentionally replaces that behavior, so the
// inherited test must guard the new action-first contract instead.
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
    'legacy mobile target-first hotbar expectation',
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) COMBATANT SKILL 1 — REAVER STRIKE IS A TRUE MULTI-BODY FRONT SWEEP
//
// The starter warrior action is authored as an on-next-swing weaponDamage skill.
// That path never reaches the generic aoeDamage dispatcher. Preserve one rage spend
// and one hit-table roll on the primary. Once that slash CONNECTS, all other bodies
// inside the same 100-degree volume receive the landed slash damage directly. They
// must not independently miss/dodge a slash whose geometry already intersects them.
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
    // Thuggery mastery (Sword Specialization shape): a landed mainhand auto has`,
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
    }

    // Thuggery mastery (Sword Specialization shape): a landed mainhand auto has`,
    'Reaver Strike connected slash propagates to all intersected bodies',
  );

  write(path, source);
}

// Make the telegraph truthful: Reaver Strike is now a broad frontal action, not
// a one-pixel-looking line that implies target exclusivity.
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `    if (def?.id === 'sinister_strike') {
      return {`,
    `    if (def?.id === 'heroic_strike') {
      return {
        shape: 'cone',
        range: MELEE_RANGE + 1.25,
        width: 0,
        angleDeg: 100,
        radius: 0,
      };
    }

    if (def?.id === 'sinister_strike') {
      return {`,
    'Reaver Strike explicit 100-degree mobile aim profile',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) COMBATANT SKILL 3 — ONRUSH / CHARGE OWNS A REAL DAMAGE CORRIDOR
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/effect_dispatch.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `      case 'charge': {
        if (!target || hasUnbreakableMovementLock(p)) break;
        // the stun effect in the same ability lands this tick; the player`,
    `      case 'charge': {
        if (!target || hasUnbreakableMovementLock(p)) break;

        if (ability.id === 'charge') {
          const highflyChargeStartX = p.pos.x;
          const highflyChargeStartZ = p.pos.z;
          const highflyChargeDx = target.pos.x - highflyChargeStartX;
          const highflyChargeDz = target.pos.z - highflyChargeStartZ;
          const highflyChargeLenSq = highflyChargeDx * highflyChargeDx + highflyChargeDz * highflyChargeDz;
          const highflyChargeLen = Math.sqrt(highflyChargeLenSq);
          const highflyChargeHalfWidth = 1.6;
          let highflyChargeBodies = 0;

          if (highflyChargeLenSq > 0.0001) {
            for (const hostile of ctx.hostilesInRadius(
              p,
              p.pos,
              highflyChargeLen + highflyChargeHalfWidth,
            )) {
              if (highflyChargeBodies >= 6) break;
              if (hostile.dead) continue;
              const highflyChargeWx = hostile.pos.x - highflyChargeStartX;
              const highflyChargeWz = hostile.pos.z - highflyChargeStartZ;
              const highflyChargeT = Math.max(
                0,
                Math.min(
                  1,
                  (highflyChargeWx * highflyChargeDx + highflyChargeWz * highflyChargeDz) /
                    highflyChargeLenSq,
                ),
              );
              const highflyChargeClosestX = highflyChargeStartX + highflyChargeDx * highflyChargeT;
              const highflyChargeClosestZ = highflyChargeStartZ + highflyChargeDz * highflyChargeT;
              const highflyChargeDistance = Math.hypot(
                hostile.pos.x - highflyChargeClosestX,
                hostile.pos.z - highflyChargeClosestZ,
              );
              if (highflyChargeDistance > highflyChargeHalfWidth) continue;
              if (!ctx.hasLineOfSight(p, hostile)) continue;

              highflyChargeBodies += 1;
              ctx.meleeSwing(p, hostile, 0, ability.name, {
                normalizedInstant: true,
                weaponMult: 0.65,
                threatFlat: res.threatFlat,
                threatMult: res.threatMult,
                abilityId: ability.id,
              });
            }
          }
        }

        // the stun effect in the same ability lands this tick; the player`,
    'Onrush real multi-body travel corridor',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) REGRESSION — TEST THE REAL MOBILE INTERCEPTOR + THE TWO REPORTED SKILLS
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v085_real_mobile_combat.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { handleMobileAttackTap } from '../src/ui/hud/action_bar/hotbar';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';
import { groundHeight } from '../src/sim/world';

function killAmbientMobs(sim: Sim): void {
  for (const entity of sim.entities.values()) {
    if (entity.kind === 'mob') entity.dead = true;
  }
}

function addDummy(sim: Sim, id: number, x: number, z: number): Entity {
  const dummy = createMob(id, MOBS.training_dummy, 1, {
    x,
    y: groundHeight(x, z, sim.cfg.seed),
    z,
  });
  dummy.hostile = true;
  dummy.dead = false;
  dummy.maxHp = dummy.hp = 1_000_000;
  dummy.level = 1;
  dummy.stats.armor = 0;
  (sim as unknown as { addEntity(e: Entity): void }).addEntity(dummy);
  return dummy;
}

function placePlayer(sim: Sim, x: number, z: number): void {
  const p = sim.player;
  p.pos.x = x;
  p.pos.z = z;
  p.pos.y = groundHeight(x, z, sim.cfg.seed);
  p.prevPos = { ...p.pos };
  (sim as unknown as { rebucket(e: Entity): void }).rebucket(p);
  p.resource = p.maxResource;
  p.swingTimer = 0;
  p.offhandSwingTimer = 0;
}

describe('HIGHFLY v0.8.5 real mobile combat path', () => {
  it('the actual mobile Attack helper never calls attackNearest / target-first anymore', () => {
    let attackCalls = 0;
    let nearestCalls = 0;
    handleMobileAttackTap(
      { autoAttack: false, hasLiveHostileTarget: false },
      {
        activateAttack: () => { attackCalls += 1; },
        attackNearest: () => { nearestCalls += 1; },
      },
    );
    expect(attackCalls).toBe(1);
    expect(nearestCalls).toBe(0);
  });

  it('Combatant Reaver Strike damages two bodies inside its frontal sweep', () => {
    const sim = new Sim({ seed: 851, playerClass: 'warrior' });
    sim.setPlayerLevel(4);
    killAmbientMobs(sim);
    placePlayer(sim, 10, 10);
    const p = sim.player;
    p.facing = 0;
    const primary = addDummy(sim, 98510, 10, 13);
    const secondary = addDummy(sim, 98511, 11.0, 13.1);

    sim.targetEntity(primary.id);
    p.resource = p.maxResource;
    sim.castAbility('heroic_strike');
    sim.startAutoAttack();

    for (let tick = 0; tick < 20 * 8; tick += 1) sim.tick();

    expect(primary.hp, 'Reaver primary').toBeLessThan(primary.maxHp);
    expect(secondary.hp, 'Reaver secondary body').toBeLessThan(secondary.maxHp);
  });

  it('Combatant Onrush damages multiple bodies intersecting its dash corridor', () => {
    const sim = new Sim({ seed: 852, playerClass: 'warrior' });
    sim.setPlayerLevel(4);
    killAmbientMobs(sim);
    placePlayer(sim, 20, 20);
    const p = sim.player;
    p.facing = 0;
    const middle = addDummy(sim, 98520, 20.9, 25);
    const anchor = addDummy(sim, 98521, 20, 30);

    sim.targetEntity(anchor.id);
    p.resource = p.maxResource;
    sim.castAbility('charge');
    for (let tick = 0; tick < 20 * 2; tick += 1) sim.tick();

    expect(middle.hp, 'Onrush corridor body').toBeLessThan(middle.maxHp);
    expect(anchor.hp, 'Onrush anchor body').toBeLessThan(anchor.maxHp);
  });

  it('pins the visual promise to the same real geometry', () => {
    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
    const attacks = fs.readFileSync('src/sim/combat/auto_attack.ts', 'utf8');
    const dispatch = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');
    expect(hud).toContain("def?.id === 'heroic_strike'");
    expect(hud).toContain('angleDeg: 100');
    expect(attacks).toContain("abilityId === 'heroic_strike'");
    expect(attacks).toContain('highflyReaverPrimaryDamage');
    expect(attacks).toContain('highflyReaverHalfAngle');
    expect(dispatch).toContain("ability.id === 'charge'");
    expect(dispatch).toContain('highflyChargeHalfWidth = 1.6');
  });
});
`;

  write(path, content);
}

console.log('[HIGHFLY v0.8.5] real mobile Attack path + deterministic Reaver sweep + Onrush multi-body semantics installed.');

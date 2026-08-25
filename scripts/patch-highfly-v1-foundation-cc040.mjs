import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v1 foundation] wrote ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

function replaceRegexRequired(source, regex, replacement, label) {
  if (!regex.test(source)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(regex, replacement);
}

const pkg = JSON.parse(read('package.json'));
if (pkg.version !== '0.40.0') {
  throw new Error(`HIGHFLY Foundation expects ClaudeCraft 0.40.0, got ${pkg.version}`);
}

// ---------------------------------------------------------------------------
// HIGHFLY ACTION COMBAT CONTRACT
//
// 1. ATTACK is an action, never a disguised target-selection command.
// 2. A valid manual target is only a focus preference inside the authored attack
//    geometry. Without one, a narrow frontal soft resolver may choose a body.
// 3. The soft resolver does NOT mutate player.targetId, so action combat never
//    fabricates a UI selection merely to make damage legal.
// 4. Spatial skills resolve every hostile body inside their authored geometry.
// ---------------------------------------------------------------------------

// Real mobile button path: bypass ClaudeCraft's attackNearest -> targetEntity seam.
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
  // HIGHFLY: ATTACK owns combat intent. Target selection is optional focus assist.
  void state;
  void actions.attackNearest;
  actions.activateAttack();
}`,
    'mobile Attack action-first contract',
  );
  write(path, source);
}

// Update ClaudeCraft's inherited unit contract so upstream tests protect HIGHFLY's
// deliberate action-first behavior instead of reintroducing target-first combat.
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
    'legacy hotbar target-first expectation',
  );
  write(path, source);
}

// Shared pure geometry primitives. Every HIGHFLY cone/corridor/area skill will
// converge on this layer instead of adding one-off target loops inside abilities.
write(
  'src/sim/combat/highfly_action_geometry.ts',
  `import type { SimContext } from '../sim_context';
import { angleTo, dist2d, type Entity, normAngle } from '../types';

export interface HighflyConeSpec {
  range: number;
  halfAngleRad: number;
  maxTargets?: number;
  excludeIds?: ReadonlySet<number>;
}

export function highflyBodyInsideCone(
  source: Entity,
  target: Entity,
  range: number,
  halfAngleRad: number,
): boolean {
  if (target.dead || target.id === source.id) return false;
  if (dist2d(source.pos, target.pos) > range) return false;
  const diff = Math.abs(normAngle(angleTo(source.pos, target.pos) - source.facing));
  return diff <= halfAngleRad;
}

export function highflyHostilesInCone(
  ctx: SimContext,
  source: Entity,
  spec: HighflyConeSpec,
): Entity[] {
  const out: Entity[] = [];
  const exclude = spec.excludeIds ?? new Set<number>();
  const maxTargets = Math.max(1, spec.maxTargets ?? Number.MAX_SAFE_INTEGER);

  for (const hostile of ctx.hostilesInRadius(source, source.pos, spec.range)) {
    if (out.length >= maxTargets) break;
    if (exclude.has(hostile.id)) continue;
    if (!highflyBodyInsideCone(source, hostile, spec.range, spec.halfAngleRad)) continue;
    out.push(hostile);
  }

  return out;
}
`,
);

// Targetless basic attack + Reaver spatial sweep on the authoritative sim path.
{
  const path = 'src/sim/combat/auto_attack.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `import { drawWeapon } from '../weapon_stow';`,
    `import { drawWeapon } from '../weapon_stow';
import { highflyHostilesInCone } from './highfly_action_geometry';`,
    'HIGHFLY geometry import',
  );

  const helperAnchor = 'export function startAutoAttack(ctx: SimContext, pid?: number): void {';
  const helper = `const HIGHFLY_BASIC_ASSIST_HALF_ANGLE = (58 * Math.PI) / 180;
const HIGHFLY_REAVER_HALF_ANGLE = (50 * Math.PI) / 180;
const HIGHFLY_REAVER_RANGE = MELEE_RANGE + 1.25;

function highflyBasicTargetIsUsable(
  ctx: SimContext,
  p: Entity,
  meta: PlayerMeta,
  target: Entity | null | undefined,
): target is Entity {
  if (!target || target.dead || target.id === p.id || hasEscapeStealth(target)) return false;
  if (!ctx.isHostileTo(p, target)) return false;

  const distance = dist2d(p.pos, target.pos);
  const ranged = rangedAutoProfile(p, meta.cls);
  const meleeLegal = distance <= MELEE_RANGE;
  const rangedLegal =
    ranged !== undefined &&
    distance <= ranged.maxRange &&
    (ranged.wand || distance >= ranged.minRange);
  if (!meleeLegal && !rangedLegal) return false;

  const facingDiff = Math.abs(normAngle(angleTo(p.pos, target.pos) - p.facing));
  if (facingDiff > HIGHFLY_BASIC_ASSIST_HALF_ANGLE) return false;

  if (rangedLegal && !ctx.hasLineOfSight(p, target)) return false;
  if (meleeLegal && isArenaPos(p.pos.x) && !ctx.hasLineOfSight(p, target)) return false;
  return true;
}

function highflyAcquireBasicTarget(
  ctx: SimContext,
  p: Entity,
  meta: PlayerMeta,
): Entity | null {
  const ranged = rangedAutoProfile(p, meta.cls);
  const maxRange = Math.max(MELEE_RANGE, ranged?.maxRange ?? 0);
  let best: Entity | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of ctx.hostilesInRadius(p, p.pos, maxRange)) {
    if (!highflyBasicTargetIsUsable(ctx, p, meta, candidate)) continue;
    const distance = dist2d(p.pos, candidate.pos);
    const facingDiff = Math.abs(normAngle(angleTo(p.pos, candidate.pos) - p.facing));
    // Direction dominates distance: this is a frontal action-assist, never Tab targeting.
    const score = facingDiff * 5 + distance / Math.max(1, maxRange);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

`;
  source = replaceRequired(source, helperAnchor, helper + helperAnchor, 'HIGHFLY basic resolver');

  source = replaceRegexRequired(
    source,
    /export function startAutoAttack\(ctx: SimContext, pid\?: number\): void \{[\s\S]*?\n\}\n\nexport function stopAutoAttack/,
    `export function startAutoAttack(ctx: SimContext, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const p = r.e;
  if (p.dead) return;
  if (isInStasis(p)) return;
  if (isValkyrsCallingAirborne(p)) return;
  if (p.auras.some((a) => isTravelFormAuraKind(a.kind))) return;

  // HIGHFLY: pressing ATTACK is valid even in empty space. It arms combat intent;
  // updatePlayerAutoAttack performs a narrow frontal body query every tick.
  if (p.mountKey !== '') forceDismount(ctx, p);
  if (p.sitting) ctx.standUp(p);
  if (p.weaponStowed) drawWeapon(p);
  p.autoAttack = true;
  r.meta.lastActiveTick = ctx.tickCount;

  // Preserve ClaudeCraft's immediate melee aggro seed only when the player already
  // has a valid manual hostile in the actual frontal attack geometry. Soft-acquired
  // bodies are not written into targetId and enter combat on the landed hit instead.
  const manual = p.targetId !== null ? ctx.entities.get(p.targetId) : null;
  if (!highflyBasicTargetIsUsable(ctx, p, r.meta, manual)) return;
  const d = dist2d(p.pos, manual.pos);
  if (
    d <= MELEE_RANGE &&
    !p.castingAbility &&
    manual.kind === 'mob' &&
    manual.hostile &&
    manual.ownerId === null &&
    manual.aiState !== 'evade'
  ) {
    if (questGateBlocksAggro(ctx.players, manual, p)) {
      p.autoAttack = false;
      return;
    }
    if (manual.aiState === 'idle' && !ctx.aggroMob(manual, p, true)) {
      p.autoAttack = false;
      return;
    } else if (manual.aggroTargetId === null) {
      manual.aggroTargetId = p.id;
    }
    addThreat(manual, p.id, 1);
    p.combatTimer = 0;
    p.inCombat = true;
  }
}

export function stopAutoAttack`,
    'targetless startAutoAttack implementation',
  );

  source = replaceRequired(
    source,
    `  const t = p.targetId !== null ? ctx.entities.get(p.targetId) : null;
  // A target that slips into Vanish's escape stealth mid-fight must drop the
  // swing too (issue #2426): the client stops rendering it as targeted, but
  // without this the swing kept connecting on a target the caster could no
  // longer see, the same detection the mob AI already honors (mobCanSeeTarget).
  if (!t || t.dead || !ctx.isHostileTo(p, t) || hasEscapeStealth(t)) {
    p.autoAttack = false;
    return;
  }`,
    `  const manual = p.targetId !== null ? ctx.entities.get(p.targetId) : null;
  const t = highflyBasicTargetIsUsable(ctx, p, meta, manual)
    ? manual
    : highflyAcquireBasicTarget(ctx, p, meta);
  // No body in the authored frontal volume yet: stay armed and wait. We do not
  // fabricate a selection, auto-rotate to a screen-wide nearest target, or error.
  if (!t) return;`,
    'continuous targetless frontal acquisition',
  );

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
    });`,
    `    const connected = meleeSwing(ctx, p, t, bonus, abilityName, {
      autoAttackHand: 'mainhand',
      abilityId,
      threatFlat,
      threatMult,
      weaponMult,
      whiteDualWieldPenalty: dualWieldWhiteMissPenalty && abilityName === null,
      autoAttack: true,
      guaranteedActionHit: abilityId === 'heroic_strike',
    });

    // Reaver Strike / Skill 1 is a true 100-degree spatial slash. Resource,
    // queue consumption and cooldown were already paid exactly once above. Each
    // additional intersected body resolves one physical weapon hit through the
    // shared melee engine, but cannot independently miss/dodge/parry an authored
    // slash whose body geometry already intersected it.
    if (connected && abilityId === 'heroic_strike') {
      const extras = highflyHostilesInCone(ctx, p, {
        range: HIGHFLY_REAVER_RANGE,
        halfAngleRad: HIGHFLY_REAVER_HALF_ANGLE,
        maxTargets: 4,
        excludeIds: new Set([t.id]),
      });
      for (const hostile of extras) {
        if (isArenaPos(p.pos.x) && !ctx.hasLineOfSight(p, hostile)) continue;
        meleeSwing(ctx, p, hostile, bonus, abilityName, {
          autoAttackHand: 'mainhand',
          abilityId,
          threatFlat: 0,
          threatMult,
          weaponMult,
          whiteDualWieldPenalty: false,
          autoAttack: false,
          guaranteedActionHit: true,
        });
      }
    }`,
    'Reaver true spatial multi-body sweep',
  );

  source = replaceRequired(
    source,
    `    normalizedInstant?: boolean;
  },`,
    `    normalizedInstant?: boolean;
    /** HIGHFLY spatial action: geometry already confirmed body intersection. */
    guaranteedActionHit?: boolean;
  },`,
    'meleeSwing guaranteed action option',
  );

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
    `  const highflyGuaranteedActionHit = opts.guaranteedActionHit === true;
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
    'geometry-authoritative melee hit table',
  );

  write(path, source);
}

// Build identity is generated during the patch step and embedded in the web bundle.
write(
  'public/highfly-build.json',
  JSON.stringify(
    {
      product: 'HIGHFLY',
      foundation: 'v1',
      upstream: 'ClaudeCraft 0.40.0',
      highflyCommit: process.env.GITHUB_SHA ?? 'local',
      builtAt: new Date().toISOString(),
      contracts: {
        targetlessBasic: true,
        mobileAttackActionFirst: true,
        reaverSpatialSweep: true,
      },
    },
    null,
    2,
  ) + '\n',
);

// Decisive regression: test the real mobile helper, targetless authoritative Sim,
// absence of targetId fabrication, and Reaver's multi-body spatial contract.
write(
  'tests/highfly_v1_foundation.test.ts',
  `import { describe, expect, it } from 'vitest';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity, PlayerClass } from '../src/sim/types';
import { ALL_CLASSES } from '../src/sim/types';
import { groundHeight } from '../src/sim/world';
import { handleMobileAttackTap } from '../src/ui/hud/action_bar/hotbar';

const RANGED_BASIC_CLASSES = new Set<PlayerClass>([
  'hunter',
  'priest',
  'shaman',
  'mage',
  'warlock',
  'druid',
]);

function killAmbientMobs(sim: Sim): void {
  for (const entity of sim.entities.values()) {
    if (entity.kind === 'mob') entity.dead = true;
  }
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

function tickUntilDamage(sim: Sim, target: Entity, seconds = 12): boolean {
  for (let tick = 0; tick < 20 * seconds; tick += 1) {
    sim.tick();
    if (target.hp < target.maxHp) return true;
  }
  return false;
}

describe('HIGHFLY v1 Foundation on ClaudeCraft 0.40', () => {
  it('mobile ATTACK never routes through attackNearest / target-first', () => {
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

  it('all nine classes land a basic attack with targetId remaining null', () => {
    for (let index = 0; index < ALL_CLASSES.length; index += 1) {
      const classId = ALL_CLASSES[index];
      const sim = new Sim({ seed: 1000 + index, playerClass: classId });
      sim.setPlayerLevel(20);
      killAmbientMobs(sim);
      placePlayer(sim, 10, 10);
      const distance = classId === 'hunter' ? 10 : RANGED_BASIC_CLASSES.has(classId) ? 8 : 3;
      const dummy = addDummy(sim, 99100 + index, 10, 10 + distance);
      const p = sim.player;
      p.facing = 0;
      p.targetId = null;
      p.autoAttack = false;

      sim.startAutoAttack();
      expect(p.autoAttack, classId + ':attack-armed').toBe(true);
      expect(p.targetId, classId + ':no-fabricated-selection').toBeNull();
      expect(tickUntilDamage(sim, dummy), classId + ':targetless-basic-landed').toBe(true);
      expect(p.targetId, classId + ':still-no-fabricated-selection').toBeNull();
    }
  });

  it('Reaver Strike damages multiple hostile bodies inside the same frontal slash', () => {
    const sim = new Sim({ seed: 1101, playerClass: 'warrior' });
    sim.setPlayerLevel(4);
    killAmbientMobs(sim);
    placePlayer(sim, 10, 10);
    const p = sim.player;
    p.facing = 0;
    const primary = addDummy(sim, 99201, 10, 13);
    const secondary = addDummy(sim, 99202, 11, 13.1);
    const outside = addDummy(sim, 99203, 13.4, 10);

    sim.targetEntity(primary.id);
    p.resource = p.maxResource;
    sim.castAbility('heroic_strike');
    sim.startAutoAttack();
    for (let tick = 0; tick < 20 * 8; tick += 1) sim.tick();

    expect(primary.hp, 'primary').toBeLessThan(primary.maxHp);
    expect(secondary.hp, 'secondary inside 100-degree slash').toBeLessThan(secondary.maxHp);
    expect(outside.hp, 'outside body').toBe(outside.maxHp);
  });
});
`,
);

console.log('[HIGHFLY v1 foundation] ClaudeCraft 0.40 action-combat foundation applied.');

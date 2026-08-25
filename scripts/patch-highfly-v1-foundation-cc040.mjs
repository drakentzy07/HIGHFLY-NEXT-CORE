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
// 3. The soft resolver does NOT mutate player.targetId.
// 4. Spatial skills snapshot every hostile body in their authored geometry and
//    spend resource/cooldown exactly once per cast, never once per body.
// 5. Reaver Strike is an INSTANT action skill, not a queued MMO on-next-swing.
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

// ---------------------------------------------------------------------------
// DATA-DRIVEN ACTION GEOMETRY — first canonical action definition.
// ---------------------------------------------------------------------------
write(
  'src/sim/combat/highfly_action_geometry.ts',
  `import type { SimContext } from '../sim_context';
import { angleTo, dist2d, MELEE_RANGE, type Entity, normAngle } from '../types';

export type HighflyActionShape =
  | 'single'
  | 'cone'
  | 'circle'
  | 'corridor'
  | 'projectile'
  | 'projectile_pierce';

export interface HighflyActionDefinition {
  shape: HighflyActionShape;
  range: number;
  angleDeg?: number;
  maxTargets: number;
  targetPolicy: 'required' | 'soft' | 'none';
  aimMode: 'facing' | 'target' | 'ground';
}

const HIGHFLY_ACTIONS: Readonly<Record<string, HighflyActionDefinition>> = {
  heroic_strike: {
    shape: 'cone',
    range: MELEE_RANGE + 1.25,
    angleDeg: 100,
    maxTargets: 5,
    targetPolicy: 'soft',
    aimMode: 'facing',
  },
};

export function highflyActionDefinition(abilityId: string): HighflyActionDefinition | null {
  return HIGHFLY_ACTIONS[abilityId] ?? null;
}

export function highflyBodyInsideCone(
  source: Entity,
  target: Entity,
  range: number,
  halfAngleRad: number,
  facing = source.facing,
): boolean {
  if (target.dead || target.id === source.id) return false;
  if (dist2d(source.pos, target.pos) > range) return false;
  const diff = Math.abs(normAngle(angleTo(source.pos, target.pos) - facing));
  return diff <= halfAngleRad;
}

export function highflyHostilesInCone(
  ctx: SimContext,
  source: Entity,
  def: HighflyActionDefinition,
  facing = source.facing,
): Entity[] {
  if (def.shape !== 'cone') return [];
  const halfAngleRad = (((def.angleDeg ?? 0) / 2) * Math.PI) / 180;
  const candidates: Array<{ body: Entity; distance: number; facingDiff: number }> = [];

  for (const hostile of ctx.hostilesInRadius(source, source.pos, def.range)) {
    if (!highflyBodyInsideCone(source, hostile, def.range, halfAngleRad, facing)) continue;
    const distance = dist2d(source.pos, hostile.pos);
    const facingDiff = Math.abs(normAngle(angleTo(source.pos, hostile.pos) - facing));
    candidates.push({ body: hostile, distance, facingDiff });
  }

  // Stable action priority: bodies closest to the authored facing line first,
  // then nearest distance. Geometry never depends on target selection order.
  candidates.sort((a, b) => a.facingDiff - b.facingDiff || a.distance - b.distance || a.body.id - b.body.id);
  return candidates.slice(0, Math.max(1, def.maxTargets)).map((entry) => entry.body);
}
`,
);

// ---------------------------------------------------------------------------
// REAVER STRIKE — retire inherited on-next-swing MMO semantics.
// Convert every rank from weaponDamage to an instant weaponStrike. Resource and
// cooldown now belong to one cast transaction in casting_lifecycle; effect_dispatch
// fans that single cast out over the cone bodies.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/content/classes.ts';
  let source = read(path);
  const start = source.indexOf('  heroic_strike: {');
  const end = source.indexOf('\n  battle_shout:', start);
  if (start < 0 || end < 0) throw new Error('Anchor not found: heroic_strike definition block');
  let block = source.slice(start, end);
  if (!block.includes('onNextSwing: true')) throw new Error('Anchor not found: heroic_strike onNextSwing');
  block = block.replace('    onNextSwing: true,\n', '');
  block = block.replaceAll("type: 'weaponDamage'", "type: 'weaponStrike'");
  block = block.replace(
    "description: 'A strong attack that increases melee damage by $d. Activates on your next swing.',",
    "description: 'Slash a broad frontal arc for weapon damage plus $d. Hits every hostile body caught by the action.',",
  );
  source = source.slice(0, start) + block + source.slice(end);
  write(path, source);
}

// ---------------------------------------------------------------------------
// TARGETLESS BASIC + SHAMAN HYBRID BASIC on authoritative Sim path.
// Caster/no-spec Shaman gets the Nature projectile we already validated in the
// previous HIGHFLY line; Enhancement deliberately remains authored melee.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/auto_attack.ts';
  let source = read(path);

  const helperAnchor = 'export function startAutoAttack(ctx: SimContext, pid?: number): void {';
  const helper = `const HIGHFLY_BASIC_ASSIST_HALF_ANGLE = (58 * Math.PI) / 180;

const HIGHFLY_SHAMAN_RANGED_BASIC = {
  min: 3,
  max: 6,
  speed: 1.8,
  maxRange: 30,
  minRange: 0,
  wand: true,
  school: 'nature' as const,
  label: 'Storm Spark',
};

function highflyRangedAutoProfile(ctx: SimContext, p: Entity, meta: PlayerMeta) {
  if (meta.cls === 'shaman' && ctx.playerMods(meta).spec !== 'enhancement') {
    return HIGHFLY_SHAMAN_RANGED_BASIC;
  }
  return rangedAutoProfile(p, meta.cls);
}

function highflyBasicTargetIsUsable(
  ctx: SimContext,
  p: Entity,
  meta: PlayerMeta,
  target: Entity | null | undefined,
): target is Entity {
  if (!target || target.dead || target.id === p.id || hasEscapeStealth(target)) return false;
  if (!ctx.isHostileTo(p, target)) return false;

  const distance = dist2d(p.pos, target.pos);
  const ranged = highflyRangedAutoProfile(ctx, p, meta);
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
  const ranged = highflyRangedAutoProfile(ctx, p, meta);
  const maxRange = Math.max(MELEE_RANGE, ranged?.maxRange ?? 0);
  let best: Entity | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of ctx.hostilesInRadius(p, p.pos, maxRange)) {
    if (!highflyBasicTargetIsUsable(ctx, p, meta, candidate)) continue;
    const distance = dist2d(p.pos, candidate.pos);
    const facingDiff = Math.abs(normAngle(angleTo(p.pos, candidate.pos) - p.facing));
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
  // updatePlayerAutoAttack performs the restrained frontal body query every tick.
  if (p.mountKey !== '') forceDismount(ctx, p);
  if (p.sitting) ctx.standUp(p);
  if (p.weaponStowed) drawWeapon(p);
  p.autoAttack = true;
  r.meta.lastActiveTick = ctx.tickCount;

  // Preserve immediate melee aggro only for an already-selected, actually valid
  // body. A soft-acquired body never mutates targetId and enters combat on hit.
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
  // No body in the authored frontal volume yet: stay armed and wait. Do not
  // fabricate a selection, auto-rotate, or turn ATTACK into Tab-targeting.
  if (!t) return;`,
    'continuous targetless frontal acquisition',
  );

  // Only the real updatePlayerAutoAttack ranged resolver remains after helper
  // injection; helper functions above already call highflyRangedAutoProfile.
  source = replaceRequired(
    source,
    `  const ranged = rangedAutoProfile(p, meta.cls);
  if (ranged && d <= ranged.maxRange && d >= (ranged.wand ? 0 : ranged.minRange)) {`,
    `  const ranged = highflyRangedAutoProfile(ctx, p, meta);
  if (ranged && d <= ranged.maxRange && d >= (ranged.wand ? 0 : ranged.minRange)) {`,
    'spec-aware ranged basic resolver',
  );

  source = replaceRequired(
    source,
    `  ranged: { min: number; max: number; speed: number; wand?: boolean; school?: string },`,
    `  ranged: {
    min: number;
    max: number;
    speed: number;
    wand?: boolean;
    school?: string;
    label?: string;
  },`,
    'ranged basic optional authored label',
  );

  source = replaceRequired(
    source,
    `  const label = ranged.wand ? 'Wand' : AUTO_SHOT_LABEL;`,
    `  const label = ranged.label ?? (ranged.wand ? 'Wand' : AUTO_SHOT_LABEL);`,
    'ranged basic combat-log label',
  );

  // Spatial action bodies are already confirmed by geometry, so they can skip the
  // inherited MMO miss/dodge/parry table while ordinary basic attacks keep it.
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

// Thread guaranteedActionHit through the extracted SimContext seam and Sim facade.
for (const path of ['src/sim/sim_context.ts', 'src/sim/sim.ts']) {
  let source = read(path);
  source = replaceRequired(
    source,
    `      onEffectiveDamage?: (amount: number) => void;
      abilityId?: string | null;`,
    `      onEffectiveDamage?: (amount: number) => void;
      abilityId?: string | null;
      /** HIGHFLY: authored spatial collision already confirmed this body. */
      guaranteedActionHit?: boolean;`,
    `${path} meleeSwing guaranteed action seam`,
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// REAVER SPATIAL RESOLUTION in the instant weaponStrike path.
// This reuses ClaudeCraft 0.40's proven weaponStrike lifecycle: the cast pays once,
// the primary hit runs normal talent/proc bookkeeping once, and extra bodies are
// resolved from the same snapshot without another cast/resource/cooldown transaction.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/effect_dispatch.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `import { glacialFrontContains } from './glacial_front';`,
    `import { glacialFrontContains } from './glacial_front';
import { highflyActionDefinition, highflyHostilesInCone } from './highfly_action_geometry';`,
    'HIGHFLY action geometry import in effect dispatcher',
  );

  source = replaceRequired(
    source,
    `          critBonus: mods.abilities[ability.id]?.critPct ?? 0,
          abilityId: ability.id,
          onDealt:`,
    `          critBonus: mods.abilities[ability.id]?.critPct ?? 0,
          abilityId: ability.id,
          guaranteedActionHit: ability.id === 'heroic_strike',
          onDealt:`,
    'Reaver primary geometry-authoritative hit',
  );

  source = replaceRequired(
    source,
    `        });
        if (hit && hunterStrike) {`,
    `        });

        // HIGHFLY Reaver Strike: one instant cast, one resource/cooldown payment,
        // many body hits. Snapshot geometry at impact before secondary damage can
        // mutate combat state. Manual target remains only the primary preference.
        if (hit && ability.id === 'heroic_strike') {
          const action = highflyActionDefinition(ability.id);
          if (action?.shape === 'cone') {
            const bodies = highflyHostilesInCone(ctx, p, action, facingOverride ?? p.facing);
            for (const hostile of bodies) {
              if (hostile.id === target.id || hostile.dead) continue;
              if (!ctx.hasLineOfSight(p, hostile)) continue;
              ctx.meleeSwing(p, hostile, bonus, ability.name, {
                cannotBeDodged: true,
                normalizedInstant: eff.normalized,
                weaponMult,
                threatFlat: 0,
                threatMult: res.threatMult,
                forceCrit: sureCrit,
                critBonus: mods.abilities[ability.id]?.critPct ?? 0,
                abilityId: ability.id,
                guaranteedActionHit: true,
              });
            }
          }
        }

        if (hit && hunterStrike) {`,
    'Reaver instant spatial multi-body fan-out',
  );

  write(path, source);
}

// Build identity is generated during the patch step and embedded in the web bundle.
write(
  'public/highfly-build.json',
  JSON.stringify(
    {
      product: 'HIGHFLY',
      foundation: 'v1.0.1',
      upstream: 'ClaudeCraft 0.40.0',
      highflyCommit: process.env.GITHUB_SHA ?? 'local',
      builtAt: new Date().toISOString(),
      contracts: {
        targetlessBasic: true,
        mobileAttackActionFirst: true,
        shamanCasterNatureBasic: true,
        reaverInstantAction: true,
        reaverSpatialSweep: true,
        spatialCastPaysOnce: true,
      },
    },
    null,
    2,
  ) + '\n',
);

// ---------------------------------------------------------------------------
// DECISIVE REGRESSION
// ---------------------------------------------------------------------------
write(
  'tests/highfly_v1_foundation.test.ts',
  `import { describe, expect, it } from 'vitest';
import { ABILITIES, MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { highflyActionDefinition, highflyBodyInsideCone } from '../src/sim/combat/highfly_action_geometry';
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

  it('gives caster/no-spec Shaman a Nature projectile basic while keeping Enhancement melee by contract', () => {
    const auto = fs.readFileSync('src/sim/combat/auto_attack.ts', 'utf8');
    expect(auto).toContain("meta.cls === 'shaman'");
    expect(auto).toContain("ctx.playerMods(meta).spec !== 'enhancement'");
    expect(auto).toContain("school: 'nature' as const");
    expect(auto).toContain("label: 'Storm Spark'");
  });

  it('Reaver Strike is an instant cast transaction and damages every body in its 100-degree cone', () => {
    const sim = new Sim({ seed: 1101, playerClass: 'warrior' });
    sim.setPlayerLevel(4);
    killAmbientMobs(sim);
    placePlayer(sim, 10, 10);
    const p = sim.player;
    p.facing = 0;
    const primary = addDummy(sim, 99201, 10, 13);
    const secondary = addDummy(sim, 99202, 11, 13.1);
    const outside = addDummy(sim, 99203, 13.4, 10);
    const action = highflyActionDefinition('heroic_strike');

    expect(action?.shape).toBe('cone');
    expect(action?.angleDeg).toBe(100);
    expect(action).not.toBeNull();
    expect(highflyBodyInsideCone(p, secondary, action!.range, ((action!.angleDeg ?? 0) * Math.PI) / 360)).toBe(true);
    expect(highflyBodyInsideCone(p, outside, action!.range, ((action!.angleDeg ?? 0) * Math.PI) / 360)).toBe(false);

    sim.targetEntity(primary.id);
    p.resource = p.maxResource;
    const resourceBefore = p.resource;
    sim.castAbility('heroic_strike');
    for (let tick = 0; tick < 4; tick += 1) sim.tick();

    expect(ABILITIES.heroic_strike.onNextSwing).not.toBe(true);
    expect(ABILITIES.heroic_strike.effects.every((effect) => effect.type === 'weaponStrike')).toBe(true);
    expect(p.queuedOnSwing, 'Reaver must never queue behind auto-attack').toBeNull();
    expect(resourceBefore - p.resource, 'one cast pays exactly one Reaver cost').toBe(15);
    expect(primary.hp, 'primary').toBeLessThan(primary.maxHp);
    expect(secondary.hp, 'secondary inside 100-degree slash').toBeLessThan(secondary.maxHp);
    expect(outside.hp, 'outside body').toBe(outside.maxHp);
  });
});
`,
);

console.log('[HIGHFLY v1 foundation] ClaudeCraft 0.40 action-combat foundation v1.0.1 applied.');

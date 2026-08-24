import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.2] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// 1) BASIC ATTACK AUDIT — SHAMAN HYBRID IDENTITY
//
// ClaudeCraft gives Mage/Priest/Warlock/Druid a caster ranged auto profile and
// Hunter a physical ranged profile, but Shaman has no ranged basic at all. That
// makes a fresh/Elemental/Restoration Shaman try to white-swing its mace even
// though its opening combat loop is elemental ranged magic. HIGHFLY resolves
// this at the actual auto-attack engine: caster Shaman gets a Nature projectile;
// Enhancement deliberately keeps the authored melee weapon loop.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/auto_attack.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    'const HIGHFLY_AUTO_ATTACK_INTERVAL_MULT = 0.60;',
    `const HIGHFLY_AUTO_ATTACK_INTERVAL_MULT = 0.60;

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
}`,
    'Shaman hybrid basic profile',
  );

  source = replaceRequired(
    source,
    '  const ranged = rangedAutoProfile(p, meta.cls);',
    '  const ranged = highflyRangedAutoProfile(ctx, p, meta);',
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

  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) FULL ATTACK REGRESSION MATRIX
//
// This is intentionally broader than one Shaman screenshot. Every selectable
// class must resolve every authored ability id, every damage-bearing ability is
// sanity-checked, and every class must land a REAL basic attack in the Sim. This
// catches broken melee, hunter Auto Shot, caster projectiles and Shaman's new
// hybrid basic through the same production combat loop used by the APK.
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v082_combat_audit.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABILITIES, CLASSES, MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import { ALL_CLASSES, type Entity, type PlayerClass } from '../src/sim/types';
import { groundHeight } from '../src/sim/world';

const RANGED_BASIC_CLASSES = new Set<PlayerClass>([
  'hunter',
  'priest',
  'shaman',
  'mage',
  'warlock',
  'druid',
]);

function nearestMob(sim: Sim, templateId: string): Entity {
  const p = sim.player;
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const entity of sim.entities.values()) {
    if (entity.kind !== 'mob' || entity.dead || entity.templateId !== templateId) continue;
    const d = Math.hypot(entity.pos.x - p.pos.x, entity.pos.z - p.pos.z);
    if (d < bestD) {
      best = entity;
      bestD = d;
    }
  }
  if (!best) throw new Error('no ' + templateId + ' in world');
  return best;
}

function installStaticDummy(sim: Sim, id: number, distance: number): Entity {
  const p = sim.player;
  const anchor = nearestMob(sim, 'forest_wolf');
  p.pos.x = anchor.pos.x + distance;
  p.pos.z = anchor.pos.z;
  p.pos.y = groundHeight(p.pos.x, p.pos.z, sim.cfg.seed);
  p.prevPos = { ...p.pos };
  (sim as unknown as { rebucket(e: Entity): void }).rebucket(p);

  const dummy = createMob(id, MOBS.training_dummy, 1, {
    x: anchor.pos.x,
    y: groundHeight(anchor.pos.x, anchor.pos.z, sim.cfg.seed),
    z: anchor.pos.z,
  });
  dummy.hostile = true;
  dummy.dead = false;
  dummy.maxHp = dummy.hp = 1_000_000;
  dummy.stats.armor = 0;
  (sim as unknown as { addEntity(e: Entity): void }).addEntity(dummy);

  p.facing = Math.atan2(dummy.pos.x - p.pos.x, dummy.pos.z - p.pos.z);
  p.swingTimer = 0;
  p.offhandSwingTimer = 0;
  p.resource = p.maxResource;
  return dummy;
}

function isDamageEffect(type: string): boolean {
  const normalized = type.toLowerCase();
  return normalized.includes('damage') || normalized.includes('strike');
}

describe('HIGHFLY v0.8.2 complete class attack audit', () => {
  it('keeps all nine class kits resolvable and audits every damage-bearing skill definition', () => {
    expect([...ALL_CLASSES].sort()).toEqual(Object.keys(CLASSES).sort());

    let offensiveAbilities = 0;
    for (const classId of ALL_CLASSES) {
      const cls = CLASSES[classId];
      let classOffense = 0;
      for (const abilityId of cls.abilities) {
        const def = ABILITIES[abilityId];
        expect(def, classId + ':' + abilityId).toBeDefined();
        if (!def) continue;

        const effects = def.effects ?? [];
        const offensive = effects.some((effect) => isDamageEffect(String(effect.type)));
        if (!offensive) continue;
        offensiveAbilities += 1;
        classOffense += 1;

        expect(Number.isFinite(def.range ?? 0), classId + ':' + abilityId + ':range').toBe(true);
        expect(def.range ?? 0, classId + ':' + abilityId + ':range').toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(def.castTime ?? 0), classId + ':' + abilityId + ':cast').toBe(true);
        expect(def.castTime ?? 0, classId + ':' + abilityId + ':cast').toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(def.cooldown ?? 0), classId + ':' + abilityId + ':cooldown').toBe(true);
        expect(def.cooldown ?? 0, classId + ':' + abilityId + ':cooldown').toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(def.cost ?? 0), classId + ':' + abilityId + ':cost').toBe(true);
        expect(def.cost ?? 0, classId + ':' + abilityId + ':cost').toBeGreaterThanOrEqual(0);
      }
      expect(classOffense, classId + ':offensive-kit').toBeGreaterThan(0);
    }

    expect(offensiveAbilities).toBeGreaterThan(40);
  });

  it('makes every one of the nine classes land a real basic attack', () => {
    for (let index = 0; index < ALL_CLASSES.length; index += 1) {
      const classId = ALL_CLASSES[index];
      const sim = new Sim({ seed: 820 + index, playerClass: classId });
      sim.setPlayerLevel(20);
      const distance = classId === 'hunter' ? 10 : RANGED_BASIC_CLASSES.has(classId) ? 8 : 3;
      const dummy = installStaticDummy(sim, 98200 + index, distance);
      const p = sim.player;

      sim.targetEntity(dummy.id);
      sim.startAutoAttack();

      let landed = false;
      for (let tick = 0; tick < 20 * 12; tick += 1) {
        for (const event of sim.tick()) {
          if (
            event.type === 'damage' &&
            event.sourceId === p.id &&
            event.targetId === dummy.id &&
            event.amount > 0
          ) {
            landed = true;
          }
        }
        if (landed) break;
      }

      expect(landed, classId + ':basic-attack').toBe(true);
    }
  });

  it('gives caster Shaman a Nature projectile basic while Enhancement remains melee', () => {
    const attacks = fs.readFileSync('src/sim/combat/auto_attack.ts', 'utf8');
    expect(attacks).toContain("meta.cls === 'shaman'");
    expect(attacks).toContain("ctx.playerMods(meta).spec !== 'enhancement'");
    expect(attacks).toContain("school: 'nature' as const");
    expect(attacks).toContain("label: 'Storm Spark'");
    expect(attacks).toContain('highflyRangedAutoProfile(ctx, p, meta)');
  });

  it('preserves the approved spatial skills while the broader audit is added', () => {
    const combat = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');
    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
    expect(combat).toContain("ability.id === 'sinister_strike'");
    expect(combat).toContain('highflySweepHalfAngle');
    expect(combat).toContain("ability.id === 'lightning_bolt'");
    expect(combat).toContain('highflyArcHalfAngle');
    expect(hud).not.toContain('/cone|breath|sweep|cleave|fan|roar|shout|wave|whirl|arc|nova/');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.8.2] all-class combat audit installed: Shaman hybrid basic fixed, nine real basic loops tested, full damage-skill registry sanity checked.');

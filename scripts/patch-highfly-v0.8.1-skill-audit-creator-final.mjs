import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.1] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// 1) CREATOR FINAL PHONE POLISH
//
// v0.8.0.5 proved the six stats can exist at 36px, but the real S23 screenshot
// showed the absolute footer visually intruding into row 2. Reserve real room for
// the footer instead of compressing the dossier again. Appearance is untouched.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.8.1 — final real-phone Class workspace/footer separation. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-layout {
    height: min(268px, calc(100vh - 144px)) !important;
    max-height: min(268px, calc(100vh - 144px)) !important;
    margin-bottom: 68px !important;
    overflow: visible !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right,
  body.native-app #offline-select[data-hf-creator-step="class"] .char-create,
  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-info-stack {
    height: 100% !important;
    max-height: 100% !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    padding: 6px 8px !important;
    overflow: visible !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.highfly-class-sheet, .highfly-class-sheet-v062) {
    grid-template-rows: auto auto auto auto 77px !important;
    align-content: start !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) {
    grid-template-rows: repeat(2, 36px) !important;
    grid-auto-rows: 36px !important;
    height: 77px !important;
    min-height: 77px !important;
    max-height: 77px !important;
    margin-bottom: 0 !important;
  }

  /* The footer owns its own 56px zone and must never overlay the dossier. */
  body.native-app #offline-select[data-hf-creator-step="class"] .hf-creator-stagebar {
    bottom: 8px !important;
    height: 56px !important;
    min-height: 56px !important;
  }
}
`;
  write(path, css);
}

// Slightly pull the class-sheet camera back. This changes visual scale, not the
// Appearance editor and not the underlying character model.
{
  const path = 'src/render/characters/preview_framing.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    "  sheet: { y: 1.34, z: 3.25, lookY: 1.22 },",
    "  sheet: { y: 1.34, z: 3.55, lookY: 1.22 },",
    'class preview final breathing-room framing',
  );
  write(path, source);
}

// The camera move above is intentional final behavior. Historical generated
// creator regressions must follow that final authority instead of pinning 3.25.
for (const testPath of [
  'tests/highfly_v066_creator_combat_flow.test.ts',
  'tests/highfly_v071_combat_matrix_creator.test.ts',
  'tests/highfly_v0711_fx_type_fix.test.ts',
  'tests/highfly_v072_lane_aim_creator.test.ts',
  'tests/highfly_v073_class_geometry_action_sweep.test.ts',
  'tests/highfly_v074_creator_visual_hierarchy.test.ts',
  'tests/highfly_v075_creator_balanced_layout.test.ts',
  'tests/highfly_v0751_class_grid_lock.test.ts',
  'tests/highfly_v0801_creator_dossier_fit.test.ts',
  'tests/highfly_v0802_creator_stat_visibility.test.ts',
  'tests/highfly_v0803_creator_clean_reset.test.ts',
]) {
  if (!fs.existsSync(testPath)) continue;
  let test = read(testPath);
  test = test.replaceAll(
    'sheet: { y: 1.34, z: 3.25, lookY: 1.22 }',
    'sheet: { y: 1.34, z: 3.55, lookY: 1.22 }',
  );
  write(testPath, test);
}

// ---------------------------------------------------------------------------
// 2) AIM LANGUAGE AUDIT
//
// A shape is a gameplay promise. Stop inferring CONE from English words in a
// spell name (Arc, Wave, Cleave, Nova...). Position spells are circles, movement
// effects are dashes, authored frontal AoE is a cone, and normal directed attacks
// remain a line/corridor. HIGHFLY exceptions are explicit by ability id.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `    const isCone =
      /cone|breath|sweep|cleave|fan|roar|shout|wave|whirl|arc|nova/.test(text) ||
      effectTypes.has('weaponDamage') && range <= 8;
    if (isCone) {`,
    `    if (def?.id === 'lightning_bolt') {
      return {
        shape: 'cone',
        range,
        width: 0,
        angleDeg: 64,
        radius: 0,
      };
    }

    const isAuthoredFrontalAoe = effects.some(
      (effect) => effect.type === 'aoeDamage' && effect.frontal === true,
    );
    if (isAuthoredFrontalAoe) {`,
    'semantic cone classification instead of name heuristic',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) SHAMAN ARC BOLT — REAL CHARGED CONE AOE
//
// Arc Bolt already has a 1.5s cast. HIGHFLY now makes the triangular telegraph
// truthful: the primary direct hit resolves normally, then every other hostile
// body inside the same 64-degree cone and authored range receives the same cast
// result. Mana/cast/cooldown and Thunder/Ward hooks still happen ONCE per cast.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/effect_dispatch.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `        // Read before the hunter/shaman follow-up hooks below, which can deal their
        // own damage: this must stay the damage THIS ability landed.
        const effectiveDamage = Math.max(0, targetHpBefore - target.hp);
        onHunterPrimaryDamage(ctx, p, target, res, finalDamage);`,
    `        // Read before the hunter/shaman follow-up hooks below, which can deal their
        // own damage: this must stay the damage THIS ability landed.
        const effectiveDamage = Math.max(0, targetHpBefore - target.hp);

        // HIGHFLY Arc Bolt: the charged triangular telegraph is a real multi-body
        // cone. Secondary bodies receive damage directly here so Thundercall and
        // Ward Cycle below remain one-per-CAST rather than one-per-target.
        if (ability.id === 'lightning_bolt' && effectiveDamage > 0) {
          const highflyArcFacing = facingOverride ?? p.facing;
          const highflyArcHalfAngle = (32 * Math.PI) / 180;
          const highflyArcRange = Math.max(5, ability.range);
          for (const hostile of ctx.hostilesInRadius(p, p.pos, highflyArcRange)) {
            if (hostile.id === target.id || hostile.dead) continue;
            if (!ctx.hasLineOfSight(p, hostile)) continue;
            const highflyArcDiff = Math.abs(
              normAngle(angleTo(p.pos, hostile.pos) - highflyArcFacing),
            );
            if (highflyArcDiff > highflyArcHalfAngle) continue;
            ctx.dealDamage(
              p,
              hostile,
              finalDamage,
              crit,
              ability.school,
              ability.name,
              'hit',
              false,
              threatOpts,
              true,
              false,
              false,
              ability.id,
              false,
            );
          }
        }

        onHunterPrimaryDamage(ctx, p, target, res, finalDamage);`,
    'Arc Bolt real cone multi-target resolution',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) REGRESSION — REAL SHAMAN CAST PATH + SEMANTIC TELEGRAPHS + CREATOR
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v081_skill_audit_creator_final.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABILITIES, MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';
import { groundHeight } from '../src/sim/world';

function nearestMob(sim: Sim, templateId: string): Entity {
  const p = sim.player;
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const entity of sim.entities.values()) {
    if (entity.kind !== 'mob' || entity.dead || entity.templateId !== templateId) continue;
    const distance = Math.hypot(entity.pos.x - p.pos.x, entity.pos.z - p.pos.z);
    if (distance < bestD) {
      bestD = distance;
      best = entity;
    }
  }
  if (!best) throw new Error(\`no \${templateId} in world\`);
  return best;
}

function addTargetAt(sim: Sim, id: number, x: number, z: number): Entity {
  const mob = createMob(id, MOBS.training_dummy, 20, {
    x,
    y: groundHeight(x, z, sim.cfg.seed),
    z,
  });
  mob.hostile = true;
  mob.dead = false;
  mob.maxHp = mob.hp = 1_000_000;
  mob.level = 1;
  mob.stats.armor = 0;
  (sim as unknown as { addEntity(e: Entity): void }).addEntity(mob);
  return mob;
}

describe('HIGHFLY v0.8.1 skill geometry audit + creator final polish', () => {
  it('does not infer cone telegraphs from ability-name words anymore', () => {
    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
    expect(hud).not.toContain('/cone|breath|sweep|cleave|fan|roar|shout|wave|whirl|arc|nova/');
    expect(hud).toContain("effect.type === 'aoeDamage' && effect.frontal === true");
    expect(hud).toContain("def?.id === 'lightning_bolt'");
    expect(hud).toContain('angleDeg: 64');
    expect(hud).toContain("def?.id === 'sinister_strike'");
  });

  it('keeps Arc Bolt charged and damages every body inside its real cone', () => {
    expect(ABILITIES.lightning_bolt.castTime).toBe(1.5);

    // Mirror ClaudeCraft's own lightning_bolt_fx runtime path: seed 42 and a
    // real forest wolf in the live world, then add only the bodies needed to
    // prove HIGHFLY multi-target geometry around that known-good cast lane.
    const sim = new Sim({ seed: 42, playerClass: 'shaman' }) as Sim & Record<string, any>;
    const p = sim.player;
    const primary = nearestMob(sim, 'forest_wolf');
    p.pos.x = primary.pos.x + 4;
    p.pos.z = primary.pos.z;
    p.pos.y = groundHeight(p.pos.x, p.pos.z, sim.cfg.seed);
    p.prevPos = { ...p.pos };
    (sim as unknown as { rebucket(e: Entity): void }).rebucket(p);
    p.facing = Math.atan2(primary.pos.x - p.pos.x, primary.pos.z - p.pos.z);
    p.resource = p.maxResource;

    primary.maxHp = primary.hp = 1_000_000;
    primary.stats.armor = 0;

    const forwardX = Math.sin(p.facing);
    const forwardZ = Math.cos(p.facing);
    const rightX = Math.cos(p.facing);
    const rightZ = -Math.sin(p.facing);

    const secondary = addTargetAt(
      sim,
      98102,
      p.pos.x + forwardX * 5 + rightX * 1.2,
      p.pos.z + forwardZ * 5 + rightZ * 1.2,
    );
    const outside = addTargetAt(
      sim,
      98103,
      p.pos.x + forwardX * 5 + rightX * 5,
      p.pos.z + forwardZ * 5 + rightZ * 5,
    );

    sim.targetEntity(primary.id);
    sim.castAbility('lightning_bolt');

    const damagedIds = new Set<number>();
    let sawLightningFx = false;
    for (let i = 0; i < 20 * 5; i += 1) {
      for (const event of sim.tick()) {
        if (event.type === 'spellfx' && event.fx === 'lightning' && event.targetId === primary.id) {
          sawLightningFx = true;
        }
        if (event.type === 'damage' && event.amount > 0) damagedIds.add(event.targetId);
      }
    }

    expect(sawLightningFx).toBe(true);
    expect(damagedIds.has(primary.id)).toBe(true);
    expect(damagedIds.has(secondary.id)).toBe(true);
    expect(damagedIds.has(outside.id)).toBe(false);
  });

  it('reserves a footer-free class workspace and pulls only the class preview camera back', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    const framing = fs.readFileSync('src/render/characters/preview_framing.ts', 'utf8');
    expect(css).toContain('HIGHFLY v0.8.1 — final real-phone Class workspace/footer separation');
    expect(css).toContain('height: min(268px, calc(100vh - 144px)) !important');
    expect(css).toContain('margin-bottom: 68px !important');
    expect(css).toContain('grid-template-rows: repeat(2, 36px) !important');
    expect(framing).toContain("sheet: { y: 1.34, z: 3.55, lookY: 1.22 }");
  });

  it('keeps the already-approved Wicked Slash multi-body sweep intact', () => {
    const combat = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');
    expect(combat).toContain("ability.id === 'sinister_strike'");
    expect(combat).toContain('highflySweepHalfAngle');
    expect(combat).toContain('highflyExtraHits');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.8.1] creator footer separated; Arc Bolt is a real charged cone AoE; cone telegraphs now follow mechanics, not names.');

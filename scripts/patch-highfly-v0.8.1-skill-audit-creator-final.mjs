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
// 4) REGRESSION — REAL SHAMAN MULTI-BODY HIT + SEMANTIC TELEGRAPHS + CREATOR
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v081_skill_audit_creator_final.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABILITIES, MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';

function addTarget(sim: Sim, id: number, dx: number, dz: number): Entity {
  const p = sim.player;
  const mob = createMob(id, MOBS.training_dummy, 20, {
    x: p.pos.x + dx,
    y: p.pos.y,
    z: p.pos.z + dz,
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

  it('keeps Arc Bolt authored as a charged spell and makes its cone hit multiple bodies', () => {
    expect(ABILITIES.lightning_bolt.castTime).toBe(1.5);
    const sim = new Sim({ seed: 8117, playerClass: 'shaman', autoEquip: true }) as Sim & Record<string, any>;
    sim.setPlayerLevel(20);
    const p = sim.player;
    p.critChance = 0;
    p.facing = 0;
    p.resource = p.maxResource;

    const primary = addTarget(sim, 98101, 0, 5);
    const secondary = addTarget(sim, 98102, 1.4, 6);
    const outside = addTarget(sim, 98103, 7, 2);
    sim.targetEntity(primary.id);
    sim.castAbility('lightning_bolt');

    const primaryBefore = primary.hp;
    const secondaryBefore = secondary.hp;
    const outsideBefore = outside.hp;
    for (let i = 0; i < 180; i += 1) sim.tick();

    expect(primary.hp).toBeLessThan(primaryBefore);
    expect(secondary.hp).toBeLessThan(secondaryBefore);
    expect(outside.hp).toBe(outsideBefore);
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

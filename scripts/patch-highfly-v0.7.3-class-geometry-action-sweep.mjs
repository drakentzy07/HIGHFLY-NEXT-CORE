import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.7.3] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// 1) CLASS CREATOR — REAL THREE-ZONE COMPOSITION
//
// Appearance remains true 50/50. Class becomes:
//   34% class choices | 28% live character | 38% class dossier.
// The existing right wrapper remains in the DOM but becomes a horizontal grid,
// so preview and stats use the full available height instead of stacking.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/creator_steps.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    "important(layout, 'grid-template-columns', 'minmax(0, 42fr) minmax(0, 58fr)');",
    "important(layout, 'grid-template-columns', 'minmax(0, 34fr) minmax(0, 66fr)');",
    'class outer 34/66 runtime geometry',
  );

  source = replaceRequired(
    source,
    "important(right, 'grid-template-rows', '102px minmax(0, 1fr)');\n  important(right, 'gap', '4px');",
    "important(right, 'grid-template-columns', 'minmax(190px, 28fr) minmax(0, 38fr)');\n  important(right, 'grid-template-rows', 'minmax(0, 1fr)');\n  important(right, 'gap', '8px');",
    'class right preview+dossier side-by-side runtime geometry',
  );

  write(path, source);
}

{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);

  css += `

/* HIGHFLY v0.7.3 — final S23 class creator: choices | character | dossier. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-layout {
    display: grid !important;
    grid-template-columns: minmax(0, 34fr) minmax(0, 66fr) !important;
    gap: 8px !important;
    min-width: 0 !important;
    max-width: 100% !important;
    overflow: visible !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-step="class"] .char-create {
    min-width: 0 !important;
    min-height: 0 !important;
    height: 100% !important;
    max-height: none !important;
    overflow: visible !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right {
    display: grid !important;
    grid-template-columns: minmax(190px, 28fr) minmax(0, 38fr) !important;
    grid-template-rows: minmax(0, 1fr) !important;
    gap: 8px !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    overflow: visible !important;
    align-items: stretch !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-preview-container {
    position: relative !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    align-self: stretch !important;
    justify-self: stretch !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    position: relative !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    align-self: stretch !important;
    justify-self: stretch !important;
    transform: none !important;
    translate: none !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    box-sizing: border-box !important;
  }

  /* The old class subpanel was the reason the third row looked cut while a
     large empty area remained below it. Let the 3x3 picker own its real height. */
  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-rows: repeat(3, 46px) !important;
    grid-auto-rows: 46px !important;
    gap: 6px !important;
    width: 100% !important;
    min-width: 0 !important;
    min-height: 150px !important;
    height: 150px !important;
    max-height: none !important;
    margin: 4px 0 0 !important;
    padding: 0 !important;
    align-content: start !important;
    overflow: visible !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker .mini-class {
    width: 100% !important;
    min-width: 0 !important;
    height: 46px !important;
    min-height: 46px !important;
    max-height: 46px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
}
`;

  write(path, css);
}

// ---------------------------------------------------------------------------
// 2) AIM PROFILE — WICKED SLASH IS A REAL FRONTAL SWEEP
//
// No marked target is required for manual drag. Any hostile body inside the
// authored 100-degree / 5m cone can become the primary collision candidate.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `    const isDash =
      effectTypes.has('charge') ||`,
    `    if (def?.id === 'sinister_strike') {
      return {
        shape: 'cone',
        range: 5,
        width: 0,
        angleDeg: 100,
        radius: 0,
      };
    }

    const isDash =
      effectTypes.has('charge') ||`,
    'Wicked Slash explicit cone aim profile',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) HIT RESOLUTION — WICKED SLASH DAMAGES EVERY BODY IN THE FRONTAL SWEEP
//
// The first body selected by the HUD remains the cast target / animation anchor.
// The effect dispatcher then resolves up to four additional hostiles in the same
// 100-degree, 5.25m frontal cone. Combo is awarded ONCE per cast, never per body.
// Other single-target strikes keep their existing semantics untouched.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/effect_dispatch.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `        });
        if (hit && hunterStrike) {`,
    `        });
        let highflySpatialComboTarget: Entity | null = hit ? strikeTarget : null;
        if (ability.id === 'sinister_strike') {
          const highflySweepFacing = facingOverride ?? p.facing;
          const highflySweepHalfAngle = (50 * Math.PI) / 180;
          let highflyExtraHits = 0;
          for (const hostile of ctx.hostilesInRadius(p, p.pos, 5.25)) {
            if (highflyExtraHits >= 4) break;
            if (hostile.id === strikeTarget.id || hostile.dead) continue;
            if (!ctx.hasLineOfSight(p, hostile)) continue;
            const highflyFacingDiff = Math.abs(
              normAngle(angleTo(p.pos, hostile.pos) - highflySweepFacing),
            );
            if (highflyFacingDiff > highflySweepHalfAngle) continue;

            const secondaryHit = ctx.meleeSwing(p, hostile, bonus, ability.name, {
              cannotBeDodged: eff.cannotBeDodged,
              normalizedInstant: eff.normalized,
              weaponMult,
              threatFlat: res.threatFlat,
              threatMult: res.threatMult,
              forceCrit: sureCrit,
              critBonus: mods.abilities[ability.id]?.critPct ?? 0,
              abilityId: ability.id,
            });
            if (secondaryHit) {
              highflyExtraHits += 1;
              if (!highflySpatialComboTarget) highflySpatialComboTarget = hostile;
            }
          }
        }
        if (hit && hunterStrike) {`,
    'Wicked Slash multi-body frontal sweep',
  );

  source = replaceRequired(
    source,
    `        if (hit && ability.awardsCombo) {
          ctx.awardCombo(p, target, ability.awardsCombo);
          comboAwarded = true;
        }`,
    `        if (highflySpatialComboTarget && ability.awardsCombo) {
          ctx.awardCombo(p, highflySpatialComboTarget, ability.awardsCombo);
          comboAwarded = true;
        }`,
    'single combo award after spatial sweep',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) ALIGN SUPERSEDED CREATOR REGRESSIONS
// ---------------------------------------------------------------------------
for (const testPath of [
  'tests/highfly_v066_creator_combat_flow.test.ts',
  'tests/highfly_v071_combat_matrix_creator.test.ts',
  'tests/highfly_v0711_fx_type_fix.test.ts',
  'tests/highfly_v072_lane_aim_creator.test.ts',
]) {
  let test = read(testPath);
  test = test.replaceAll(
    'minmax(0, 42fr) minmax(0, 58fr)',
    'minmax(0, 34fr) minmax(0, 66fr)',
  );
  test = test.replaceAll(
    '102px minmax(0, 1fr)',
    'minmax(0, 1fr)',
  );
  write(testPath, test);
}

// ---------------------------------------------------------------------------
// 5) RUNTIME SMOKE — PROVE THE SCREEN IS REALLY THREE-ZONE AT 915x412
// ---------------------------------------------------------------------------
{
  const path = '../scripts/highfly_runtime_smoke.mjs';
  let smoke = read(path);

  smoke = replaceRequired(
    smoke,
    `      rightHeight: rr.height,
      rightBottom: rr.bottom,
      previewHeight: pr.height,`,
    `      leftBottom: lr.bottom,
      rightHeight: rr.height,
      rightTop: rr.top,
      rightBottom: rr.bottom,
      previewWidth: pr.width,
      previewHeight: pr.height,
      previewTop: pr.top,
      previewRight: pr.right,
      detailsWidth: dr.width,
      detailsLeft: dr.left,`,
    'smoke three-zone geometry fields',
  );

  smoke = replaceRequired(
    smoke,
    `      detailsInlineStyle: details.getAttribute('style') ?? '',
      rightInlineStyle: right.getAttribute('style') ?? '',`,
    `      detailsInlineStyle: details.getAttribute('style') ?? '',
      rightInlineStyle: right.getAttribute('style') ?? '',
      classButtonCount: root?.querySelectorAll('.mini-class[data-class]').length ?? 0,
      lastClassBottom:
        root?.querySelector('.mini-class[data-class="druid"]')?.getBoundingClientRect().bottom ?? 0,
      rightGridTemplateColumns: rs.gridTemplateColumns,`,
    'smoke class picker and right columns fields',
  );

  smoke = replaceRequired(
    smoke,
    `  if (classGeometry.rightWidth < classGeometry.leftWidth * 1.25) {
    throw new Error(\`HIGHFLY creator Class right block did not move left / widen enough: \${JSON.stringify(classGeometry)}\`);
  }
  if (classGeometry.previewHeight < 96 || classGeometry.detailsHeight < 165) {
    throw new Error(\`HIGHFLY creator Class preview/details split is too small: \${JSON.stringify(classGeometry)}\`);
  }
  if (classGeometry.detailsTop < classGeometry.previewBottom + 3) {
    throw new Error(\`HIGHFLY creator Class preview overlaps the details sheet: \${JSON.stringify(classGeometry)}\`);
  }`,
    `  if (classGeometry.rightWidth < classGeometry.leftWidth * 1.7) {
    throw new Error(\`HIGHFLY creator Class outer grid is not the intended 34/66 composition: \${JSON.stringify(classGeometry)}\`);
  }
  if (
    classGeometry.previewHeight < classGeometry.rightHeight * 0.94 ||
    classGeometry.detailsHeight < classGeometry.rightHeight * 0.94
  ) {
    throw new Error(\`HIGHFLY creator Class character/dossier do not use full height: \${JSON.stringify(classGeometry)}\`);
  }
  if (classGeometry.previewWidth < 185 || classGeometry.detailsWidth < 250) {
    throw new Error(\`HIGHFLY creator Class three-zone widths are too small: \${JSON.stringify(classGeometry)}\`);
  }
  if (Math.abs(classGeometry.previewTop - classGeometry.detailsTop) > 3) {
    throw new Error(\`HIGHFLY creator Class character and dossier are not side-by-side: \${JSON.stringify(classGeometry)}\`);
  }
  if (classGeometry.previewRight > classGeometry.detailsLeft + 2) {
    throw new Error(\`HIGHFLY creator Class character overlaps the dossier: \${JSON.stringify(classGeometry)}\`);
  }
  if (classGeometry.classButtonCount !== 9 || classGeometry.lastClassBottom > classGeometry.leftBottom + 2) {
    throw new Error(\`HIGHFLY creator Class 3x3 picker is clipped: \${JSON.stringify(classGeometry)}\`);
  }`,
    'smoke final class three-zone assertions',
  );

  smoke = smoke.replace(
    'Apariencia 50/50 -> Clase 42/58 -> world boot OK',
    'Apariencia 50/50 -> Clase 34/28/38 -> world boot OK',
  );

  write(path, smoke);
}

// ---------------------------------------------------------------------------
// 6) v0.7.3 REGRESSION — CREATOR CONTRACT + REAL MULTI-BODY ROGUE BEHAVIOR
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v073_class_geometry_action_sweep.test.ts';
  const test = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABILITIES, MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';

function addSweepTarget(sim: Sim, id: number, dx: number, dz: number): Entity {
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

describe('HIGHFLY v0.7.3 class geometry + action sweep', () => {
  it('uses a real 34/28/38 three-zone Class creator while Appearance stays independent', () => {
    const creator = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');

    expect(creator).toContain(
      "important(layout, 'grid-template-columns', 'minmax(0, 34fr) minmax(0, 66fr)')",
    );
    expect(creator).toContain(
      "important(right, 'grid-template-columns', 'minmax(190px, 28fr) minmax(0, 38fr)')",
    );
    expect(creator).toContain(
      "important(right, 'grid-template-rows', 'minmax(0, 1fr)')",
    );
    expect(css).toContain(
      'grid-template-columns: minmax(190px, 28fr) minmax(0, 38fr) !important',
    );
    expect(css).toContain('grid-template-rows: repeat(3, 46px) !important');
    expect(css).toContain('overflow: visible !important');
  });

  it('classifies Wicked Slash as a broad manual cone instead of a narrow line', () => {
    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
    expect(hud).toContain("def?.id === 'sinister_strike'");
    expect(hud).toContain("shape: 'cone'");
    expect(hud).toContain('angleDeg: 100');
    expect(hud).toContain('range: 5');
  });

  it('resolves Wicked Slash against multiple hostile bodies in the 100-degree sweep', () => {
    const sim = new Sim({ seed: 7331, playerClass: 'rogue', autoEquip: true }) as Sim &
      Record<string, any>;
    sim.setPlayerLevel(20);
    const p = sim.player;
    p.critChance = 0;
    p.facing = 0;

    const primary = addSweepTarget(sim, 97301, 0, 2);
    const secondary = addSweepTarget(sim, 97302, 1.1, 2.2);
    const outside = addSweepTarget(sim, 97303, 2.5, 0.4);
    const abilityName = ABILITIES.sinister_strike.name;

    let sawExpectedSweep = false;
    for (let i = 0; i < 100; i++) {
      for (const mob of [primary, secondary, outside]) {
        mob.hp = mob.maxHp;
        mob.dead = false;
      }
      p.resource = p.maxResource;
      p.facing = 0;
      sim.targetEntity(primary.id);
      sim.castAbility('sinister_strike');
      const events = sim.tick();
      const damagedIds = new Set(
        events
          .filter(
            (event: any) =>
              event.type === 'damage' &&
              event.sourceId === p.id &&
              event.kind === 'hit' &&
              event.ability === abilityName,
          )
          .map((event: any) => event.targetId),
      );

      if (damagedIds.has(primary.id) && damagedIds.has(secondary.id)) {
        expect(damagedIds.has(outside.id)).toBe(false);
        sawExpectedSweep = true;
        break;
      }
    }

    expect(sawExpectedSweep).toBe(true);
  });

  it('keeps the action sweep at one combo award per cast, not one per monster', () => {
    const dispatch = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');
    expect(dispatch).toContain("ability.id === 'sinister_strike'");
    expect(dispatch).toContain('highflySweepHalfAngle = (50 * Math.PI) / 180');
    expect(dispatch).toContain('highflyExtraHits >= 4');
    expect(dispatch).toContain('highflySpatialComboTarget');
    expect(dispatch).toContain(
      'ctx.awardCombo(p, highflySpatialComboTarget, ability.awardsCombo)',
    );
  });
});
`;
  write(path, test);
}

console.log(
  '[HIGHFLY v0.7.3] Class 34/28/38 + full-height character/dossier + Wicked Slash multi-body sweep applied.',
);

import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.7.2] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// 1) WORLD-LANE GEOMETRY
// Manual action aim is spatial, not angular auto-targeting. A monster can be
// behind the player's OLD facing and still be a valid hit when the thumb points
// the skill toward it. The dragged facing is the only directional authority.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/highfly_action_aim.ts';
  let source = read(path);
  const marker = 'export function highflyDirectionalLaneMetrics(';
  if (!source.includes(marker)) {
    source += `

export interface HighflyLanePoint {
  x: number;
  z: number;
}

export interface HighflyLaneMetrics {
  forward: number;
  lateral: number;
  distance: number;
}

export function highflyDirectionalLaneMetrics(
  origin: HighflyLanePoint,
  target: HighflyLanePoint,
  aimFacing: number,
): HighflyLaneMetrics {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const dirX = Math.sin(aimFacing);
  const dirZ = Math.cos(aimFacing);
  return {
    forward: dx * dirX + dz * dirZ,
    lateral: Math.abs(dx * dirZ - dz * dirX),
    distance: Math.hypot(dx, dz),
  };
}

export function highflyDirectionalLaneContains(
  origin: HighflyLanePoint,
  target: HighflyLanePoint,
  aimFacing: number,
  maxRange: number,
  halfWidth: number,
): boolean {
  const metrics = highflyDirectionalLaneMetrics(origin, target, aimFacing);
  return (
    metrics.forward > 0.001 &&
    metrics.forward <= maxRange &&
    metrics.distance <= maxRange + Math.max(0.35, halfWidth * 0.25) &&
    metrics.lateral <= halfWidth
  );
}
`;
    write(path, source);
  }
}

// ---------------------------------------------------------------------------
// 2) HUD MANUAL AIM: COLLISION CORRIDOR INSTEAD OF A 7-DEG MICRO CONE
// Tap keeps restrained smart assistance. Drag remains manual: find only monsters
// physically intersecting the dragged skill lane. The first valid body in that
// lane wins for a single-target directed skill. No target = a real whiff.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  const importAnchor = "import type { ResolvedAbility } from '../sim/sim';";
  const importLine = "import { highflyDirectionalLaneMetrics } from '../sim/highfly_action_aim';";
  if (!source.includes(importLine)) {
    source = replaceRequired(
      source,
      importAnchor,
      `${importLine}\n${importAnchor}`,
      'directional lane helper import',
    );
  }

  const methodStart = source.indexOf('  private highflyPickManualMicroAssistTarget(');
  const methodEnd = source.indexOf('  private highflyEnsureSkillStick(): HTMLDivElement {', methodStart);
  if (methodStart < 0 || methodEnd < 0) {
    throw new Error('Anchor not found: HIGHFLY manual target picker');
  }

  const replacement = `  private highflyPickManualMicroAssistTarget(barSlot: number, aimFacing: number): number | null {
    const resolved = this.highflyMobileAimDef(barSlot);
    if (!resolved || resolved.def.targetMode === 'position') return null;
    const profile = this.highflyAimProfile(barSlot);
    const player = this.sim.player;
    const maxRange = Math.max(4, profile.range + 0.75);
    let bestId: number | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const entity of this.sim.entities.values()) {
      if (entity.id === player.id || entity.dead) continue;
      if (!(entity.hostile || isPvpHostileTarget(entity.id, this.sim.duelInfo, this.sim.arenaInfo))) continue;

      const metrics = highflyDirectionalLaneMetrics(player.pos, entity.pos, aimFacing);
      if (metrics.forward <= 0.001 || metrics.forward > maxRange) continue;

      // LINE / melee-directed skills use a forgiving physical corridor rather
      // than a tiny angle. CONE skills expand naturally with authored angle.
      const coneHalfWidth =
        profile.shape === 'cone'
          ? Math.tan((Math.max(12, profile.angleDeg) * Math.PI) / 360) * metrics.forward + 0.45
          : 0;
      const laneHalfWidth =
        profile.shape === 'cone'
          ? Math.max(1.15, coneHalfWidth)
          : Math.min(2.45, 1.05 + metrics.forward * 0.085);

      if (metrics.lateral > laneHalfWidth) continue;
      if (metrics.distance > maxRange + 0.35) continue;

      // First body down the dragged lane wins; lateral offset only breaks ties.
      const score = metrics.forward + metrics.lateral * 3.25;
      if (score < bestScore) {
        bestScore = score;
        bestId = entity.id;
      }
    }
    return bestId;
  }

`;
  source = source.slice(0, methodStart) + replacement + source.slice(methodEnd);

  // v0.7.1 already rotates before validation. Keep an explicit second commit at
  // the actual hit branch too so targetEntity/castSlot can never re-use the old
  // north/south heading in a later upstream refactor.
  const hitBranch = `      if (targetId !== null) {\n        this.sim.targetEntity(targetId);`;
  const hitBranchCurrent = `      if (targetId !== null) {\n        this.sim.player.facing = facing;\n        this.sim.targetEntity(targetId);`;
  if (source.includes(hitBranch) && !source.includes(hitBranchCurrent)) {
    source = source.replace(hitBranch, hitBranchCurrent);
  }

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) CREATOR CLASS SCREEN: KEEP THE WORKING STRUCTURE, REMOVE THE CROWDING
// Appearance remains untouched. Class stays true 50/50, but uses the whole
// available width safely and gives the 9 choices / 6 stats room to breathe.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.7.2 — clean class composition without changing Appearance. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-layout {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 10px !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right,
  body.native-app #offline-select[data-hf-creator-step="class"] .char-create {
    min-width: 0 !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-auto-rows: 40px !important;
    gap: 7px !important;
    width: 100% !important;
    margin: 10px 0 0 !important;
    padding: 0 !important;
    align-content: start !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker .mini-class {
    width: 100% !important;
    min-width: 0 !important;
    height: 40px !important;
    min-height: 40px !important;
    padding: 0 8px !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    padding: 7px 8px !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    grid-auto-rows: minmax(25px, auto) !important;
    gap: 4px 6px !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    margin: 3px 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    min-height: 25px !important;
    height: auto !important;
    padding: 3px 6px !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    white-space: nowrap !important;
    text-overflow: ellipsis !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-desc, .hf-class-desc-v062) {
    margin: 3px 0 !important;
    line-height: 1.12 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-note, .hf-class-note-v062) {
    margin-top: 3px !important;
    line-height: 1.08 !important;
  }
}
`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// 4) REGRESSION: SOUTH-AIM MUST HIT SOUTH EVEN WHEN OLD FACING IS NORTH
// This tests the geometry that the HUD now uses. We also keep the creator pass
// purely presentational so the already-green runtime smoke remains authoritative.
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v072_lane_aim_creator.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  highflyDirectionalLaneContains,
  highflyDirectionalLaneMetrics,
} from '../src/sim/highfly_action_aim';

describe('HIGHFLY v0.7.2 lane aim + creator composition', () => {
  it('accepts a south target when manual aim points south regardless of old north facing', () => {
    const origin = { x: 0, z: 0 };
    const southTarget = { x: 0.15, z: -2.2 };
    const manualSouth = Math.PI;
    const metrics = highflyDirectionalLaneMetrics(origin, southTarget, manualSouth);
    expect(metrics.forward).toBeGreaterThan(2);
    expect(metrics.lateral).toBeLessThan(0.25);
    expect(highflyDirectionalLaneContains(origin, southTarget, manualSouth, 5, 1.2)).toBe(true);
  });

  it('rejects monsters outside the dragged lane even if they are nearby', () => {
    const origin = { x: 0, z: 0 };
    expect(highflyDirectionalLaneContains(origin, { x: 3, z: -1 }, Math.PI, 5, 1.2)).toBe(false);
  });

  it('uses the dragged facing before the targeted cast branch', () => {
    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
    expect(hud).toContain('highflyDirectionalLaneMetrics(player.pos, entity.pos, aimFacing)');
    expect(hud).toContain('this.sim.player.facing = facing');
    expect(hud).not.toContain("const maxAngle = profile.shape === 'cone'");
  });

  it('keeps class choice and stat grids inside the true 50/50 creator', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    expect(css).toContain('HIGHFLY v0.7.2 — clean class composition');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important');
    expect(css).toContain('grid-auto-rows: 40px !important');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.7.2] world-lane manual aim + clean creator class composition applied.');

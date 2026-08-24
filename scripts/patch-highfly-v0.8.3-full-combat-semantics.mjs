import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.3] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

function replaceBetween(source, startNeedle, endNeedle, replacement, label) {
  const start = source.indexOf(startNeedle);
  if (start < 0) throw new Error(`Start anchor not found: ${label}`);
  const end = source.indexOf(endNeedle, start);
  if (end < 0) throw new Error(`End anchor not found: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// ---------------------------------------------------------------------------
// 1) WARRIOR — MAKE THE AUTHORED FRONT-ARC PROMISE TRUE
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/content/classes.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    "    effects: [{ type: 'aoeDamage', min: 30, max: 38, radius: 5, softCap: 5 }],",
    `    effects: [
      {
        type: 'aoeDamage',
        min: 30,
        max: 38,
        radius: 5,
        frontal: true,
        frontalHalfAngle: (50 * Math.PI) / 180,
        softCap: 5,
      },
    ],`,
    'Warrior Reaping Arc frontal geometry',
  );

  source = replaceRequired(
    source,
    `        min: 18,
        max: 24,
        radius: 8,
        frontal: true,
        softCap: 5,`,
    `        min: 18,
        max: 24,
        radius: 8,
        frontal: true,
        frontalHalfAngle: (70 * Math.PI) / 180,
        softCap: 5,`,
    'Warrior Revenge explicit wide frontal arc',
  );

  source = replaceRequired(
    source,
    `        radius: 8,
        frontal: true,
        stunSec: 3,`,
    `        radius: 8,
        frontal: true,
        frontalHalfAngle: Math.PI / 3,
        stunSec: 3,`,
    'Warrior Faultline explicit frontal arc',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) MOBILE ACTION AIM — DIRECTIONAL NO-TARGET ATTACKS ARE REAL INPUTS
//
// Patch method boundaries instead of matching a historical whole method. Several
// HIGHFLY versions intentionally rewrite this HUD; structural anchors are stable.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  const mobileDef = `  private highflyDirectionalNoTarget(resolved: ResolvedAbility): boolean {
    if (resolved.def.requiresTarget || resolved.def.targetMode === 'position') return false;
    const effects = (resolved.effects ?? []) as unknown as Array<Record<string, unknown>>;
    return effects.some((effect) =>
      (effect.type === 'aoeDamage' && effect.frontal === true) ||
      effect.type === 'empoweredCone' ||
      effect.type === 'frozenOrb'
    );
  }

  private highflyMobileAimDef(barSlot: number): ResolvedAbility | null {
    const resolved = this.abilityForSlot(barSlot);
    if (!resolved) return null;
    const def = resolved.def;
    if (def.selfCentered) return null;
    if (def.targetMode === 'position') return resolved;
    if (this.highflyDirectionalNoTarget(resolved)) return resolved;
    if (!def.requiresTarget || def.targetType === 'friendly' || def.targetsDead) return null;
    return resolved;
  }

`;

  source = replaceBetween(
    source,
    '  private highflyMobileAimDef(',
    '  private highflyAimProfile(',
    mobileDef,
    'HIGHFLY mobile aim admission methods',
  );

  const aimProfile = `  private highflyAimProfile(barSlot: number): {
    shape: 'line' | 'cone' | 'circle' | 'dash';
    range: number;
    width: number;
    angleDeg: number;
    radius: number;
  } {
    const resolved = this.abilityForSlot(barSlot);
    const def = resolved?.def;
    const range = Math.max(5, def?.range ?? 12);
    const effects = (resolved?.effects ?? []) as unknown as Array<Record<string, unknown>>;
    const effectTypes = new Set(effects.map((effect) => String(effect.type ?? '')));
    const idText = String(def?.id ?? '').toLowerCase();
    const nameText = String(def?.name ?? '').toLowerCase();
    const text = idText + ' ' + nameText;

    const numeric = (key: string, fallback: number): number => {
      for (const effect of effects) {
        const value = effect[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        const landing = effect.landingAoe;
        if (landing && typeof landing === 'object') {
          const nested = (landing as Record<string, unknown>)[key];
          if (typeof nested === 'number' && Number.isFinite(nested)) return nested;
        }
      }
      return fallback;
    };

    if (def?.targetMode === 'position') {
      return {
        shape: 'circle',
        range,
        width: 0,
        angleDeg: 0,
        radius: Math.max(2.2, numeric('radius', 4)),
      };
    }

    const isDash =
      effectTypes.has('charge') ||
      effectTypes.has('repositionToAim') ||
      /charge|rush|leap|blink|dash|step|lunge|intervene|onrush|shadeslip/.test(text);
    if (isDash) {
      return { shape: 'dash', range, width: 2.6, angleDeg: 0, radius: 0 };
    }

    const empoweredCone = effects.find((effect) => effect.type === 'empoweredCone');
    if (empoweredCone) {
      const stages = Array.isArray(empoweredCone.stages)
        ? (empoweredCone.stages as Array<Record<string, unknown>>)
        : [];
      const stageRanges = stages.map((stage) =>
        typeof stage.range === 'number' && Number.isFinite(stage.range) ? stage.range : 0,
      );
      const stageAngles = stages.map((stage) =>
        typeof stage.angle === 'number' && Number.isFinite(stage.angle) ? stage.angle : 0,
      );
      const baseAngle =
        typeof empoweredCone.angle === 'number' && Number.isFinite(empoweredCone.angle)
          ? empoweredCone.angle
          : 64;
      return {
        shape: 'cone',
        range: Math.max(range, 5, ...stageRanges),
        width: 0,
        angleDeg: Math.max(36, Math.min(180, baseAngle, ...stageAngles.filter((v) => v > 0))),
        radius: 0,
      };
    }

    if (def?.id === 'lightning_bolt') {
      return {
        shape: 'cone',
        range,
        width: 0,
        angleDeg: 64,
        radius: 0,
      };
    }

    const authoredFrontalAoe = effects.find(
      (effect) => effect.type === 'aoeDamage' && effect.frontal === true,
    );
    if (authoredFrontalAoe) {
      const halfAngle =
        typeof authoredFrontalAoe.frontalHalfAngle === 'number' &&
        Number.isFinite(authoredFrontalAoe.frontalHalfAngle)
          ? authoredFrontalAoe.frontalHalfAngle
          : (50 * Math.PI) / 180;
      return {
        shape: 'cone',
        range: Math.max(5, numeric('radius', range)),
        width: 0,
        angleDeg: Math.max(36, Math.min(180, (halfAngle * 360) / Math.PI)),
        radius: 0,
      };
    }

    if (effects.some((effect) => effect.type === 'frozenOrb')) {
      return {
        shape: 'line',
        range: 32,
        width: Math.max(6, numeric('radius', 6) * 2),
        angleDeg: 0,
        radius: 0,
      };
    }

    return {
      shape: 'line',
      range,
      width: Math.max(1.5, Math.min(4.2, numeric('radius', 2.2))),
      angleDeg: 0,
      radius: 0,
    };
  }

`;

  source = replaceBetween(
    source,
    '  private highflyAimProfile(',
    '  private highflyPickManualMicroAssistTarget(',
    aimProfile,
    'HIGHFLY semantic aim profile',
  );

  source = replaceRequired(
    source,
    `      const targetId = this.highflyPickManualMicroAssistTarget(castSlot, facing);`,
    `      if (this.highflyDirectionalNoTarget(resolved)) {
        this.sim.player.facing = facing;
        this.castSlot(castSlot);
        button.blur();
        return;
      }

      const targetId = this.highflyPickManualMicroAssistTarget(castSlot, facing);`,
    'directional no-target cast branch',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) DEEP SEMANTIC REGRESSION — ALL NINE CLASSES + REAL FRONT ARC
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v083_full_combat_semantics.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABILITIES, CLASSES } from '../src/sim/data';
import { ALL_CLASSES } from '../src/sim/types';

describe('HIGHFLY v0.8.3 full combat semantics', () => {
  it('audits every one of the nine class ability registries, not only Shaman', () => {
    let checked = 0;
    for (const classId of ALL_CLASSES) {
      const cls = CLASSES[classId];
      expect(cls, classId).toBeDefined();
      expect(cls.abilities.length, classId + ':abilities').toBeGreaterThan(0);
      for (const abilityId of cls.abilities) {
        const ability = ABILITIES[abilityId];
        expect(ability, classId + ':' + abilityId).toBeDefined();
        if (!ability) continue;
        checked += 1;
        for (const [label, value] of [
          ['range', ability.range ?? 0],
          ['cost', ability.cost ?? 0],
          ['castTime', ability.castTime ?? 0],
          ['cooldown', ability.cooldown ?? 0],
        ] as const) {
          expect(Number.isFinite(value), classId + ':' + abilityId + ':' + label).toBe(true);
          expect(value, classId + ':' + abilityId + ':' + label).toBeGreaterThanOrEqual(0);
        }
      }
    }
    expect(checked).toBeGreaterThan(120);
  });

  it('turns Reaping Arc into a true frontal sweep matching its description', () => {
    const cleave = ABILITIES.cleave;
    expect(cleave.description.toLowerCase()).toContain('in front of you');
    const aoe = cleave.effects?.find((effect) => effect.type === 'aoeDamage') as
      | ({ frontal?: boolean; frontalHalfAngle?: number; radius?: number } & Record<string, unknown>)
      | undefined;
    expect(aoe).toBeDefined();
    expect(aoe?.frontal).toBe(true);
    expect(aoe?.radius).toBe(5);
    expect(aoe?.frontalHalfAngle).toBeCloseTo((50 * Math.PI) / 180, 6);
  });

  it('keeps Warrior frontal identities distinct and explicit', () => {
    const revenge = ABILITIES.revenge.effects?.find((effect) => effect.type === 'aoeDamage') as
      | ({ frontal?: boolean; frontalHalfAngle?: number } & Record<string, unknown>)
      | undefined;
    const faultline = ABILITIES.faultline.effects?.find((effect) => effect.type === 'aoeDamage') as
      | ({ frontal?: boolean; frontalHalfAngle?: number } & Record<string, unknown>)
      | undefined;
    expect(revenge?.frontal).toBe(true);
    expect(revenge?.frontalHalfAngle).toBeCloseTo((70 * Math.PI) / 180, 6);
    expect(faultline?.frontal).toBe(true);
    expect(faultline?.frontalHalfAngle).toBeCloseTo(Math.PI / 3, 6);
  });

  it('makes every written front-arc AoE use frontal authoritative geometry', () => {
    const offenders: string[] = [];
    for (const classId of ALL_CLASSES) {
      for (const abilityId of CLASSES[classId].abilities) {
        const ability = ABILITIES[abilityId];
        const description = String(ability.description ?? '').toLowerCase();
        if (!description.includes('in front of you') && !description.includes('frontal arc')) continue;
        const aoes = ability.effects?.filter((effect) => effect.type === 'aoeDamage') ?? [];
        if (aoes.length === 0) continue;
        if (!aoes.some((effect) => (effect as Record<string, unknown>).frontal === true)) {
          offenders.push(classId + ':' + abilityId);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('lets no-target directional engines participate in mobile action aim', () => {
    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
    expect(hud).toContain('private highflyDirectionalNoTarget(resolved: ResolvedAbility)');
    expect(hud).toContain("effect.type === 'aoeDamage' && effect.frontal === true");
    expect(hud).toContain("effect.type === 'empoweredCone'");
    expect(hud).toContain("effect.type === 'frozenOrb'");
    expect(hud).toContain('frontalHalfAngle');
    expect(hud).toContain('this.highflyDirectionalNoTarget(resolved)');
  });

  it('preserves the two already-approved HIGHFLY spatial attacks', () => {
    const combat = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');
    expect(combat).toContain("ability.id === 'sinister_strike'");
    expect(combat).toContain('highflySweepHalfAngle');
    expect(combat).toContain("ability.id === 'lightning_bolt'");
    expect(combat).toContain('highflyArcHalfAngle');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.8.3] deep nine-class combat semantics installed with structural HUD patching.');

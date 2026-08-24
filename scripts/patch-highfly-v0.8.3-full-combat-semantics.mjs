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

// ---------------------------------------------------------------------------
// 1) WARRIOR — MAKE THE AUTHORED FRONT-ARC PROMISE TRUE
//
// Reaping Arc said "enemies in front" but was a 360-degree radius. Revenge and
// Faultline were marked frontal, yet inherited ClaudeCraft's very wide generic
// MELEE_ARC fallback. HIGHFLY gives each an explicit action-combat arc so render,
// mobile aim and authoritative damage all share the same geometry.
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

  // Faultline's record has a stun directly after the frontal flag. Keep its
  // identity broader than Reaping Arc, but never let it leak behind the hunter.
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
// HIGHFLY's old mobile helper only admitted entity-targeted or ground-position
// abilities. That meant frontal sweeps (Reaping Arc / Revenge / Faultline /
// Bastion Sweep) and true forward engines could not be drag-aimed even though the
// Sim already resolves them from player.facing. Teach the HUD their semantics.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  const oldDef = `  private highflyMobileAimDef(barSlot: number): ResolvedAbility | null {
    const resolved = this.abilityForSlot(barSlot);
    if (!resolved) return null;
    const def = resolved.def;
    if (def.selfCentered) return null;
    if (def.targetMode === 'position') return resolved;
    if (!def.requiresTarget || def.targetType === 'friendly' || def.targetsDead) return null;
    return resolved;
  }`;

  const newDef = `  private highflyDirectionalNoTarget(resolved: ResolvedAbility): boolean {
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
  }`;

  source = replaceRequired(source, oldDef, newDef, 'directional no-target mobile aim admission');

  const oldCone = `    if (def?.id === 'lightning_bolt') {
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
    if (isAuthoredFrontalAoe) {
      return {
        shape: 'cone',
        range,
        width: 0,
        angleDeg: Math.max(36, Math.min(100, numeric('angle', 64))),
        radius: 0,
      };
    }`;

  const newCone = `    const empoweredCone = effects.find((effect) => effect.type === 'empoweredCone');
    if (empoweredCone) {
      const stages = Array.isArray(empoweredCone.stages)
        ? (empoweredCone.stages as Array<Record<string, unknown>>)
        : [];
      const empoweredRange = Math.max(
        range,
        ...stages.map((stage) =>
          typeof stage.range === 'number' && Number.isFinite(stage.range) ? stage.range : 0,
        ),
      );
      const baseAngle =
        typeof empoweredCone.angle === 'number' && Number.isFinite(empoweredCone.angle)
          ? empoweredCone.angle
          : 64;
      const empoweredAngle = Math.max(
        baseAngle,
        ...stages.map((stage) =>
          typeof stage.angle === 'number' && Number.isFinite(stage.angle) ? stage.angle : 0,
        ),
      );
      return {
        shape: 'cone',
        range: Math.max(5, empoweredRange),
        width: 0,
        angleDeg: Math.max(36, Math.min(180, empoweredAngle)),
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
      const fullAngleDeg = (halfAngle * 360) / Math.PI;
      return {
        shape: 'cone',
        range: Math.max(5, numeric('radius', range)),
        width: 0,
        angleDeg: Math.max(36, Math.min(180, fullAngleDeg)),
        radius: 0,
      };
    }

    if (effects.some((effect) => effect.type === 'frozenOrb')) {
      const orb = effects.find((effect) => effect.type === 'frozenOrb');
      const duration =
        orb && typeof orb.duration === 'number' && Number.isFinite(orb.duration) ? orb.duration : 8;
      return {
        shape: 'line',
        range: Math.max(12, Math.min(32, duration * 4)),
        width: Math.max(3, numeric('radius', 6) * 2),
        angleDeg: 0,
        radius: 0,
      };
    }`;

  source = replaceRequired(source, oldCone, newCone, 'truthful cone and forward-engine aim profiles');

  // A directional no-target attack casts after the drag commits facing. It does
  // NOT auto-select an arbitrary entity; its own Sim geometry decides every body
  // hit, preserving the action-RPG contract.
  const targetPickerAnchor = `      const targetId = this.highflyPickManualMicroAssistTarget(castSlot, facing);`;
  source = replaceRequired(
    source,
    targetPickerAnchor,
    `      if (this.highflyDirectionalNoTarget(resolved)) {
        this.sim.player.facing = facing;
        this.castSlot(castSlot);
        button.blur();
        return;
      }

${targetPickerAnchor}`,
    'directional no-target cast branch',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) HOLD-TO-CHARGE MOBILE GESTURE
//
// Glacial Front and Dragon's Breath are authoritative empowered cones. On touch,
// charging must begin on pointer DOWN, keep the thumb free to rotate the cone,
// and release the empowered spell on pointer UP. Ordinary skills still begin on
// release exactly as before.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `    let manual = false;
    let swallowClickUntil = 0;`,
    `    let manual = false;
    let empoweredHeld = false;
    let swallowClickUntil = 0;`,
    'empowered touch state',
  );

  source = replaceRequired(
    source,
    `        manual = false;
        this.highflyCancelSkillAim();
        try { button.setPointerCapture(event.pointerId); } catch { /* optional */ }`,
    `        manual = false;
        empoweredHeld = !!this.abilityForSlot(nextSlot)?.def.empowerStages;
        this.highflyCancelSkillAim();
        try { button.setPointerCapture(event.pointerId); } catch { /* optional */ }
        // Empowered cones charge while the thumb is held. The authoritative Sim
        // owns stage timing; pointer-up below only asks it to release.
        if (empoweredHeld) this.castSlot(nextSlot);`,
    'start empowered cast on touch hold',
  );

  source = replaceRequired(
    source,
    `      const wasManual = manual || dragLength >= 12;
      const castSlot = slot;
      pointerId = null;
      slot = -1;
      manual = false;`,
    `      const wasManual = manual || dragLength >= 12;
      const wasEmpowered = empoweredHeld;
      const castSlot = slot;
      pointerId = null;
      slot = -1;
      manual = false;
      empoweredHeld = false;`,
    'capture empowered release state',
  );

  source = replaceRequired(
    source,
    `      if (cancelled) return;

      audio.click();`,
    `      if (cancelled) {
        if (wasEmpowered) {
          const cancelledResolved = this.abilityForSlot(castSlot);
          if (cancelledResolved) this.sim.releaseEmpoweredAbility(cancelledResolved.def.id);
        }
        return;
      }

      audio.click();`,
    'release empowered cast on pointer cancellation',
  );

  const resolvedAnchor = `      const resolved = this.highflyMobileAimDef(castSlot);
      if (!resolved) {
        this.castSlot(castSlot);
        return;
      }

      if (!wasManual) {`;
  const resolvedReplacement = `      const resolved = this.highflyMobileAimDef(castSlot);
      if (!resolved) {
        this.castSlot(castSlot);
        return;
      }

      if (wasEmpowered) {
        if (wasManual) this.sim.player.facing = this.highflyScreenAimFacing(dx, dy);
        this.sim.releaseEmpoweredAbility(resolved.def.id);
        button.blur();
        return;
      }

      if (!wasManual) {`;
  source = replaceRequired(source, resolvedAnchor, resolvedReplacement, 'empowered release before ordinary tap path');

  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) DEEP SEMANTIC REGRESSION — ALL ABILITIES, REAL CONES, REAL WARRIOR ARC
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v083_full_combat_semantics.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABILITIES, MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { AbilityEffect, Entity } from '../src/sim/types';

function effectRecords(ability: (typeof ABILITIES)[string]): Array<AbilityEffect & Record<string, unknown>> {
  return (ability.effects ?? []) as Array<AbilityEffect & Record<string, unknown>>;
}

function dummy(sim: Sim & Record<string, any>, id: number, x: number, z: number): Entity {
  const p = sim.player;
  const mob = createMob(id, MOBS.training_dummy, 20, {
    x: p.pos.x + x,
    y: p.pos.y,
    z: p.pos.z + z,
  });
  mob.hostile = true;
  mob.dead = false;
  mob.maxHp = mob.hp = 100_000;
  mob.stats.armor = 0;
  sim.addEntity(mob);
  return mob;
}

describe('HIGHFLY v0.8.3 full combat semantics', () => {
  it('audits every authored class ability for finite combat timing/range/cost fields', () => {
    let checked = 0;
    for (const [abilityId, ability] of Object.entries(ABILITIES)) {
      if (!ability.class) continue;
      checked += 1;
      for (const [label, value] of [
        ['range', ability.range ?? 0],
        ['cost', ability.cost ?? 0],
        ['castTime', ability.castTime ?? 0],
        ['cooldown', ability.cooldown ?? 0],
      ] as const) {
        expect(Number.isFinite(value), abilityId + ':' + label).toBe(true);
        expect(value, abilityId + ':' + label).toBeGreaterThanOrEqual(0);
      }
    }
    expect(checked).toBeGreaterThan(120);
  });

  it('requires every frontal AoE to own an explicit finite half-angle', () => {
    const missing: string[] = [];
    for (const [abilityId, ability] of Object.entries(ABILITIES)) {
      for (const effect of effectRecords(ability)) {
        if (effect.type !== 'aoeDamage' || effect.frontal !== true) continue;
        const angle = effect.frontalHalfAngle;
        if (typeof angle !== 'number' || !Number.isFinite(angle) || angle <= 0 || angle > Math.PI) {
          missing.push(abilityId);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('enforces the written front-arc promise instead of allowing a 360 degree radius', () => {
    for (const [abilityId, ability] of Object.entries(ABILITIES)) {
      const description = String(ability.description ?? '').toLowerCase();
      if (!description.includes('in front of you') && !description.includes('frontal arc')) continue;
      const aoes = effectRecords(ability).filter((effect) => effect.type === 'aoeDamage');
      if (aoes.length === 0) continue;
      expect(aoes.some((effect) => effect.frontal === true), abilityId).toBe(true);
    }
  });

  it('requires every empowered cone stage to have valid forward geometry', () => {
    let empowered = 0;
    for (const [abilityId, ability] of Object.entries(ABILITIES)) {
      for (const effect of effectRecords(ability)) {
        if (effect.type !== 'empoweredCone') continue;
        empowered += 1;
        const stages = Array.isArray(effect.stages) ? effect.stages as Array<Record<string, unknown>> : [];
        expect(stages.length, abilityId + ':stages').toBeGreaterThan(0);
        for (const stage of stages) {
          expect(Number(stage.range), abilityId + ':stageRange').toBeGreaterThan(0);
          const angle = stage.angle ?? effect.angle;
          expect(Number(angle), abilityId + ':stageAngle').toBeGreaterThan(0);
          expect(Number(angle), abilityId + ':stageAngle').toBeLessThanOrEqual(180);
        }
      }
    }
    expect(empowered).toBeGreaterThanOrEqual(2);
  });

  it('makes Reaping Arc damage the front body and never the equally-near rear body', () => {
    const sim = new Sim({ seed: 833, playerClass: 'warrior', autoEquip: true }) as Sim & Record<string, any>;
    sim.setPlayerLevel(20);
    expect(sim.setSpec('arms')).toBe(true);
    sim.tick();
    const p = sim.player;
    p.facing = 0;
    p.resource = p.maxResource;
    const front = dummy(sim, 98331, 0, 3);
    const rear = dummy(sim, 98332, 0, -3);

    sim.castAbility('cleave');

    expect(front.hp).toBeLessThan(front.maxHp);
    expect(rear.hp).toBe(rear.maxHp);
  });

  it('exposes truthful manual geometry for frontals, empowered cones and Frozen Orb', () => {
    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
    expect(hud).toContain('private highflyDirectionalNoTarget(resolved: ResolvedAbility)');
    expect(hud).toContain("effect.type === 'aoeDamage' && effect.frontal === true");
    expect(hud).toContain("effect.type === 'empoweredCone'");
    expect(hud).toContain("effect.type === 'frozenOrb'");
    expect(hud).toContain('frontalHalfAngle');
    expect(hud).toContain('this.sim.releaseEmpoweredAbility(resolved.def.id)');
    expect(hud).toContain('if (empoweredHeld) this.castSlot(nextSlot)');
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

console.log('[HIGHFLY v0.8.3] deep all-class combat semantics installed: truthful frontals, directional no-target aim, empowered mobile cones and full ability audit.');

import { describe, expect, it } from 'vitest';
import {
  HIGHFLY_BASIC_MELEE,
  HIGHFLY_REAVER_STRIKE,
  resolveActionBodies,
  type ActionDefinition,
} from '../src/highfly/combat/action';
import { epley1RmKg, summarizeStrengthSession } from '../src/highfly/training/strength';
import { applyHighflyEvent, createHighflyProfile } from '../src/highfly/system/system';

describe('HIGHFLY Clean Core combat contracts', () => {
  const origin = { x: 0, z: 0 };
  const direction = { x: 0, z: 1 };

  it('basic attack works without selected target and resolves one natural body', () => {
    const hits = resolveActionBodies(
      HIGHFLY_BASIC_MELEE,
      { origin, direction, focusId: null },
      [
        { id: 'near', pos: { x: 0.2, z: 2 }, alive: true, hostile: true },
        { id: 'far', pos: { x: 0.1, z: 2.8 }, alive: true, hostile: true },
      ],
    );
    expect(hits.map((b) => b.id)).toEqual(['near']);
  });

  it('manual target is priority only when it is inside action geometry', () => {
    const hits = resolveActionBodies(
      HIGHFLY_REAVER_STRIKE,
      { origin, direction, focusId: 'focus' },
      [
        { id: 'near', pos: { x: 0, z: 2 }, alive: true, hostile: true },
        { id: 'focus', pos: { x: 1, z: 3 }, alive: true, hostile: true },
      ],
    );
    expect(hits[0]?.id).toBe('focus');
  });

  it('Reaver Strike damages multiple bodies inside 100-degree cone and excludes outside bodies', () => {
    const hits = resolveActionBodies(
      HIGHFLY_REAVER_STRIKE,
      { origin, direction },
      [
        { id: 'a', pos: { x: -1, z: 3 }, alive: true, hostile: true },
        { id: 'b', pos: { x: 1.2, z: 3.2 }, alive: true, hostile: true },
        { id: 'outside-angle', pos: { x: 4, z: 1 }, alive: true, hostile: true },
        { id: 'outside-range', pos: { x: 0, z: 7 }, alive: true, hostile: true },
      ],
    );
    expect(hits.map((b) => b.id)).toEqual(['a', 'b']);
  });

  it('non-piercing projectile resolves only first intersection', () => {
    const projectile: ActionDefinition = {
      id: 'projectile',
      shape: 'projectile',
      range: 12,
      width: 1,
      maxTargets: 5,
      targetPolicy: 'optional-focus',
      aimMode: 'facing',
      piercing: false,
    };
    const hits = resolveActionBodies(projectile, { origin, direction }, [
      { id: 'first', pos: { x: 0, z: 4 }, alive: true, hostile: true },
      { id: 'second', pos: { x: 0, z: 8 }, alive: true, hostile: true },
    ]);
    expect(hits.map((b) => b.id)).toEqual(['first']);
  });
});

describe('HIGHFLY Clean Core training contracts', () => {
  it('keeps tested RM separate while Epley estimates 1-10 reps', () => {
    expect(epley1RmKg(100, 1)).toBe(100);
    expect(epley1RmKg(100, 5)).toBeCloseTo(116.6667, 3);
    expect(epley1RmKg(100, 11)).toBe(0);
  });

  it('summarizes session tonnage and best e1RM per exercise', () => {
    const summary = summarizeStrengthSession([
      { exerciseId: 'squat', weightKg: 100, reps: 5, completedAt: 1 },
      { exerciseId: 'squat', weightKg: 90, reps: 8, completedAt: 2 },
      { exerciseId: 'bench', weightKg: 70, reps: 5, completedAt: 3 },
    ]);
    expect(summary.tonnageKg).toBe(1570);
    expect(summary.completedSets).toBe(3);
    expect(summary.estimated1RmByExercise.squat).toBeGreaterThan(110);
  });
});

describe('HIGHFLY Clean Core system contracts', () => {
  it('processes each event exactly once', () => {
    const initial = createHighflyProfile();
    const event = { id: 'session-001', type: 'SESSION_COMPLETED' as const, payload: { tonnageKg: 5000 } };
    const once = applyHighflyEvent(initial, event);
    const twice = applyHighflyEvent(once, event);
    expect(once.xp).toBeGreaterThan(0);
    expect(twice).toBe(once);
    expect(twice.xp).toBe(once.xp);
  });
});

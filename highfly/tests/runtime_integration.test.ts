import { describe, expect, it } from 'vitest';
import { handleMobileAttackTap } from '../src/ui/hud/action_bar/hotbar';
import { HighflyCombatRuntime } from '../src/highfly/combat/runtime';
import { ClaudeCraft040Adapter } from '../src/highfly/runtime/claudecraft040';
import { movementVector } from '../src/highfly/movement/movement';
import {
  createTrainingSession,
  parseTrainingSession,
  registerTrainingSet,
  serializeTrainingSession,
  summarizeTrainingSession,
} from '../src/highfly/training/session';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';
import { groundHeight } from '../src/sim/world';

function killAmbientMobs(sim: Sim): void {
  for (const entity of sim.entities.values()) if (entity.kind === 'mob') entity.dead = true;
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

function placePlayer(sim: Sim, x = 0, z = 0): void {
  const p = sim.player;
  p.pos.x = x;
  p.pos.z = z;
  p.pos.y = groundHeight(x, z, sim.cfg.seed);
  p.prevPos = { ...p.pos };
  p.facing = 0;
  p.targetId = null;
  sim.ctx.rebucket(p);
}

describe('HIGHFLY real ClaudeCraft 0.40 runtime combat', () => {
  it('mobile Attack invokes HIGHFLY action hook and never attackNearest', () => {
    let highfly = 0;
    let nearest = 0;
    let inherited = 0;
    const globals = globalThis as typeof globalThis & { __HIGHFLY_ATTACK__?: () => void };
    globals.__HIGHFLY_ATTACK__ = () => highfly++;
    handleMobileAttackTap(
      { autoAttack: false, hasLiveHostileTarget: false },
      { activateAttack: () => inherited++, attackNearest: () => nearest++ },
    );
    delete globals.__HIGHFLY_ATTACK__;
    expect(highfly).toBe(1);
    expect(nearest).toBe(0);
    expect(inherited).toBe(0);
  });

  it('basic attack damages a real training dummy with targetId null and does not select it', () => {
    const sim = new Sim({ seed: 92001, playerClass: 'warrior', playerName: 'HIGHFLY' });
    killAmbientMobs(sim);
    placePlayer(sim);
    const first = addDummy(sim, 990001, 0, 2.5);
    const second = addDummy(sim, 990002, 0.4, 3.8);
    const runtime = new HighflyCombatRuntime(new ClaudeCraft040Adapter(sim));
    const firstBefore = first.hp;
    const secondBefore = second.hp;
    const result = runtime.basic();
    expect(result.hitIds).toEqual([first.id]);
    expect(first.hp).toBeLessThan(firstBefore);
    expect(second.hp).toBe(secondBefore);
    expect(sim.player.targetId).toBeNull();
  });

  it('warrior skill one is a targetless real 100-degree multi-body cast paid once', () => {
    const sim = new Sim({ seed: 92002, playerClass: 'warrior', playerName: 'HIGHFLY' });
    killAmbientMobs(sim);
    placePlayer(sim);
    sim.player.resource = 100;
    const a = addDummy(sim, 990011, -1, 3);
    const b = addDummy(sim, 990012, 1.1, 3.2);
    const outside = addDummy(sim, 990013, 4, 1);
    const before = { a: a.hp, b: b.hp, outside: outside.hp, resource: sim.player.resource };
    const runtime = new HighflyCombatRuntime(new ClaudeCraft040Adapter(sim));
    const result = runtime.skillOne();
    expect(result.hitIds).toEqual([a.id, b.id]);
    expect(a.hp).toBeLessThan(before.a);
    expect(b.hp).toBeLessThan(before.b);
    expect(outside.hp).toBe(before.outside);
    expect(sim.player.resource).toBe(before.resource - 15);
    expect(sim.player.targetId).toBeNull();
    const immediateSecondCast = runtime.skillOne();
    expect(immediateSecondCast.blockedBy).toBe('cooldown');
    expect(sim.player.resource).toBe(before.resource - 15);
  });

  it('ranged class basic resolves a real body without requiring a target', () => {
    const sim = new Sim({ seed: 92003, playerClass: 'mage', playerName: 'HIGHFLY' });
    killAmbientMobs(sim);
    placePlayer(sim);
    const dummy = addDummy(sim, 990021, 0, 12);
    const before = dummy.hp;
    const result = new HighflyCombatRuntime(new ClaudeCraft040Adapter(sim)).basic();
    expect(result.hitIds).toEqual([dummy.id]);
    expect(dummy.hp).toBeLessThan(before);
    expect(sim.player.targetId).toBeNull();
  });
});

describe('HIGHFLY action movement contract', () => {
  it('back input becomes a travel direction instead of a moonwalk instruction', () => {
    const planned = movementVector(
      { forward: false, back: true, strafeLeft: false, strafeRight: false },
      0,
      0,
    );
    expect(planned.hasInput).toBe(true);
    expect(planned.direction.x).toBeCloseTo(0, 5);
    expect(planned.direction.z).toBeCloseTo(-1, 5);
  });
});

describe('HIGHFLY training persistence contract', () => {
  it('serializes every registered set and restores exact RM evidence inputs after restart', () => {
    let session = createTrainingSession(1000, 'session-e2e');
    session = registerTrainingSet(session, {
      exerciseId: 'sentadilla_trasera',
      weightKg: 100,
      reps: 5,
      completedAt: 1100,
    });
    const restored = parseTrainingSession(serializeTrainingSession(session));
    expect(restored).not.toBeNull();
    expect(restored?.sets).toEqual(session.sets);
    const summary = summarizeTrainingSession(restored!);
    expect(summary.summary.tonnageKg).toBe(500);
    expect(summary.evidenceByExercise.sentadilla_trasera.estimated1RmKg).toBeCloseTo(116.6667, 3);
  });
});

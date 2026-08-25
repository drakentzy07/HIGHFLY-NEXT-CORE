import { describe, expect, it } from 'vitest';
import { emptyMoveInput } from '../src/sim/types';
import {
  highflyCameraDrivesFacing,
  highflyDashFacing,
  highflyMovementFacing,
  resolveHighflyLocomotion,
} from '../src/highfly/movement/movement_core';

const EPS = 1e-8;

function move(patch: Partial<ReturnType<typeof emptyMoveInput>>) {
  return { ...emptyMoveInput(), ...patch };
}

function angleClose(actual: number | null, expected: number): void {
  expect(actual).not.toBeNull();
  const delta = Math.atan2(Math.sin((actual ?? 0) - expected), Math.cos((actual ?? 0) - expected));
  expect(Math.abs(delta)).toBeLessThan(EPS);
}

describe('HIGHFLY Phase 3 locomotion', () => {
  it('turns the body into each joystick travel direction instead of backpedalling/strafe-walking', () => {
    const camera = 0.7;
    angleClose(highflyMovementFacing(move({ forward: true }), camera, 0), camera);
    angleClose(highflyMovementFacing(move({ back: true }), camera, 0), camera - Math.PI);
    angleClose(highflyMovementFacing(move({ strafeRight: true }), camera, 0), camera - Math.PI / 2);
    angleClose(highflyMovementFacing(move({ strafeLeft: true }), camera, 0), camera + Math.PI / 2);
    angleClose(highflyMovementFacing(move({ forward: true, strafeRight: true }), camera, 0), camera - Math.PI / 4);
  });

  it('feeds the engine forward locomotion while preserving jump/swim intent', () => {
    const result = resolveHighflyLocomotion({
      moveInput: move({ back: true, strafeLeft: true, jump: true, dive: true, swimSteer: 0.5 }),
      cameraYaw: 0,
      currentFacing: 0.25,
      upstreamFacing: null,
      enabled: true,
    });
    expect(result.mi.forward).toBe(true);
    expect(result.mi.back).toBe(false);
    expect(result.mi.strafeLeft).toBe(false);
    expect(result.mi.strafeRight).toBe(false);
    expect(result.mi.turnLeft).toBe(false);
    expect(result.mi.turnRight).toBe(false);
    expect(result.mi.jump).toBe(true);
    expect(result.mi.dive).toBe(true);
    expect(result.mi.swimSteer).toBe(0.5);
    expect(result.facing).not.toBeNull();
  });

  it('leaves desktop/upstream locomotion byte-for-byte untouched when disabled', () => {
    const source = move({ back: true, strafeRight: true });
    const result = resolveHighflyLocomotion({
      moveInput: source,
      cameraYaw: 1,
      currentFacing: 0,
      upstreamFacing: -0.4,
      enabled: false,
    });
    expect(result.mi).toBe(source);
    expect(result.facing).toBe(-0.4);
  });

  it('leaves click-to-move under the engine authority', () => {
    const source = move({ forward: true, strafeRight: true });
    const result = resolveHighflyLocomotion({
      moveInput: source,
      cameraYaw: 1.4,
      currentFacing: 0.2,
      upstreamFacing: -1.1,
      enabled: true,
      clickMoveActive: true,
    });
    expect(result.mi).toBe(source);
    expect(result.facing).toBe(-1.1);
  });

  it('keeps touch camera intent independent from body facing in HIGHFLY mode', () => {
    expect(highflyCameraDrivesFacing(true, true)).toBe(false);
    expect(highflyCameraDrivesFacing(false, true)).toBe(true);
  });

  it('uses joystick direction for dash and current body facing when the stick is centred', () => {
    angleClose(highflyDashFacing(move({ strafeRight: true }), 0, 1), -Math.PI / 2);
    angleClose(highflyDashFacing(move({}), 0, 1.2), 1.2);
  });
});

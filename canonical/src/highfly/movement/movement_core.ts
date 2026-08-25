import type { MoveInput } from '../../sim/types';

export interface HighflyLocomotionRequest {
  moveInput: MoveInput;
  cameraYaw: number;
  currentFacing: number;
  upstreamFacing: number | null;
  enabled: boolean;
  clickMoveActive?: boolean;
}

export interface HighflyLocomotionResult {
  mi: MoveInput;
  facing: number | null;
}

function normAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function axes(mi: MoveInput): { x: number; z: number } {
  return {
    x: (mi.strafeRight ? 1 : 0) - (mi.strafeLeft ? 1 : 0),
    z: (mi.forward ? 1 : 0) - (mi.back ? 1 : 0),
  };
}

export function highflyMovementFacing(
  mi: MoveInput,
  cameraYaw: number,
  fallbackFacing: number,
): number | null {
  const { x, z } = axes(mi);
  if (x === 0 && z === 0) return null;
  const base = Number.isFinite(cameraYaw) ? cameraYaw : fallbackFacing;
  // ClaudeCraft's own movement_visual.ts uses this bearing convention. Keeping
  // the same convention means HIGHFLY changes locomotion semantics without
  // fighting the renderer/world coordinate system.
  return normAngle(base - Math.atan2(x, z));
}

/**
 * HIGHFLY mobile locomotion contract.
 *
 * The touch wheel expresses a travel direction, not MMO-style forward/backpedal/
 * strafe animation states. We resolve that direction against the camera, rotate
 * the body toward travel, then feed the engine a normal forward step. The engine
 * still owns collision, speed, jumping, swimming, networking and prediction.
 */
export function resolveHighflyLocomotion(
  request: HighflyLocomotionRequest,
): HighflyLocomotionResult {
  const { moveInput, enabled, clickMoveActive = false } = request;
  if (!enabled || clickMoveActive) {
    return { mi: moveInput, facing: request.upstreamFacing };
  }

  const facing = highflyMovementFacing(moveInput, request.cameraYaw, request.currentFacing);
  if (facing === null) {
    return { mi: moveInput, facing: request.upstreamFacing };
  }

  return {
    mi: {
      ...moveInput,
      forward: true,
      back: false,
      strafeLeft: false,
      strafeRight: false,
      turnLeft: false,
      turnRight: false,
    },
    facing,
  };
}

/** Camera drag/orbit on native HIGHFLY is camera intent, not body-facing intent. */
export function highflyCameraDrivesFacing(enabled: boolean, upstreamActive: boolean): boolean {
  return enabled ? false : upstreamActive;
}

/** Dash uses the same travel bearing as locomotion; with a centred stick it uses body facing. */
export function highflyDashFacing(
  mi: MoveInput,
  cameraYaw: number,
  currentFacing: number,
): number {
  return highflyMovementFacing(mi, cameraYaw, currentFacing) ?? normAngle(currentFacing);
}

import { normalized, type Vec2 } from '../combat/action';

export type HighflyMoveFlags = {
  forward: boolean;
  back: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
};

export function movementVector(
  move: HighflyMoveFlags,
  cameraYaw: number,
  fallbackFacing: number,
): { direction: Vec2; hasInput: boolean } {
  const forwardAmount = Number(move.forward) - Number(move.back);
  const rightAmount = Number(move.strafeRight) - Number(move.strafeLeft);
  const hasInput = forwardAmount !== 0 || rightAmount !== 0;
  if (!hasInput) {
    return {
      direction: { x: Math.sin(fallbackFacing), z: Math.cos(fallbackFacing) },
      hasInput: false,
    };
  }

  const forward = { x: Math.sin(cameraYaw), z: Math.cos(cameraYaw) };
  const right = { x: Math.cos(cameraYaw), z: -Math.sin(cameraYaw) };
  return {
    direction: normalized({
      x: forward.x * forwardAmount + right.x * rightAmount,
      z: forward.z * forwardAmount + right.z * rightAmount,
    }),
    hasInput: true,
  };
}

export function facingForDirection(direction: Vec2): number {
  return Math.atan2(direction.x, direction.z);
}

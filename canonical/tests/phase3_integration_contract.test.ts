import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('HIGHFLY canonical Phase 3 engine boundary', () => {
  it('routes movement through one canonical resolver at the existing resolveMove seam', () => {
    const main = read('src/main.ts');
    expect(main).toContain("from './highfly/movement/movement_core'");
    expect(main).toContain('return resolveHighflyLocomotion({');
    expect(main).toContain('moveInput: mi');
    expect(main).toContain('cameraYaw: input.camYaw');
    expect(main).toContain('currentFacing: playerFacing');
    expect(main).toContain("enabled: import.meta.env.VITE_HIGHFLY_NATIVE === '1'");
    expect(main).toContain('clickMoveActive: input.clickMoveTarget !== null');
  });

  it('keeps touch camera independent from body-facing authority without changing Input itself', () => {
    const main = read('src/main.ts');
    const input = read('src/game/input.ts');
    expect(main).toContain('highflyCameraDrivesFacing(');
    expect(main).toContain('const upstreamCameraFacing = isCameraDrivenFacingActive(');
    expect(main).toContain('const cameraDrivenFacing = highflyCameraDrivesFacing(');
    expect(main).not.toContain('readMoveInput =');
    expect(input).not.toContain('HIGHFLY');
  });

  it('leaves the engine movement visual helper untouched as an upstream implementation detail', () => {
    const visual = read('src/game/movement_visual.ts');
    expect(visual).toContain('Preserve classic pure strafe/backpedal presentation');
    expect(visual).not.toContain('HIGHFLY');
  });
});

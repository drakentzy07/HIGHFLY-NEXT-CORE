import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'game');
const mainPath = path.join(root, 'src/main.ts');
let source = fs.readFileSync(mainPath, 'utf8');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.version !== '0.40.0') {
  throw new Error(`HIGHFLY Phase 3 requires ClaudeCraft 0.40.0, got ${pkg.version}`);
}

function once(label, from, to) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`HIGHFLY Phase 3 seam missing: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) {
    throw new Error(`HIGHFLY Phase 3 seam ambiguous: ${label}`);
  }
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

// One explicit engine boundary. No Input prototype mutation and no DOM overlay.
once(
  'movement import',
  "import { diagonalMovementVisualFacing } from './game/movement_visual';",
  "import { diagonalMovementVisualFacing } from './game/movement_visual';\nimport { highflyCameraDrivesFacing, resolveHighflyLocomotion } from './highfly/movement/movement_core';",
);

// Camera drag/look remains fully upstream, but on native HIGHFLY it no longer owns
// the body heading. Desktop and non-HIGHFLY builds retain the exact 0.40 contract.
const renderStart = source.indexOf('  function renderFacingOverride(): number | null {');
const renderEnd = source.indexOf('\n  function cameraMoveActive(): boolean {', renderStart);
if (renderStart < 0 || renderEnd < 0) throw new Error('HIGHFLY Phase 3 seam missing: renderFacingOverride');
let renderBlock = source.slice(renderStart, renderEnd);
const renderNeedle = `    return isCameraDrivenFacingActive(\n      input.isMouseCameraMode(),\n      cameraMoveActive(),\n      input.isMouselookActive(),\n      movementFrozen(),\n    )\n      ? input.camYaw\n      : null;`;
const renderReplacement = `    const upstreamCameraFacing = isCameraDrivenFacingActive(\n      input.isMouseCameraMode(),\n      cameraMoveActive(),\n      input.isMouselookActive(),\n      movementFrozen(),\n    );\n    return highflyCameraDrivesFacing(\n      import.meta.env.VITE_HIGHFLY_NATIVE === '1',\n      upstreamCameraFacing,\n    )\n      ? input.camYaw\n      : null;`;
if (!renderBlock.includes(renderNeedle)) throw new Error('HIGHFLY Phase 3 seam missing: camera render authority');
renderBlock = renderBlock.replace(renderNeedle, renderReplacement);
source = source.slice(0, renderStart) + renderBlock + source.slice(renderEnd);

// The release-facing latch uses the same authority decision or the body would snap
// to the camera yaw when the player lifts their look finger.
const cameraDrivenNeedle = `    const cameraDrivenFacing = isCameraDrivenFacingActive(\n      input.isMouseCameraMode(),\n      cameraMoveActive(),\n      input.isMouselookActive(),\n      movementFrozen(),\n    );`;
const cameraDrivenReplacement = `    const cameraDrivenFacing = highflyCameraDrivesFacing(\n      import.meta.env.VITE_HIGHFLY_NATIVE === '1',\n      isCameraDrivenFacingActive(\n        input.isMouseCameraMode(),\n        cameraMoveActive(),\n        input.isMouselookActive(),\n        movementFrozen(),\n      ),\n    );`;
const cameraIndex = source.indexOf(cameraDrivenNeedle);
if (cameraIndex < 0) throw new Error('HIGHFLY Phase 3 seam missing: release-facing authority');
source = source.slice(0, cameraIndex) + cameraDrivenReplacement + source.slice(cameraIndex + cameraDrivenNeedle.length);

// Resolve joystick travel once, at the existing movement transaction boundary.
// Everything after this point (collision, speed, swimming, prediction/network) is
// still ClaudeCraft 0.40 engine code.
const resolveStart = source.indexOf('  function resolveMove(\n');
const resolveEnd = source.indexOf('\n\n  function partyMemberIds(', resolveStart);
if (resolveStart < 0 || resolveEnd < 0) throw new Error('HIGHFLY Phase 3 seam missing: resolveMove');
let resolveBlock = source.slice(resolveStart, resolveEnd);

const facingNeedle = '    let facing: number | null = mouselook ? input.camYaw : null;';
const facingReplacement = `    const bodyCameraFacing = highflyCameraDrivesFacing(\n      import.meta.env.VITE_HIGHFLY_NATIVE === '1',\n      mouselook,\n    );\n    let facing: number | null = bodyCameraFacing ? input.camYaw : null;`;
if (!resolveBlock.includes(facingNeedle)) throw new Error('HIGHFLY Phase 3 seam missing: resolveMove initial facing');
resolveBlock = resolveBlock.replace(facingNeedle, facingReplacement);

const finalReturn = '    return { mi, facing };\n  }';
const finalPos = resolveBlock.lastIndexOf(finalReturn);
if (finalPos < 0) throw new Error('HIGHFLY Phase 3 seam missing: resolveMove final return');
const canonicalReturn = `    return resolveHighflyLocomotion({\n      moveInput: mi,\n      cameraYaw: input.camYaw,\n      currentFacing: playerFacing,\n      upstreamFacing: facing,\n      enabled: import.meta.env.VITE_HIGHFLY_NATIVE === '1',\n      clickMoveActive: input.clickMoveTarget !== null,\n    });\n  }`;
resolveBlock = resolveBlock.slice(0, finalPos) + canonicalReturn + resolveBlock.slice(finalPos + finalReturn.length);
source = source.slice(0, resolveStart) + resolveBlock + source.slice(resolveEnd);

if (source.includes('readMoveInput =')) {
  throw new Error('HIGHFLY Phase 3 refuses Input monkey-patching');
}

fs.writeFileSync(mainPath, source, 'utf8');
console.log('[HIGHFLY canonical] Phase 3 movement boundary installed');

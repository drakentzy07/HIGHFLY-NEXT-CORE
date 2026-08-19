import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.4.3] patched ${path}`);
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// Camera ownership: left half is movement-only territory. Right half owns swipe-look.
{
  const path = 'src/game/mobile_controls.ts';
  let source = read(path);
  const before = `    if (!isCameraDragAllowedAt(target, menuOpen)) return;\n    const groundAimOwnsPointer = this.callbacks.onGroundAimMove(e.clientX, e.clientY);`;
  const after = `    if (!isCameraDragAllowedAt(target, menuOpen)) return;\n    // HIGHFLY native action layout: the left half of the screen belongs to movement.\n    // Camera swipe-look only begins on the right half, so the movement thumb can\n    // never rotate the camera even when it starts outside the visible joystick wheel.\n    if (document.body.classList.contains('native-app')) {\n      const cameraRect = this.canvas?.getBoundingClientRect();\n      if (cameraRect && e.clientX < cameraRect.left + cameraRect.width * 0.5) return;\n    }\n    const groundAimOwnsPointer = this.callbacks.onGroundAimMove(e.clientX, e.clientY);`;
  source = replaceRequired(source, before, after, 'right-half native camera gate');
  write(path, source);
}

// Native HUD geometry and the last small creator fit adjustment.
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.4.3 — final S23 creator fit + action locomotion HUD. */
@media (orientation: landscape) {
  /* Free a few vertical CSS pixels so Enter World remains fully visible on the S23. */
  body.native-app.mobile-touch #offline-select.highfly-native-creator:not([hidden]) {
    padding: 2px 4px !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator > .auth-title {
    flex-basis: 16px !important;
    height: 16px !important;
    line-height: 16px !important;
    font-size: 13px !important;
    margin-bottom: 1px !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-layout {
    height: calc(100% - 17px) !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator .mini-class-row {
    flex-basis: 64px !important;
    grid-template-rows: repeat(3, 20px) !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator .mini-class {
    height: 20px !important;
    min-height: 20px !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator .auth-actions,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-start-offline {
    height: 25px !important;
    min-height: 25px !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator .auth-actions {
    flex-basis: 25px !important;
    margin-top: 1px !important;
  }

  /* SALTO -> DASH -> PRIMERA SKILL, all on the same lower arc. The dash keeps
     its own callback and never consumes a skill slot. Its centre is exactly the
     midpoint between Jump and action slot 0 in ClaudeCraft's ring geometry. */
  body.native-app.mobile-touch #mobile-action-ring #mobile-dash {
    right: calc(
      var(--mobile-ring-attack-size) / 2 +
      var(--mobile-ring-radius) * 1.5 -
      var(--mobile-ring-hollow) / 2 -
      var(--mobile-ring-secondary-size) / 2
    ) !important;
    bottom: calc(
      var(--mobile-ring-attack-size) / 2 -
      var(--mobile-ring-secondary-size) / 2
    ) !important;
    width: var(--mobile-ring-secondary-size) !important;
    height: var(--mobile-ring-secondary-size) !important;
    min-width: 0 !important;
    min-height: 0 !important;
  }

  body.native-app.mobile-touch.mobile-left-handed #mobile-action-ring #mobile-dash {
    left: calc(
      var(--mobile-ring-attack-size) / 2 +
      var(--mobile-ring-radius) * 1.5 -
      var(--mobile-ring-hollow) / 2 -
      var(--mobile-ring-secondary-size) / 2
    ) !important;
    right: auto !important;
  }
}
`;
  write(path, css);
}

console.log('[HIGHFLY] v0.4.3 HUD/camera patch complete');

import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.5.4] patched ${path}`);
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

function replaceBetween(source, startNeedle, endNeedle, replacement, label) {
  const start = source.indexOf(startNeedle);
  if (start < 0) throw new Error(`Start anchor not found: ${label}`);
  const end = source.indexOf(endNeedle, start);
  if (end < 0) throw new Error(`End anchor not found: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// ---------------------------------------------------------------------------
// 1) PLAYER-ORIGIN SKILL GUIDE
// v0.5.3 correctly made the SKILL BUTTON behave like a directional joystick,
// but its visible arrow also grew out of the button. That is not the combat
// language we want: the finger chooses intent at the button, while the spell
// itself originates from the avatar. Keep the input math and target lane intact,
// but render the guide from the player's on-screen combat anchor.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  const methodStart = '  private highflyPaintSkillStick(';
  const methodEnd = '\n  private highflyHideSkillStick(): void {';
  const newMethod = `  private highflyPaintSkillStick(\n    barSlot: number,\n    screenDx: number,\n    screenDy: number,\n    hasTarget: boolean,\n  ): void {\n    const stick = this.highflyEnsureSkillStick();\n    const resolved = this.highflyExplicitAimDef(barSlot);\n    const range = Math.max(6, resolved?.def.range ?? 12);\n\n    // In ClaudeCraft's third-person mobile camera the avatar is intentionally\n    // framed slightly below screen centre. Anchor the targeting lane there so\n    // the visible projectile/range language always begins at the PLAYER, never\n    // at the thumb or skill button.\n    const x = window.innerWidth * 0.5;\n    const y = window.innerHeight * 0.58;\n    const angle = Math.atan2(screenDy, screenDx);\n\n    // Visual range is proportional to the actual ability range, capped so the\n    // lane remains readable on S23-class landscape screens.\n    const maxVisual = Math.min(270, window.innerWidth * 0.3);\n    const length = Math.max(105, Math.min(maxVisual, range * 7.2));\n\n    stick.style.left = String(x) + 'px';\n    stick.style.top = String(y) + 'px';\n    stick.style.width = String(length) + 'px';\n    stick.style.transform = 'translateY(-50%) rotate(' + String(angle) + 'rad)';\n    stick.dataset.range = String(Math.round(range)) + 'm';\n    stick.classList.add('active');\n    stick.classList.toggle('has-target', hasTarget);\n  }\n`;

  source = replaceBetween(source, methodStart, methodEnd, newMethod, 'player-origin skill guide method');
  source = replaceRequired(
    source,
    '        this.highflyPaintSkillStick(button, dx, dy, candidate !== null);',
    '        this.highflyPaintSkillStick(slot, dx, dy, candidate !== null);',
    'player-origin skill guide call',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) PLAYER-ORIGIN DASH GUIDE
// The dash direction itself already works and remains untouched. Only move the
// directional feedback from the DASH button to the player's combat anchor.
// ---------------------------------------------------------------------------
{
  const path = 'src/game/mobile_controls.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `      if (Math.hypot(dx, dy) >= 4) {\n        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;\n        button.style.setProperty('--highfly-dash-angle', String(angle) + 'deg');\n      }`,
    `      const distance = Math.hypot(dx, dy);\n      if (distance >= 4) {\n        const angle = Math.atan2(dy, dx);\n        let guide = document.getElementById('highfly-dash-guide') as HTMLDivElement | null;\n        if (!guide) {\n          guide = document.createElement('div');\n          guide.id = 'highfly-dash-guide';\n          guide.setAttribute('aria-hidden', 'true');\n          document.body.appendChild(guide);\n        }\n        guide.style.left = String(window.innerWidth * 0.5) + 'px';\n        guide.style.top = String(window.innerHeight * 0.58) + 'px';\n        guide.style.width = String(Math.max(62, Math.min(108, distance))) + 'px';\n        guide.style.transform = 'translateY(-50%) rotate(' + String(angle) + 'rad)';\n        guide.classList.add('active');\n      }`,
    'dash guide from player',
  );

  source = replaceRequired(
    source,
    `      button.classList.remove('highfly-aiming');\n      button.style.removeProperty('--highfly-dash-angle');\n      try { button.releasePointerCapture(event.pointerId); } catch { /* already released */ }`,
    `      button.classList.remove('highfly-aiming');\n      button.style.removeProperty('--highfly-dash-angle');\n      document.getElementById('highfly-dash-guide')?.classList.remove('active');\n      try { button.releasePointerCapture(event.pointerId); } catch { /* already released */ }`,
    'dash guide cleanup',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) S23 CREATOR CONTAINMENT + CLEAN ENTER WORLD
// Remove the extra framed dock around ENTER WORLD, keep only the actual action,
// reserve its space inside the left column, and hard-contain the preview/details
// column so class text/canvas cannot bleed off the right edge.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);

  css += `

/* HIGHFLY v0.5.4 — final S23 creator containment + player-origin combat guides. */
@media (orientation: landscape) and (max-height: 820px) {
  body.native-app.mobile-touch #offline-select.highfly-native-creator:not([hidden]) {
    box-sizing: border-box !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-layout {
    width: 100% !important;
    max-width: 100% !important;
    grid-template-columns: minmax(0, 1.34fr) minmax(0, 0.86fr) !important;
    gap: 10px !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-left,
  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-right {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .char-create {
    position: relative !important;
    min-width: 0 !important;
    max-width: 100% !important;
    padding-bottom: 40px !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-pages,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-page {
    min-width: 0 !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance {
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
    padding-bottom: 4px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-right {
    display: grid !important;
    grid-template-rows: minmax(150px, 0.92fr) minmax(128px, 1.08fr) !important;
    gap: 6px !important;
    padding-right: 0 !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .char-preview-container,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-preview-container {
    box-sizing: border-box !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    height: auto !important;
    min-height: 150px !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-preview-container canvas {
    max-width: 100% !important;
    max-height: 100% !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .class-details-panel {
    box-sizing: border-box !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    min-height: 0 !important;
    margin-top: 0 !important;
    padding: 7px 9px 10px !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    font-size: 12px !important;
    line-height: 1.25 !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .class-details-panel h2 {
    margin: 0 0 3px !important;
    font-size: 21px !important;
    line-height: 1.05 !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .class-details-panel p {
    margin: 4px 0 !important;
  }

  /* The wrapper becomes invisible. Only ENTER WORLD remains visible. */
  body.native-app.mobile-touch #offline-select.highfly-native-creator .auth-actions {
    position: absolute !important;
    left: 50% !important;
    right: auto !important;
    bottom: 1px !important;
    transform: translateX(-50%) !important;
    z-index: 25 !important;
    display: block !important;
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    overflow: visible !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-start-offline,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-start-offline:focus,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-start-offline:focus-visible {
    width: auto !important;
    min-width: 158px !important;
    height: 32px !important;
    min-height: 32px !important;
    padding: 0 22px !important;
    border: 1px solid rgba(188, 146, 54, 0.82) !important;
    border-radius: 999px !important;
    outline: none !important;
    background: linear-gradient(180deg, rgba(93, 68, 18, 0.98), rgba(39, 29, 11, 0.98)) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 225, 145, 0.14) !important;
    color: #f7d56a !important;
    font-size: 11.5px !important;
    line-height: 30px !important;
    white-space: nowrap !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-offline-back {
    display: none !important;
  }
}

/* Skill button = INPUT joystick. Visible spell lane = PLAYER origin. */
body.native-app.mobile-touch #highfly-skill-stick {
  position: fixed !important;
  z-index: 94 !important;
  display: block !important;
  height: 9px !important;
  border: 1px solid rgba(255, 201, 75, 0.9) !important;
  border-radius: 999px !important;
  transform-origin: 0 50% !important;
  pointer-events: none !important;
  opacity: 0 !important;
  background: linear-gradient(90deg, rgba(255, 205, 77, 0.25), rgba(255, 191, 49, 0.92)) !important;
  box-shadow: 0 0 12px rgba(255, 174, 36, 0.6), inset 0 0 7px rgba(255, 238, 175, 0.35) !important;
  transition: opacity 70ms linear !important;
}

body.native-app.mobile-touch #highfly-skill-stick.active {
  opacity: 0.96 !important;
}

body.native-app.mobile-touch #highfly-skill-stick.has-target {
  border-color: rgba(133, 255, 146, 0.95) !important;
  background: linear-gradient(90deg, rgba(119, 255, 136, 0.22), rgba(111, 245, 129, 0.92)) !important;
  box-shadow: 0 0 14px rgba(102, 255, 126, 0.68), inset 0 0 7px rgba(224, 255, 229, 0.36) !important;
}

body.native-app.mobile-touch #highfly-skill-stick::after {
  content: '' !important;
  position: absolute !important;
  right: -13px !important;
  top: 50% !important;
  width: 0 !important;
  height: 0 !important;
  border-top: 10px solid transparent !important;
  border-bottom: 10px solid transparent !important;
  border-left: 18px solid rgba(255, 198, 64, 0.98) !important;
  transform: translateY(-50%) !important;
  filter: drop-shadow(0 0 4px rgba(255, 176, 34, 0.72)) !important;
}

body.native-app.mobile-touch #highfly-skill-stick.has-target::after {
  border-left-color: rgba(112, 255, 132, 0.98) !important;
}

body.native-app.mobile-touch #highfly-skill-stick::before {
  content: attr(data-range) !important;
  position: absolute !important;
  right: 4px !important;
  top: -23px !important;
  padding: 2px 6px !important;
  border-radius: 7px !important;
  background: rgba(7, 8, 13, 0.84) !important;
  color: #f9df8d !important;
  font: 700 10px/1.1 sans-serif !important;
  letter-spacing: 0.4px !important;
  white-space: nowrap !important;
}

/* Old button-origin DASH pseudo-arrow is disabled; feedback now starts at player. */
body.native-app.mobile-touch #mobile-dash.highfly-aiming::before,
body.native-app.mobile-touch #mobile-dash.highfly-aiming::after {
  display: none !important;
}

body.native-app.mobile-touch #highfly-dash-guide {
  position: fixed !important;
  z-index: 94 !important;
  display: block !important;
  height: 7px !important;
  border-radius: 999px !important;
  transform-origin: 0 50% !important;
  pointer-events: none !important;
  opacity: 0 !important;
  background: linear-gradient(90deg, rgba(118, 186, 255, 0.28), rgba(113, 176, 255, 0.95)) !important;
  box-shadow: 0 0 12px rgba(91, 159, 255, 0.72) !important;
}

body.native-app.mobile-touch #highfly-dash-guide.active {
  opacity: 0.95 !important;
}

body.native-app.mobile-touch #highfly-dash-guide::after {
  content: '' !important;
  position: absolute !important;
  right: -12px !important;
  top: 50% !important;
  width: 0 !important;
  height: 0 !important;
  border-top: 9px solid transparent !important;
  border-bottom: 9px solid transparent !important;
  border-left: 16px solid rgba(119, 181, 255, 0.98) !important;
  transform: translateY(-50%) !important;
  filter: drop-shadow(0 0 4px rgba(91, 159, 255, 0.7)) !important;
}
`;

  write(path, css);
}

console.log('[HIGHFLY] v0.5.4 player-origin aim + creator containment complete');

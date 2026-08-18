import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY] wrote ${path}`);
}

function patch(path, fn) {
  const before = read(path);
  const after = fn(before);
  if (after === before) throw new Error(`No changes applied to ${path}`);
  fs.writeFileSync(path, after, 'utf8');
  console.log(`[HIGHFLY] patched ${path}`);
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// ---------------------------------------------------------------------------
// HIGHFLY native identity + direct offline entry + standalone DASH callback.
// ClaudeCraft's original class roster is intentionally untouched.
// ---------------------------------------------------------------------------
patch('src/main.ts', (s) => {
  let out = s;
  out = replaceRequired(
    out,
    "import './styles/index.css';",
    "import './styles/index.css';\nimport './styles/highfly.native.css';",
    'HIGHFLY native stylesheet import',
  );

  const oldGate = '  const offlineAvailable = isOfflineModeAvailable(import.meta.env.DEV);';
  const newGate =
    "  const offlineAvailable = isOfflineModeAvailable(import.meta.env.DEV) || (NATIVE_APP && import.meta.env.VITE_HIGHFLY_OFFLINE === '1');";
  out = replaceRequired(out, oldGate, newGate, 'native offline gate');

  out = replaceRequired(
    out,
    '    onJump: () => input.triggerTouchJump(),',
    '    onJump: () => input.triggerTouchJump(),\n    onDash: () => input.triggerTouchDash(),',
    'mobile dash callback',
  );

  const backAnchor =
    "  if (offlineBackBtn) offlineBackBtn.addEventListener('click', handleOfflineBack);";
  out = replaceRequired(
    out,
    backAnchor,
    `${backAnchor}\n\n  // HIGHFLY native is a local-first game shell: skip the ClaudeCraft online/offline\n  // landing choice and open the original full character creator directly.\n  if (NATIVE_APP && import.meta.env.VITE_HIGHFLY_OFFLINE === '1') {\n    queueMicrotask(handleOfflineSelect);\n  }`,
    'direct native offline creator entry',
  );
  return out;
});

// ---------------------------------------------------------------------------
// Dedicated DASH control. It is deliberately NOT an action-bar slot.
// ---------------------------------------------------------------------------
patch('src/game/mobile_controls.ts', (s) => {
  let out = s;
  out = replaceRequired(
    out,
    '  onJump(): void;\n  onInteract(): void;',
    '  onJump(): void;\n  /** HIGHFLY locomotion action; never consumes an ability slot. */\n  onDash(): void;\n  onInteract(): void;',
    'MobileControlCallbacks.onDash',
  );
  out = replaceRequired(
    out,
    "    this.bindButton('mobile-jump', () => this.callbacks.onJump(), { pressFirst: true });",
    "    this.bindButton('mobile-jump', () => this.callbacks.onJump(), { pressFirst: true });\n    this.bindButton('mobile-dash', () => this.callbacks.onDash(), { pressFirst: true });",
    'mobile dash button binding',
  );
  return out;
});

// Latch a touch dash just like jump so a quick tap cannot fall between 20 Hz sim ticks.
patch('src/game/input.ts', (s) => {
  let out = s;
  out = replaceRequired(
    out,
    'const TOUCH_JUMP_LATCH_MS = 220;',
    'const TOUCH_JUMP_LATCH_MS = 220;\nconst TOUCH_DASH_LATCH_MS = 180;',
    'touch dash latch constant',
  );
  out = replaceRequired(
    out,
    '  private touchJumpUntil = 0;',
    '  private touchJumpUntil = 0;\n  private touchDashUntil = 0;',
    'touch dash state',
  );
  out = replaceRequired(
    out,
    '    this.touchJumpUntil = 0;',
    '    this.touchJumpUntil = 0;\n    this.touchDashUntil = 0;',
    'touch dash reset',
  );
  const jumpMethod = `  triggerTouchJump(): void {\n    this.touchJumpUntil = Math.max(this.touchJumpUntil, performance.now() + TOUCH_JUMP_LATCH_MS);\n  }`;
  out = replaceRequired(
    out,
    jumpMethod,
    `${jumpMethod}\n\n  /** HIGHFLY directional dodge/dash input. Collision and cooldown live in Sim. */\n  triggerTouchDash(): void {\n    this.touchDashUntil = Math.max(this.touchDashUntil, performance.now() + TOUCH_DASH_LATCH_MS);\n    this.noteMovementIntent();\n  }`,
    'triggerTouchDash',
  );

  const jumpRead = `    const jump =\n      this.keybinds.codesForAction('jump').some((c) => this.keys.has(comboCode(c))) ||\n      performance.now() <= this.touchJumpUntil ||\n      performance.now() <= this.keyJumpUntil;`;
  out = replaceRequired(
    out,
    jumpRead,
    `${jumpRead}\n    const dash = performance.now() <= this.touchDashUntil;`,
    'dash readMoveInput latch',
  );

  // readMoveInput has two active return paths (Mouse Camera and classic). Add dash
  // beside jump in both without changing keyboard/controller semantics.
  const beforeReturns = out;
  out = out.replace(/(\n\s+jump,\n)(\s+dive,)/g, '$1      dash,\n$2');
  if (out === beforeReturns) throw new Error('Anchor not found: readMoveInput dash return');
  return out;
});

// Wire shape remains backward-compatible: dash is optional for old clients/bots.
patch('src/sim/types.ts', (s) => {
  let out = s;
  out = replaceRequired(
    out,
    '  jump: boolean;\n  /** Swim DOWN.',
    '  jump: boolean;\n  /** HIGHFLY locomotion action. Optional keeps old wire/test inputs compatible. */\n  dash?: boolean;\n  /** Swim DOWN.',
    'MoveInput.dash',
  );
  out = replaceRequired(
    out,
    '    jump: false,\n    dive: false,',
    '    jump: false,\n    dash: false,\n    dive: false,',
    'emptyMoveInput dash',
  );
  out = replaceRequired(
    out,
    'export interface Entity extends ClientMirroredEntityFields {\n  guardianState?: GuardianState;',
    `export interface Entity extends ClientMirroredEntityFields {\n  /** HIGHFLY transient locomotion state; not persisted and not class-specific. */\n  highflyDashTime?: number;\n  highflyDashCooldown?: number;\n  highflyDashLocalX?: number;\n  highflyDashLocalZ?: number;\n  guardianState?: GuardianState;`,
    'Entity HIGHFLY dash state',
  );
  return out;
});

patch('src/sim/move_input.ts', (s) =>
  replaceRequired(
    s,
    "  ['jump', 'j'],\n  ['dive', 'dv'],",
    "  ['jump', 'j'],\n  ['dash', 'ds'],\n  ['dive', 'dv'],",
    'dash move wire field',
  ),
);

// HIGHFLY movement keeps ClaudeCraft physics/collision, but removes classic
// backpedal presentation and adds a short, collision-aware directional dash.
patch('src/sim/player_motion.ts', (s) => {
  let out = s;
  out = replaceRequired(
    out,
    'export const BACKPEDAL_MULT = 0.65;',
    `export const BACKPEDAL_MULT = 1;\nexport const HIGHFLY_DASH_DURATION = 0.18;\nexport const HIGHFLY_DASH_COOLDOWN = 0.8;\nexport const HIGHFLY_DASH_SPEED_MULT = 2.6;`,
    'HIGHFLY movement constants',
  );

  const flags = `  if (inp.forward) mz += 1;\n  if (inp.back) mz -= 1;\n  if (inp.strafeLeft) mx -= 1;\n  if (inp.strafeRight) mx += 1;`;
  out = replaceRequired(
    out,
    flags,
    `${flags}\n\n  // Cooldown and travel state are simulation-owned, so the dash uses the same\n  // swept collisions, slopes and instance bounds as ordinary movement. Capture\n  // its direction once at press time so releasing the joystick cannot bend it.\n  p.highflyDashTime = Math.max(0, (p.highflyDashTime ?? 0) - DT);\n  p.highflyDashCooldown = Math.max(0, (p.highflyDashCooldown ?? 0) - DT);\n  if (\n    inp.dash &&\n    (p.highflyDashCooldown ?? 0) <= 0 &&\n    !isStunned(p) &&\n    !isRooted(p) &&\n    p.onGround\n  ) {\n    let dx = mx;\n    let dz = mz;\n    if (dx === 0 && dz === 0) dz = 1;\n    const dlen = Math.hypot(dx, dz);\n    p.highflyDashLocalX = dx / dlen;\n    p.highflyDashLocalZ = dz / dlen;\n    p.highflyDashTime = HIGHFLY_DASH_DURATION;\n    p.highflyDashCooldown = HIGHFLY_DASH_COOLDOWN;\n  }\n  if ((p.highflyDashTime ?? 0) > 0) {\n    mx = p.highflyDashLocalX ?? 0;\n    mz = p.highflyDashLocalZ ?? 1;\n  }`,
    'HIGHFLY dash movement state',
  );

  out = replaceRequired(
    out,
    '    if (mz < 0) speed *= BACKPEDAL_MULT;\n    if (swimming) speed *= swimSpeedMult(p.swimStroke, submerged);',
    '    if (mz < 0) speed *= BACKPEDAL_MULT;\n    if ((p.highflyDashTime ?? 0) > 0) speed *= HIGHFLY_DASH_SPEED_MULT;\n    if (swimming) speed *= swimSpeedMult(p.swimStroke, submerged);',
    'HIGHFLY dash speed',
  );
  return out;
});

// Render the character toward every travel direction, including pure reverse
// and pure strafe. Gameplay mechanics/classes stay exactly ClaudeCraft's.
patch('src/game/movement_visual.ts', (s) => {
  let out = s;
  out = out.replace(
    '  // Preserve classic pure strafe/backpedal presentation; only combined diagonal\n  // travel gets a visual yaw override.\n  if (mx === 0 || mz === 0) return null;',
    '  // HIGHFLY action locomotion: face the actual travel vector in all 360 degrees.\n  if (mx === 0 && mz === 0) return null;',
  );
  if (out === s) throw new Error('Anchor not found: 360-degree movement visual facing');
  return out;
});

// ---------------------------------------------------------------------------
// Native HTML: standalone dash button + HIGHFLY visible branding.
// ---------------------------------------------------------------------------
for (const html of ['index.html', 'play.html']) {
  if (!fs.existsSync(html)) continue;
  patch(html, (s) => {
    let out = s;
    const pageToggle = '      <button type="button" id="mobile-action-page-toggle"';
    if (out.includes(pageToggle)) {
      out = out.replace(
        pageToggle,
        '      <button type="button" id="mobile-dash" title="Esquivar / Dash" aria-label="Esquivar / Dash"><span class="mobile-label">DASH</span></button>\n' +
          pageToggle,
      );
    }
    out = out
      .replaceAll('World of ClaudeCraft', 'HIGHFLY NEXT CORE')
      .replaceAll('World of Claudecraft', 'HIGHFLY NEXT CORE')
      .replaceAll('/worldofclaudecraft-logo.png', '/highfly-mark.svg')
      .replaceAll('class="header-logo" src="/icon-192.png"', 'class="header-logo" src="/highfly-mark.svg"');
    return out;
  });
}

write(
  'public/highfly-mark.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="HIGHFLY">\n  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#36d7ff"/><stop offset="0.52" stop-color="#7067ff"/><stop offset="1" stop-color="#a839ff"/></linearGradient></defs>\n  <path fill="#070912" d="M256 22 466 143v226L256 490 46 369V143z"/>\n  <path fill="none" stroke="url(#g)" stroke-width="24" d="M256 48 442 155v202L256 464 70 357V155z"/>\n  <path fill="url(#g)" d="M145 150h48v82h126v-82h48v212h-48v-86H193v86h-48z"/>\n</svg>\n`,
);

write(
  'src/styles/highfly.native.css',
  `/* HIGHFLY native-only overrides. Kept separate from ClaudeCraft's upstream CSS. */\nbody.native-app:not(.game-active) .homepage-header,\nbody.native-app:not(.game-active) #intro-logo,\nbody.native-app #btn-offline-back {\n  display: none !important;\n}\n\n/* S23-class landscape creator: use the whole app viewport, no desktop page shell. */\n@media (orientation: landscape) and (max-height: 940px) {\n  body.native-app:not(.game-active) #start-screen {\n    position: fixed !important;\n    inset: 0 !important;\n    width: 100vw !important;\n    height: 100dvh !important;\n    min-height: 0 !important;\n    padding: max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left)) !important;\n    overflow: hidden !important;\n    align-items: stretch !important;\n    justify-content: stretch !important;\n  }\n\n  body.native-app #offline-select {\n    position: relative !important;\n    inset: auto !important;\n    width: 100% !important;\n    max-width: none !important;\n    height: 100% !important;\n    max-height: none !important;\n    min-height: 0 !important;\n    margin: 0 !important;\n    padding: 10px 12px !important;\n    overflow: hidden !important;\n    box-sizing: border-box !important;\n  }\n\n  body.native-app #offline-select > .auth-title {\n    margin: 0 0 7px !important;\n    font-size: clamp(20px, 3.2vh, 29px) !important;\n    line-height: 1.05 !important;\n  }\n\n  body.native-app #offline-select .charselect-layout {\n    display: grid !important;\n    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr) !important;\n    gap: 10px !important;\n    height: calc(100% - 38px) !important;\n    min-height: 0 !important;\n    overflow: hidden !important;\n  }\n\n  body.native-app #offline-select .charselect-col-left,\n  body.native-app #offline-select .charselect-col-right,\n  body.native-app #offline-select .char-create {\n    min-width: 0 !important;\n    min-height: 0 !important;\n    max-width: none !important;\n  }\n\n  body.native-app #offline-select .charselect-col-left {\n    overflow-y: auto !important;\n    overflow-x: hidden !important;\n    padding-right: 5px !important;\n    scrollbar-width: thin !important;\n  }\n\n  body.native-app #offline-select .mini-class-row {\n    display: grid !important;\n    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;\n    gap: 5px !important;\n    width: 100% !important;\n  }\n\n  body.native-app #offline-select .mini-class {\n    min-width: 0 !important;\n    min-height: 42px !important;\n    padding: 5px 7px !important;\n    font-size: clamp(11px, 1.75vh, 15px) !important;\n  }\n\n  body.native-app #offline-appearance {\n    min-width: 0 !important;\n    max-width: 100% !important;\n    overflow: hidden !important;\n  }\n\n  body.native-app #offline-appearance .ac-tabs {\n    display: grid !important;\n    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;\n    gap: 3px !important;\n    width: 100% !important;\n    overflow: hidden !important;\n  }\n\n  body.native-app #offline-appearance .ac-tab {\n    min-width: 0 !important;\n    padding: 8px 3px !important;\n    font-size: clamp(10px, 1.6vh, 14px) !important;\n    white-space: nowrap !important;\n  }\n\n  body.native-app #offline-appearance .ac-pages {\n    min-width: 0 !important;\n    max-height: 31vh !important;\n    overflow: auto !important;\n  }\n\n  body.native-app #offline-select .charselect-col-right {\n    display: grid !important;\n    grid-template-rows: minmax(0, 0.55fr) minmax(0, 0.45fr) !important;\n    gap: 8px !important;\n    overflow: hidden !important;\n  }\n\n  body.native-app #offline-preview-container,\n  body.native-app #offline-class-details {\n    min-width: 0 !important;\n    min-height: 0 !important;\n    height: auto !important;\n    max-height: none !important;\n    margin: 0 !important;\n  }\n\n  body.native-app #offline-preview-container {\n    overflow: hidden !important;\n  }\n\n  body.native-app #offline-class-details {\n    overflow: auto !important;\n    padding: 10px 12px !important;\n  }\n\n  body.native-app #offline-select .auth-actions {\n    position: sticky !important;\n    bottom: 0 !important;\n    z-index: 4 !important;\n    margin-top: 6px !important;\n    padding: 6px 0 2px !important;\n    background: linear-gradient(180deg, transparent, #090a12 24%) !important;\n  }\n\n  body.native-app #btn-start-offline {\n    width: 100% !important;\n    min-height: 44px !important;\n  }\n}\n\n/* Independent locomotion button: no data-mobile-index, therefore no skill slot. */\nbody.mobile-touch #mobile-action-ring #mobile-dash {\n  position: absolute;\n  right: calc(var(--mobile-ring-attack-size) + 70px);\n  bottom: calc(var(--mobile-ring-secondary-size) + 64px);\n  width: max(48px, var(--mobile-ring-secondary-size));\n  height: max(48px, var(--mobile-ring-secondary-size));\n  border-radius: 50%;\n  pointer-events: auto;\n  touch-action: none;\n  color: #d8efff;\n  border: 2px solid #596ee0;\n  background: radial-gradient(circle at 35% 30%, #263d82e8, #11172ee8 72%);\n  box-shadow: 0 0 0 1px #0009, inset 0 1px 0 #ffffff24, 0 0 15px #596ee066;\n  font: 700 9px/1 var(--ui-font);\n  letter-spacing: .08em;\n  z-index: 4;\n}\nbody.mobile-touch #mobile-action-ring #mobile-dash::before {\n  content: '➤➤';\n  display: block;\n  margin-bottom: 2px;\n  font-size: 15px;\n  letter-spacing: -5px;\n  transform: translateX(-2px);\n}\nbody.mobile-touch #mobile-action-ring #mobile-dash:active {\n  transform: scale(.92);\n  border-color: #80e6ff;\n  box-shadow: 0 0 18px #5cdfffaa;\n}\nbody.mobile-touch #mobile-action-ring #mobile-dash .mobile-label {\n  display: block !important;\n  color: #d8efff !important;\n  font-size: 8px !important;\n}\n`,
);

// Native application identity. Keep upstream namespace/package internals for now;
// applicationId can differ safely and lets HIGHFLY install as its own Android app.
patch('capacitor.config.ts', (s) => {
  let out = s;
  out = out.replace(/appId:\s*['"]com\.worldofclaudecraft['"]/, "appId: 'com.highfly.nextcore'");
  out = out.replace(/appName:\s*['"]World of ClaudeCraft['"]/, "appName: 'HIGHFLY NEXT CORE'");
  out = out.replace(
    /CapacitorUpdater:\s*\{[\s\S]*?\n\s*\},/,
    "CapacitorUpdater: {\n      autoUpdate: false,\n      statsUrl: '',\n    },",
  );
  return out;
});

const gradle = 'android/app/build.gradle';
if (fs.existsSync(gradle)) {
  const before = read(gradle);
  const after = before.replace(
    /applicationId\s+["']com\.worldofclaudecraft["']/,
    'applicationId "com.highfly.nextcore"',
  );
  if (after !== before) fs.writeFileSync(gradle, after, 'utf8');
}

const strings = 'android/app/src/main/res/values/strings.xml';
if (fs.existsSync(strings)) {
  const s = read(strings);
  const out = s
    .replaceAll('World of ClaudeCraft', 'HIGHFLY NEXT CORE')
    .replaceAll('World of Claudecraft', 'HIGHFLY NEXT CORE');
  fs.writeFileSync(strings, out, 'utf8');
}

// Hard guard: the original nine ClaudeCraft classes must still exist untouched.
const types = read('src/sim/types.ts');
for (const cls of ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid']) {
  if (!types.includes(`'${cls}'`)) throw new Error(`Original ClaudeCraft class missing: ${cls}`);
}

console.log('[HIGHFLY] v0.4 native mobility patch complete');

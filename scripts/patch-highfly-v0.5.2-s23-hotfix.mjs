import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.5.2] patched ${path}`);
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// ---------------------------------------------------------------------------
// 1) LOCOMOTION HOTFIX
// v0.5.0 fed the camera-relative visual resolver back into authoritative facing.
// On touch that can create a feedback loop and make the avatar spin while moving.
// Keep the proven v0.4 360-degree visual movement, but restore ClaudeCraft's
// stable authoritative facing inputs.
// ---------------------------------------------------------------------------
{
  const path = 'src/main.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `        // HIGHFLY action locomotion: commit travel direction to gameplay facing.\n        // movement_visual already resolves the camera-relative 360-degree vector;\n        // using it here means releasing the stick preserves that heading instead\n        // of visually snapping back to the camera forward axis. The original\n        // authoritative player facing is the final non-null fallback for TS and\n        // for frames where neither camera nor resolver supplied a heading.\n        const highflyTravelFacing = visualFacingFor(\n          mi,\n          movementFacing ?? facing ?? offlineSim.player.facing,\n        );\n        const stepFacing = highflyTravelFacing ?? movementFacing ?? facing;`,
    '        const stepFacing = movementFacing ?? facing;',
    'restore stable offline facing',
  );

  source = replaceRequired(
    source,
    `    // Mirror the same action-facing rule on the network client path.\n    const highflyTravelFacing = visualFacingFor(\n      resolved.mi,\n      movementFacing ?? resolved.facing ?? world.player.facing,\n    );\n    const foreignFacing = highflyTravelFacing ?? movementFacing ?? resolved.facing;`,
    '    const foreignFacing = movementFacing ?? resolved.facing;',
    'restore stable online facing',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) EXPLICIT MOBILE SKILL AIM
// Position/AoE skills keep ClaudeCraft's authoritative ground reticle from v0.5.1.
// Targeted hostile skills now get a clear two-step camera aim on Android:
// first tap arms the skill and shows a centre reticle; rotate the camera; second
// tap locks the hostile nearest the reticle and casts through the original sim.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    '  private highflyAimFacing: number | null = null;',
    `  private highflyAimFacing: number | null = null;\n  private highflyAimSlot: number | null = null;\n  private highflyAimTargetId: number | null = null;\n  private highflyAimOverlay: HTMLDivElement | null = null;`,
    'explicit skill aim state',
  );

  const oldSetter = `  /** Native camera heading used by tap-to-soft-aim. */\n  setHighflyAimFacing(facing: number): void {\n    this.highflyAimFacing = Number.isFinite(facing) ? facing : null;\n  }`;
  const newSetter = `  /** Native camera heading used by HIGHFLY explicit touch aiming. */\n  setHighflyAimFacing(facing: number): void {\n    this.highflyAimFacing = Number.isFinite(facing) ? facing : null;\n    if (this.highflyAimSlot !== null) this.highflyRefreshSkillAim();\n  }\n\n  private highflyEnsureAimOverlay(): HTMLDivElement {\n    if (this.highflyAimOverlay?.isConnected) return this.highflyAimOverlay;\n    const overlay = document.createElement('div');\n    overlay.id = 'highfly-skill-aim';\n    overlay.setAttribute('aria-hidden', 'true');\n    overlay.innerHTML =\n      '<span class="highfly-skill-aim-reticle"></span><span class="highfly-skill-aim-label"></span>';\n    document.body.appendChild(overlay);\n    this.highflyAimOverlay = overlay;\n    return overlay;\n  }\n\n  private highflyExplicitAimDef(barSlot: number): ResolvedAbility | null {\n    const resolved = this.abilityForSlot(barSlot);\n    if (!resolved) return null;\n    const def = resolved.def;\n    if (!def.requiresTarget || def.targetType === 'friendly' || def.targetsDead || def.targetMode === 'position') {\n      return null;\n    }\n    return resolved;\n  }\n\n  private highflyPickAimTarget(barSlot: number): number | null {\n    const resolved = this.highflyExplicitAimDef(barSlot);\n    if (!resolved) return null;\n    const player = this.sim.player;\n    const def = resolved.def;\n    const aimFacing = this.highflyAimFacing ?? player.facing;\n    const maxRange = Math.max(8, (def.range ?? 0) + 4);\n    const halfCone = 0.42; // ~24 degrees either side.\n    let bestId: number | null = null;\n    let bestScore = Number.POSITIVE_INFINITY;\n\n    for (const entity of this.sim.entities.values()) {\n      if (entity.id === player.id || entity.dead) continue;\n      const hostile =\n        entity.hostile || isPvpHostileTarget(entity.id, this.sim.duelInfo, this.sim.arenaInfo);\n      if (!hostile) continue;\n      const dx = entity.pos.x - player.pos.x;\n      const dz = entity.pos.z - player.pos.z;\n      const distance = Math.hypot(dx, dz);\n      if (distance <= 0.001 || distance > maxRange) continue;\n      const bearing = Math.atan2(dx, dz);\n      const diff = Math.abs(Math.atan2(Math.sin(bearing - aimFacing), Math.cos(bearing - aimFacing)));\n      if (diff > halfCone) continue;\n      const score = diff * 20 + distance * 0.05;\n      if (score < bestScore) {\n        bestId = entity.id;\n        bestScore = score;\n      }\n    }\n    return bestId;\n  }\n\n  private highflyRefreshSkillAim(): void {\n    if (this.highflyAimSlot === null) return;\n    const overlay = this.highflyEnsureAimOverlay();\n    const targetId = this.highflyPickAimTarget(this.highflyAimSlot);\n    this.highflyAimTargetId = targetId;\n    overlay.classList.add('active');\n    overlay.classList.toggle('has-target', targetId !== null);\n    const label = overlay.querySelector('.highfly-skill-aim-label');\n    if (label) {\n      label.textContent =\n        targetId === null\n          ? 'SKILL ' + this.highflyAimSlot + ' · APUNTÁ CON LA CÁMARA'\n          : 'SKILL ' + this.highflyAimSlot + ' · OBJETIVO LISTO · TOCÁ DE NUEVO';\n    }\n  }\n\n  private highflyCancelSkillAim(): void {\n    this.highflyAimSlot = null;\n    this.highflyAimTargetId = null;\n    this.highflyAimOverlay?.classList.remove('active', 'has-target');\n  }\n\n  /** Return true when this tap was consumed by the explicit aiming state. */\n  private highflyHandleExplicitAim(barSlot: number): boolean {\n    const resolved = this.highflyExplicitAimDef(barSlot);\n    if (!resolved) {\n      this.highflyCancelSkillAim();\n      return false;\n    }\n\n    if (this.highflyAimSlot !== barSlot) {\n      this.highflyAimSlot = barSlot;\n      this.highflyRefreshSkillAim();\n      return true;\n    }\n\n    this.highflyRefreshSkillAim();\n    const targetId = this.highflyAimTargetId;\n    if (targetId === null) return true;\n    this.sim.targetEntity(targetId);\n    this.highflyCancelSkillAim();\n    return false;\n  }`;
  source = replaceRequired(source, oldSetter, newSetter, 'explicit aim helpers');

  source = replaceRequired(
    source,
    `    if (\n      document.body.classList.contains('native-app') &&\n      document.body.classList.contains('mobile-touch') &&\n      !this.isGroundAimActive()\n    ) {\n      this.highflyAutoAimHostile(barSlot);\n    }\n    if (this.isGroundAimActive()) {`,
    `    if (\n      document.body.classList.contains('native-app') &&\n      document.body.classList.contains('mobile-touch') &&\n      !this.isGroundAimActive() &&\n      this.highflyHandleExplicitAim(barSlot)\n    ) {\n      return;\n    }\n    if (this.isGroundAimActive()) {`,
    'explicit aim before targeted mobile cast',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) DASH DIRECTION INDICATOR
// While dragging DASH, show an arrow toward the chosen screen direction.
// ---------------------------------------------------------------------------
{
  const path = 'src/game/mobile_controls.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `      lastX = event.clientX;\n      lastY = event.clientY;\n    });\n\n    const finish = (event: PointerEvent, cancelled: boolean): void => {`,
    `      lastX = event.clientX;\n      lastY = event.clientY;\n      const dx = lastX - startX;\n      const dy = lastY - startY;\n      if (Math.hypot(dx, dy) >= 4) {\n        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;\n        button.style.setProperty('--highfly-dash-angle', String(angle) + 'deg');\n      }\n    });\n\n    const finish = (event: PointerEvent, cancelled: boolean): void => {`,
    'dash drag angle visual',
  );

  source = replaceRequired(
    source,
    `      pointerId = null;\n      button.classList.remove('highfly-aiming');\n      try { button.releasePointerCapture(event.pointerId); } catch { /* already released */ }`,
    `      pointerId = null;\n      button.classList.remove('highfly-aiming');\n      button.style.removeProperty('--highfly-dash-angle');\n      try { button.releasePointerCapture(event.pointerId); } catch { /* already released */ }`,
    'dash indicator cleanup',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) S23 CREATOR / AIM / DASH VISUALS
// Keep the compact creator but guarantee ENTER WORLD is visible on S23 landscape.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.5.2 — S23 runtime hotfix. */
@media (orientation: landscape) {
  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-layout {
    padding-bottom: 40px !important;
    box-sizing: border-box !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .char-create {
    padding-bottom: 0 !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .auth-actions {
    position: fixed !important;
    left: 50% !important;
    right: auto !important;
    bottom: max(6px, env(safe-area-inset-bottom)) !important;
    transform: translateX(-50%) !important;
    z-index: 120 !important;
    display: flex !important;
    width: min(220px, 34vw) !important;
    height: 34px !important;
    min-height: 34px !important;
    margin: 0 !important;
    padding: 0 !important;
    border-radius: 9px !important;
    overflow: hidden !important;
    background: rgba(4, 8, 18, 0.94) !important;
    box-shadow: 0 0 0 1px rgba(90, 190, 255, 0.55), 0 8px 24px rgba(0, 0, 0, 0.4) !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-start-offline {
    display: block !important;
    width: 100% !important;
    height: 34px !important;
    min-height: 34px !important;
    padding: 2px 10px !important;
    font-size: 11px !important;
    line-height: 28px !important;
    font-weight: 800 !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-offline-back {
    display: none !important;
  }

  body.native-app.mobile-touch #mobile-dash.highfly-aiming {
    overflow: visible !important;
  }

  body.native-app.mobile-touch #mobile-dash.highfly-aiming::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 4px;
    height: 48px;
    border-radius: 4px;
    background: currentColor;
    opacity: 0.82;
    transform-origin: 50% 100%;
    transform: translate(-50%, -100%) rotate(var(--highfly-dash-angle, 0deg));
    pointer-events: none;
    filter: drop-shadow(0 0 5px currentColor);
  }

  body.native-app.mobile-touch #mobile-dash.highfly-aiming::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0;
    height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-bottom: 12px solid currentColor;
    transform-origin: 50% 36px;
    transform: translate(-50%, -44px) rotate(var(--highfly-dash-angle, 0deg));
    pointer-events: none;
    filter: drop-shadow(0 0 5px currentColor);
  }
}

body.native-app.mobile-touch #highfly-skill-aim {
  position: fixed;
  inset: 0;
  z-index: 88;
  display: none;
  pointer-events: none;
}

body.native-app.mobile-touch #highfly-skill-aim.active {
  display: block;
}

body.native-app.mobile-touch #highfly-skill-aim .highfly-skill-aim-reticle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 46px;
  height: 46px;
  transform: translate(-50%, -50%);
  border: 2px solid rgba(255, 190, 70, 0.86);
  border-radius: 50%;
  box-shadow: 0 0 12px rgba(255, 160, 45, 0.55), inset 0 0 10px rgba(255, 160, 45, 0.2);
}

body.native-app.mobile-touch #highfly-skill-aim .highfly-skill-aim-reticle::before,
body.native-app.mobile-touch #highfly-skill-aim .highfly-skill-aim-reticle::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  background: rgba(255, 215, 110, 0.95);
  transform: translate(-50%, -50%);
}

body.native-app.mobile-touch #highfly-skill-aim .highfly-skill-aim-reticle::before {
  width: 62px;
  height: 2px;
}

body.native-app.mobile-touch #highfly-skill-aim .highfly-skill-aim-reticle::after {
  width: 2px;
  height: 62px;
}

body.native-app.mobile-touch #highfly-skill-aim.has-target .highfly-skill-aim-reticle {
  border-width: 3px;
  transform: translate(-50%, -50%) scale(0.9);
  box-shadow: 0 0 18px currentColor, inset 0 0 14px rgba(255, 255, 255, 0.18);
}

body.native-app.mobile-touch #highfly-skill-aim .highfly-skill-aim-label {
  position: absolute;
  left: 50%;
  top: calc(50% + 38px);
  transform: translateX(-50%);
  min-width: 220px;
  max-width: 70vw;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(3, 7, 16, 0.8);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-align: center;
  color: #fff;
  text-shadow: 0 1px 2px #000;
  white-space: nowrap;
}
`;
  write(path, css);
}

console.log('[HIGHFLY] v0.5.2 S23 hotfix complete');

import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.5.3] patched ${path}`);
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// ---------------------------------------------------------------------------
// 1) MOBILE SKILL AIM — MOBA-style touch intent instead of centre-screen reticle.
//
// Targeted hostile skills now behave like a mobile action skill button:
// - quick TAP = assisted cast using the existing camera-cone soft aim;
// - HOLD/DRAG = directional manual aim from the skill button;
// - RELEASE = cast at the first hostile intersecting that aimed lane.
//
// This deliberately does NOT rewrite ClaudeCraft's class kits/damage/cooldowns.
// It changes only target acquisition before the original authoritative cast.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    '  private highflyAimOverlay: HTMLDivElement | null = null;',
    `  private highflyAimOverlay: HTMLDivElement | null = null;\n  private highflySkillStick: HTMLDivElement | null = null;\n  private highflyManualCommit = false;`,
    'manual skill aim state',
  );

  const explicitDefAnchor = `  private highflyExplicitAimDef(barSlot: number): ReturnType<Hud['abilityForSlot']> | null {`;
  const manualAimHelpers = `  /** Convert a drag on a right-side skill button into a camera-relative world heading. */\n  private highflyScreenAimFacing(screenDx: number, screenDy: number): number {\n    const length = Math.hypot(screenDx, screenDy);\n    if (length < 0.001) return this.highflyAimFacing ?? this.sim.player.facing;\n    const forward = -screenDy / length;\n    const right = screenDx / length;\n    const cameraFacing = this.highflyAimFacing ?? this.sim.player.facing;\n    const sin = Math.sin(cameraFacing);\n    const cos = Math.cos(cameraFacing);\n    const worldX = forward * sin - right * cos;\n    const worldZ = forward * cos + right * sin;\n    return Math.atan2(worldX, worldZ);\n  }\n\n  /**\n   * Pick the FIRST hostile in a narrow aimed lane, not merely the nearest hostile.\n   * That gives projectile-like skills the same intent as a manual direction shot:\n   * an enemy standing in front of another one wins the lane.\n   */\n  private highflyPickDirectionalTarget(barSlot: number, aimFacing: number): number | null {\n    const resolved = this.highflyExplicitAimDef(barSlot);\n    if (!resolved) return null;\n    const player = this.sim.player;\n    const maxRange = Math.max(8, (resolved.def.range ?? 0) + 3);\n    let bestId: number | null = null;\n    let bestScore = Number.POSITIVE_INFINITY;\n\n    for (const entity of this.sim.entities.values()) {\n      if (entity.id === player.id || entity.dead) continue;\n      const hostile =\n        entity.hostile || isPvpHostileTarget(entity.id, this.sim.duelInfo, this.sim.arenaInfo);\n      if (!hostile) continue;\n\n      const dx = entity.pos.x - player.pos.x;\n      const dz = entity.pos.z - player.pos.z;\n      const distance = Math.hypot(dx, dz);\n      if (distance <= 0.001 || distance > maxRange) continue;\n\n      const bearing = Math.atan2(dx, dz);\n      const diff = Math.atan2(Math.sin(bearing - aimFacing), Math.cos(bearing - aimFacing));\n      const forward = Math.cos(diff) * distance;\n      const lateral = Math.abs(Math.sin(diff) * distance);\n      if (forward <= 0) continue;\n\n      // Small near-player forgiveness, widening gently with distance like a\n      // touch projectile corridor rather than a giant tab-target cone.\n      const laneHalfWidth = Math.min(3.1, 1.35 + distance * 0.055);\n      if (lateral > laneHalfWidth) continue;\n\n      const score = forward + lateral * 7;\n      if (score < bestScore) {\n        bestId = entity.id;\n        bestScore = score;\n      }\n    }\n\n    return bestId;\n  }\n\n  private highflyEnsureSkillStick(): HTMLDivElement {\n    if (this.highflySkillStick?.isConnected) return this.highflySkillStick;\n    const stick = document.createElement('div');\n    stick.id = 'highfly-skill-stick';\n    stick.setAttribute('aria-hidden', 'true');\n    document.body.appendChild(stick);\n    this.highflySkillStick = stick;\n    return stick;\n  }\n\n  private highflyPaintSkillStick(\n    button: HTMLButtonElement,\n    screenDx: number,\n    screenDy: number,\n    hasTarget: boolean,\n  ): void {\n    const stick = this.highflyEnsureSkillStick();\n    const rect = button.getBoundingClientRect();\n    const x = rect.left + rect.width / 2;\n    const y = rect.top + rect.height / 2;\n    const rawLength = Math.hypot(screenDx, screenDy);\n    const length = Math.max(50, Math.min(126, rawLength));\n    const angle = Math.atan2(screenDy, screenDx);\n    stick.style.left = String(x) + 'px';\n    stick.style.top = String(y) + 'px';\n    stick.style.width = String(length) + 'px';\n    stick.style.transform = 'translateY(-50%) rotate(' + String(angle) + 'rad)';\n    stick.classList.add('active');\n    stick.classList.toggle('has-target', hasTarget);\n  }\n\n  private highflyHideSkillStick(): void {\n    this.highflySkillStick?.classList.remove('active', 'has-target');\n  }\n\n  /**\n   * Bind a hostile targeted skill as a mobile skill joystick. The capture-phase\n   * pointerdown owns only those skills; buffs/items/friendly actions retain all\n   * original ClaudeCraft touch handling and action-bar editing behavior.\n   */\n  private bindHighflyMobileSkillAim(\n    button: HTMLButtonElement,\n    getSlot: () => number,\n  ): void {\n    let pointerId: number | null = null;\n    let slot = -1;\n    let startX = 0;\n    let startY = 0;\n    let lastX = 0;\n    let lastY = 0;\n    let manual = false;\n    let swallowClickUntil = 0;\n\n    button.addEventListener(\n      'click',\n      (event) => {\n        if (Date.now() > swallowClickUntil) return;\n        event.preventDefault();\n        event.stopImmediatePropagation();\n      },\n      true,\n    );\n\n    button.addEventListener(\n      'pointerdown',\n      (event) => {\n        if (\n          event.pointerType !== 'touch' ||\n          !document.body.classList.contains('native-app') ||\n          !document.body.classList.contains('mobile-touch')\n        ) {\n          return;\n        }\n        const nextSlot = getSlot();\n        if (!this.highflyExplicitAimDef(nextSlot)) return;\n\n        event.preventDefault();\n        event.stopImmediatePropagation();\n        pointerId = event.pointerId;\n        slot = nextSlot;\n        startX = lastX = event.clientX;\n        startY = lastY = event.clientY;\n        manual = false;\n        this.highflyCancelSkillAim();\n        try { button.setPointerCapture(event.pointerId); } catch { /* optional */ }\n      },\n      true,\n    );\n\n    button.addEventListener(\n      'pointermove',\n      (event) => {\n        if (event.pointerId !== pointerId) return;\n        event.preventDefault();\n        event.stopImmediatePropagation();\n        lastX = event.clientX;\n        lastY = event.clientY;\n        const dx = lastX - startX;\n        const dy = lastY - startY;\n        if (!manual && Math.hypot(dx, dy) < 14) return;\n        manual = true;\n        const facing = this.highflyScreenAimFacing(dx, dy);\n        const candidate = this.highflyPickDirectionalTarget(slot, facing);\n        this.highflyPaintSkillStick(button, dx, dy, candidate !== null);\n      },\n      true,\n    );\n\n    const finish = (event: PointerEvent, cancelled: boolean): void => {\n      if (event.pointerId !== pointerId) return;\n      event.preventDefault();\n      event.stopImmediatePropagation();\n      lastX = event.clientX;\n      lastY = event.clientY;\n      const dx = lastX - startX;\n      const dy = lastY - startY;\n      const wasManual = manual || Math.hypot(dx, dy) >= 14;\n      const castSlot = slot;\n      pointerId = null;\n      slot = -1;\n      manual = false;\n      swallowClickUntil = Date.now() + 750;\n      this.highflyHideSkillStick();\n      try { button.releasePointerCapture(event.pointerId); } catch { /* optional */ }\n      if (cancelled) return;\n\n      audio.click();\n      this.hideTooltip();\n      if (wasManual) {\n        const facing = this.highflyScreenAimFacing(dx, dy);\n        const targetId = this.highflyPickDirectionalTarget(castSlot, facing);\n        if (targetId !== null) {\n          this.sim.targetEntity(targetId);\n          this.highflyManualCommit = true;\n          try {\n            this.castSlot(castSlot);\n          } finally {\n            this.highflyManualCommit = false;\n          }\n        }\n      } else {\n        // Quick tap = semi-auto cast: castSlot performs the camera-cone assist.\n        this.castSlot(castSlot);\n      }\n      button.blur();\n    };\n\n    button.addEventListener('pointerup', (event) => finish(event, false), true);\n    button.addEventListener('pointercancel', (event) => finish(event, true), true);\n  }\n\n`;
  source = replaceRequired(
    source,
    explicitDefAnchor,
    manualAimHelpers + explicitDefAnchor,
    'manual skill aim helpers',
  );

  // The v0.5.2 centre reticle/two-tap flow is replaced by immediate semi-auto on
  // a quick tap. Manual drags set highflyManualCommit so the chosen lane target is
  // never overwritten by the camera-cone helper on release.
  source = replaceRequired(
    source,
    `    if (\n      document.body.classList.contains('native-app') &&\n      document.body.classList.contains('mobile-touch') &&\n      !this.isGroundAimActive() &&\n      this.highflyHandleExplicitAim(barSlot)\n    ) {\n      return;\n    }\n    if (this.isGroundAimActive()) {`,
    `    if (\n      document.body.classList.contains('native-app') &&\n      document.body.classList.contains('mobile-touch') &&\n      !this.isGroundAimActive() &&\n      !this.highflyManualCommit\n    ) {\n      this.highflyCancelSkillAim();\n      this.highflyAutoAimHostile(barSlot);\n    }\n    if (this.isGroundAimActive()) {`,
    'replace two-tap reticle with tap assist',
  );

  source = replaceRequired(
    source,
    `    slotBtns.forEach((btn, i) => {\n      this.bindEmpoweredActionHold(btn, () => this.mobileSourceSlotForButton(i));`,
    `    slotBtns.forEach((btn, i) => {\n      this.bindHighflyMobileSkillAim(btn, () => this.mobileSourceSlotForButton(i));\n      this.bindEmpoweredActionHold(btn, () => this.mobileSourceSlotForButton(i));`,
    'bind mobile skill joystick',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) S23 CREATOR FINISH
// Keep a real viewport gutter on both sides, stop inner appearance rows from
// overflowing their grid cell, and remove the blue debug/focus-looking chrome
// around ENTER WORLD. The creator remains the original ClaudeCraft creator.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.5.3 — creator containment + MOBA-style skill joystick aim. */
@media (orientation: landscape) {
  body.native-app.mobile-touch[data-start-panel="offline-select"] #homepage-views-container {
    box-sizing: border-box !important;
    padding-left: max(8px, env(safe-area-inset-left)) !important;
    padding-right: max(8px, env(safe-area-inset-right)) !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator:not([hidden]) {
    width: calc(100% - 4px) !important;
    max-width: calc(100vw - 18px) !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-layout,
  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-left,
  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-right,
  body.native-app.mobile-touch #offline-select.highfly-native-creator .char-create,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-pages,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-page,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-row,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-seg {
    box-sizing: border-box !important;
    min-width: 0 !important;
    max-width: 100% !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-seg {
    width: 100% !important;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-seg-btn {
    min-width: 0 !important;
    max-width: 100% !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-right {
    padding-right: 3px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .auth-actions {
    border: 1px solid rgba(185, 145, 55, 0.72) !important;
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.38) !important;
    background: rgba(7, 7, 12, 0.96) !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-start-offline,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-start-offline:focus,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-start-offline:focus-visible {
    outline: none !important;
    outline-offset: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
  }
}

/* Manual skill drag: line grows FROM the skill button, not from the player. */
body.native-app.mobile-touch #highfly-skill-aim {
  display: none !important;
}

body.native-app.mobile-touch #highfly-skill-stick {
  --highfly-skill-stick-color: rgba(255, 187, 68, 0.92);
  position: fixed;
  z-index: 96;
  display: none;
  height: 8px;
  min-width: 50px;
  border-radius: 999px;
  pointer-events: none;
  transform-origin: 0 50%;
  background: linear-gradient(
    90deg,
    rgba(255, 187, 68, 0.25),
    var(--highfly-skill-stick-color)
  );
  box-shadow: 0 0 12px rgba(255, 170, 45, 0.55);
}

body.native-app.mobile-touch #highfly-skill-stick.active {
  display: block;
}

body.native-app.mobile-touch #highfly-skill-stick.has-target {
  --highfly-skill-stick-color: rgba(101, 235, 154, 0.96);
  box-shadow: 0 0 14px rgba(80, 235, 145, 0.68);
}

body.native-app.mobile-touch #highfly-skill-stick::after {
  content: '';
  position: absolute;
  right: -11px;
  top: 50%;
  width: 0;
  height: 0;
  border-top: 9px solid transparent;
  border-bottom: 9px solid transparent;
  border-left: 14px solid var(--highfly-skill-stick-color);
  transform: translateY(-50%);
  filter: drop-shadow(0 0 5px currentColor);
}
`;
  write(path, css);
}

console.log('[HIGHFLY] v0.5.3 mobile skill aim complete');

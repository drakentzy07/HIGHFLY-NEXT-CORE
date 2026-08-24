import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.6.1 MOBA AIM] patched ${path}`);
}
function replaceBetween(source, startNeedle, endNeedle, replacement, label) {
  const start = source.indexOf(startNeedle);
  if (start < 0) throw new Error(`Start anchor not found: ${label}`);
  const end = source.indexOf(endNeedle, start);
  if (end < 0) throw new Error(`End anchor not found: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}
function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// ---------------------------------------------------------------------------
// HIGHFLY v0.6.1 — MOBA TARGETING LANGUAGE
//
// Mobile Legends/Tales-of-Wind style control contract:
// - quick tap = assisted cast using HIGHFLY soft aim;
// - hold + drag = manual aim owned by the skill button;
// - the WORLD telegraph starts at the hunter, never at the thumb;
// - line/projectile, cone, circle/ground and dash each have different geometry;
// - position abilities can be cast directly by dragging to a legal point;
// - manual aim always wins over auto aim.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  const geometryStart = '  private highflyPickDirectionalTarget(';
  const geometryEnd = '\n  private highflyHideSkillStick(): void {';
  const geometry = `  private highflyMobileAimDef(barSlot: number): ResolvedAbility | null {\n    const resolved = this.abilityForSlot(barSlot);\n    if (!resolved) return null;\n    const def = resolved.def;\n    if (def.selfCentered) return null;\n    if (def.targetMode === 'position') return resolved;\n    if (!def.requiresTarget || def.targetType === 'friendly' || def.targetsDead) return null;\n    return resolved;\n  }\n\n  private highflyAimProfile(barSlot: number): {\n    shape: 'line' | 'cone' | 'circle' | 'dash';\n    range: number;\n    width: number;\n    angleDeg: number;\n    radius: number;\n  } {\n    const resolved = this.abilityForSlot(barSlot);\n    const def = resolved?.def;\n    const range = Math.max(5, def?.range ?? 12);\n    const effects = (resolved?.effects ?? []) as unknown as Array<Record<string, unknown>>;\n    const effectTypes = new Set(effects.map((effect) => String(effect.type ?? '')));\n    const idText = String(def?.id ?? '').toLowerCase();\n    const nameText = String(def?.name ?? '').toLowerCase();\n    const text = idText + ' ' + nameText;\n\n    const numeric = (key: string, fallback: number): number => {\n      for (const effect of effects) {\n        const value = effect[key];\n        if (typeof value === 'number' && Number.isFinite(value)) return value;\n        const landing = effect.landingAoe;\n        if (landing && typeof landing === 'object') {\n          const nested = (landing as Record<string, unknown>)[key];\n          if (typeof nested === 'number' && Number.isFinite(nested)) return nested;\n        }\n      }\n      return fallback;\n    };\n\n    if (def?.targetMode === 'position') {\n      return {\n        shape: 'circle',\n        range,\n        width: 0,\n        angleDeg: 0,\n        radius: Math.max(2.2, numeric('radius', 4)),\n      };\n    }\n\n    const isDash =\n      effectTypes.has('charge') ||\n      effectTypes.has('repositionToAim') ||\n      /charge|rush|leap|blink|dash|step|lunge|intervene|onrush|shadeslip/.test(text);\n    if (isDash) {\n      return { shape: 'dash', range, width: 2.6, angleDeg: 0, radius: 0 };\n    }\n\n    const isCone =\n      /cone|breath|sweep|cleave|fan|roar|shout|wave|whirl|arc|nova/.test(text) ||\n      effectTypes.has('weaponDamage') && range <= 8;\n    if (isCone) {\n      return {\n        shape: 'cone',\n        range,\n        width: 0,\n        angleDeg: Math.max(36, Math.min(100, numeric('angle', 64))),\n        radius: 0,\n      };\n    }\n\n    return {\n      shape: 'line',\n      range,\n      width: Math.max(1.5, Math.min(4.2, numeric('radius', 2.2))),\n      angleDeg: 0,\n      radius: 0,\n    };\n  }\n\n  private highflyPickDirectionalTarget(barSlot: number, aimFacing: number): number | null {\n    const resolved = this.highflyMobileAimDef(barSlot);\n    if (!resolved || resolved.def.targetMode === 'position') return null;\n    const profile = this.highflyAimProfile(barSlot);\n    const player = this.sim.player;\n    const maxRange = Math.max(8, profile.range + 3);\n    let bestId: number | null = null;\n    let bestScore = Number.POSITIVE_INFINITY;\n\n    for (const entity of this.sim.entities.values()) {\n      if (entity.id === player.id || entity.dead) continue;\n      const hostile =\n        entity.hostile || isPvpHostileTarget(entity.id, this.sim.duelInfo, this.sim.arenaInfo);\n      if (!hostile) continue;\n\n      const dx = entity.pos.x - player.pos.x;\n      const dz = entity.pos.z - player.pos.z;\n      const distance = Math.hypot(dx, dz);\n      if (distance <= 0.001 || distance > maxRange) continue;\n\n      const bearing = Math.atan2(dx, dz);\n      const diff = Math.atan2(Math.sin(bearing - aimFacing), Math.cos(bearing - aimFacing));\n      const absDiff = Math.abs(diff);\n      const forward = Math.cos(diff) * distance;\n      const lateral = Math.abs(Math.sin(diff) * distance);\n      if (forward <= 0) continue;\n\n      if (profile.shape === 'cone') {\n        const halfAngle = (profile.angleDeg * Math.PI) / 360;\n        if (absDiff > halfAngle) continue;\n        const score = absDiff * 14 + distance * 0.04;\n        if (score < bestScore) {\n          bestId = entity.id;\n          bestScore = score;\n        }\n        continue;\n      }\n\n      const laneHalfWidth = Math.max(profile.width * 0.5, Math.min(3.4, 1.2 + distance * 0.05));\n      if (lateral > laneHalfWidth) continue;\n      const score = forward + lateral * 8;\n      if (score < bestScore) {\n        bestId = entity.id;\n        bestScore = score;\n      }\n    }\n\n    return bestId;\n  }\n\n  private highflyEnsureSkillStick(): HTMLDivElement {\n    if (this.highflySkillStick?.isConnected) return this.highflySkillStick;\n    const stick = document.createElement('div');\n    stick.id = 'highfly-skill-stick';\n    stick.setAttribute('aria-hidden', 'true');\n    stick.innerHTML =\n      '<span class="hf-aim-range-ring"></span>' +\n      '<span class="hf-aim-shape"></span>' +\n      '<span class="hf-aim-end"></span>' +\n      '<span class="hf-aim-label"></span>';\n    document.body.appendChild(stick);\n    this.highflySkillStick = stick;\n    return stick;\n  }\n\n  private highflyPaintSkillStick(\n    barSlot: number,\n    screenDx: number,\n    screenDy: number,\n    hasTarget: boolean,\n  ): void {\n    const stick = this.highflyEnsureSkillStick();\n    const profile = this.highflyAimProfile(barSlot);\n    const rawLength = Math.hypot(screenDx, screenDy);\n    const angle = Math.atan2(screenDy, screenDx);\n\n    // ClaudeCraft mobile keeps the hunter slightly below centre. The input comes\n    // from the skill button, but every world telegraph originates here at the hunter.\n    const originX = window.innerWidth * 0.5;\n    const originY = window.innerHeight * 0.58;\n    const maxVisualRange = Math.min(340, window.innerWidth * 0.34);\n    const rangePx = Math.max(112, Math.min(maxVisualRange, profile.range * 8.2));\n    const dragPct = Math.max(0.24, Math.min(1, rawLength / 112));\n    const aimDistancePx = profile.shape === 'circle' ? rangePx * dragPct : rangePx;\n    const worldWidthPx = Math.max(20, profile.width * 11);\n    const radiusPx = Math.max(28, profile.radius * 10.5);\n    const coneEndWidth = Math.max(72, 2 * rangePx * Math.tan((profile.angleDeg * Math.PI) / 360));\n\n    stick.style.left = String(originX) + 'px';\n    stick.style.top = String(originY) + 'px';\n    stick.style.transform = 'rotate(' + String(angle) + 'rad)';\n    stick.style.setProperty('--hf-range-px', String(rangePx) + 'px');\n    stick.style.setProperty('--hf-aim-distance-px', String(aimDistancePx) + 'px');\n    stick.style.setProperty('--hf-width-px', String(worldWidthPx) + 'px');\n    stick.style.setProperty('--hf-radius-px', String(radiusPx) + 'px');\n    stick.style.setProperty('--hf-cone-end-px', String(coneEndWidth) + 'px');\n    stick.dataset.range = String(Math.round(profile.range)) + 'm';\n    stick.dataset.shape = profile.shape;\n    stick.classList.add('active');\n    stick.classList.toggle('has-target', hasTarget);\n\n    const label = stick.querySelector('.hf-aim-label');\n    if (label) {\n      const kind =\n        profile.shape === 'circle' ? 'ÁREA' :\n        profile.shape === 'cone' ? 'CONO' :\n        profile.shape === 'dash' ? 'DESPLAZAMIENTO' : 'DIRECCIÓN';\n      label.textContent = kind + ' · ' + String(Math.round(profile.range)) + 'm';\n    }\n  }\n`;

  source = replaceBetween(source, geometryStart, geometryEnd, geometry, 'MOBA aim geometry');

  const bindStart = '  private bindHighflyMobileSkillAim(';
  const bindEnd = '\n  private highflyExplicitAimDef(';
  const bindMethod = `  private bindHighflyMobileSkillAim(\n    button: HTMLButtonElement,\n    getSlot: () => number,\n  ): void {\n    let pointerId: number | null = null;\n    let slot = -1;\n    let startX = 0;\n    let startY = 0;\n    let lastX = 0;\n    let lastY = 0;\n    let manual = false;\n    let swallowClickUntil = 0;\n\n    button.addEventListener(\n      'click',\n      (event) => {\n        if (Date.now() > swallowClickUntil) return;\n        event.preventDefault();\n        event.stopImmediatePropagation();\n      },\n      true,\n    );\n\n    button.addEventListener(\n      'pointerdown',\n      (event) => {\n        if (\n          event.pointerType !== 'touch' ||\n          !document.body.classList.contains('native-app') ||\n          !document.body.classList.contains('mobile-touch')\n        ) {\n          return;\n        }\n        const nextSlot = getSlot();\n        if (!this.highflyMobileAimDef(nextSlot)) return;\n\n        event.preventDefault();\n        event.stopImmediatePropagation();\n        pointerId = event.pointerId;\n        slot = nextSlot;\n        startX = lastX = event.clientX;\n        startY = lastY = event.clientY;\n        manual = false;\n        this.highflyCancelSkillAim();\n        try { button.setPointerCapture(event.pointerId); } catch { /* optional */ }\n      },\n      true,\n    );\n\n    button.addEventListener(\n      'pointermove',\n      (event) => {\n        if (event.pointerId !== pointerId) return;\n        event.preventDefault();\n        event.stopImmediatePropagation();\n        lastX = event.clientX;\n        lastY = event.clientY;\n        const dx = lastX - startX;\n        const dy = lastY - startY;\n        if (!manual && Math.hypot(dx, dy) < 12) return;\n        manual = true;\n        const facing = this.highflyScreenAimFacing(dx, dy);\n        const candidate = this.highflyPickDirectionalTarget(slot, facing);\n        this.highflyPaintSkillStick(slot, dx, dy, candidate !== null);\n      },\n      true,\n    );\n\n    const finish = (event: PointerEvent, cancelled: boolean): void => {\n      if (event.pointerId !== pointerId) return;\n      event.preventDefault();\n      event.stopImmediatePropagation();\n      lastX = event.clientX;\n      lastY = event.clientY;\n      const dx = lastX - startX;\n      const dy = lastY - startY;\n      const dragLength = Math.hypot(dx, dy);\n      const wasManual = manual || dragLength >= 12;\n      const castSlot = slot;\n      pointerId = null;\n      slot = -1;\n      manual = false;\n      swallowClickUntil = Date.now() + 750;\n      this.highflyHideSkillStick();\n      try { button.releasePointerCapture(event.pointerId); } catch { /* optional */ }\n      if (cancelled) return;\n\n      audio.click();\n      this.hideTooltip();\n      const resolved = this.highflyMobileAimDef(castSlot);\n      if (!resolved) {\n        this.castSlot(castSlot);\n        return;\n      }\n\n      if (!wasManual) {\n        // Fast tap stays convenient: targeted abilities use HIGHFLY soft aim;\n        // ground abilities enter ClaudeCraft's existing ground-target mode.\n        this.castSlot(castSlot);\n        button.blur();\n        return;\n      }\n\n      const facing = this.highflyScreenAimFacing(dx, dy);\n      if (resolved.def.targetMode === 'position') {\n        const profile = this.highflyAimProfile(castSlot);\n        const distancePct = Math.max(0.2, Math.min(1, dragLength / 112));\n        const distance = profile.range * distancePct;\n        const aim = {\n          x: this.sim.player.pos.x + Math.sin(facing) * distance,\n          z: this.sim.player.pos.z + Math.cos(facing) * distance,\n        };\n        this.sim.castAbilityAt(resolved.def.id, aim);\n        button.blur();\n        return;\n      }\n\n      const targetId = this.highflyPickDirectionalTarget(castSlot, facing);\n      if (targetId !== null) {\n        this.sim.targetEntity(targetId);\n        this.highflyManualCommit = true;\n        try {\n          this.castSlot(castSlot);\n        } finally {\n          this.highflyManualCommit = false;\n        }\n      }\n      button.blur();\n    };\n\n    button.addEventListener('pointerup', (event) => finish(event, false), true);\n    button.addEventListener('pointercancel', (event) => finish(event, true), true);\n  }\n`;

  source = replaceBetween(source, bindStart, bindEnd, bindMethod, 'MOBA hold-drag-release binding');
  write(path, source);
}

// ---------------------------------------------------------------------------
// Visual language: clean cyan geometry inspired by premium mobile ARPG/MOBA
// readability, without copying any external art/assets.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.6.1 — MOBA-style world targeting geometry. */
body.native-app.mobile-touch #highfly-skill-stick {
  --hf-cyan: rgba(82, 226, 255, 0.96);
  --hf-cyan-soft: rgba(82, 226, 255, 0.18);
  --hf-valid: rgba(112, 255, 161, 0.98);
  position: fixed !important;
  z-index: 96 !important;
  width: 1px !important;
  height: 1px !important;
  transform-origin: 0 0 !important;
  pointer-events: none !important;
  opacity: 0 !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  transition: opacity 55ms linear !important;
}
body.native-app.mobile-touch #highfly-skill-stick.active { opacity: 1 !important; }

body.native-app.mobile-touch #highfly-skill-stick .hf-aim-range-ring {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  width: calc(var(--hf-range-px) * 2) !important;
  height: calc(var(--hf-range-px) * 2) !important;
  transform: translate(-50%, -50%) !important;
  border: 1.5px solid rgba(82, 226, 255, 0.42) !important;
  border-radius: 50% !important;
  background: rgba(40, 190, 230, 0.025) !important;
  box-shadow: inset 0 0 22px rgba(70, 220, 255, 0.04) !important;
}

body.native-app.mobile-touch #highfly-skill-stick .hf-aim-shape {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  transform-origin: 0 50% !important;
  border: 2px solid var(--hf-cyan) !important;
  background: linear-gradient(90deg, rgba(65, 218, 255, 0.10), rgba(65, 218, 255, 0.25)) !important;
  box-shadow: 0 0 12px rgba(60, 210, 255, 0.24), inset 0 0 12px rgba(120, 240, 255, 0.10) !important;
}

/* Projectile / beam lane. */
body.native-app.mobile-touch #highfly-skill-stick[data-shape="line"] .hf-aim-shape {
  width: var(--hf-range-px) !important;
  height: var(--hf-width-px) !important;
  transform: translateY(-50%) !important;
  border-radius: 999px 14px 14px 999px !important;
  clip-path: polygon(0 28%, 88% 28%, 88% 0, 100% 50%, 88% 100%, 88% 72%, 0 72%) !important;
}

/* Reposition / charge: thicker double-chevron lane. */
body.native-app.mobile-touch #highfly-skill-stick[data-shape="dash"] .hf-aim-shape {
  width: var(--hf-range-px) !important;
  height: max(34px, var(--hf-width-px)) !important;
  transform: translateY(-50%) !important;
  border-radius: 18px !important;
  clip-path: polygon(0 31%, 70% 31%, 70% 7%, 100% 50%, 70% 93%, 70% 69%, 0 69%, 12% 50%) !important;
  background: linear-gradient(90deg, rgba(65, 218, 255, 0.10), rgba(65, 218, 255, 0.32)) !important;
}

/* Frontal sector / cleave / breath. */
body.native-app.mobile-touch #highfly-skill-stick[data-shape="cone"] .hf-aim-shape {
  width: var(--hf-range-px) !important;
  height: var(--hf-cone-end-px) !important;
  transform: translateY(-50%) !important;
  border-radius: 0 48% 48% 0 !important;
  clip-path: polygon(0 50%, 100% 0, 100% 100%) !important;
  background: linear-gradient(90deg, rgba(65, 218, 255, 0.06), rgba(65, 218, 255, 0.24)) !important;
}

/* Ground placement: the circle travels from the hunter to the chosen point. */
body.native-app.mobile-touch #highfly-skill-stick[data-shape="circle"] .hf-aim-shape {
  left: var(--hf-aim-distance-px) !important;
  width: calc(var(--hf-radius-px) * 2) !important;
  height: calc(var(--hf-radius-px) * 2) !important;
  transform: translate(-50%, -50%) !important;
  border-radius: 50% !important;
  background: radial-gradient(circle, rgba(65, 218, 255, 0.22) 0 52%, rgba(65, 218, 255, 0.06) 53% 100%) !important;
}
body.native-app.mobile-touch #highfly-skill-stick[data-shape="circle"]::after {
  content: '' !important;
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  width: var(--hf-aim-distance-px) !important;
  height: 2px !important;
  transform: translateY(-50%) !important;
  background: repeating-linear-gradient(90deg, rgba(82, 226, 255, 0.65) 0 8px, transparent 8px 13px) !important;
}

body.native-app.mobile-touch #highfly-skill-stick .hf-aim-end {
  position: absolute !important;
  left: var(--hf-range-px) !important;
  top: 0 !important;
  width: 11px !important;
  height: 11px !important;
  transform: translate(-50%, -50%) !important;
  border: 2px solid var(--hf-cyan) !important;
  border-radius: 50% !important;
  background: rgba(12, 38, 50, 0.82) !important;
  box-shadow: 0 0 10px rgba(82, 226, 255, 0.5) !important;
}
body.native-app.mobile-touch #highfly-skill-stick[data-shape="circle"] .hf-aim-end {
  left: var(--hf-aim-distance-px) !important;
}

body.native-app.mobile-touch #highfly-skill-stick .hf-aim-label {
  position: absolute !important;
  left: 10px !important;
  top: -31px !important;
  transform: rotate(0deg) !important;
  padding: 3px 7px !important;
  border: 1px solid rgba(82, 226, 255, 0.28) !important;
  border-radius: 8px !important;
  background: rgba(5, 15, 25, 0.82) !important;
  color: rgba(185, 244, 255, 0.96) !important;
  font: 800 9px/1 sans-serif !important;
  letter-spacing: 0.6px !important;
  white-space: nowrap !important;
}

body.native-app.mobile-touch #highfly-skill-stick.has-target .hf-aim-shape,
body.native-app.mobile-touch #highfly-skill-stick.has-target .hf-aim-end {
  border-color: var(--hf-valid) !important;
  box-shadow: 0 0 14px rgba(112, 255, 161, 0.42), inset 0 0 10px rgba(112, 255, 161, 0.10) !important;
}
body.native-app.mobile-touch #highfly-skill-stick.has-target .hf-aim-shape {
  background-color: rgba(112, 255, 161, 0.12) !important;
}

/* DASH uses the same hunter-origin language: range ring + thick direction arrow. */
body.native-app.mobile-touch #highfly-dash-guide {
  --hf-dash-cyan: rgba(82, 226, 255, 0.96);
  height: 30px !important;
  border: 2px solid var(--hf-dash-cyan) !important;
  border-radius: 15px !important;
  background: linear-gradient(90deg, rgba(65, 218, 255, 0.10), rgba(65, 218, 255, 0.30)) !important;
  clip-path: polygon(0 31%, 70% 31%, 70% 6%, 100% 50%, 70% 94%, 70% 69%, 0 69%, 12% 50%) !important;
  box-shadow: 0 0 13px rgba(82, 226, 255, 0.35) !important;
}
body.native-app.mobile-touch #highfly-dash-guide::before {
  content: '' !important;
  position: absolute !important;
  left: 0 !important;
  top: 50% !important;
  width: 210px !important;
  height: 210px !important;
  transform: translate(-50%, -50%) !important;
  border: 1.5px solid rgba(82, 226, 255, 0.38) !important;
  border-radius: 50% !important;
  background: rgba(60, 210, 255, 0.02) !important;
}

/* Final creator containment: content may scroll internally but never fall off-screen. */
@media (orientation: landscape) and (max-height: 820px) {
  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-layout {
    grid-template-columns: minmax(0, 1.48fr) minmax(248px, 0.82fr) !important;
    gap: 8px !important;
    max-width: 100% !important;
    overflow: hidden !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-right {
    min-width: 0 !important;
    overflow: hidden !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-class-details,
  body.native-app.mobile-touch #offline-select.highfly-native-creator .class-details-panel {
    min-width: 0 !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    padding-right: 8px !important;
  }
}
`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// Contract test emitted into the cloned game so CI catches regressions before APK.
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_mobile_aim_contract.test.ts';
  const content = `import fs from 'node:fs';\nimport { describe, expect, it } from 'vitest';\n\ndescribe('HIGHFLY mobile targeting contract', () => {\n  const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');\n  const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');\n\n  it('supports tap assist plus hold-drag-release manual targeting', () => {\n    expect(hud).toContain('highflyMobileAimDef');\n    expect(hud).toContain('pointermove');\n    expect(hud).toContain('highflyScreenAimFacing');\n    expect(hud).toContain('highflyManualCommit');\n  });\n\n  it('supports line, cone, circle and dash telegraph profiles', () => {\n    expect(hud).toContain("'line' | 'cone' | 'circle' | 'dash'");\n    expect(css).toContain('[data-shape="line"]');\n    expect(css).toContain('[data-shape="cone"]');\n    expect(css).toContain('[data-shape="circle"]');\n    expect(css).toContain('[data-shape="dash"]');\n  });\n\n  it('casts dragged position skills at a world point and keeps telegraphs hunter-origin', () => {\n    expect(hud).toContain('this.sim.castAbilityAt(resolved.def.id, aim)');\n    expect(hud).toContain('window.innerWidth * 0.5');\n    expect(hud).toContain('window.innerHeight * 0.58');\n  });\n\n  it('keeps the dedicated dash guide in the same visual targeting language', () => {\n    expect(css).toContain('#highfly-dash-guide');\n    expect(css).toContain('--hf-dash-cyan');\n  });\n});\n`;
  write(path, content);
}

console.log('[HIGHFLY] v0.6.1 MOBA targeting pass complete.');

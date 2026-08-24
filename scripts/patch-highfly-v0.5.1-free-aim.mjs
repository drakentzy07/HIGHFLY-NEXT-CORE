import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.5.1] patched ${path}`);
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// ---------------------------------------------------------------------------
// 1) DASH drag aiming. Tap keeps the current quick-dash behaviour. Dragging the
//    dedicated DASH button chooses a camera-relative world direction, completely
//    independent from the character's current facing.
// ---------------------------------------------------------------------------
{
  const path = 'src/game/mobile_controls.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    '  onDash?(): void;',
    '  onDash?(screenDx?: number, screenDy?: number): void;',
    'dash callback vector signature',
  );

  source = replaceRequired(
    source,
    "    this.bindButton('mobile-dash', () => this.callbacks.onDash?.(), { pressFirst: true });",
    "    this.bindHighflyDashButton('mobile-dash');",
    'dash custom pointer binding',
  );

  const bindButtonAnchor = "  private bindButton(id: string, cb: () => void, opts: { pressFirst?: boolean } = {}): void {";
  const dashBinder = `  /** HIGHFLY action dodge: tap = quick dash, drag = explicit 360-degree aim. */\n  private bindHighflyDashButton(id: string): void {\n    const button = document.getElementById(id);\n    if (!button) return;\n    let pointerId: number | null = null;\n    let startX = 0;\n    let startY = 0;\n    let lastX = 0;\n    let lastY = 0;\n\n    button.addEventListener('pointerdown', (event) => {\n      if (!this.active || pointerId !== null) return;\n      event.preventDefault();\n      event.stopPropagation();\n      pointerId = event.pointerId;\n      startX = lastX = event.clientX;\n      startY = lastY = event.clientY;\n      try { button.setPointerCapture(event.pointerId); } catch { /* capture unsupported */ }\n      button.classList.add('highfly-aiming');\n    });\n\n    button.addEventListener('pointermove', (event) => {\n      if (event.pointerId !== pointerId) return;\n      event.preventDefault();\n      event.stopPropagation();\n      lastX = event.clientX;\n      lastY = event.clientY;\n    });\n\n    const finish = (event: PointerEvent, cancelled: boolean): void => {\n      if (event.pointerId !== pointerId) return;\n      event.preventDefault();\n      event.stopPropagation();\n      const dx = lastX - startX;\n      const dy = lastY - startY;\n      const distance = Math.hypot(dx, dy);\n      pointerId = null;\n      button.classList.remove('highfly-aiming');\n      try { button.releasePointerCapture(event.pointerId); } catch { /* already released */ }\n      if (cancelled) return;\n      if (distance >= 14) this.callbacks.onDash?.(dx, dy);\n      else this.callbacks.onDash?.();\n    };\n\n    button.addEventListener('pointerup', (event) => finish(event, false));\n    button.addEventListener('pointercancel', (event) => finish(event, true));\n  }\n\n`;
  source = replaceRequired(source, bindButtonAnchor, dashBinder + bindButtonAnchor, 'dash binder insertion');
  write(path, source);
}

{
  const path = 'src/main.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    '    onDash: () => input.triggerTouchDash(),',
    '    onDash: (screenDx, screenDy) => input.triggerTouchDash(screenDx, screenDy),',
    'main dash vector callback',
  );

  // Keep the HUD's soft-aim direction synced to the actual camera heading.
  source = replaceRequired(
    source,
    '    const mouselook = intro === null && input.isMouselookActive() && !movementFrozen();',
    `    const mouselook = intro === null && input.isMouselookActive() && !movementFrozen();\n    hud.setHighflyAimFacing(input.camYaw);`,
    'camera aim heading sync',
  );

  // The fixed Attack button now prioritises what is near the centre of the camera
  // instead of simply choosing the nearest enemy anywhere around the player.
  const oldAttackNearest = `    let best: number | null = null;\n    let bestD = 40;\n    for (const e of world.entities.values()) {\n      if (!isAttackableEntity(e, world.playerId, activePvpOpponents)) continue;\n      const d = dist2d(p.pos, e.pos);\n      if (d < bestD) {\n        best = e.id;\n        bestD = d;\n      }\n    }`;
  const newAttackNearest = `    let best: number | null = null;\n    let bestScore = Number.POSITIVE_INFINITY;\n    for (const e of world.entities.values()) {\n      if (!isAttackableEntity(e, world.playerId, activePvpOpponents)) continue;\n      const dx = e.pos.x - p.pos.x;\n      const dz = e.pos.z - p.pos.z;\n      const d = Math.hypot(dx, dz);\n      if (d > 40 || d <= 0.001) continue;\n      const bearing = Math.atan2(dx, dz);\n      const diff = Math.abs(Math.atan2(Math.sin(bearing - input.camYaw), Math.cos(bearing - input.camYaw)));\n      // About 65 degrees either side: forgiving on a phone but still directional.\n      if (diff > 1.13) continue;\n      // Centre-screen intent wins first; distance is only a secondary tie-breaker.\n      const score = diff * 12 + d * 0.08;\n      if (score < bestScore) {\n        best = e.id;\n        bestScore = score;\n      }\n    }`;
  source = replaceRequired(source, oldAttackNearest, newAttackNearest, 'camera-cone basic attack auto aim');
  write(path, source);
}

{
  const path = 'src/game/input.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    '  private touchDashUntil = 0;',
    '  private touchDashUntil = 0;\n  private touchDashFacing: number | null = null;',
    'touch dash facing state',
  );

  const oldMethod = `  /** HIGHFLY directional dodge/dash input. Collision and cooldown live in Sim. */\n  triggerTouchDash(): void {\n    this.touchDashUntil = Math.max(this.touchDashUntil, performance.now() + TOUCH_DASH_LATCH_MS);\n    this.noteMovementIntent();\n  }`;
  const newMethod = `  /** HIGHFLY directional dodge/dash input. Collision and cooldown live in Sim. */\n  triggerTouchDash(screenDx?: number, screenDy?: number): void {\n    this.touchDashUntil = Math.max(this.touchDashUntil, performance.now() + TOUCH_DASH_LATCH_MS);\n    this.touchDashFacing = null;\n    if (typeof screenDx === 'number' && typeof screenDy === 'number') {\n      const length = Math.hypot(screenDx, screenDy);\n      if (length >= 1) {\n        // Screen up follows camera-forward; screen right follows camera-right.\n        const forward = -screenDy / length;\n        const right = screenDx / length;\n        const sin = Math.sin(this.camYaw);\n        const cos = Math.cos(this.camYaw);\n        const worldX = forward * sin - right * cos;\n        const worldZ = forward * cos + right * sin;\n        this.touchDashFacing = Math.atan2(worldX, worldZ);\n      }\n    }\n    this.noteMovementIntent();\n  }`;
  source = replaceRequired(source, oldMethod, newMethod, 'vector-aware triggerTouchDash');

  const beforeReturns = source;
  source = source.replace(
    /(\n\s+dash,\n)(\s+dive,)/g,
    '$1      dashFacing: dash ? this.touchDashFacing ?? undefined : undefined,\n$2',
  );
  if (source === beforeReturns) throw new Error('Anchor not found: dashFacing readMoveInput returns');
  write(path, source);
}

{
  const path = 'src/sim/types.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    '  dash?: boolean;\n  /** Swim DOWN.',
    '  dash?: boolean;\n  /** Camera-relative world heading explicitly chosen by dragging DASH. */\n  dashFacing?: number;\n  /** Swim DOWN.',
    'MoveInput dashFacing',
  );
  write(path, source);
}

{
  const path = 'src/sim/move_input.ts';
  let source = read(path);
  const swimFnAnchor = `/** The one non-boolean field: how steeply the camera is steering a dive/climb.`;
  const dashSanitizer = `/** HIGHFLY optional world heading chosen by a directional DASH drag. */\nfunction sanitizeDashFacing(raw: Record<string, unknown>): number | undefined {\n  const value = raw.dashFacing ?? raw.df;\n  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;\n  return Math.atan2(Math.sin(value), Math.cos(value));\n}\n\n`;
  source = replaceRequired(source, swimFnAnchor, dashSanitizer + swimFnAnchor, 'dashFacing sanitizer insertion');
  source = replaceRequired(
    source,
    '  input.swimSteer = sanitizeSwimSteer(raw);\n  return input;',
    '  input.swimSteer = sanitizeSwimSteer(raw);\n  input.dashFacing = sanitizeDashFacing(raw);\n  return input;',
    'sanitize dashFacing',
  );
  write(path, source);
}

{
  const path = 'src/sim/player_motion.ts';
  let source = read(path);
  const oldDashDirection = `    let dx = mx;\n    let dz = mz;\n    if (dx === 0 && dz === 0) dz = 1;\n    const dlen = Math.hypot(dx, dz);\n    p.highflyDashLocalX = dx / dlen;\n    p.highflyDashLocalZ = dz / dlen;`;
  const newDashDirection = `    let dx = mx;\n    let dz = mz;\n    // A drag on DASH provides a WORLD heading. Convert it back into this movement\n    // kernel's local forward/right coordinates so character facing cannot bend it.\n    if (typeof inp.dashFacing === 'number' && Number.isFinite(inp.dashFacing)) {\n      const worldX = Math.sin(inp.dashFacing);\n      const worldZ = Math.cos(inp.dashFacing);\n      const sin = Math.sin(p.facing);\n      const cos = Math.cos(p.facing);\n      dz = worldX * sin + worldZ * cos;\n      dx = -worldX * cos + worldZ * sin;\n    }\n    if (dx === 0 && dz === 0) dz = 1;\n    const dlen = Math.hypot(dx, dz);\n    p.highflyDashLocalX = dx / dlen;\n    p.highflyDashLocalZ = dz / dlen;`;
  source = replaceRequired(source, oldDashDirection, newDashDirection, 'world-directed dash');
  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) FREE AIM for area / position abilities. ClaudeCraft already has an
//    authoritative castAim + castAbilityAt + range clamp + world reticle. HIGHFLY
//    enables that complete path on touch for EVERY position-targeted ability,
//    not Meteor alone.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud/action_bar/ground_aim.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    "  return mobileTouch ? abilityId === 'meteor' : desktopPreference;",
    `  // HIGHFLY native action targeting: every position-targeted ability gets\n  // explicit touch placement. The HUD only asks this after confirming that the\n  // ability is targetMode:'position' and not selfCentered.\n  return mobileTouch ? true : desktopPreference;`,
    'all mobile position abilities use ground aim',
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) Camera-cone soft aim for ordinary hostile targeted abilities. This never
//    rewrites a class or an ability: it only chooses the most intentional target
//    before ClaudeCraft runs its original authoritative cast logic.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    'export class Hud {',
    `export class Hud {\n  /** HIGHFLY soft-aim direction, continuously synced from the native camera. */\n  private highflyAimFacing: number | null = null;`,
    'Hud soft aim state',
  );

  const castComment = '  // Shared entry point for hotbar clicks and the 1..0-= keybinds.';
  const helper = `  /** Native camera heading used by tap-to-soft-aim. */\n  setHighflyAimFacing(facing: number): void {\n    this.highflyAimFacing = Number.isFinite(facing) ? facing : null;\n  }\n\n  /** Pick the hostile closest to the centre of the camera within this ability's reach. */\n  private highflyAutoAimHostile(barSlot: number): void {\n    const resolved = this.abilityForSlot(barSlot);\n    if (!resolved) return;\n    const def = resolved.def;\n    if (!def.requiresTarget || def.targetType === 'friendly' || def.targetsDead || def.targetMode === 'position') return;\n\n    const player = this.sim.player;\n    const aimFacing = this.highflyAimFacing ?? player.facing;\n    const maxRange = Math.max(8, (def.range ?? 0) + 4);\n    const halfCone = 1.05; // ~60 degrees either side: generous mobile soft-lock.\n    let bestId: number | null = null;\n    let bestScore = Number.POSITIVE_INFINITY;\n\n    for (const entity of this.sim.entities.values()) {\n      if (entity.id === player.id || entity.dead) continue;\n      const hostile =\n        entity.hostile || isPvpHostileTarget(entity.id, this.sim.duelInfo, this.sim.arenaInfo);\n      if (!hostile) continue;\n      const dx = entity.pos.x - player.pos.x;\n      const dz = entity.pos.z - player.pos.z;\n      const distance = Math.hypot(dx, dz);\n      if (distance <= 0.001 || distance > maxRange) continue;\n      const bearing = Math.atan2(dx, dz);\n      const diff = Math.abs(Math.atan2(Math.sin(bearing - aimFacing), Math.cos(bearing - aimFacing)));\n      if (diff > halfCone) continue;\n      // Screen-centre intent matters much more than a few yards of distance.\n      const score = diff * 12 + distance * 0.08;\n      if (score < bestScore) {\n        bestId = entity.id;\n        bestScore = score;\n      }\n    }\n\n    if (bestId !== null) this.sim.targetEntity(bestId);\n  }\n\n`;
  source = replaceRequired(source, castComment, helper + castComment, 'Hud soft aim helper insertion');

  source = replaceRequired(
    source,
    '  castSlot(barSlot: number): void {\n    if (this.isGroundAimActive()) {',
    `  castSlot(barSlot: number): void {\n    if (\n      document.body.classList.contains('native-app') &&\n      document.body.classList.contains('mobile-touch') &&\n      !this.isGroundAimActive()\n    ) {\n      this.highflyAutoAimHostile(barSlot);\n    }\n    if (this.isGroundAimActive()) {`,
    'soft aim before native mobile cast',
  );
  write(path, source);
}

// Auto-facing at the moment of a targeted cast: soft aim chooses the target, then
// the authoritative sim turns the character to that target instead of rejecting
// the command merely because the camera and body were looking in different ways.
{
  const path = 'src/sim/combat/casting_lifecycle.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    `    const facingDiff = Math.abs(normAngle(angleTo(p.pos, target.pos) - p.facing));\n    if (facingDiff > MELEE_ARC) {\n      ctx.error(p.id, 'You must be facing your target.');\n      return;\n    }`,
    `    const targetFacing = angleTo(p.pos, target.pos);\n    const facingDiff = Math.abs(normAngle(targetFacing - p.facing));\n    if (facingDiff > MELEE_ARC) {\n      // HIGHFLY action combat: target selection is camera-driven, so the cast\n      // rotates the body into the chosen target instead of failing a legacy\n      // tab-target facing check. Positional attacks (Backstab etc.) still keep\n      // their separate target-facing/behind requirements below.\n      p.facing = targetFacing;\n    }`,
    'action auto-facing cast gate',
  );
  write(path, source);
}

// Small visual feedback while the player is dragging the dodge button.
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `\n\n/* HIGHFLY v0.5.1 — directional dash/free-aim touch feedback. */\nbody.native-app #mobile-dash.highfly-aiming {\n  transform: scale(1.12) !important;\n  filter: brightness(1.35) drop-shadow(0 0 8px rgba(92, 157, 255, 0.9)) !important;\n}\n`;
  write(path, css);
}

console.log('[HIGHFLY] v0.5.1 FREE AIM core complete');

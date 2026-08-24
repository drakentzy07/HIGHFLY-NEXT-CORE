import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.5.5] patched ${path}`);
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
// 1) WORLD-SPACE ACTION AIM VISUAL
// The previous guide was an HTML bar floating over the screen. HIGHFLY v0.5.5
// renders the intent in the actual 3D world: a terrain-draped lane from the
// player's feet to the real ability range, with a world-space end reticle.
// ---------------------------------------------------------------------------
{
  const path = 'src/render/highfly_directional_aim_visual.ts';
  const content = `import * as THREE from 'three';

export type HighflyAimGuideKind = 'skill' | 'dash';

export interface HighflyAimGuideState {
  x: number;
  z: number;
  facing: number;
  range: number;
  width: number;
  kind: HighflyAimGuideKind;
  assisted: boolean;
}

const SEGMENTS = 34;
const LIFT = 0.075;

export class HighflyDirectionalAimVisual {
  readonly group = new THREE.Group();

  private readonly ribbonGeometry = new THREE.BufferGeometry();
  private readonly ribbonMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  private readonly ribbon: THREE.Mesh;

  private readonly spineGeometry = new THREE.BufferGeometry();
  private readonly spineMaterial = new THREE.LineBasicMaterial({
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });
  private readonly spine: THREE.Line;

  private readonly arrowGeometry = new THREE.BufferGeometry();
  private readonly arrowMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  private readonly arrow: THREE.Mesh;

  private readonly endMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.66,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  private readonly endRing: THREE.Mesh;

  private elapsed = 0;
  private assisted = false;
  private disposed = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly heightAt: (x: number, z: number) => number,
    private readonly colorBoost = 1,
  ) {
    this.group.name = 'highfly-directional-aim';
    this.group.visible = false;

    const ribbonPositions = new Float32Array(SEGMENTS * 2 * 3);
    this.ribbonGeometry.setAttribute('position', new THREE.BufferAttribute(ribbonPositions, 3));
    const indices = new Uint16Array((SEGMENTS - 1) * 6);
    for (let i = 0; i < SEGMENTS - 1; i++) {
      const base = i * 6;
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.set([a, b, d, a, d, c], base);
    }
    this.ribbonGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.ribbon = new THREE.Mesh(this.ribbonGeometry, this.ribbonMaterial);
    this.ribbon.name = 'highfly-aim-lane';

    this.spineGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(SEGMENTS * 3), 3),
    );
    this.spine = new THREE.Line(this.spineGeometry, this.spineMaterial);
    this.spine.name = 'highfly-aim-spine';

    this.arrowGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(9), 3),
    );
    this.arrow = new THREE.Mesh(this.arrowGeometry, this.arrowMaterial);
    this.arrow.name = 'highfly-aim-arrow';

    const ringGeometry = new THREE.RingGeometry(0.62, 0.82, 48);
    ringGeometry.rotateX(-Math.PI / 2);
    this.endRing = new THREE.Mesh(ringGeometry, this.endMaterial);
    this.endRing.name = 'highfly-aim-end';

    for (const object of [this.ribbon, this.spine, this.arrow, this.endRing]) {
      object.frustumCulled = false;
      object.renderOrder = 4;
      this.group.add(object);
    }
    this.scene.add(this.group);
  }

  setAim(aim: HighflyAimGuideState | null): void {
    if (this.disposed) return;
    if (!aim) {
      this.group.visible = false;
      return;
    }

    this.assisted = aim.assisted;
    const baseColor = aim.kind === 'dash' ? 0x63c9ff : aim.assisted ? 0x73ff98 : 0xf2c356;
    for (const material of [
      this.ribbonMaterial,
      this.spineMaterial,
      this.arrowMaterial,
      this.endMaterial,
    ]) {
      material.color.setHex(baseColor);
      material.color.multiplyScalar(this.colorBoost);
    }

    this.rebuild(aim);
    this.group.visible = true;
  }

  update(dt: number): void {
    if (!this.group.visible || this.disposed) return;
    this.elapsed += Math.max(0, dt);
    const pulse = 0.82 + Math.sin(this.elapsed * Math.PI * 4) * 0.12;
    this.spineMaterial.opacity = 0.78 + pulse * 0.16;
    this.arrowMaterial.opacity = 0.75 + pulse * 0.2;
    this.endMaterial.opacity = (this.assisted ? 0.78 : 0.58) + pulse * 0.08;
    this.ribbonMaterial.opacity = this.assisted ? 0.26 : 0.18;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.group);
    this.ribbonGeometry.dispose();
    this.ribbonMaterial.dispose();
    this.spineGeometry.dispose();
    this.spineMaterial.dispose();
    this.arrowGeometry.dispose();
    this.arrowMaterial.dispose();
    this.endRing.geometry.dispose();
    this.endMaterial.dispose();
  }

  private rebuild(aim: HighflyAimGuideState): void {
    const range = Math.max(1.6, aim.range);
    const width = Math.max(0.24, aim.width);
    const dirX = Math.sin(aim.facing);
    const dirZ = Math.cos(aim.facing);
    const rightX = Math.cos(aim.facing);
    const rightZ = -Math.sin(aim.facing);
    const startDistance = Math.min(0.72, range * 0.12);

    const ribbonPos = this.ribbonGeometry.getAttribute('position') as THREE.BufferAttribute;
    const spinePos = this.spineGeometry.getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < SEGMENTS; i++) {
      const t = i / (SEGMENTS - 1);
      const distance = startDistance + (range - startDistance) * t;
      const centerX = aim.x + dirX * distance;
      const centerZ = aim.z + dirZ * distance;
      const taper = 1 - t * 0.28;
      const halfWidth = width * 0.5 * taper;

      const leftX = centerX - rightX * halfWidth;
      const leftZ = centerZ - rightZ * halfWidth;
      const rightWorldX = centerX + rightX * halfWidth;
      const rightWorldZ = centerZ + rightZ * halfWidth;

      ribbonPos.setXYZ(i * 2, leftX, this.heightAt(leftX, leftZ) + LIFT, leftZ);
      ribbonPos.setXYZ(
        i * 2 + 1,
        rightWorldX,
        this.heightAt(rightWorldX, rightWorldZ) + LIFT,
        rightWorldZ,
      );
      spinePos.setXYZ(i, centerX, this.heightAt(centerX, centerZ) + LIFT + 0.025, centerZ);
    }
    ribbonPos.needsUpdate = true;
    spinePos.needsUpdate = true;

    const endX = aim.x + dirX * range;
    const endZ = aim.z + dirZ * range;
    const backDistance = Math.max(startDistance, range - Math.max(0.75, width * 1.7));
    const backX = aim.x + dirX * backDistance;
    const backZ = aim.z + dirZ * backDistance;
    const arrowHalf = width * 0.9;
    const arrowPos = this.arrowGeometry.getAttribute('position') as THREE.BufferAttribute;
    const noseX = endX + dirX * Math.min(0.55, width * 0.8);
    const noseZ = endZ + dirZ * Math.min(0.55, width * 0.8);
    const leftX = backX - rightX * arrowHalf;
    const leftZ = backZ - rightZ * arrowHalf;
    const rightX2 = backX + rightX * arrowHalf;
    const rightZ2 = backZ + rightZ * arrowHalf;
    arrowPos.setXYZ(0, noseX, this.heightAt(noseX, noseZ) + LIFT + 0.04, noseZ);
    arrowPos.setXYZ(1, leftX, this.heightAt(leftX, leftZ) + LIFT + 0.04, leftZ);
    arrowPos.setXYZ(2, rightX2, this.heightAt(rightX2, rightZ2) + LIFT + 0.04, rightZ2);
    arrowPos.needsUpdate = true;
    this.arrowGeometry.computeBoundingSphere();

    this.endRing.position.set(endX, this.heightAt(endX, endZ) + LIFT + 0.015, endZ);
    const ringScale = Math.max(0.55, width * 0.9);
    this.endRing.scale.setScalar(ringScale);
  }
}
`;
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.5.5] created ${path}`);
}

// ---------------------------------------------------------------------------
// 2) THREAD WORLD AIM INTO THE RENDERER
// ---------------------------------------------------------------------------
{
  const path = 'src/render/renderer.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    "import { GroundAimReticleVisual } from './ground_aim_reticle_visual';",
    "import { GroundAimReticleVisual } from './ground_aim_reticle_visual';\nimport { HighflyDirectionalAimVisual, type HighflyAimGuideState } from './highfly_directional_aim_visual';",
    'renderer directional aim import',
  );

  source = replaceRequired(
    source,
    '  private groundAimReticle: GroundAimReticleVisual;',
    '  private groundAimReticle: GroundAimReticleVisual;\n  private highflyDirectionalAim: HighflyDirectionalAimVisual;',
    'renderer directional aim field',
  );

  source = replaceRequired(
    source,
    "    setRenderCategory(this.groundAimReticle.group, 'ui3d');",
    `    setRenderCategory(this.groundAimReticle.group, 'ui3d');\n    this.highflyDirectionalAim = new HighflyDirectionalAimVisual(\n      this.scene,\n      (x, z) => groundHeight(x, z, this.sim.cfg.seed),\n      this.lowGfx ? 1 : SELECTION_RING_BOOST,\n    );\n    setRenderCategory(this.highflyDirectionalAim.group, 'ui3d');`,
    'renderer directional aim construction',
  );

  source = replaceRequired(
    source,
    '  setGroundAimReticle(\n',
    `  setHighflyDirectionalAim(aim: HighflyAimGuideState | null): void {\n    this.highflyDirectionalAim.setAim(aim);\n  }\n\n  setGroundAimReticle(\n`,
    'renderer directional aim setter',
  );

  source = replaceRequired(
    source,
    `  private updateGroundAimReticle(dt: number): void {\n    this.groundAimReticle.update(dt);\n  }`,
    `  private updateGroundAimReticle(dt: number): void {\n    this.groundAimReticle.update(dt);\n    this.highflyDirectionalAim.update(dt);\n  }`,
    'renderer directional aim update',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) HUD ACTION INTENT
// Skill button remains the thumb input, but the visible intent is now renderer
// state. Manual aim receives a soft magnet only when the player's drag already
// passes close to a hostile; obvious off-target drags are never hijacked.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  source = source.replace('  handleMobileAttackTap,\n', '');

  source = replaceRequired(
    source,
    '  private highflyManualCommit = false;',
    `  private highflyManualCommit = false;\n  private highflyDirectionalGuideState: {\n    x: number;\n    z: number;\n    facing: number;\n    range: number;\n    width: number;\n    kind: 'skill' | 'dash';\n    assisted: boolean;\n  } | null = null;`,
    'HUD directional guide state',
  );

  const helperAnchor = '  /** Convert a drag on a right-side skill button into a camera-relative world heading. */';
  const publicHelpers = `  /** Renderer-facing HIGHFLY aim state. Keep the origin glued to the live player. */\n  highflyDirectionalAimGuide(): {\n    x: number;\n    z: number;\n    facing: number;\n    range: number;\n    width: number;\n    kind: 'skill' | 'dash';\n    assisted: boolean;\n  } | null {\n    const guide = this.highflyDirectionalGuideState;\n    if (!guide) return null;\n    guide.x = this.sim.player.pos.x;\n    guide.z = this.sim.player.pos.z;\n    return guide;\n  }\n\n  /** Live world-space preview while the DASH button is being dragged. */\n  setHighflyDashAim(screenDx?: number, screenDy?: number): void {\n    if (typeof screenDx !== 'number' || typeof screenDy !== 'number' || Math.hypot(screenDx, screenDy) < 4) {\n      if (this.highflyDirectionalGuideState?.kind === 'dash') this.highflyDirectionalGuideState = null;\n      return;\n    }\n    const facing = this.highflyScreenAimFacing(screenDx, screenDy);\n    this.highflyDirectionalGuideState = {\n      x: this.sim.player.pos.x,\n      z: this.sim.player.pos.z,\n      facing,\n      range: 5.2,\n      width: 0.82,\n      kind: 'dash',\n      assisted: false,\n    };\n  }\n\n`;
  source = replaceRequired(source, helperAnchor, publicHelpers + helperAnchor, 'HUD public aim helpers');

  const methodStart = '  private highflyPaintSkillStick(';
  const methodEnd = '\n  private highflyHideSkillStick(): void {';
  const newMethod = `  private highflyPaintSkillStick(\n    barSlot: number,\n    screenDx: number,\n    screenDy: number,\n    _hasTarget: boolean,\n  ): void {\n    const resolved = this.highflyExplicitAimDef(barSlot);\n    if (!resolved) {\n      if (this.highflyDirectionalGuideState?.kind === 'skill') this.highflyDirectionalGuideState = null;\n      return;\n    }\n\n    const rawFacing = this.highflyScreenAimFacing(screenDx, screenDy);\n    const targetId = this.highflyPickDirectionalTarget(barSlot, rawFacing);\n    let facing = rawFacing;\n    let assisted = false;\n\n    if (targetId !== null) {\n      const target = this.sim.entities.get(targetId);\n      if (target) {\n        const dx = target.pos.x - this.sim.player.pos.x;\n        const dz = target.pos.z - this.sim.player.pos.z;\n        const bearing = Math.atan2(dx, dz);\n        const diff = Math.atan2(Math.sin(bearing - rawFacing), Math.cos(bearing - rawFacing));\n        const abs = Math.abs(diff);\n        const assistWindow = 0.38; // ~22 degrees: help, never a hard lock.\n        if (abs <= assistWindow) {\n          const strength = (1 - abs / assistWindow) * 0.58;\n          facing = Math.atan2(\n            Math.sin(rawFacing + diff * strength),\n            Math.cos(rawFacing + diff * strength),\n          );\n          assisted = true;\n        }\n      }\n    }\n\n    const range = Math.max(6, resolved.def.range ?? 12);\n    this.highflyDirectionalGuideState = {\n      x: this.sim.player.pos.x,\n      z: this.sim.player.pos.z,\n      facing,\n      range,\n      width: Math.min(1.15, Math.max(0.58, 0.58 + range * 0.012)),\n      kind: 'skill',\n      assisted,\n    };\n  }\n`;
  source = replaceBetween(source, methodStart, methodEnd, newMethod, 'replace DOM skill lane with world aim state');

  source = replaceRequired(
    source,
    `  private highflyHideSkillStick(): void {\n    this.highflySkillStick?.classList.remove('active', 'has-target');\n  }`,
    `  private highflyHideSkillStick(): void {\n    this.highflySkillStick?.classList.remove('active', 'has-target');\n    if (this.highflyDirectionalGuideState?.kind === 'skill') this.highflyDirectionalGuideState = null;\n  }`,
    'clear world skill guide',
  );

  source = replaceRequired(
    source,
    `      const castSlot = slot;\n      pointerId = null;`,
    `      const castSlot = slot;\n      const committedGuideFacing =\n        this.highflyDirectionalGuideState?.kind === 'skill'\n          ? this.highflyDirectionalGuideState.facing\n          : null;\n      pointerId = null;`,
    'preserve assisted facing through release',
  );

  source = replaceRequired(
    source,
    `        const facing = this.highflyScreenAimFacing(dx, dy);\n        const targetId = this.highflyPickDirectionalTarget(castSlot, facing);`,
    `        const facing = committedGuideFacing ?? this.highflyScreenAimFacing(dx, dy);\n        const targetId = this.highflyPickDirectionalTarget(castSlot, facing);`,
    'cast with assisted manual facing',
  );

  // HIGHFLY basic attack: repeated taps must never toggle auto-attack OFF. A
  // pointer-down arms combat immediately; holding the button keeps the intent
  // alive and reacquires after a kill, while the original swing timers/damage
  // remain authoritative and unchanged.
  const attackBindAnchor = '    bindTouchTap(attackBtn, () => {';
  const attackHold = `    const highflyEngageAttack = (): void => {\n      if (this.firstSportAbility()) return;\n      let player = this.sim.player;\n      let target = player.targetId !== null ? this.sim.entities.get(player.targetId) : null;\n      let liveHostile =\n        !!target &&\n        !target.dead &&\n        (target.hostile || isPvpHostileTarget(target.id, this.sim.duelInfo, this.sim.arenaInfo));\n      if (!liveHostile) {\n        this.onMobileAttackNearest?.();\n        player = this.sim.player;\n        target = player.targetId !== null ? this.sim.entities.get(player.targetId) : null;\n        liveHostile =\n          !!target &&\n          !target.dead &&\n          (target.hostile || isPvpHostileTarget(target.id, this.sim.duelInfo, this.sim.arenaInfo));\n      }\n      if (liveHostile && !player.autoAttack) this.sim.startAutoAttack();\n    };\n\n    let highflyAttackHoldTimer: number | null = null;\n    const stopHighflyAttackHold = (): void => {\n      if (highflyAttackHoldTimer !== null) {\n        window.clearInterval(highflyAttackHoldTimer);\n        highflyAttackHoldTimer = null;\n      }\n      attackBtn.classList.remove('highfly-held');\n    };\n\n    attackBtn.addEventListener(\n      'pointerdown',\n      (event) => {\n        if (\n          event.pointerType !== 'touch' ||\n          !document.body.classList.contains('native-app') ||\n          !document.body.classList.contains('mobile-touch')\n        ) {\n          return;\n        }\n        stopHighflyAttackHold();\n        attackBtn.classList.add('highfly-held');\n        highflyEngageAttack();\n        highflyAttackHoldTimer = window.setInterval(highflyEngageAttack, 140);\n      },\n      true,\n    );\n    attackBtn.addEventListener('pointerup', stopHighflyAttackHold, true);\n    attackBtn.addEventListener('pointercancel', stopHighflyAttackHold, true);\n    attackBtn.addEventListener('lostpointercapture', stopHighflyAttackHold, true);\n\n`;
  source = replaceRequired(source, attackBindAnchor, attackHold + attackBindAnchor, 'basic attack hold binder');

  const oldAttackTap = `      const p = this.sim.player;\n      if (this.firstSportAbility()) {\n        this.activateFixedAttackSlot();\n        attackBtn.blur();\n        return;\n      }\n      const target = p.targetId !== null ? this.sim.entities.get(p.targetId) : null;\n      const hasLiveHostileTarget = !!target && !target.dead && target.hostile;\n      handleMobileAttackTap(\n        { autoAttack: p.autoAttack, hasLiveHostileTarget },\n        {\n          activateAttack: () => this.activateFixedAttackSlot(),\n          attackNearest: this.onMobileAttackNearest,\n        },\n      );\n      attackBtn.blur();`;
  const newAttackTap = `      if (this.firstSportAbility()) {\n        this.activateFixedAttackSlot();\n        attackBtn.blur();\n        return;\n      }\n      highflyEngageAttack();\n      attackBtn.blur();`;
  source = replaceRequired(source, oldAttackTap, newAttackTap, 'non-toggle mobile basic attack');

  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) DASH WORLD GUIDE + DELIBERATE AUTORUN
// DASH retains the working vector movement. Its preview is forwarded to HUD and
// rendered in world space. Autorun no longer activates from pushing the stick
// too far: double-tap the FORWARD cap to enable, touch the joystick once to cancel.
// ---------------------------------------------------------------------------
{
  const path = 'src/game/mobile_controls.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    '  onDash?(screenDx?: number, screenDy?: number): void;',
    `  onDash?(screenDx?: number, screenDy?: number): void;\n  onDashAim?(screenDx?: number, screenDy?: number): void;`,
    'dash aim callback',
  );

  source = replaceRequired(
    source,
    '  private moveAutorunLocked = false;',
    `  private moveAutorunLocked = false;\n  private highflyLastAutorunTapAt = 0;`,
    'autorun double-tap state',
  );

  const oldDashGuide = `      const distance = Math.hypot(dx, dy);\n      if (distance >= 4) {\n        const angle = Math.atan2(dy, dx);\n        let guide = document.getElementById('highfly-dash-guide') as HTMLDivElement | null;\n        if (!guide) {\n          guide = document.createElement('div');\n          guide.id = 'highfly-dash-guide';\n          guide.setAttribute('aria-hidden', 'true');\n          document.body.appendChild(guide);\n        }\n        guide.style.left = String(window.innerWidth * 0.5) + 'px';\n        guide.style.top = String(window.innerHeight * 0.58) + 'px';\n        guide.style.width = String(Math.max(62, Math.min(108, distance))) + 'px';\n        guide.style.transform = 'translateY(-50%) rotate(' + String(angle) + 'rad)';\n        guide.classList.add('active');\n      }`;
  source = replaceRequired(
    source,
    oldDashGuide,
    `      const distance = Math.hypot(dx, dy);\n      if (distance >= 4) this.callbacks.onDashAim?.(dx, dy);\n      else this.callbacks.onDashAim?.();`,
    'dash world preview forwarding',
  );

  source = replaceRequired(
    source,
    `      document.getElementById('highfly-dash-guide')?.classList.remove('active');\n      try { button.releasePointerCapture(event.pointerId); } catch { /* already released */ }`,
    `      this.callbacks.onDashAim?.();\n      document.getElementById('highfly-dash-guide')?.classList.remove('active');\n      try { button.releasePointerCapture(event.pointerId); } catch { /* already released */ }`,
    'dash world preview cleanup',
  );

  // Deliberate double-tap activation before the joystick takes pointer ownership.
  source = replaceRequired(
    source,
    `    const restCenterX = restRect.left + restRect.width / 2;\n    const restCenterY = restRect.top + restRect.height / 2;\n    this.joyPointer = e.pointerId;`,
    `    const restCenterX = restRect.left + restRect.width / 2;\n    const restCenterY = restRect.top + restRect.height / 2;\n\n    const now = this.now();\n    const forwardTap =\n      Math.abs(e.clientX - restCenterX) <= restRect.width * 0.34 &&\n      e.clientY <= restCenterY - restRect.height * 0.08;\n\n    // Any new joystick touch cancels an existing HIGHFLY autorun immediately.\n    if (this.input.autorun) {\n      this.moveAutorunLocked = false;\n      this.input.setAutorun(false);\n      this.moveJoystick.classList.remove('highfly-autorun');\n      this.syncMoveAutorunTarget('hidden');\n      this.highflyLastAutorunTapAt = 0;\n    } else if (\n      forwardTap &&\n      this.highflyLastAutorunTapAt > 0 &&\n      now - this.highflyLastAutorunTapAt <= 330\n    ) {\n      this.highflyLastAutorunTapAt = 0;\n      this.moveAutorunLocked = true;\n      this.input.clearTouchMove();\n      this.input.setAutorun(true);\n      this.moveJoystick.classList.add('highfly-autorun');\n      this.syncMoveAutorunTarget('locked');\n      triggerHaptic(HAPTIC_CONFIRM, this.hapticsOn);\n      return;\n    } else {\n      this.highflyLastAutorunTapAt = forwardTap ? now : 0;\n    }\n\n    this.joyPointer = e.pointerId;`,
    'double-tap autorun activation',
  );

  source = replaceRequired(
    source,
    `    this.moveAutorunLocked = false;\n    this.syncMoveAutorunTarget('hidden');\n    // Autorun is a latch from the previous joystick drag; a fresh grab is a new\n    // movement intent, so it cancels the latch before steering.\n    if (this.input.autorun) this.input.setAutorun(false);`,
    `    this.moveAutorunLocked = this.input.autorun;\n    this.syncMoveAutorunTarget(this.input.autorun ? 'locked' : 'hidden');`,
    'remove grab-to-threshold autorun reset',
  );

  const autorunPattern = /    const move = mapJoystickVector\(x, y, this\.moveDeadzone\);\n    const inAutorunTarget = isMoveAutorunPush\(rawY\);[\s\S]*?    this\.syncMoveAutorunTarget\(isMoveAutorunNear\(rawY\) \? 'near' : 'hidden'\);\n/;
  if (!autorunPattern.test(source)) throw new Error('Anchor not found: joystick push autorun block');
  source = source.replace(
    autorunPattern,
    `    const move = mapJoystickVector(x, y, this.moveDeadzone);\n    this.input.setTouchMove(move);\n    const moving = move.forward || move.back || move.strafeLeft || move.strafeRight;\n    if (moving && this.input.autorun && !this.moveAutorunLocked) this.input.setAutorun(false);\n    // Pushing the stick hard no longer arms autorun. Only the deliberate\n    // forward double-tap above can enter the locked state.\n    this.syncMoveAutorunTarget(this.input.autorun ? 'locked' : 'hidden');\n`,
  );

  source = replaceRequired(
    source,
    `  syncAutorun(on: boolean): void {\n    this.moveAutorunLocked = false;\n    this.syncMoveAutorunTarget(on ? 'locked' : 'hidden');\n  }`,
    `  syncAutorun(on: boolean): void {\n    this.moveAutorunLocked = on;\n    this.moveJoystick?.classList.toggle('highfly-autorun', on);\n    this.syncMoveAutorunTarget(on ? 'locked' : 'hidden');\n  }`,
    'autorun indicator sync',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 5) MAIN THREADING + NATIVE CREATOR SUMMARY
// ---------------------------------------------------------------------------
{
  const path = 'src/main.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    '    onDash: (screenDx, screenDy) => input.triggerTouchDash(screenDx, screenDy),',
    `    onDash: (screenDx, screenDy) => input.triggerTouchDash(screenDx, screenDy),\n    onDashAim: (screenDx, screenDy) => hud.setHighflyDashAim(screenDx, screenDy),`,
    'main dash aim callback',
  );

  source = replaceRequired(
    source,
    '  function syncGroundAimReticle(): void {',
    `  function syncHighflyDirectionalAim(): void {\n    renderer.setHighflyDirectionalAim(hud.highflyDirectionalAimGuide());\n  }\n\n  function syncGroundAimReticle(): void {`,
    'main world aim sync helper',
  );

  const renderMarker = 'if (gate.render) syncGroundAimReticle();';
  const renderCount = source.split(renderMarker).length - 1;
  if (renderCount !== 2) throw new Error(`Expected 2 ground aim render sites, found ${renderCount}`);
  source = source.replaceAll(
    renderMarker,
    `${renderMarker}\n      if (gate.render) syncHighflyDirectionalAim();`,
  );

  source = replaceRequired(
    source,
    `    if (!offlineAvailable) return;\n    show('#offline-select');`,
    `    if (!offlineAvailable) return;\n    // HIGHFLY native creator: make ENTER WORLD a true footer rather than an\n    // absolutely-positioned child of the left editor column.\n    const offlinePanel = document.getElementById('offline-select');\n    const offlineActions = offlinePanel?.querySelector('.auth-actions');\n    if (offlinePanel && offlineActions && offlineActions.parentElement !== offlinePanel) {\n      offlinePanel.appendChild(offlineActions);\n    }\n    show('#offline-select');`,
    'creator footer DOM placement',
  );

  source = replaceRequired(
    source,
    `  const classDef = CLASSES[className];\n  const details = CLASS_DETAILS[className];\n  if (!classDef || !details) return;`,
    `  const classDef = CLASSES[className];\n  const details = CLASS_DETAILS[className];\n  if (!classDef || !details) return;\n\n  // HIGHFLY native creator uses a compact Spanish combat profile. Full ability\n  // cards remain available in-game; the creation screen should explain the role\n  // and stats without clipping or leaking untranslated English source strings.\n  if (NATIVE_APP && panelId === 'offline-class-details') {\n    const nativeName: Record<PlayerClass, string> = {\n      warrior: 'GUERRERO',\n      paladin: 'PALADÍN',\n      hunter: 'CAZADOR',\n      rogue: 'PÍCARO',\n      priest: 'SACERDOTE',\n      shaman: 'CHAMÁN',\n      mage: 'MAGO',\n      warlock: 'BRUJO',\n      druid: 'DRUIDA',\n    };\n    const nativeRole: Record<PlayerClass, string> = {\n      warrior: 'Tanque / DPS cuerpo a cuerpo',\n      paladin: 'Tanque / apoyo / DPS',\n      hunter: 'DPS a distancia / movilidad',\n      rogue: 'DPS cuerpo a cuerpo / sigilo',\n      priest: 'Sanación / DPS a distancia',\n      shaman: 'Híbrido / apoyo / daño',\n      mage: 'DPS a distancia / control',\n      warlock: 'DPS a distancia / invocación',\n      druid: 'Híbrido / tanque / sanación',\n    };\n    const nativeResource: Record<string, string> = {\n      rage: 'Ira',\n      mana: 'Maná',\n      energy: 'Energía',\n      focus: 'Enfoque',\n    };\n    const s = classDef.baseStats;\n    panel.innerHTML = \`\n      <div class="class-details-content highfly-native-class-summary">\n        <div class="highfly-native-class-head">\n          <h3>\${nativeName[className]}</h3>\n          <span>\${nativeRole[className]}</span>\n        </div>\n        <div class="highfly-native-resource">RECURSO · \${nativeResource[classDef.resourceType] ?? 'Maná'}</div>\n        <div class="highfly-native-stat-grid">\n          <span>FUERZA <b>\${s.str}</b></span>\n          <span>AGILIDAD <b>\${s.agi}</b></span>\n          <span>AGUANTE <b>\${s.sta}</b></span>\n          <span>INTELECTO <b>\${s.int}</b></span>\n          <span>ESPÍRITU <b>\${s.spi}</b></span>\n          <span>ARMADURA <b>\${s.armor}</b></span>\n        </div>\n        <p>Las habilidades completas, talentos y especializaciones se desarrollan dentro del mundo.</p>\n      </div>\n    \`;\n    return;\n  }`,
    'native Spanish class summary',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 6) MOBILE PRESENTATION FINISH
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.5.5 — Action Combat Control */
body.native-app.mobile-touch #highfly-skill-stick,
body.native-app.mobile-touch #highfly-dash-guide,
body.native-app.mobile-touch #highfly-skill-aim {
  display: none !important;
}

body.native-app.mobile-touch #mobile-move-joystick.highfly-autorun::after {
  content: 'AUTO' !important;
  position: absolute !important;
  left: 50% !important;
  top: -18px !important;
  transform: translateX(-50%) !important;
  padding: 2px 7px !important;
  border-radius: 999px !important;
  border: 1px solid rgba(110, 215, 255, 0.85) !important;
  background: rgba(5, 18, 28, 0.9) !important;
  color: #bfeeff !important;
  font: 800 9px/1 sans-serif !important;
  letter-spacing: 0.7px !important;
  box-shadow: 0 0 10px rgba(80, 190, 255, 0.38) !important;
  pointer-events: none !important;
}

body.native-app.mobile-touch .mobile-action-attack.highfly-held,
body.native-app.mobile-touch #mobile-action-attack.highfly-held {
  transform: scale(0.95) !important;
  filter: brightness(1.18) !important;
}

@media (orientation: landscape) and (max-height: 820px) {
  body.native-app.mobile-touch #offline-select.highfly-native-creator:not([hidden]) {
    display: grid !important;
    grid-template-rows: auto minmax(0, 1fr) 38px !important;
    width: calc(100vw - 18px) !important;
    max-width: calc(100vw - 18px) !important;
    height: calc(100dvh - 10px) !important;
    max-height: calc(100dvh - 10px) !important;
    margin: 5px auto !important;
    padding: 5px 8px !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .auth-title {
    margin: 0 0 3px !important;
    font-size: 15px !important;
    line-height: 1.05 !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-layout {
    grid-row: 2 !important;
    min-height: 0 !important;
    height: 100% !important;
    grid-template-columns: minmax(0, 1.42fr) minmax(0, 0.78fr) !important;
    gap: 8px !important;
    padding-bottom: 0 !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .char-create {
    padding-bottom: 0 !important;
    height: 100% !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance {
    min-height: 0 !important;
    max-height: none !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    padding-right: 3px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-right {
    display: grid !important;
    grid-template-rows: minmax(118px, 0.9fr) minmax(118px, 1.1fr) !important;
    min-width: 0 !important;
    min-height: 0 !important;
    overflow: hidden !important;
    gap: 5px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-preview-container {
    min-width: 0 !important;
    min-height: 118px !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-class-details {
    min-width: 0 !important;
    min-height: 0 !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
    padding: 0 !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .highfly-native-class-summary {
    height: 100% !important;
    min-height: 0 !important;
    box-sizing: border-box !important;
    padding: 8px 9px !important;
    overflow-y: auto !important;
    background: linear-gradient(180deg, rgba(15, 14, 21, 0.94), rgba(8, 8, 13, 0.94)) !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .highfly-native-class-head h3 {
    margin: 0 !important;
    color: #e3a077 !important;
    font-size: 18px !important;
    line-height: 1 !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .highfly-native-class-head span {
    display: block !important;
    margin-top: 3px !important;
    color: #d9b94e !important;
    font: 800 10px/1.1 sans-serif !important;
    text-transform: uppercase !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .highfly-native-resource {
    margin: 7px 0 5px !important;
    color: #cfc5aa !important;
    font: 700 9px/1 sans-serif !important;
    letter-spacing: 0.7px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .highfly-native-stat-grid {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 4px 7px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .highfly-native-stat-grid span {
    display: flex !important;
    justify-content: space-between !important;
    gap: 6px !important;
    min-width: 0 !important;
    padding: 3px 5px !important;
    border: 1px solid rgba(151, 118, 48, 0.36) !important;
    border-radius: 5px !important;
    color: #bdb6a5 !important;
    font: 700 8.5px/1 sans-serif !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .highfly-native-stat-grid b {
    color: #f1d477 !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .highfly-native-class-summary p {
    margin: 6px 0 0 !important;
    color: #a9a39a !important;
    font: 500 9px/1.2 sans-serif !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator > .auth-actions {
    grid-row: 3 !important;
    position: static !important;
    left: auto !important;
    right: auto !important;
    bottom: auto !important;
    transform: none !important;
    justify-self: center !important;
    align-self: center !important;
    display: block !important;
    width: auto !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    overflow: visible !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator > .auth-actions #btn-start-offline {
    min-width: 170px !important;
    height: 31px !important;
    min-height: 31px !important;
    padding: 0 24px !important;
    border-radius: 999px !important;
    font-size: 11px !important;
    line-height: 29px !important;
  }
}
`;
  write(path, css);
}

console.log('[HIGHFLY v0.5.5] Action Combat Control patch complete.');

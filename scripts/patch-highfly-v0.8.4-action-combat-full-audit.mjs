import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.4] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// 1) BASIC ATTACK = ACTION INPUT, NOT A TAB-TARGET REQUIREMENT
//
// Every class may press ATTACK with no marked target. The simulation performs a
// restrained frontal acquisition using the class's real melee/ranged profile.
// A manually selected valid hostile still wins. If the current target dies or
// vanishes while auto-attack remains armed, the same narrow action cone can
// acquire the next hostile instead of turning the attack button off.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/auto_attack.ts';
  let source = read(path);

  const helperAnchor = 'export function startAutoAttack(ctx: SimContext, pid?: number): void {';
  const helper = `const HIGHFLY_BASIC_ASSIST_HALF_ANGLE = (58 * Math.PI) / 180;\nconst HIGHFLY_BASIC_TARGET_PADDING = 1.25;\n\nfunction highflyAcquireBasicTarget(\n  ctx: SimContext,\n  p: Entity,\n  meta: PlayerMeta,\n): Entity | null {\n  const ranged = highflyRangedAutoProfile(ctx, p, meta);\n  const maxRange = Math.max(MELEE_RANGE + HIGHFLY_BASIC_TARGET_PADDING, ranged?.maxRange ?? 0);\n  let best: Entity | null = null;\n  let bestScore = Number.POSITIVE_INFINITY;\n\n  for (const entity of ctx.entities.values()) {\n    if (entity.id === p.id || entity.dead || hasEscapeStealth(entity)) continue;\n    if (!ctx.isHostileTo(p, entity)) continue;\n\n    const distance = dist2d(p.pos, entity.pos);\n    if (distance <= 0.001 || distance > maxRange) continue;\n\n    // Hunter keeps its authored 8 yd ranged dead-zone, but may still fight in\n    // actual melee range. Do not magnetize the basic attack into the unusable\n    // gap between those two legal bands.\n    if (ranged && !ranged.wand && distance < ranged.minRange && distance > MELEE_RANGE) continue;\n    if (!ctx.hasLineOfSight(p, entity)) continue;\n\n    const facingDiff = Math.abs(normAngle(angleTo(p.pos, entity.pos) - p.facing));\n    const halfAngle = distance <= MELEE_RANGE + 0.5\n      ? Math.max(MELEE_ARC, HIGHFLY_BASIC_ASSIST_HALF_ANGLE)\n      : HIGHFLY_BASIC_ASSIST_HALF_ANGLE;\n    if (facingDiff > halfAngle) continue;\n\n    // Direction dominates distance so the helper never behaves like a\n    // screen-wide MMO target selector. Distance only breaks close angular ties.\n    const score = facingDiff * 4 + distance / Math.max(1, maxRange);\n    if (score < bestScore) {\n      bestScore = score;\n      best = entity;\n    }\n  }\n\n  return best;\n}\n\n`;
  source = replaceRequired(source, helperAnchor, helper + helperAnchor, 'basic action target helper');

  source = replaceRequired(
    source,
    '  const t = p.targetId !== null ? ctx.entities.get(p.targetId) : null;',
    '  let t = p.targetId !== null ? ctx.entities.get(p.targetId) : null;',
    'startAutoAttack mutable target',
  );

  source = replaceRequired(
    source,
    '  if (t?.dead) return;',
    `  if (!t || t.dead || !ctx.isHostileTo(p, t) || hasEscapeStealth(t)) {\n    const assisted = highflyAcquireBasicTarget(ctx, p, r.meta);\n    if (assisted) {\n      p.targetId = assisted.id;\n      t = assisted;\n    } else {\n      p.targetId = null;\n      t = null;\n    }\n  }`,
    'targetless basic acquisition on press',
  );

  source = replaceRequired(
    source,
    `  if (!t || !ctx.isHostileTo(p, t) || hasEscapeStealth(t)) {\n    ctx.error(p.id, 'Invalid attack target.');\n    return;\n  }`,
    `  if (!t) {\n    // Empty-space ATTACK is a valid HIGHFLY action. Arm the loop silently; a\n    // hostile entering the frontal assist cone can be acquired on a later tick.\n    if (p.mountKey !== '') forceDismount(ctx, p);\n    if (p.sitting) ctx.standUp(p);\n    if (p.weaponStowed) drawWeapon(p);\n    p.autoAttack = true;\n    r.meta.lastActiveTick = ctx.tickCount;\n    return;\n  }`,
    'no invalid-target error for targetless basic',
  );

  source = replaceRequired(
    source,
    '  const t = p.targetId !== null ? ctx.entities.get(p.targetId) : null;',
    '  let t = p.targetId !== null ? ctx.entities.get(p.targetId) : null;',
    'update auto attack mutable target',
  );

  source = replaceRequired(
    source,
    `  if (!t || t.dead || !ctx.isHostileTo(p, t) || hasEscapeStealth(t)) {\n    p.autoAttack = false;\n    return;\n  }`,
    `  if (!t || t.dead || !ctx.isHostileTo(p, t) || hasEscapeStealth(t)) {\n    const assisted = highflyAcquireBasicTarget(ctx, p, meta);\n    if (!assisted) {\n      p.targetId = null;\n      return;\n    }\n    p.targetId = assisted.id;\n    t = assisted;\n  }`,
    'continuous frontal reacquisition after target loss',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) TOUCH OWNERSHIP — LEFT THUMB CAN NEVER BECOME CAMERA
//
// ClaudeCraft already has a pointer-owner ledger for joystick/buttons, but open
// canvas on the left could still begin swipe-look. HIGHFLY reserves the left
// 48% of the landscape viewport for locomotion ownership for the full lifetime
// of that touch. Camera swipe-look starts only on the right gameplay side.
// ---------------------------------------------------------------------------
{
  const path = 'src/game/mobile_controls.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    'const SWIPE_LOOK_DEADZONE_PX = 6;',
    `const SWIPE_LOOK_DEADZONE_PX = 6;\nexport const HIGHFLY_CAMERA_START_X_RATIO = 0.48;\n\nexport function highflyCameraSwipeMayStart(clientX: number, viewportWidth: number): boolean {\n  if (!Number.isFinite(clientX) || !Number.isFinite(viewportWidth) || viewportWidth <= 0) return false;\n  return clientX > viewportWidth * HIGHFLY_CAMERA_START_X_RATIO;\n}`,
    'left-thumb camera ownership helper',
  );

  source = replaceRequired(
    source,
    '  private onSwipeLookDown(e: PointerEvent): void {',
    `  private onSwipeLookDown(e: PointerEvent): void {\n    // Pointer ownership is decided at DOWN and never changes sides mid-gesture.\n    // This protects the movement thumb even when it begins on open canvas rather\n    // than directly on the floating joystick element.\n    if (!highflyCameraSwipeMayStart(e.clientX, window.innerWidth)) return;`,
    'camera begins only on right side',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) REGRESSION: NINE TARGETLESS BASICS + ALL-CLASS GEOMETRY CONTRACTS
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v084_action_combat_full_audit.test.ts';
  const content = `import fs from 'node:fs';\nimport { describe, expect, it } from 'vitest';\nimport { ABILITIES, CLASSES, MOBS } from '../src/sim/data';\nimport { createMob } from '../src/sim/entity';\nimport { Sim } from '../src/sim/sim';\nimport { ALL_CLASSES, type Entity, type PlayerClass } from '../src/sim/types';\nimport { groundHeight } from '../src/sim/world';\n\nconst RANGED_BASIC_CLASSES = new Set<PlayerClass>([\n  'hunter',\n  'priest',\n  'shaman',\n  'mage',\n  'warlock',\n  'druid',\n]);\n\nfunction nearestMob(sim: Sim, templateId: string): Entity {\n  const p = sim.player;\n  let best: Entity | null = null;\n  let bestD = Infinity;\n  for (const entity of sim.entities.values()) {\n    if (entity.kind !== 'mob' || entity.dead || entity.templateId !== templateId) continue;\n    const d = Math.hypot(entity.pos.x - p.pos.x, entity.pos.z - p.pos.z);\n    if (d < bestD) {\n      best = entity;\n      bestD = d;\n    }\n  }\n  if (!best) throw new Error('no ' + templateId + ' in world');\n  return best;\n}\n\nfunction installOnlyTarget(sim: Sim, id: number, distance: number): Entity {\n  const p = sim.player;\n  const anchor = nearestMob(sim, 'forest_wolf');\n  const ax = anchor.pos.x;\n  const az = anchor.pos.z;\n\n  // Remove ambient candidates so the test proves the exact targetless contract\n  // instead of accidentally acquiring a pre-seeded world mob.\n  for (const entity of sim.entities.values()) {\n    if (entity.kind === 'mob') entity.dead = true;\n  }\n\n  p.pos.x = ax + distance;\n  p.pos.z = az;\n  p.pos.y = groundHeight(p.pos.x, p.pos.z, sim.cfg.seed);\n  p.prevPos = { ...p.pos };\n  (sim as unknown as { rebucket(e: Entity): void }).rebucket(p);\n\n  const dummy = createMob(id, MOBS.training_dummy, 1, {\n    x: ax,\n    y: groundHeight(ax, az, sim.cfg.seed),\n    z: az,\n  });\n  dummy.hostile = true;\n  dummy.dead = false;\n  dummy.maxHp = dummy.hp = 1_000_000;\n  dummy.level = 1;\n  dummy.stats.armor = 0;\n  (sim as unknown as { addEntity(e: Entity): void }).addEntity(dummy);\n\n  p.facing = Math.atan2(dummy.pos.x - p.pos.x, dummy.pos.z - p.pos.z);\n  p.targetId = null;\n  p.autoAttack = false;\n  p.swingTimer = 0;\n  p.offhandSwingTimer = 0;\n  p.resource = p.maxResource;\n  return dummy;\n}\n\nfunction isDamageEffect(type: string): boolean {\n  const normalized = type.toLowerCase();\n  return normalized.includes('damage') || normalized.includes('strike');\n}\n\ndescribe('HIGHFLY v0.8.4 full action-combat audit', () => {\n  it('lets every one of the nine classes acquire and land a basic attack with no manual target', () => {\n    for (let index = 0; index < ALL_CLASSES.length; index += 1) {\n      const classId = ALL_CLASSES[index];\n      const sim = new Sim({ seed: 840 + index, playerClass: classId });\n      sim.setPlayerLevel(20);\n      const distance = classId === 'hunter' ? 10 : RANGED_BASIC_CLASSES.has(classId) ? 8 : 3;\n      const dummy = installOnlyTarget(sim, 98400 + index, distance);\n      const p = sim.player;\n\n      expect(p.targetId, classId + ':precondition-target').toBeNull();\n      sim.startAutoAttack();\n      expect(p.targetId, classId + ':soft-basic-target').toBe(dummy.id);\n\n      let landed = false;\n      for (let tick = 0; tick < 20 * 12; tick += 1) {\n        for (const event of sim.tick()) {\n          if (\n            event.type === 'damage' &&\n            event.sourceId === p.id &&\n            event.targetId === dummy.id &&\n            event.amount > 0\n          ) {\n            landed = true;\n          }\n        }\n        if (landed) break;\n      }\n\n      expect(landed, classId + ':targetless-basic-landed').toBe(true);\n    }\n  });\n\n  it('keeps the basic assist narrow, forward-facing and able to stay armed in empty space', () => {\n    const attacks = fs.readFileSync('src/sim/combat/auto_attack.ts', 'utf8');\n    expect(attacks).toContain('HIGHFLY_BASIC_ASSIST_HALF_ANGLE = (58 * Math.PI) / 180');\n    expect(attacks).toContain('highflyAcquireBasicTarget(ctx, p, r.meta)');\n    expect(attacks).toContain('highflyAcquireBasicTarget(ctx, p, meta)');\n    expect(attacks).toContain('p.autoAttack = true');\n    expect(attacks).not.toContain("ctx.error(p.id, 'Invalid attack target.');");\n  });\n\n  it('reserves the left thumb side for movement ownership, never swipe-look', () => {\n    const mobile = fs.readFileSync('src/game/mobile_controls.ts', 'utf8');\n    expect(mobile).toContain('HIGHFLY_CAMERA_START_X_RATIO = 0.48');\n    expect(mobile).toContain('highflyCameraSwipeMayStart(e.clientX, window.innerWidth)');\n    expect(mobile).toContain('private touchOwners = new TouchOwnerLedger()');\n  });\n\n  it('audits every class offensive definition and pins generic AoE geometry to bodies, not the selected target', () => {\n    let offensive = 0;\n    let frontal = 0;\n    let ground = 0;\n\n    for (const classId of ALL_CLASSES) {\n      const cls = CLASSES[classId];\n      expect(cls, classId).toBeDefined();\n      for (const abilityId of cls.abilities) {\n        const ability = ABILITIES[abilityId];\n        expect(ability, classId + ':' + abilityId).toBeDefined();\n        if (!ability) continue;\n\n        const effects = ability.effects ?? [];\n        if (effects.some((effect) => isDamageEffect(String(effect.type)))) offensive += 1;\n        if (ability.targetMode === 'position') ground += 1;\n\n        for (const effect of effects) {\n          if (effect.type !== 'aoeDamage' || effect.frontal !== true) continue;\n          frontal += 1;\n          expect(effect.radius, classId + ':' + abilityId + ':frontal-radius').toBeGreaterThan(0);\n          if (effect.frontalHalfAngle !== undefined) {\n            expect(Number.isFinite(effect.frontalHalfAngle), classId + ':' + abilityId + ':frontal-angle').toBe(true);\n            expect(effect.frontalHalfAngle, classId + ':' + abilityId + ':frontal-angle').toBeGreaterThan(0);\n          }\n        }\n      }\n    }\n\n    expect(offensive).toBeGreaterThan(40);\n    expect(frontal).toBeGreaterThan(0);\n    expect(ground).toBeGreaterThan(0);\n\n    const dispatch = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');\n    expect(dispatch).toContain('for (const m of ctx.hostilesInRadius(p, aoeCenter, eff.radius))');\n    expect(dispatch).toContain('if (eff.frontal)');\n    expect(dispatch).toContain('eff.frontalHalfAngle ?? MELEE_ARC');\n\n    // Approved bespoke spatial engines remain multi-body as well.\n    expect(dispatch).toContain("ability.id === 'sinister_strike'");\n    expect(dispatch).toContain('highflyExtraHits');\n    expect(dispatch).toContain("ability.id === 'lightning_bolt'");\n    expect(dispatch).toContain('highflyArcHalfAngle');\n  });\n\n  it('keeps the full mobile skill geometry language for all classes', () => {\n    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');\n    expect(hud).toContain("shape: 'line' | 'cone' | 'circle' | 'dash'");\n    expect(hud).toContain("def?.targetMode === 'position'");\n    expect(hud).toContain("effect.type === 'aoeDamage' && effect.frontal === true");\n    expect(hud).toContain("effect.type === 'empoweredCone'");\n    expect(hud).toContain("effect.type === 'frozenOrb'");\n    expect(hud).toContain('this.highflyDirectionalNoTarget(resolved)');\n  });\n});\n`;
  write(path, content);
}

console.log('[HIGHFLY v0.8.4] nine targetless basic loops + persistent frontal reacquisition + left-thumb camera ownership + full ability geometry audit installed.');

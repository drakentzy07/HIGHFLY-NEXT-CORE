import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.7.0] patched ${path}`);
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// ---------------------------------------------------------------------------
// 1) SMART TAP + MANUAL-FIRST AIM
// Tap = restrained assistance. Drag = player direction with only a micro lane
// tolerance, never a broad retarget. No valid tap target = cast straight ahead.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  const helperAnchor = '  private highflyEnsureSkillStick(): HTMLDivElement {';
  const helpers = `  private highflyTapAimPriority(): 'dynamic' | 'nearest' | 'lowest_hp' | 'lowest_pct' {\n    try {\n      const value = localStorage.getItem('highfly.aim.priority.v1');\n      if (value === 'nearest' || value === 'lowest_hp' || value === 'lowest_pct') return value;\n    } catch { /* storage is optional */ }\n    return 'dynamic';\n  }\n\n  private highflyForwardAim(barSlot: number, facing: number, distancePct = 1): { x: number; z: number } {\n    const profile = this.highflyAimProfile(barSlot);\n    const distance = Math.max(1.5, profile.range * Math.max(0.2, Math.min(1, distancePct)));\n    return {\n      x: this.sim.player.pos.x + Math.sin(facing) * distance,\n      z: this.sim.player.pos.z + Math.cos(facing) * distance,\n    };\n  }\n\n  private highflyPickSmartTapTarget(barSlot: number, facing: number): number | null {\n    const resolved = this.abilityForSlot(barSlot);\n    if (!resolved || resolved.def.selfCentered || resolved.def.targetType === 'friendly' || resolved.def.targetsDead) {\n      return null;\n    }\n\n    const player = this.sim.player;\n    const maxRange = Math.max(4, resolved.def.range ?? this.highflyAimProfile(barSlot).range) + 0.75;\n    const halfAssistAngle = (58 * Math.PI) / 180;\n    const priority = this.highflyTapAimPriority();\n\n    const validHostile = (entity: typeof player): boolean => {\n      if (entity.id === player.id || entity.dead) return false;\n      if (!(entity.hostile || isPvpHostileTarget(entity.id, this.sim.duelInfo, this.sim.arenaInfo))) return false;\n      const dx = entity.pos.x - player.pos.x;\n      const dz = entity.pos.z - player.pos.z;\n      return Math.hypot(dx, dz) <= maxRange;\n    };\n\n    // A manually selected target is explicit intent and therefore wins while valid.\n    if (player.targetId !== null) {\n      const locked = this.sim.entities.get(player.targetId);\n      if (locked && validHostile(locked)) return locked.id;\n    }\n\n    let bestId: number | null = null;\n    let bestScore = Number.POSITIVE_INFINITY;\n    for (const entity of this.sim.entities.values()) {\n      if (!validHostile(entity)) continue;\n      const dx = entity.pos.x - player.pos.x;\n      const dz = entity.pos.z - player.pos.z;\n      const distance = Math.hypot(dx, dz);\n      if (distance <= 0.001) continue;\n      const bearing = Math.atan2(dx, dz);\n      const diff = Math.atan2(Math.sin(bearing - facing), Math.cos(bearing - facing));\n      const absDiff = Math.abs(diff);\n      if (absDiff > halfAssistAngle) continue;\n\n      const hpPct = entity.maxHp > 0 ? entity.hp / entity.maxHp : 1;\n      const angleNorm = absDiff / halfAssistAngle;\n      const distanceNorm = distance / maxRange;\n      let score: number;\n      if (priority === 'nearest') {\n        score = distanceNorm * 4 + angleNorm * 1.6;\n      } else if (priority === 'lowest_hp') {\n        score = entity.hp * 0.001 + distanceNorm * 0.45 + angleNorm * 0.8;\n      } else if (priority === 'lowest_pct') {\n        score = hpPct * 4 + distanceNorm * 0.5 + angleNorm * 0.8;\n      } else {\n        // Dynamic is intentionally restrained: direction + distance matter more\n        // than execute bias, so tap assist never feels like a screen-wide magnet.\n        score = angleNorm * 2.8 + distanceNorm * 1.7 + hpPct * 0.55;\n      }\n      if (score < bestScore) {\n        bestScore = score;\n        bestId = entity.id;\n      }\n    }\n    return bestId;\n  }\n\n  private highflyPickManualMicroAssistTarget(barSlot: number, aimFacing: number): number | null {\n    const resolved = this.highflyMobileAimDef(barSlot);\n    if (!resolved || resolved.def.targetMode === 'position') return null;\n    const profile = this.highflyAimProfile(barSlot);\n    const player = this.sim.player;\n    const maxRange = Math.max(4, profile.range + 0.75);\n    const maxAngle = profile.shape === 'cone'\n      ? Math.max((profile.angleDeg * Math.PI) / 360, (8 * Math.PI) / 180)\n      : (7 * Math.PI) / 180;\n    let bestId: number | null = null;\n    let bestScore = Number.POSITIVE_INFINITY;\n\n    for (const entity of this.sim.entities.values()) {\n      if (entity.id === player.id || entity.dead) continue;\n      if (!(entity.hostile || isPvpHostileTarget(entity.id, this.sim.duelInfo, this.sim.arenaInfo))) continue;\n      const dx = entity.pos.x - player.pos.x;\n      const dz = entity.pos.z - player.pos.z;\n      const distance = Math.hypot(dx, dz);\n      if (distance <= 0.001 || distance > maxRange) continue;\n      const bearing = Math.atan2(dx, dz);\n      const diff = Math.atan2(Math.sin(bearing - aimFacing), Math.cos(bearing - aimFacing));\n      const absDiff = Math.abs(diff);\n      if (absDiff > maxAngle) continue;\n      const score = absDiff * 30 + distance * 0.015;\n      if (score < bestScore) {\n        bestScore = score;\n        bestId = entity.id;\n      }\n    }\n    return bestId;\n  }\n\n`;
  source = replaceRequired(source, helperAnchor, helpers + helperAnchor, 'smart aim helper insertion');

  const quickTapOld = `      if (!wasManual) {\n        // Fast tap stays convenient: targeted abilities use HIGHFLY soft aim;\n        // ground abilities enter ClaudeCraft's existing ground-target mode.\n        this.castSlot(castSlot);\n        button.blur();\n        return;\n      }`;
  const quickTapNew = `      if (!wasManual) {\n        const facing = this.sim.player.facing;\n        const smartTargetId = this.highflyPickSmartTapTarget(castSlot, facing);\n\n        if (resolved.def.targetMode === 'position') {\n          const smartTarget = smartTargetId !== null ? this.sim.entities.get(smartTargetId) : null;\n          const aim = smartTarget\n            ? { x: smartTarget.pos.x, z: smartTarget.pos.z }\n            : this.highflyForwardAim(castSlot, facing);\n          this.sim.castAbilityAt(resolved.def.id, aim);\n          button.blur();\n          return;\n        }\n\n        if (resolved.def.requiresTarget && resolved.def.targetType !== 'friendly' && !resolved.def.targetsDead) {\n          if (smartTargetId !== null) {\n            this.sim.targetEntity(smartTargetId);\n            this.castSlot(castSlot);\n          } else {\n            // No monster in the restrained assist cone: do not refuse the input\n            // and do not hunt elsewhere. Fire exactly forward as an intentional cast.\n            this.sim.castAbilityAt(resolved.def.id, this.highflyForwardAim(castSlot, facing));\n          }\n          button.blur();\n          return;\n        }\n\n        this.castSlot(castSlot);\n        button.blur();\n        return;\n      }`;
  source = replaceRequired(source, quickTapOld, quickTapNew, 'smart tap cast branch');

  source = replaceRequired(
    source,
    '      const targetId = this.highflyPickDirectionalTarget(castSlot, facing);',
    '      const targetId = this.highflyPickManualMicroAssistTarget(castSlot, facing);',
    'manual drag micro-assist target',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) HIGHFLY COMBAT GCD
// Keep authored cooldowns/cast times, but reduce the generic lock between combat
// actions. Non-spell profession casts are intentionally unaffected.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/casting_lifecycle.ts';
  let source = read(path);
  const oldGcd = `  const gcd = Math.max(MIN_GCD, ctx.playerGcdFor(meta.cls) / spellHasteMult(p));`;
  const newGcd = `  const highflyCombatGcdMult = isNonSpellCast(ability.id) ? 1 : 0.75;\n  const gcd = Math.max(\n    MIN_GCD,\n    (ctx.playerGcdFor(meta.cls) * highflyCombatGcdMult) / spellHasteMult(p),\n  );`;
  source = replaceRequired(source, oldGcd, newGcd, 'HIGHFLY combat GCD');
  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) BASIC ATTACK RECOVERY
// v0.6.6 proved the sim-owned cadence path. v0.7 tightens it another notch so
// attacks feel action-RPG responsive without returning to pointer-spam.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/auto_attack.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    'const HIGHFLY_AUTO_ATTACK_INTERVAL_MULT = 0.68;',
    'const HIGHFLY_AUTO_ATTACK_INTERVAL_MULT = 0.60;',
    'HIGHFLY v0.7 basic recovery',
  );
  write(path, source);
}

// v0.7 intentionally supersedes the v0.6.6 cadence value. Keep the older
// regression suite active for creator/casting coverage, but align only its
// cadence assertion with the new simulation-owned recovery value.
{
  const path = 'tests/highfly_v066_creator_combat_flow.test.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    'HIGHFLY_AUTO_ATTACK_INTERVAL_MULT = 0.68',
    'HIGHFLY_AUTO_ATTACK_INTERVAL_MULT = 0.60',
    'v0.6.6 cadence contract alignment',
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) REGRESSION CONTRACTS
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v070_combat_core.test.ts';
  const content = `import fs from 'node:fs';\nimport { describe, expect, it } from 'vitest';\n\ndescribe('HIGHFLY v0.7.0 combat core', () => {\n  it('uses restrained smart tap but manual drag keeps a micro-assist lane', () => {\n    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');\n    expect(hud).toContain('highflyPickSmartTapTarget');\n    expect(hud).toContain('highflyPickManualMicroAssistTarget');\n    expect(hud).toContain("localStorage.getItem('highfly.aim.priority.v1')");\n    expect(hud).toContain("const halfAssistAngle = (58 * Math.PI) / 180");\n    expect(hud).toContain("const maxAngle = profile.shape === 'cone'");\n    expect(hud).toContain('this.highflyForwardAim(castSlot, facing)');\n  });\n\n  it('fires tap casts forward when no assisted target exists', () => {\n    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');\n    expect(hud).toContain('No monster in the restrained assist cone');\n    expect(hud).toContain('this.sim.castAbilityAt(resolved.def.id, this.highflyForwardAim(castSlot, facing))');\n  });\n\n  it('shortens combat GCD without changing profession casts', () => {\n    const lifecycle = fs.readFileSync('src/sim/combat/casting_lifecycle.ts', 'utf8');\n    expect(lifecycle).toContain('isNonSpellCast(ability.id) ? 1 : 0.75');\n    expect(lifecycle).toContain('ctx.playerGcdFor(meta.cls) * highflyCombatGcdMult');\n  });\n\n  it('uses a 0.60 real-sim basic attack interval', () => {\n    const attacks = fs.readFileSync('src/sim/combat/auto_attack.ts', 'utf8');\n    expect(attacks).toContain('HIGHFLY_AUTO_ATTACK_INTERVAL_MULT = 0.60');\n  });\n\n  it('keeps ClaudeCraft spell queue support instead of layering a second timer buffer', () => {\n    const types = fs.readFileSync('src/sim/types.ts', 'utf8');\n    const lifecycle = fs.readFileSync('src/sim/combat/casting_lifecycle.ts', 'utf8');\n    expect(types).toContain('CAST_QUEUE_WINDOW_SEC = 0.4');\n    expect(lifecycle).toContain('queuedCastAbility');\n  });\n});\n`;
  write(path, content);
}

console.log('[HIGHFLY v0.7.0] smart tap + manual-first aim + faster combat recovery applied.');

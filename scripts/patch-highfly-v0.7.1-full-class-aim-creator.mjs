import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.7.1] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// 1) ONE MANUAL-AIM POLICY FOR ALL NINE CLASSES
// Drag direction belongs to the player. Ordinary hostile direct attacks may
// deliberately whiff; target-contract abilities (charge, execute, dispel, etc.)
// keep their authored rules. Finisher damage can whiff, but spends its combo bank.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/highfly_action_aim.ts';
  const content = `import type { AbilityDef, AbilityEffect } from './types';

const DIRECT_ACTION_EFFECTS = new Set<string>([
  'directDamage',
  'weaponDamage',
  'weaponStrike',
  'chainDamage',
  'finisherDamage',
]);

const SPECIAL_TARGET_EFFECTS = new Set<string>([
  'polymorph',
  'taunt',
  'tamePet',
  'charge',
  'feralCharge',
  'packCommand',
  'unleashBeast',
  'hunterBloodhook',
  'dispel',
]);

const SPECIAL_TARGET_ABILITY_IDS = new Set<string>([
  'unleash_weapon',
  'conflagrate',
  'sentence',
  'coven',
  'possess_evil_eye',
  'hour_of_judgment',
  'litany_of_guilt',
]);

export function highflyManualMissConsumesCombo(
  ability: AbilityDef,
  effects: readonly AbilityEffect[],
): boolean {
  return (
    !!ability.spendsCombo &&
    effects.some((effect) => String(effect.type) === 'finisherDamage')
  );
}

export function highflyManualAimMissAllowed(
  ability: AbilityDef,
  effects: readonly AbilityEffect[],
  aim: { x: number; z: number } | undefined,
  castTargetId: number | null,
): boolean {
  if (!aim || castTargetId !== -1) return false;
  if (!ability.requiresTarget || ability.targetType === 'friendly' || ability.targetsDead) return false;
  if (ability.targetMode === 'position' || ability.channel || ability.onNextSwing) return false;
  if (ability.executeThreshold !== undefined || ability.requiresTargetHpBelow !== undefined) return false;
  if (ability.requiresDodgeProc) return false;
  if (SPECIAL_TARGET_ABILITY_IDS.has(ability.id)) return false;

  const directAction = effects.some((effect) => DIRECT_ACTION_EFFECTS.has(String(effect.type)));
  if (!directAction) return false;

  // A combo-point utility/CC finisher still needs a real target. Damage finishers
  // are spatial attacks in HIGHFLY and may be committed into empty space.
  if (ability.spendsCombo && !highflyManualMissConsumesCombo(ability, effects)) return false;

  const specialTargetContract = effects.some((effect) =>
    SPECIAL_TARGET_EFFECTS.has(String(effect.type)),
  );
  return !specialTargetContract;
}
`;
  write(path, content);
}

// ---------------------------------------------------------------------------
// 2) CAST LIFECYCLE: MANUAL WHIFF NEVER FALLS BACK TO THE STALE TARGET
// Keep every generic gate (resource, GCD, cooldown, stealth, form, etc.) but skip
// entity-only target/range/facing contracts after the explicit MISS sentinel.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/casting_lifecycle.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    "import { hasEscapeStealth } from '../threat';",
    "import { hasEscapeStealth } from '../threat';\nimport { highflyManualAimMissAllowed, highflyManualMissConsumesCombo } from '../highfly_action_aim';",
    'HIGHFLY manual aim policy import',
  );

  const helperStart = source.indexOf('function highflyManualAimMissAllowed(');
  const helperEnd = source.indexOf('export function castAbility(', helperStart);
  if (helperStart < 0 || helperEnd < 0) {
    throw new Error('Anchor not found: legacy HIGHFLY manual aim helper');
  }
  source = source.slice(0, helperStart) + source.slice(helperEnd);

  source = source.replaceAll(
    'highflyManualAimMissAllowed(ability, res,',
    'highflyManualAimMissAllowed(ability, res.effects,',
  );

  const targetStartNeedle =
    "  let target: Entity | null = null;\n  if (ability.id === 'unleash_weapon') {";
  const groundNeedle =
    "\n  // Ground-targeted abilities aim at a world point instead of an entity.";
  const targetStart = source.indexOf(targetStartNeedle);
  const targetEnd = source.indexOf(groundNeedle, targetStart);
  if (targetStart < 0 || targetEnd < 0) {
    throw new Error('Anchor not found: cast target-resolution block');
  }

  const targetBlock = source.slice(targetStart, targetEnd);
  const declaration = '  let target: Entity | null = null;\n';
  if (!targetBlock.startsWith(declaration)) {
    throw new Error('Unexpected target-resolution declaration');
  }
  const targetBody = targetBlock.slice(declaration.length);
  const indentedBody = targetBody
    .split('\n')
    .map((line) => (line.length ? `  ${line}` : line))
    .join('\n');
  const wrappedTargetBlock =
    declaration +
    '  if (!highflyManualMiss) {\n' +
    indentedBody +
    '\n  }';
  source = source.slice(0, targetStart) + wrappedTargetBlock + source.slice(targetEnd);

  source = replaceRequired(
    source,
    `    spendResource(p, missCost);\n    armAbilityCooldownWithReflection(ctx, p, meta, res, togglingOff);`,
    `    spendResource(p, missCost);\n    if (highflyManualMissConsumesCombo(ability, res.effects)) p.comboPoints = 0;\n    armAbilityCooldownWithReflection(ctx, p, meta, res, togglingOff);`,
    'manual miss combo commitment',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) HUD: COMMIT THE CHARACTER FACING TO THE DRAGGED WORLD DIRECTION
// A valid micro-assisted target and an intentional miss now share the same facing.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    `      const facing = this.highflyScreenAimFacing(dx, dy);\n      if (resolved.def.targetMode === 'position') {`,
    `      const facing = this.highflyScreenAimFacing(dx, dy);\n      // Manual action aim owns the hunter's intent: turn toward the dragged world\n      // heading before target/facing validation instead of reusing stale facing.\n      this.sim.player.facing = facing;\n      if (resolved.def.targetMode === 'position') {`,
    'manual drag facing commit',
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) CREATOR FINAL POLISH
// - Class attributes become 3 x 2, never six clipped pills in one line.
// - Full class sheet can scroll as a safety valve.
// - "Enter World" lives in the intentionally empty lower-left class area.
// - Keep the already-good Appearance 50/50 preview untouched.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/creator_steps.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    "important(refs.classDetails, 'overflow', 'hidden');",
    "important(refs.classDetails, 'overflow', 'auto');",
    'class details overflow safety',
  );
  write(path, source);
}

{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.7.1 — creator finish pass: ordered class stage, no clipped stats. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-auto-rows: minmax(25px, auto) !important;
    gap: 4px !important;
    width: 100% !important;
    min-width: 0 !important;
    margin: 3px 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span {
    width: 100% !important;
    min-width: 0 !important;
    min-height: 25px !important;
    height: auto !important;
    padding: 3px 5px !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 4px !important;
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: clip !important;
    font-size: 7.8px !important;
    line-height: 1.05 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    overflow-x: hidden !important;
    overflow-y: auto !important;
    scrollbar-width: thin;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 6px !important;
    margin-top: 4px !important;
    align-content: start !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker .mini-class {
    min-height: 31px !important;
    height: 31px !important;
    box-sizing: border-box !important;
  }

  /* Use the quiet lower-left half for the primary CTA instead of floating it
     across the seam between class picker and preview. */
  body.native-app #offline-select[data-hf-creator-step="class"] #btn-start-offline {
    position: absolute !important;
    left: 10px !important;
    right: auto !important;
    bottom: 51px !important;
    width: calc(50% - 15px) !important;
    max-width: none !important;
    height: 38px !important;
    margin: 0 !important;
    z-index: 6 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .auth-actions {
    min-height: 0 !important;
    height: 0 !important;
    flex: 0 0 0 !important;
    overflow: visible !important;
  }
}
`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// 5) REAL REGRESSION + NINE-CLASS REGISTRY AUDIT
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v071_full_class_aim_creator.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABILITIES, CLASSES } from '../src/sim/content/classes';
import { createMob } from '../src/sim/entity';
import {
  highflyManualAimMissAllowed,
  highflyManualMissConsumesCombo,
} from '../src/sim/highfly_action_aim';
import { MOBS } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import type { Entity, PlayerClass } from '../src/sim/types';

const ALL_CLASSES: readonly PlayerClass[] = [
  'warrior',
  'paladin',
  'hunter',
  'rogue',
  'priest',
  'shaman',
  'mage',
  'warlock',
  'druid',
];

function addTarget(sim: Sim): Entity {
  const p = sim.player;
  const mob = createMob(9917, MOBS.forest_wolf, 20, {
    x: p.pos.x,
    y: p.pos.y,
    z: p.pos.z + 2,
  });
  mob.hostile = true;
  mob.maxHp = mob.hp = 1_000_000;
  (sim as unknown as { addEntity(e: Entity): void }).addEntity(mob);
  sim.targetEntity(mob.id);
  p.facing = 0;
  return mob;
}

describe('HIGHFLY v0.7.1 full class action aim', () => {
  it('keeps all nine player class registries internally resolvable', () => {
    expect(Object.keys(CLASSES).sort()).toEqual([...ALL_CLASSES].sort());
    for (const classId of ALL_CLASSES) {
      const cls = CLASSES[classId];
      expect(cls.abilities.length, classId).toBeGreaterThan(0);
      for (const abilityId of cls.abilities) {
        expect(ABILITIES[abilityId], classId + ':' + abilityId).toBeDefined();
      }
    }
  });

  it('classifies ordinary direct hostile actions across every class with one policy', () => {
    const seen = new Set<PlayerClass>();
    const direct = new Set([
      'directDamage',
      'weaponDamage',
      'weaponStrike',
      'chainDamage',
      'finisherDamage',
    ]);
    for (const classId of ALL_CLASSES) {
      for (const abilityId of CLASSES[classId].abilities) {
        const ability = ABILITIES[abilityId];
        if (!ability?.requiresTarget || ability.targetType === 'friendly' || ability.targetsDead) continue;
        if (ability.targetMode === 'position' || ability.channel || ability.onNextSwing) continue;
        if (ability.executeThreshold !== undefined || ability.requiresTargetHpBelow !== undefined) continue;
        if (ability.requiresDodgeProc) continue;
        if (['unleash_weapon', 'conflagrate', 'sentence', 'coven', 'possess_evil_eye', 'hour_of_judgment', 'litany_of_guilt'].includes(ability.id)) continue;
        if (!ability.effects.some((effect) => direct.has(String(effect.type)))) continue;
        const hasSpecial = ability.effects.some((effect) =>
          ['polymorph', 'taunt', 'tamePet', 'charge', 'feralCharge', 'packCommand', 'unleashBeast', 'hunterBloodhook', 'dispel']
            .includes(String(effect.type)),
        );
        if (hasSpecial) continue;
        if (ability.spendsCombo && !ability.effects.some((effect) => String(effect.type) === 'finisherDamage')) continue;
        expect(
          highflyManualAimMissAllowed(ability, ability.effects, { x: 5, z: 0 }, -1),
          classId + ':' + abilityId,
        ).toBe(true);
        seen.add(classId);
      }
    }
    expect([...seen].sort()).toEqual([...ALL_CLASSES].sort());
  });

  it('Wicked Slash commits a 90-degree miss instead of hitting/refusing the stale target', () => {
    const sim = new Sim({ seed: 71, playerClass: 'rogue', autoEquip: true });
    sim.setPlayerLevel(20);
    const p = sim.player;
    const target = addTarget(sim);
    p.resource = p.maxResource;
    const beforeResource = p.resource;
    const beforeHp = target.hp;
    sim.castAbilityAt('sinister_strike', { x: p.pos.x + 5, z: p.pos.z });
    expect(target.hp).toBe(beforeHp);
    expect(p.resource).toBeLessThan(beforeResource);
    expect(p.comboPoints).toBe(0);
    expect(p.gcdRemaining).toBeGreaterThan(0);
  });

  it('Dirt Nap commits a 90-degree miss and spends combo points without damaging the stale target', () => {
    const sim = new Sim({ seed: 72, playerClass: 'rogue', autoEquip: true });
    sim.setPlayerLevel(20);
    const p = sim.player;
    const target = addTarget(sim);
    p.resource = p.maxResource;
    p.comboPoints = 5;
    const beforeResource = p.resource;
    const beforeHp = target.hp;
    const eviscerate = ABILITIES.eviscerate;
    expect(highflyManualAimMissAllowed(eviscerate, eviscerate.effects, { x: 5, z: 0 }, -1)).toBe(true);
    expect(highflyManualMissConsumesCombo(eviscerate, eviscerate.effects)).toBe(true);
    sim.castAbilityAt('eviscerate', { x: p.pos.x + 5, z: p.pos.z });
    expect(target.hp).toBe(beforeHp);
    expect(p.resource).toBeLessThan(beforeResource);
    expect(p.comboPoints).toBe(0);
    expect(p.gcdRemaining).toBeGreaterThan(0);
  });

  it('keeps authored target contracts out of free-whiff policy', () => {
    for (const abilityId of ['charge', 'polymorph', 'taunt']) {
      const ability = ABILITIES[abilityId];
      if (!ability) continue;
      expect(highflyManualAimMissAllowed(ability, ability.effects, { x: 5, z: 0 }, -1)).toBe(false);
    }
  });

  it('commits dragged world facing and keeps the class sheet readable', () => {
    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
    const lifecycle = fs.readFileSync('src/sim/combat/casting_lifecycle.ts', 'utf8');
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    const creator = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');

    expect(hud).toContain('this.sim.player.facing = facing');
    expect(lifecycle).toContain('if (!highflyManualMiss) {');
    expect(lifecycle).toContain('highflyManualMissConsumesCombo(ability, res.effects)');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr)) !important');
    expect(css).toContain('width: calc(50% - 15px) !important');
    expect(creator).toContain("important(refs.classDetails, 'overflow', 'auto')");
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.7.1] nine-class manual aim audit + creator finish pass applied.');

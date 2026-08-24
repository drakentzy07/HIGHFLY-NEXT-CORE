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
// 1) ONE ACTION-AIM POLICY FOR ALL NINE CLASSES
//
// Manual drag owns the world direction. Ordinary hostile DIRECT attacks may
// commit into empty space as a real miss. Entity-contract actions (charge,
// execute, dispel, tame, special engine releases, etc.) keep a real target.
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
  'resurrectAlly',
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

  // Utility/CC combo finishers still require a real target. A damage finisher is
  // a spatial action in HIGHFLY and can be committed into empty space.
  if (ability.spendsCombo && !highflyManualMissConsumesCombo(ability, effects)) return false;

  return !effects.some((effect) => SPECIAL_TARGET_EFFECTS.has(String(effect.type)));
}
`;
  write(path, content);
}

// ---------------------------------------------------------------------------
// 2) CAST LIFECYCLE: A MANUAL MISS MUST NEVER VALIDATE THE STALE TARGET
//
// v0.6.4 had the right sentinel idea, but used the player itself as a placeholder.
// Later range/facing/behind checks still ran against that placeholder, so side
// drags could be rejected with "face your target". Skip ONLY entity-specific
// resolution for a confirmed miss; resource/GCD/cooldown/form/stealth gates stay.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/casting_lifecycle.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    "import { hasEscapeStealth } from '../threat';",
    "import { hasEscapeStealth } from '../threat';\nimport { highflyManualAimMissAllowed, highflyManualMissConsumesCombo } from '../highfly_action_aim';",
    'HIGHFLY action aim policy import',
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

  source = replaceRequired(
    source,
    `      fx: 'burst',`,
    `      fx: ability.projectileFx ?? 'burst',`,
    'manual miss authored visual',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) HUD: THE CHARACTER COMMITS TO THE DRAGGED WORLD FACING
// This fixes both assisted hits and intentional misses without increasing the
// 7-degree micro-assist lane or auto-targeting something elsewhere.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    `      const facing = this.highflyScreenAimFacing(dx, dy);\n      if (resolved.def.targetMode === 'position') {`,
    `      const facing = this.highflyScreenAimFacing(dx, dy);\n      // Manual action aim owns the hunter's intent. Rotate the simulation facing\n      // before target validation instead of reusing the previous target heading.\n      this.sim.player.facing = facing;\n      if (resolved.def.targetMode === 'position') {`,
    'manual drag facing commitment',
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) CREATOR: INLINE GEOMETRY + FINAL HIERARCHY
// Runtime inline !important values beat stylesheet rules, so fix the source of
// truth as well as the final CSS. Appearance 50/50 stays unchanged.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/creator_steps.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    "important(right, 'grid-template-rows', 'minmax(128px, 0.92fr) minmax(143px, 1.08fr)');",
    "important(right, 'grid-template-rows', 'minmax(120px, 0.88fr) minmax(158px, 1.12fr)');",
    'class right-column proportions',
  );
  source = replaceRequired(
    source,
    "important(refs.preview, 'min-height', '128px');",
    "important(refs.preview, 'min-height', '120px');",
    'class preview minimum',
  );
  source = replaceRequired(
    source,
    "important(refs.classDetails, 'min-height', '143px');",
    "important(refs.classDetails, 'min-height', '158px');",
    'class dossier minimum',
  );
  source = replaceRequired(
    source,
    "important(refs.classDetails, 'overflow', 'hidden');",
    "important(refs.classDetails, 'overflow', 'auto');",
    'class dossier scroll safety',
  );
  write(path, source);
}

{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.7.1 — final creator hierarchy for phone landscape. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="appearance"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-step="class"] .char-create {
    min-height: 0 !important;
    height: 100% !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-preview-container {
    margin: 0 !important;
    border-radius: 10px !important;
  }

  /* CLASS: decision on the left, live character + full dossier on the right. */
  body.native-app #offline-select[data-hf-creator-step="class"] .char-create {
    position: relative !important;
    padding-bottom: 58px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 6px !important;
    align-content: start !important;
    margin-top: 3px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker .mini-class {
    min-height: 35px !important;
    height: 35px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .auth-actions {
    position: static !important;
    min-height: 0 !important;
    height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    overflow: visible !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #btn-start-offline {
    display: block !important;
    position: absolute !important;
    left: 12px !important;
    right: 12px !important;
    bottom: 8px !important;
    width: auto !important;
    height: 43px !important;
    min-height: 43px !important;
    margin: 0 !important;
    z-index: 4 !important;
    border: 1px solid rgba(225, 183, 70, .88) !important;
    border-radius: 22px !important;
    background: linear-gradient(180deg, rgba(100,70,10,.95), rgba(42,29,7,.98)) !important;
    box-shadow: 0 8px 20px rgba(0,0,0,.34), inset 0 1px rgba(255,225,140,.14) !important;
    font-size: 13px !important;
    font-weight: 900 !important;
    letter-spacing: .035em !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right {
    grid-template-rows: minmax(120px, .88fr) minmax(158px, 1.12fr) !important;
    gap: 7px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-preview-container {
    min-height: 120px !important;
    border-radius: 10px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    min-height: 158px !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    scrollbar-width: thin !important;
    padding: 7px 9px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) h3 {
    font-size: 15px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-desc, .hf-class-desc-v062) {
    font-size: 9.5px !important;
    line-height: 1.15 !important;
    margin: 3px 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-auto-rows: minmax(28px, auto) !important;
    gap: 4px !important;
    margin: 3px 0 !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span {
    width: 100% !important;
    min-width: 0 !important;
    min-height: 28px !important;
    height: auto !important;
    padding: 3px 5px !important;
    box-sizing: border-box !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 4px !important;
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: clip !important;
    font-size: 8px !important;
    line-height: 1.05 !important;
  }
}
`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// 5) REGRESSION MATRIX: REAL ROGUE MISSES + ALL NINE CLASS REGISTRIES
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v071_combat_matrix_creator.test.ts';
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

describe('HIGHFLY v0.7.1 combat matrix + creator hierarchy', () => {
  it('keeps all nine selectable class registries internally resolvable', () => {
    expect(Object.keys(CLASSES).sort()).toEqual([...ALL_CLASSES].sort());
    for (const classId of ALL_CLASSES) {
      const cls = CLASSES[classId];
      expect(cls.abilities.length, classId).toBeGreaterThan(0);
      for (const abilityId of cls.abilities) {
        expect(ABILITIES[abilityId], classId + ':' + abilityId).toBeDefined();
      }
    }
  });

  it('uses one manual-miss policy for eligible direct actions in every class', () => {
    const seen = new Set<PlayerClass>();
    const direct = new Set([
      'directDamage',
      'weaponDamage',
      'weaponStrike',
      'chainDamage',
      'finisherDamage',
    ]);
    const specialIds = new Set([
      'unleash_weapon',
      'conflagrate',
      'sentence',
      'coven',
      'possess_evil_eye',
      'hour_of_judgment',
      'litany_of_guilt',
    ]);
    const specialEffects = new Set([
      'polymorph',
      'taunt',
      'tamePet',
      'charge',
      'feralCharge',
      'packCommand',
      'unleashBeast',
      'hunterBloodhook',
      'dispel',
      'resurrectAlly',
    ]);

    for (const classId of ALL_CLASSES) {
      for (const abilityId of CLASSES[classId].abilities) {
        const ability = ABILITIES[abilityId];
        if (!ability?.requiresTarget || ability.targetType === 'friendly' || ability.targetsDead) continue;
        if (ability.targetMode === 'position' || ability.channel || ability.onNextSwing) continue;
        if (ability.executeThreshold !== undefined || ability.requiresTargetHpBelow !== undefined) continue;
        if (ability.requiresDodgeProc || specialIds.has(ability.id)) continue;
        if (!ability.effects.some((effect) => direct.has(String(effect.type)))) continue;
        if (ability.effects.some((effect) => specialEffects.has(String(effect.type)))) continue;
        if (
          ability.spendsCombo &&
          !ability.effects.some((effect) => String(effect.type) === 'finisherDamage')
        ) {
          continue;
        }

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

  it('Dirt Nap commits a 90-degree miss, spends combo, and never damages the stale target', () => {
    const sim = new Sim({ seed: 72, playerClass: 'rogue', autoEquip: true });
    sim.setPlayerLevel(20);
    const p = sim.player;
    const target = addTarget(sim);
    p.resource = p.maxResource;
    p.comboPoints = 5;
    const beforeResource = p.resource;
    const beforeHp = target.hp;
    const finisher = ABILITIES.eviscerate;

    expect(highflyManualAimMissAllowed(finisher, finisher.effects, { x: 5, z: 0 }, -1)).toBe(true);
    expect(highflyManualMissConsumesCombo(finisher, finisher.effects)).toBe(true);

    sim.castAbilityAt('eviscerate', { x: p.pos.x + 5, z: p.pos.z });

    expect(target.hp).toBe(beforeHp);
    expect(p.resource).toBeLessThan(beforeResource);
    expect(p.comboPoints).toBe(0);
    expect(p.gcdRemaining).toBeGreaterThan(0);
  });

  it('keeps concrete-target mechanics outside the free-whiff policy', () => {
    for (const abilityId of ['charge', 'polymorph', 'taunt']) {
      const ability = ABILITIES[abilityId];
      if (!ability) continue;
      expect(
        highflyManualAimMissAllowed(ability, ability.effects, { x: 5, z: 0 }, -1),
      ).toBe(false);
    }
  });

  it('commits dragged facing and makes the class dossier readable in 3x2', () => {
    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
    const lifecycle = fs.readFileSync('src/sim/combat/casting_lifecycle.ts', 'utf8');
    const creator = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');

    expect(hud).toContain('this.sim.player.facing = facing');
    expect(lifecycle).toContain('if (!highflyManualMiss) {');
    expect(lifecycle).toContain('highflyManualMissConsumesCombo(ability, res.effects)');
    expect(creator).toContain(
      "important(right, 'grid-template-rows', 'minmax(120px, 0.88fr) minmax(158px, 1.12fr)')",
    );
    expect(creator).toContain("important(refs.classDetails, 'overflow', 'auto')");
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr)) !important');
    expect(css).toContain('bottom: 8px !important');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.7.1] systemic 9-class action aim + real Rogue miss tests + creator hierarchy applied.');

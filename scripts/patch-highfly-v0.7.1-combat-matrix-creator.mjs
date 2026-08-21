import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.7.1] patched ${path}`);
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// ---------------------------------------------------------------------------
// 1) MANUAL-AIM CONTRACT: TARGET SEMANTICS, NOT DAMAGE-EFFECT WHITELISTS
//
// v0.6.4 deliberately allowed a dragged hostile ability to execute into empty
// space, but it inferred "offensive" from only four effect kinds and rejected
// combo spenders/min-range abilities. That made the rule brittle: Rogue's
// Eviscerate (finisherDamage + spendsCombo) was rejected, while future class
// effects could silently regress the same way.
//
// HIGHFLY v0.7.1 treats manual drag as player intent. Any ordinary hostile
// entity-targeted ability may be committed toward the chosen world vector. A
// miss remains a miss and never auto-retargets. Abilities whose mechanics
// intrinsically require a concrete entity keep their authored target contract.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/casting_lifecycle.ts';
  let source = read(path);

  const oldHelper = `function highflyManualAimMissAllowed(\n  ability: AbilityDef,\n  res: ResolvedAbility,\n  aim: { x: number; z: number } | undefined,\n  castTargetId: number | null,\n): boolean {\n  if (!aim || castTargetId !== -1) return false;\n  if (!ability.requiresTarget || ability.targetType === 'friendly' || ability.targetsDead) return false;\n  if (ability.targetMode === 'position' || ability.minRange) return false;\n  if (ability.executeThreshold !== undefined || ability.requiresTargetHpBelow !== undefined) return false;\n  if (ability.spendsCombo || ability.requiresDodgeProc) return false;\n  const offensive = res.effects.some((effect) =>\n    ['directDamage', 'weaponDamage', 'weaponStrike', 'chainDamage'].includes(effect.type),\n  );\n  const specialTargetContract = res.effects.some((effect) =>\n    ['polymorph', 'taunt', 'tamePet', 'charge', 'feralCharge', 'packCommand', 'unleashBeast', 'hunterBloodhook', 'dispel'].includes(effect.type),\n  );\n  return offensive && !specialTargetContract;\n}`;

  const newHelper = `function highflyManualAimMissAllowed(\n  ability: AbilityDef,\n  res: ResolvedAbility,\n  aim: { x: number; z: number } | undefined,\n  castTargetId: number | null,\n): boolean {\n  if (!aim || castTargetId !== -1) return false;\n  if (!ability.requiresTarget || ability.targetType === 'friendly' || ability.targetsDead) return false;\n  if (ability.targetMode === 'position') return false;\n  // These are activation/target-state contracts, not aiming contracts. They still\n  // require an actual entity so a manual miss cannot manufacture their condition.\n  if (ability.executeThreshold !== undefined || ability.requiresTargetHpBelow !== undefined) return false;\n  if (ability.requiresDodgeProc) return false;\n  const specialTargetContract = res.effects.some((effect) =>\n    ['polymorph', 'taunt', 'tamePet', 'charge', 'feralCharge', 'packCommand', 'unleashBeast', 'hunterBloodhook', 'dispel', 'resurrectAlly'].includes(effect.type),\n  );\n  return !specialTargetContract;\n}`;

  source = replaceRequired(source, oldHelper, newHelper, 'manual aim target-semantic contract');

  // A manual empty-space cast must still look like the requested ability was
  // executed. Preserve authored projectile FX where present and otherwise use a
  // visible burst at the commanded endpoint. Damage remains zero because there is
  // intentionally no target.
  source = replaceRequired(
    source,
    `      fx: 'burst',`,
    `      fx: ability.projectileFx ?? 'burst',`,
    'manual miss authored visual',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) CREATOR: REMOVE DEAD SPACE AND TURN CLASS STEP INTO A DELIBERATE 2-COLUMN UI
// ---------------------------------------------------------------------------
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

  /* APPEARANCE: let the live model use the right half cleanly. */
  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-preview-container {
    margin: 0 !important;
    border-radius: 10px !important;
  }

  /* CLASS: picker owns the upper-left, ENTER WORLD anchors the otherwise empty
     lower-left. This keeps the CTA attached to the decision it confirms. */
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

  /* The right half reads top-to-bottom as character -> class dossier. */
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
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 4px !important;
    margin: 3px 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span {
    min-height: 28px !important;
    height: 28px !important;
    padding: 3px 5px !important;
    font-size: 8px !important;
    overflow: visible !important;
    text-overflow: clip !important;
  }
}
`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// 3) REGRESSION MATRIX
// Keep all nine character families under the same mobile-aim contract and lock
// the two Rogue starter attacks that exposed the problem in live Android testing.
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v071_combat_matrix_creator.test.ts';
  const content = `import fs from 'node:fs';\nimport { describe, expect, it } from 'vitest';\n\ndescribe('HIGHFLY v0.7.1 combat matrix + creator hierarchy', () => {\n  it('uses hostile-target semantics for manual miss instead of a narrow damage whitelist', () => {\n    const lifecycle = fs.readFileSync('src/sim/combat/casting_lifecycle.ts', 'utf8');\n    const helperStart = lifecycle.indexOf('function highflyManualAimMissAllowed');\n    const helperEnd = lifecycle.indexOf('export function castAbility', helperStart);\n    const helper = lifecycle.slice(helperStart, helperEnd);\n    expect(helperStart).toBeGreaterThanOrEqual(0);\n    expect(helper).toContain("ability.targetType === 'friendly'");\n    expect(helper).toContain("ability.targetMode === 'position'");\n    expect(helper).toContain('return !specialTargetContract');\n    expect(helper).not.toContain("['directDamage', 'weaponDamage', 'weaponStrike', 'chainDamage']");\n    expect(helper).not.toContain('ability.spendsCombo ||');\n    expect(helper).not.toContain('ability.targetMode === \'position\' || ability.minRange');\n  });\n\n  it('keeps the Rogue starter builder and finisher inside the generic manual-aim family', () => {\n    const classes = fs.readFileSync('src/sim/content/classes.ts', 'utf8');\n    expect(classes).toContain("id: 'sinister_strike'");\n    expect(classes).toContain("type: 'weaponStrike'");\n    expect(classes).toContain("id: 'eviscerate'");\n    expect(classes).toContain('spendsCombo: true');\n    expect(classes).toContain("type: 'finisherDamage'");\n  });\n\n  it('keeps all nine selectable class families represented while sharing one HUD manual-aim path', () => {\n    const classes = fs.readFileSync('src/sim/content/classes.ts', 'utf8');\n    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');\n    for (const id of ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid']) {\n      expect(classes).toContain(\`  \${id}: {\`);\n    }\n    expect(hud).toContain('highflyPickManualMicroAssistTarget');\n    expect(hud).toContain('this.sim.castAbilityAt(resolved.def.id');\n    expect(hud).toContain('const targetId = this.highflyPickManualMicroAssistTarget');\n  });\n\n  it('keeps authored restrictions for skills that intrinsically need a concrete target', () => {\n    const lifecycle = fs.readFileSync('src/sim/combat/casting_lifecycle.ts', 'utf8');\n    expect(lifecycle).toContain("'charge'");\n    expect(lifecycle).toContain("'tamePet'");\n    expect(lifecycle).toContain("'dispel'");\n    expect(lifecycle).toContain("'resurrectAlly'");\n    expect(lifecycle).toContain('ability.executeThreshold !== undefined');\n    expect(lifecycle).toContain('ability.requiresDodgeProc');\n  });\n\n  it('gives Class a readable dossier and anchors Enter World inside the left decision column', () => {\n    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');\n    expect(css).toContain('HIGHFLY v0.7.1 — final creator hierarchy');\n    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr)) !important');\n    expect(css).toContain('grid-template-rows: minmax(120px, .88fr) minmax(158px, 1.12fr) !important');\n    expect(css).toContain('bottom: 8px !important');\n    expect(css).toContain('overflow-y: auto !important');\n  });\n});\n`;
  write(path, content);
}

console.log('[HIGHFLY v0.7.1] systemic manual aim + 9-class regression matrix + creator hierarchy applied.');

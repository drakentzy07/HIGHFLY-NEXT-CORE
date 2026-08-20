import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.6.6] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// 1) CREATOR: TRUE 50 / 50 LANDSCAPE COMPOSITION
// The old v0.6.3 phone rule explicitly authored 70/30. v0.6.6 makes the two
// columns equal and also neutralizes ClaudeCraft's sticky/mobile preview sizing,
// so the live character really fills the right half instead of leaving dead space.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.6.6 — TRUE 50/50 mobile creator + full-height preview stage. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select.highfly-native-creator[data-hf-creator-steps="2"] .charselect-layout {
    display: grid !important;
    grid-template-columns: minmax(0, 50%) minmax(0, 50%) !important;
    gap: 8px !important;
    width: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-steps="2"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-steps="2"] .charselect-col-right {
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
    min-height: 0 !important;
    height: 100% !important;
    align-self: stretch !important;
  }

  body.native-app #offline-select[data-hf-creator-step="appearance"] .charselect-col-right {
    display: grid !important;
    grid-template-rows: minmax(0, 1fr) !important;
    align-items: stretch !important;
    justify-items: stretch !important;
    min-height: 0 !important;
    height: 100% !important;
  }

  /* ClaudeCraft mobile makes this preview sticky/top-offset with a fixed vh height.
     HIGHFLY Appearance instead owns the whole right column as one clean stage. */
  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-preview-container {
    position: relative !important;
    inset: auto !important;
    top: auto !important;
    order: 0 !important;
    z-index: 1 !important;
    grid-row: 1 !important;
    align-self: stretch !important;
    justify-self: stretch !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-class-details {
    display: none !important;
  }

  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-appearance {
    min-width: 0 !important;
    width: 100% !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right {
    display: grid !important;
    grid-template-rows: minmax(135px, 5fr) minmax(0, 6fr) !important;
    gap: 7px !important;
    min-height: 0 !important;
    height: 100% !important;
    align-items: stretch !important;
    justify-items: stretch !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-preview-container {
    position: relative !important;
    inset: auto !important;
    top: auto !important;
    order: 0 !important;
    z-index: 1 !important;
    grid-row: 1 !important;
    align-self: stretch !important;
    justify-self: stretch !important;
    width: 100% !important;
    height: auto !important;
    min-height: 135px !important;
    max-height: none !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    display: block !important;
    grid-row: 2 !important;
    position: relative !important;
    inset: auto !important;
    order: 0 !important;
    width: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    height: auto !important;
    max-height: none !important;
    overflow: auto !important;
    padding: 8px 10px !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .highfly-class-sheet {
    gap: 3px !important;
    min-height: 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-title h3 {
    margin: 0 !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-desc {
    margin: 3px 0 4px !important;
    font-size: 9px !important;
    line-height: 1.15 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-resource,
  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-note {
    margin: 2px 0 !important;
    line-height: 1.12 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-stats {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 4px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-stats span {
    min-height: 27px !important;
    padding: 3px 5px !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 5px !important;
  }
}
`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// 2) CREATOR PREVIEW: CAMERA CLOSER, NOT A STRETCHED CANVAS
// ---------------------------------------------------------------------------
{
  const path = 'src/render/characters/preview_framing.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    "  sheet: { y: 1.45, z: 5.1, lookY: 1.3 },",
    "  sheet: { y: 1.38, z: 3.8, lookY: 1.25 },",
    'character preview sheet framing',
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) COMBAT CASTS MOVE WITH THE PLAYER
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/player_motion.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    "  DT,\n  ENRAGE_MOVE_MULT,",
    "  CRAFT_CAST_ID,\n  DISENCHANT_CAST_ID,\n  DT,\n  ENCHANT_CAST_ID,\n  ENRAGE_MOVE_MULT,\n  FISHING_CAST_ID,\n  GATHER_CAST_ID,",
    'player motion cast constants import',
  );
  source = replaceRequired(
    source,
    "  RUN_SPEED,\n  TURN_SPEED,",
    "  RUN_SPEED,\n  SALVAGE_CAST_ID,\n  TOOL_RECHARGE_CAST_ID,\n  TURN_SPEED,",
    'player motion remaining cast constants import',
  );

  const helperAnchor = "export const HIGHFLY_DASH_SPEED_MULT = 2.6;";
  const helper = `${helperAnchor}\n\nconst HIGHFLY_STATIONARY_CASTS = new Set<string>([\n  CRAFT_CAST_ID,\n  DISENCHANT_CAST_ID,\n  ENCHANT_CAST_ID,\n  FISHING_CAST_ID,\n  GATHER_CAST_ID,\n  SALVAGE_CAST_ID,\n  TOOL_RECHARGE_CAST_ID,\n]);\n\nfunction highflyCombatCastMoves(abilityId: string): boolean {\n  return !HIGHFLY_STATIONARY_CASTS.has(abilityId);\n}`;
  source = replaceRequired(source, helperAnchor, helper, 'HIGHFLY stationary cast helper');

  const oldMobile = `      const mobile =\n        casting != null &&\n        (casting.def.castWhileMoving ||\n          casting.castWhileMoving ||\n          iceFloesAuraForAbility(p, p.castingAbility) !== undefined ||\n          afflictionCanCastWhileMoving(p, p.castingAbility) ||\n          p.auras.some((a) => a.kind === 'processional_grace'));`;
  const newMobile = `      const mobile =\n        casting != null &&\n        (highflyCombatCastMoves(p.castingAbility) ||\n          casting.def.castWhileMoving ||\n          casting.castWhileMoving ||\n          iceFloesAuraForAbility(p, p.castingAbility) !== undefined ||\n          afflictionCanCastWhileMoving(p, p.castingAbility) ||\n          p.auras.some((a) => a.kind === 'processional_grace'));`;
  source = replaceRequired(source, oldMobile, newMobile, 'cast while moving gate');
  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) BASIC ATTACK CADENCE
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/auto_attack.ts';
  let source = read(path);
  const constAnchor = "const OFFHAND_AUTO_ATTACK_DMG_MULT = 0.5;";
  source = replaceRequired(
    source,
    constAnchor,
    `${constAnchor}\nconst HIGHFLY_AUTO_ATTACK_INTERVAL_MULT = 0.68;`,
    'HIGHFLY auto attack interval constant',
  );

  source = replaceRequired(
    source,
    "    p.swingTimer = (shot.speed * ctx.swingIntervalMult(p)) / (1 + p.rangedHaste);",
    "    p.swingTimer = ((shot.speed * ctx.swingIntervalMult(p)) / (1 + p.rangedHaste)) * HIGHFLY_AUTO_ATTACK_INTERVAL_MULT;",
    'ranged auto attack cadence',
  );
  source = replaceRequired(
    source,
    "    p.swingTimer =\n      (baseSwingSpeed(p) * ctx.swingIntervalMult(p)) / (1 + stanceMasteryAutoHaste(ctx, p, meta));",
    "    p.swingTimer =\n      ((baseSwingSpeed(p) * ctx.swingIntervalMult(p)) / (1 + stanceMasteryAutoHaste(ctx, p, meta))) *\n      HIGHFLY_AUTO_ATTACK_INTERVAL_MULT;",
    'melee auto attack cadence',
  );
  source = replaceRequired(
    source,
    "    p.offhandSwingTimer =\n      (offhand.speed * ctx.swingIntervalMult(p)) / (1 + stanceMasteryAutoHaste(ctx, p, meta));",
    "    p.offhandSwingTimer =\n      ((offhand.speed * ctx.swingIntervalMult(p)) / (1 + stanceMasteryAutoHaste(ctx, p, meta))) *\n      HIGHFLY_AUTO_ATTACK_INTERVAL_MULT;",
    'offhand auto attack cadence',
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// 5) REGRESSION CONTRACTS
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v066_creator_combat_flow.test.ts';
  const content = `import fs from 'node:fs';\nimport { describe, expect, it } from 'vitest';\n\ndescribe('HIGHFLY v0.6.6 creator + combat flow', () => {\n  it('uses a true 50/50 phone-landscape creator and a full-height real preview stage', () => {\n    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');\n    const framing = fs.readFileSync('src/render/characters/preview_framing.ts', 'utf8');\n    expect(css).toContain('grid-template-columns: minmax(0, 50%) minmax(0, 50%) !important');\n    expect(css).toContain('position: relative !important');\n    expect(css).toContain('top: auto !important');\n    expect(css).toContain('grid-template-rows: minmax(135px, 5fr) minmax(0, 6fr) !important');\n    expect(framing).toContain("sheet: { y: 1.38, z: 3.8, lookY: 1.25 }");\n  });\n\n  it('keeps combat hard-casts alive while moving but leaves world interactions stationary', () => {\n    const motion = fs.readFileSync('src/sim/player_motion.ts', 'utf8');\n    expect(motion).toContain('const HIGHFLY_STATIONARY_CASTS = new Set<string>');\n    expect(motion).toContain('highflyCombatCastMoves(p.castingAbility)');\n    expect(motion).toContain('FISHING_CAST_ID');\n    expect(motion).toContain('GATHER_CAST_ID');\n    expect(motion).toContain('CRAFT_CAST_ID');\n  });\n\n  it('shortens the real simulation swing interval instead of pointer-spamming attacks', () => {\n    const attacks = fs.readFileSync('src/sim/combat/auto_attack.ts', 'utf8');\n    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');\n    expect(attacks).toContain('HIGHFLY_AUTO_ATTACK_INTERVAL_MULT = 0.68');\n    expect(attacks).toContain('* HIGHFLY_AUTO_ATTACK_INTERVAL_MULT');\n    expect(hud).not.toContain('highflyAttackHoldTimer = window.setInterval');\n  });\n});\n`;
  write(path, content);
}

console.log('[HIGHFLY v0.6.6] true 50/50 creator + full preview + mobile combat casting + faster basic cadence applied.');

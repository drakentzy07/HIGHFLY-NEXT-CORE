import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.0.5] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// 1) REAL-PHONE CLASS STEP
// The name was already authored on Appearance. On Class, spend those 38px on the
// information that matters: a comfortably readable six-stat 3x2 matrix.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.8.0.5 — real-phone class stats + explicit RM entry. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] .char-input-group {
    display: none !important;
    flex: 0 0 0 !important;
    width: 0 !important;
    height: 0 !important;
    min-height: 0 !important;
    max-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-info-stack,
  body.native-app #offline-select[data-hf-creator-step="class"] .char-create {
    gap: 5px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.mini-class-row.hf-class-picker, .hf-class-picker) {
    flex: 0 0 98px !important;
    flex-basis: 98px !important;
    height: 98px !important;
    min-height: 98px !important;
    max-height: 98px !important;
    grid-template-rows: repeat(3, 30px) !important;
    grid-auto-rows: 30px !important;
    gap: 4px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker .mini-class {
    height: 30px !important;
    min-height: 30px !important;
    max-height: 30px !important;
    font-size: 11px !important;
    padding: 3px 8px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    max-height: none !important;
    padding: 7px 8px !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.highfly-class-sheet, .highfly-class-sheet-v062) {
    grid-template-rows: auto auto auto auto 77px !important;
    gap: 2px !important;
    align-content: start !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) h3 {
    font-size: 15px !important;
    line-height: 17px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) span {
    font-size: 9.5px !important;
    line-height: 11px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-desc, .hf-class-desc-v062) {
    font-size: 10px !important;
    line-height: 11px !important;
    margin: 2px 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-resource, .hf-class-resource-v062),
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.highfly-class-sheet, .highfly-class-sheet-v062) h4 {
    font-size: 9px !important;
    line-height: 11px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-rows: repeat(2, 36px) !important;
    grid-auto-rows: 36px !important;
    gap: 5px !important;
    width: 100% !important;
    height: 77px !important;
    min-height: 77px !important;
    max-height: 77px !important;
    margin: 3px 0 0 !important;
    overflow: visible !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span {
    height: 36px !important;
    min-height: 36px !important;
    max-height: 36px !important;
    padding: 5px 8px !important;
    font-size: 10.5px !important;
    line-height: 1 !important;
    overflow: hidden !important;
  }

  /* RM must be obvious and comfortable to edit on the actual phone. */
  body.native-app .hf-training-tabs {
    position: sticky !important;
    top: 0 !important;
    z-index: 20 !important;
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 8px !important;
    width: 100% !important;
    margin: 0 0 8px !important;
    padding: 0 !important;
    background: rgba(5, 9, 18, .96) !important;
  }

  body.native-app .hf-training-tabs button {
    width: 100% !important;
    min-width: 0 !important;
    height: 38px !important;
    min-height: 38px !important;
    font-size: 12px !important;
    font-weight: 900 !important;
    letter-spacing: .08em !important;
  }

  body.native-app .hf-training-tabs button[data-hf-training-tab="rm"] {
    border-color: rgba(238, 195, 77, .72) !important;
    color: #f4d675 !important;
  }

  body.native-app .hf-training-tabs button[data-hf-training-tab="rm"].active {
    border-color: #f4cf63 !important;
    color: #fff5c7 !important;
    box-shadow: 0 0 0 1px rgba(244, 207, 99, .22) inset, 0 0 14px rgba(244, 207, 99, .12) !important;
  }

  body.native-app .hf-rm-panel {
    display: block;
    width: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
    padding: 8px !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    box-sizing: border-box !important;
  }

  body.native-app .hf-rm-panel[hidden] {
    display: none !important;
  }

  body.native-app .hf-rm-head {
    position: sticky !important;
    top: 46px !important;
    z-index: 15 !important;
    margin: 0 0 7px !important;
    padding: 6px 7px !important;
    background: rgba(6, 13, 25, .97) !important;
    border-bottom: 1px solid rgba(80, 207, 255, .18) !important;
  }

  body.native-app .hf-rm-head b {
    font-size: 13px !important;
  }

  body.native-app .hf-rm-head span {
    font-size: 9px !important;
    line-height: 1.2 !important;
  }

  body.native-app .hf-rm-head button {
    height: 36px !important;
    min-height: 36px !important;
    font-size: 10px !important;
  }

  body.native-app .hf-rm-grid {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 7px !important;
  }

  body.native-app .hf-rm-grid label {
    grid-template-columns: minmax(0, 1fr) 84px 20px !important;
    gap: 6px !important;
    min-height: 52px !important;
    padding: 6px 8px !important;
    box-sizing: border-box !important;
  }

  body.native-app .hf-rm-grid label span {
    font-size: 9.5px !important;
    line-height: 1.15 !important;
  }

  body.native-app .hf-rm-grid input {
    height: 34px !important;
    min-height: 34px !important;
    font-size: 14px !important;
    font-weight: 900 !important;
  }

  body.native-app .hf-rm-grid label small[data-hf-e1rm] {
    margin-top: 3px !important;
    font-size: 8.5px !important;
    line-height: 1.1 !important;
  }
}
`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// 2) RM ENTRY SHOULD BE IMPOSSIBLE TO MISS
// Keep manual tested RM authoritative and e1RM clearly separate.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/training_rms.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `tabs.innerHTML = '<button type="button" class="active" data-hf-training-tab="routine">RUTINA</button><button type="button" data-hf-training-tab="rm">RM</button>';`,
    `tabs.innerHTML = '<button type="button" class="active" data-hf-training-tab="routine">RUTINA</button><button type="button" data-hf-training-tab="rm">RM / MARCAS</button>';`,
    'visible RM tab label',
  );

  source = replaceRequired(
    source,
    `'<div class="hf-rm-head"><div><b>RM DEL CAZADOR</b><span>Guardá tus marcas reales. HIGHFLY calcula las cargas de trabajo desde acá.</span></div><button type="button" data-hf-rm-apply>APLICAR A RUTINA</button></div>' +`,
    `'<div class="hf-rm-head"><div><b>RM / MARCAS DEL CAZADOR</b><span>Cargá tu 1RM real en kg. Se guarda automáticamente; el e1RM estimado aparece aparte.</span></div><button type="button" data-hf-rm-apply>APLICAR A RUTINA</button></div>' +`,
    'explicit RM panel copy',
  );

  source = replaceRequired(
    source,
    `input.addEventListener('change', () => {`,
    `input.addEventListener('input', () => {`,
    'immediate RM persistence',
  );

  source = replaceRequired(
    source,
    `  // Existing drafts created before RM ownership may still contain the old fake\n  // 60/40 defaults. Apply only saved real marks; otherwise clear those placeholders.\n  applyPrescription(panel, profile, evidence);\n}`,
    `  // Existing drafts created before RM ownership may still contain the old fake\n  // 60/40 defaults. Apply only saved real marks; otherwise clear those placeholders.\n  applyPrescription(panel, profile, evidence);\n\n  // First-use onboarding: if the hunter has no tested RM yet, open directly on\n  // RM / MARCAS so the fitness core cannot be missed. Once marks exist, routine\n  // remains the normal landing tab.\n  const hasAnyRm = Object.values(profile).some((value) => Number(value) > 0);\n  setTab(hasAnyRm ? 'routine' : 'rm');\n}`,
    'RM first-use onboarding',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) STRONGER RUNTIME CONTRACT: PHONE CELLS MUST BE COMFORTABLY READABLE
// ---------------------------------------------------------------------------
{
  const path = '../scripts/highfly_runtime_smoke.mjs';
  let smoke = read(path);
  smoke = replaceRequired(
    smoke,
    'cell.height < 27 ||',
    'cell.height < 32 ||',
    'stat cell real-phone minimum',
  );
  write(path, smoke);
}

// ---------------------------------------------------------------------------
// 4) REGRESSION: CREATOR BREATHING ROOM + MANUAL RM ENTRY + APPROVED COMBAT
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v0805_creator_rm_visibility.test.ts';
  const content = `import fs from 'node:fs';\nimport { describe, expect, it } from 'vitest';\n\ndescribe('HIGHFLY v0.8.0.5 real-phone creator + RM entry', () => {\n  it('gives the six class stats real physical room instead of merely clipping them inside', () => {\n    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');\n    expect(css).toContain('HIGHFLY v0.8.0.5 — real-phone class stats + explicit RM entry');\n    expect(css).toContain('grid-template-rows: repeat(2, 36px) !important');\n    expect(css).toContain('height: 77px !important');\n    expect(css).toContain('font-size: 10.5px !important');\n    expect(css).toContain('#offline-select[data-hf-creator-step="class"] .char-input-group');\n    expect(css).toContain('display: none !important');\n  });\n\n  it('makes tested RM a visible, editable and persistent first-class training surface', () => {\n    const rms = fs.readFileSync('src/highfly/training_rms.ts', 'utf8');\n    expect(rms).toContain('RM / MARCAS');\n    expect(rms).toContain('Cargá tu 1RM real en kg');\n    expect(rms).toContain("input.addEventListener('input'");\n    expect(rms).toContain("const RM_STORE = 'highfly.training.rms.v1'");\n    expect(rms).toContain("const E1RM_STORE = 'highfly.training.e1rm.v1'");\n    expect(rms).toContain("setTab(hasAnyRm ? 'routine' : 'rm')");\n    expect(rms).toContain('APLICAR A RUTINA');\n  });\n\n  it('keeps approved Wicked Slash spatial sweep untouched', () => {\n    const combat = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');\n    expect(combat).toContain("ability.id === 'sinister_strike'");\n    expect(combat).toContain('highflySweepHalfAngle');\n    expect(combat).toContain('highflyExtraHits');\n  });\n});\n`;
  write(path, content);
}

console.log('[HIGHFLY v0.8.0.5] class stats enlarged for real phone; RM / MARCAS promoted to visible first-use training surface; combat untouched.');

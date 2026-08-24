import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.7.4] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// CREATOR VISUAL HIERARCHY — STOP SHRINKING EVERYTHING TO FIT
//
// The 34/28/38 three-column layout was geometrically valid but visually wrong
// for 915x412: the class picker consumed ~289px and left the live hunter in a
// ~235px window. HIGHFLY now uses a narrow class rail and gives the visual hero
// + dossier the space that actually matters on a phone.
//
// Target at 915x412 (approx):
//   class rail ~150px | live hunter ~300px | dossier ~380px
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/creator_steps.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    "important(layout, 'grid-template-columns', 'minmax(0, 34fr) minmax(0, 66fr)');",
    "important(layout, 'grid-template-columns', 'minmax(145px, 18fr) minmax(0, 82fr)');",
    'class narrow rail + main stage runtime geometry',
  );

  source = replaceRequired(
    source,
    "important(right, 'grid-template-columns', 'minmax(190px, 28fr) minmax(0, 38fr)');",
    "important(right, 'grid-template-columns', 'minmax(285px, 44fr) minmax(330px, 56fr)');",
    'class live hunter + readable dossier runtime geometry',
  );

  write(path, source);
}

// Bring the hunter closer now that the canvas is intentionally wider. This is
// visual scale, not canvas stretching.
{
  const path = 'src/render/characters/preview_framing.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    "  sheet: { y: 1.38, z: 3.8, lookY: 1.25 },",
    "  sheet: { y: 1.34, z: 3.25, lookY: 1.22 },",
    'class preview closer framing',
  );
  write(path, source);
}

{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);

  css += `

/* HIGHFLY v0.7.4 — S23 creator visual hierarchy authority.
   Do not compress the live hunter or dossier merely to keep a wide 3x3 picker. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-layout {
    grid-template-columns: minmax(145px, 18fr) minmax(0, 82fr) !important;
    gap: 8px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right {
    grid-template-columns: minmax(285px, 44fr) minmax(330px, 56fr) !important;
    grid-template-rows: minmax(0, 1fr) !important;
    gap: 8px !important;
    min-width: 0 !important;
    overflow: visible !important;
  }

  /* Nine classes become a slim touch rail. All options remain visible without
     spending one third of the screen on the selector. */
  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: repeat(9, minmax(0, 1fr)) !important;
    grid-auto-rows: minmax(0, 1fr) !important;
    gap: 3px !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
    align-content: stretch !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker .mini-class {
    width: 100% !important;
    min-width: 0 !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    padding: 2px 6px !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    font-size: 9.5px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-preview-container {
    min-width: 285px !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    min-width: 330px !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: 100% !important;
    padding: 8px 10px !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) h3 {
    font-size: 16px !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) span {
    font-size: 9px !important;
    line-height: 1.05 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-desc, .hf-class-desc-v062) {
    margin: 5px 0 !important;
    font-size: 10px !important;
    line-height: 1.18 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-resource, .hf-class-resource-v062) {
    margin: 3px 0 !important;
    font-size: 9.5px !important;
    line-height: 1.05 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .highfly-class-sheet h4,
  body.native-app #offline-select[data-hf-creator-step="class"] .highfly-class-sheet-v062 h4 {
    margin: 4px 0 3px !important;
    font-size: 9px !important;
    line-height: 1 !important;
  }

  /* The old six-across row was the main readability regression. Six stats now
     use a 3x2 grid with real touch/reading size. */
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-auto-rows: 34px !important;
    gap: 5px !important;
    margin: 5px 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span {
    min-width: 0 !important;
    min-height: 34px !important;
    height: 34px !important;
    padding: 4px 6px !important;
    font-size: 9.5px !important;
    line-height: 1.05 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-note, .hf-class-note-v062) {
    margin: 4px 0 0 !important;
    font-size: 8.5px !important;
    line-height: 1.08 !important;
  }
}
`;

  write(path, css);
}

// Align generated historical creator tests with the final visual hierarchy.
for (const testPath of [
  'tests/highfly_v066_creator_combat_flow.test.ts',
  'tests/highfly_v071_combat_matrix_creator.test.ts',
  'tests/highfly_v0711_fx_type_fix.test.ts',
  'tests/highfly_v072_lane_aim_creator.test.ts',
  'tests/highfly_v073_class_geometry_action_sweep.test.ts',
]) {
  let test = read(testPath);
  test = test.replaceAll(
    'minmax(0, 34fr) minmax(0, 66fr)',
    'minmax(145px, 18fr) minmax(0, 82fr)',
  );
  test = test.replaceAll(
    'minmax(190px, 28fr) minmax(0, 38fr)',
    'minmax(285px, 44fr) minmax(330px, 56fr)',
  );
  test = test.replaceAll(
    'grid-template-columns: repeat(3, minmax(0, 1fr)) !important',
    'grid-template-columns: minmax(0, 1fr) !important',
  );
  test = test.replaceAll(
    'grid-template-rows: repeat(3, 46px) !important',
    'grid-template-rows: repeat(9, minmax(0, 1fr)) !important',
  );
  test = test.replaceAll(
    'grid-auto-rows: 46px !important',
    'grid-auto-rows: minmax(0, 1fr) !important',
  );
  test = test.replaceAll('height: 150px !important', 'height: 100% !important');
  test = test.replaceAll('min-height: 150px !important', 'min-height: 0 !important');
  test = test.replaceAll('height: 46px !important', 'height: auto !important');
  test = test.replaceAll('min-height: 46px !important', 'min-height: 0 !important');
  test = test.replaceAll('max-height: 46px !important', 'max-height: none !important');
  test = test.replaceAll(
    'sheet: { y: 1.38, z: 3.8, lookY: 1.25 }',
    'sheet: { y: 1.34, z: 3.25, lookY: 1.22 }',
  );
  write(testPath, test);
}

// Stronger runtime contract: a screen that merely fits is not enough anymore.
// Fail CI when the live hunter or dossier are squeezed below readable widths.
{
  const path = '../scripts/highfly_runtime_smoke.mjs';
  let smoke = read(path);

  smoke = replaceRequired(
    smoke,
    `  if (classGeometry.previewWidth < 185 || classGeometry.detailsWidth < 250) {
    throw new Error(\`HIGHFLY creator Class three-zone widths are too small: \${JSON.stringify(classGeometry)}\`);
  }`,
    `  if (classGeometry.leftWidth > 190) {
    throw new Error(\`HIGHFLY creator Class rail is stealing visual space: \${JSON.stringify(classGeometry)}\`);
  }
  if (classGeometry.previewWidth < 275 || classGeometry.detailsWidth < 325) {
    throw new Error(\`HIGHFLY creator Class visual hierarchy is compressed: \${JSON.stringify(classGeometry)}\`);
  }`,
    'smoke readable creator widths',
  );

  smoke = smoke.replace(
    'Apariencia 50/50 -> Clase 34/28/38 -> world boot OK',
    'Apariencia 50/50 -> Clase rail+hero+stats -> world boot OK',
  );
  write(path, smoke);
}

{
  const path = 'tests/highfly_v074_creator_visual_hierarchy.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY v0.7.4 creator visual hierarchy', () => {
  it('reserves a narrow class rail and materially larger hunter + dossier regions', () => {
    const steps = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');
    expect(steps).toContain("minmax(145px, 18fr) minmax(0, 82fr)");
    expect(steps).toContain("minmax(285px, 44fr) minmax(330px, 56fr)");
    expect(steps).not.toContain("minmax(0, 34fr) minmax(0, 66fr)");
  });

  it('uses a 1x9 class rail and a readable 3x2 stat matrix', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    expect(css).toContain('grid-template-rows: repeat(9, minmax(0, 1fr)) !important');
    expect(css).toContain('min-width: 285px !important');
    expect(css).toContain('min-width: 330px !important');
    expect(css).toContain('grid-auto-rows: 34px !important');
    expect(css).toContain('font-size: 9.5px !important');
  });

  it('moves the preview camera closer instead of faking scale with CSS stretching', () => {
    const framing = fs.readFileSync('src/render/characters/preview_framing.ts', 'utf8');
    expect(framing).toContain("sheet: { y: 1.34, z: 3.25, lookY: 1.22 }");
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.7.4] narrow class rail + large live hunter + readable 3x2 dossier applied.');

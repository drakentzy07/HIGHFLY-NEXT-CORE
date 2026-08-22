import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.7.5] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// CREATOR CLASS — SAME VISUAL LOGIC AS APPEARANCE
//
// 50% LEFT  : name + readable 3x3 class grid + full class dossier
// 50% RIGHT : large live character preview, full height
//
// This patch is intentionally creator-only. It does NOT touch combat, targeting,
// Wicked Slash, Action Sweep, damage dispatch, or skill geometry.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/creator_steps.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    "important(layout, 'grid-template-columns', 'minmax(145px, 18fr) minmax(0, 82fr)');",
    "important(layout, 'grid-template-columns', 'minmax(0, 1fr) minmax(0, 1fr)');",
    'class outer true 50/50',
  );

  source = replaceRequired(
    source,
    `  important(left, 'justify-self', 'stretch');\n  important(right, 'width', '100%');`,
    `  important(left, 'justify-self', 'stretch');\n\n  // Move the class dossier into the information half. This is a real DOM move,\n  // not a visual CSS trick: name -> classes -> dossier all live on the left.\n  const classHost = refs.classRow.parentElement as HTMLElement | null;\n  if (classHost && refs.classDetails.parentElement !== classHost) {\n    classHost.appendChild(refs.classDetails);\n  }\n  classHost?.classList.add('hf-class-info-stack');\n\n  important(right, 'width', '100%');`,
    'move dossier into left information column',
  );

  source = replaceRequired(
    source,
    "important(right, 'grid-template-columns', 'minmax(285px, 44fr) minmax(330px, 56fr)');",
    "important(right, 'grid-template-columns', 'minmax(0, 1fr)');",
    'remove internal preview+dossier split',
  );

  source = replaceRequired(
    source,
    `  important(right, 'display', 'grid');\n  important(right, 'grid-template-columns', 'minmax(0, 1fr)');\n  important(right, 'grid-template-rows', 'minmax(0, 1fr)');\n  important(right, 'gap', '8px');`,
    `  important(right, 'display', 'block');\n  important(right, 'grid-template-columns', 'minmax(0, 1fr)');\n  important(right, 'grid-template-rows', 'minmax(0, 1fr)');\n  important(right, 'gap', '0');`,
    'right half becomes preview-only stage',
  );

  source = replaceRequired(
    source,
    `  important(refs.preview, 'position', 'relative');\n  refs.preview.style.removeProperty('top');\n  refs.preview.style.removeProperty('right');\n  refs.preview.style.removeProperty('bottom');\n  refs.preview.style.removeProperty('left');\n  important(refs.preview, 'inset', 'auto');\n  important(refs.preview, 'width', '100%');\n  important(refs.preview, 'height', '100%');`,
    `  important(refs.preview, 'position', 'absolute');\n  important(refs.preview, 'top', '0');\n  important(refs.preview, 'right', '0');\n  important(refs.preview, 'bottom', '0');\n  important(refs.preview, 'left', '0');\n  important(refs.preview, 'inset', '0');\n  important(refs.preview, 'width', 'auto');\n  important(refs.preview, 'height', 'auto');`,
    'class preview fills entire right half',
  );

  source = source.replaceAll("  important(refs.preview, 'grid-column', '1');\n", "  refs.preview.style.removeProperty('grid-column');\n");
  source = source.replaceAll("  important(refs.preview, 'grid-row', '1');\n", "  refs.preview.style.removeProperty('grid-row');\n");
  source = source.replaceAll("  important(refs.classDetails, 'grid-column', '2');\n", "  refs.classDetails.style.removeProperty('grid-column');\n");
  source = source.replaceAll("  important(refs.classDetails, 'grid-row', '1');\n", "  refs.classDetails.style.removeProperty('grid-row');\n");

  source = replaceRequired(
    source,
    "important(refs.classDetails, 'height', '100%');",
    "important(refs.classDetails, 'height', 'auto');",
    'dossier uses remaining left height',
  );
  source = replaceRequired(
    source,
    "important(refs.classDetails, 'max-height', '100%');",
    "important(refs.classDetails, 'max-height', 'none');",
    'dossier no artificial right-column cap',
  );
  source = replaceRequired(
    source,
    "important(refs.classDetails, 'overflow', 'auto');",
    "important(refs.classDetails, 'overflow', 'hidden');",
    'dossier should fit without hidden scroll',
  );

  write(path, source);
}

{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.7.5 — clean Class screen: information 50% | character 50%.
   This intentionally supersedes the v0.7.4 rail. Nothing is compressed sideways. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-layout {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
    gap: 10px !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right {
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-step="class"] .char-create,
  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-info-stack {
    overflow: hidden !important;
  }

  /* NAME + 3x3 CLASSES + DOSSIER share the complete left half. */
  body.native-app #offline-select[data-hf-creator-step="class"] .char-create,
  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-info-stack {
    display: flex !important;
    flex-direction: column !important;
    gap: 3px !important;
    height: 100% !important;
    min-height: 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker {
    flex: 0 0 94px !important;
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-rows: repeat(3, 29px) !important;
    grid-auto-rows: 29px !important;
    gap: 4px !important;
    width: 100% !important;
    height: 94px !important;
    min-height: 94px !important;
    max-height: 94px !important;
    margin: 2px 0 3px !important;
    padding: 0 !important;
    align-content: start !important;
    overflow: visible !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker .mini-class {
    width: 100% !important;
    min-width: 0 !important;
    height: 29px !important;
    min-height: 29px !important;
    max-height: 29px !important;
    padding: 3px 7px !important;
    gap: 5px !important;
    font-size: 10.5px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker .mini-class-portrait {
    flex: 0 0 19px !important;
    width: 19px !important;
    height: 19px !important;
    min-width: 19px !important;
    min-height: 19px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    position: relative !important;
    inset: auto !important;
    flex: 1 1 auto !important;
    display: block !important;
    width: 100% !important;
    height: auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: 100% !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 6px 8px !important;
    overflow: hidden !important;
    transform: none !important;
    translate: none !important;
    grid-column: auto !important;
    grid-row: auto !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) h3 {
    margin: 0 !important;
    font-size: 15px !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) span {
    font-size: 9px !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-desc, .hf-class-desc-v062) {
    margin: 4px 0 !important;
    font-size: 9.5px !important;
    line-height: 1.12 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-resource, .hf-class-resource-v062) {
    margin: 2px 0 !important;
    font-size: 9px !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .highfly-class-sheet h4,
  body.native-app #offline-select[data-hf-creator-step="class"] .highfly-class-sheet-v062 h4 {
    margin: 3px 0 !important;
    font-size: 9px !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-rows: repeat(2, 28px) !important;
    grid-auto-rows: 28px !important;
    gap: 4px !important;
    width: 100% !important;
    margin: 4px 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span {
    width: 100% !important;
    min-width: 0 !important;
    height: 28px !important;
    min-height: 28px !important;
    padding: 4px 6px !important;
    font-size: 9.5px !important;
    line-height: 1 !important;
    box-sizing: border-box !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-note, .hf-class-note-v062) {
    margin: 3px 0 0 !important;
    font-size: 8px !important;
    line-height: 1.05 !important;
  }

  /* RIGHT 50% is the live hunter only, same philosophy as Appearance. */
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right {
    position: relative !important;
    display: block !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-preview-container {
    position: absolute !important;
    inset: 0 !important;
    width: auto !important;
    height: auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    overflow: hidden !important;
    grid-column: auto !important;
    grid-row: auto !important;
  }
}
`;
  write(path, css);
}

// Align historical creator-only expectations that v0.7.5 deliberately supersedes.
for (const testPath of [
  'tests/highfly_v066_creator_combat_flow.test.ts',
  'tests/highfly_v071_combat_matrix_creator.test.ts',
  'tests/highfly_v0711_fx_type_fix.test.ts',
  'tests/highfly_v072_lane_aim_creator.test.ts',
  'tests/highfly_v073_class_geometry_action_sweep.test.ts',
]) {
  let test = read(testPath);
  test = test.replaceAll('minmax(145px, 18fr) minmax(0, 82fr)', 'minmax(0, 1fr) minmax(0, 1fr)');
  test = test.replaceAll('minmax(285px, 44fr) minmax(330px, 56fr)', 'minmax(0, 1fr)');
  test = test.replaceAll('grid-template-rows: repeat(9, minmax(0, 1fr)) !important', 'grid-template-rows: repeat(3, 29px) !important');
  test = test.replaceAll('grid-auto-rows: minmax(0, 1fr) !important', 'grid-auto-rows: 29px !important');
  test = test.replaceAll('height: 100% !important', 'height: 94px !important');
  test = test.replaceAll('min-height: 0 !important', 'min-height: 94px !important');
  write(testPath, test);
}

// v0.7.4's own regression described the superseded rail. Rewrite it to pin the
// new balanced composition instead of forcing the old cramped design back in.
{
  const path = 'tests/highfly_v074_creator_visual_hierarchy.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY v0.7.4 hierarchy superseded by v0.7.5 balanced creator', () => {
  it('keeps Class as information 50% and live hunter 50%', () => {
    const steps = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');
    expect(steps).toContain("minmax(0, 1fr) minmax(0, 1fr)");
    expect(steps).toContain("classHost.appendChild(refs.classDetails)");
    expect(steps).not.toContain("minmax(145px, 18fr) minmax(0, 82fr)");
  });

  it('uses a readable 3x3 class grid and leaves the right half preview-only', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    expect(css).toContain('grid-template-rows: repeat(3, 29px) !important');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr)) !important');
    expect(css).toContain('RIGHT 50% is the live hunter only');
  });

  it('keeps the closer preview camera introduced in v0.7.4', () => {
    const framing = fs.readFileSync('src/render/characters/preview_framing.ts', 'utf8');
    expect(framing).toContain("sheet: { y: 1.34, z: 3.25, lookY: 1.22 }");
  });
});
`;
  write(path, content);
}

// Strong runtime proof at the S23 CSS viewport. Details must be on the LEFT,
// preview must fill the RIGHT, and both outer halves must remain 50/50.
{
  const path = '../scripts/highfly_runtime_smoke.mjs';
  let smoke = read(path);
  const start = smoke.indexOf('  const classGeometry = await page.evaluate(() => {');
  const end = smoke.indexOf("  await page.evaluate(() => document.querySelector('#btn-start-offline')?.click());", start);
  if (start < 0 || end < 0) throw new Error('Anchor not found: class runtime smoke block');

  const replacement = `  const classGeometry = await page.evaluate(() => {
    const root = document.getElementById('offline-select');
    const left = root?.querySelector('.charselect-col-left');
    const right = root?.querySelector('.charselect-col-right');
    const classRow = root?.querySelector('.hf-class-picker');
    const details = root?.querySelector('#offline-class-details');
    const desc = root?.querySelector(':is(.hf-class-desc, .hf-class-desc-v062)');
    const preview = root?.querySelector('#offline-preview-container');
    const stats = root?.querySelector(':is(.hf-class-stats, .hf-class-stats-v062)');
    const buttons = root?.querySelectorAll('.mini-class');
    if (!left || !right || !classRow || !details || !desc || !preview || !stats) {
      return { ready: false };
    }
    const lr = left.getBoundingClientRect();
    const rr = right.getBoundingClientRect();
    const cr = classRow.getBoundingClientRect();
    const dr = details.getBoundingClientRect();
    const pr = preview.getBoundingClientRect();
    const ds = getComputedStyle(details);
    const ps = getComputedStyle(preview);
    const ss = getComputedStyle(stats);
    return {
      ready: true,
      step: root?.dataset.hfCreatorStep ?? null,
      leftWidth: lr.width,
      rightWidth: rr.width,
      leftTop: lr.top,
      leftBottom: lr.bottom,
      rightTop: rr.top,
      rightBottom: rr.bottom,
      classButtonCount: buttons?.length ?? 0,
      classGridHeight: cr.height,
      detailsParentClass: details.parentElement?.className ?? '',
      detailsLeft: dr.left,
      detailsRight: dr.right,
      detailsTop: dr.top,
      detailsBottom: dr.bottom,
      detailsClientHeight: details.clientHeight,
      detailsScrollHeight: details.scrollHeight,
      previewLeft: pr.left,
      previewRight: pr.right,
      previewTop: pr.top,
      previewBottom: pr.bottom,
      previewWidth: pr.width,
      previewHeight: pr.height,
      detailsOverflow: ds.overflow,
      previewPosition: ps.position,
      statColumns: ss.gridTemplateColumns,
      detailsText: (details.textContent ?? '').trim().slice(0, 700),
    };
  });
  console.log('[HIGHFLY CREATOR CLASS GEOMETRY]', classGeometry);
  if (!classGeometry?.ready || classGeometry.step !== 'class') {
    throw new Error(\`HIGHFLY creator Class balanced layout did not become ready: \${JSON.stringify(classGeometry)}\`);
  }
  if (Math.abs(classGeometry.leftWidth - classGeometry.rightWidth) > 14) {
    throw new Error(\`HIGHFLY creator Class is not true 50/50: \${JSON.stringify(classGeometry)}\`);
  }
  if (classGeometry.classButtonCount !== 9 || classGeometry.classGridHeight < 88) {
    throw new Error(\`HIGHFLY creator Class 3x3 choices are compressed: \${JSON.stringify(classGeometry)}\`);
  }
  if (classGeometry.detailsRight > classGeometry.previewLeft + 2) {
    throw new Error(\`HIGHFLY creator dossier did not stay in the left half: \${JSON.stringify(classGeometry)}\`);
  }
  if (classGeometry.previewHeight < (classGeometry.rightBottom - classGeometry.rightTop) * 0.98) {
    throw new Error(\`HIGHFLY creator live hunter does not fill the right half: \${JSON.stringify(classGeometry)}\`);
  }
  if (classGeometry.previewWidth < classGeometry.rightWidth * 0.98) {
    throw new Error(\`HIGHFLY creator live hunter preview is horizontally compressed: \${JSON.stringify(classGeometry)}\`);
  }
  if (classGeometry.detailsScrollHeight > classGeometry.detailsClientHeight + 4) {
    throw new Error(\`HIGHFLY creator dossier still needs hidden scrolling: \${JSON.stringify(classGeometry)}\`);
  }

`;
  smoke = smoke.slice(0, start) + replacement + smoke.slice(end);
  smoke = smoke.replace(
    'Apariencia 50/50 -> Clase rail+hero+stats -> world boot OK',
    'Apariencia 50/50 -> Clase info 50/50 hunter -> world boot OK',
  );
  write(path, smoke);
}

{
  const path = 'tests/highfly_v075_creator_balanced_layout.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY v0.7.5 balanced Class creator', () => {
  it('moves the dossier into the left information stack and keeps a 50/50 outer split', () => {
    const steps = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');
    expect(steps).toContain("classHost.appendChild(refs.classDetails)");
    expect(steps).toContain("minmax(0, 1fr) minmax(0, 1fr)");
    expect(steps).toContain("important(refs.preview, 'position', 'absolute')");
  });

  it('uses a readable 3x3 class selector and 3x2 stats matrix', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    expect(css).toContain('grid-template-rows: repeat(3, 29px) !important');
    expect(css).toContain('font-size: 10.5px !important');
    expect(css).toContain('grid-template-rows: repeat(2, 28px) !important');
    expect(css).toContain('font-size: 9.5px !important');
  });

  it('does not touch the already-green multi-target Action Sweep implementation', () => {
    const sweep = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');
    expect(sweep).toContain("ability.id === 'sinister_strike'");
    expect(sweep).toContain('highflySweepHalfAngle');
    expect(sweep).toContain('highflyExtraHits');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.7.5] balanced 50/50 Class creator applied; Action Sweep untouched.');

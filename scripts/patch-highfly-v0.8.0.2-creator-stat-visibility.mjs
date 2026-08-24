import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.0.2] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// #131 proved the structural creator is healthy, but the phone screenshot showed
// the second stat row clipped. Do NOT shrink the 3x3 classes, stat text, preview,
// or combat. Reclaim the unused vertical gap above the creator footer instead.
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.8.0.2 — use the free S23 vertical stage; never hide stat row 2. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-layout {
    height: min(315px, calc(100vh - 97px)) !important;
    min-height: min(315px, calc(100vh - 97px)) !important;
    max-height: none !important;
    align-self: start !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right,
  body.native-app #offline-select[data-hf-creator-step="class"] .char-create,
  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-info-stack {
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: hidden !important;
  }

  /* Pin the complete 3x2 stat matrix as a real 47px region. Earlier historical
     styles could report a fitting dossier while visually clipping row two. */
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-rows: repeat(2, 22px) !important;
    grid-auto-rows: 22px !important;
    gap: 3px !important;
    height: 47px !important;
    min-height: 47px !important;
    max-height: 47px !important;
    margin: 2px 0 !important;
    overflow: visible !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span {
    height: 22px !important;
    min-height: 22px !important;
    max-height: 22px !important;
    box-sizing: border-box !important;
  }
}
`;
  write(path, css);
}

// Strengthen the real Chromium smoke. A scrollHeight check was not enough: the
// six actual stat boxes themselves must be physically inside the visible dossier.
{
  const path = '../scripts/highfly_runtime_smoke.mjs';
  let smoke = read(path);
  const anchor = `  await page.evaluate(() => document.querySelector('#btn-start-offline')?.click());`;
  const replacement = `  const classStatVisibility = await page.evaluate(() => {
    const root = document.getElementById('offline-select');
    const details = root?.querySelector('#offline-class-details');
    const grid = root?.querySelector(':is(.hf-class-stats, .hf-class-stats-v062)');
    const cells = Array.from(root?.querySelectorAll(':is(.hf-class-stats, .hf-class-stats-v062) span') ?? []);
    if (!(details instanceof HTMLElement) || !(grid instanceof HTMLElement)) {
      return { ready: false, count: cells.length, cells: [] };
    }
    const dr = details.getBoundingClientRect();
    const gr = grid.getBoundingClientRect();
    const cellRects = cells.map((cell) => {
      const r = cell.getBoundingClientRect();
      const style = getComputedStyle(cell);
      return {
        text: (cell.textContent ?? '').replace(/\\s+/g, ' ').trim(),
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        width: r.width,
        height: r.height,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
      };
    });
    return {
      ready: true,
      count: cellRects.length,
      detailsTop: dr.top,
      detailsBottom: dr.bottom,
      detailsHeight: dr.height,
      gridTop: gr.top,
      gridBottom: gr.bottom,
      gridHeight: gr.height,
      cells: cellRects,
    };
  });
  console.log('[HIGHFLY CREATOR SIX STAT VISIBILITY]', classStatVisibility);
  if (!classStatVisibility?.ready || classStatVisibility.count !== 6) {
    throw new Error(\`HIGHFLY creator must render exactly six class stat cells: \${JSON.stringify(classStatVisibility)}\`);
  }
  // Physical containment is authoritative. #133 measured a healthy 130px dossier
  // with the complete 47px matrix and all six 22px cells visible; an arbitrary
  // 145px dossier minimum produced a false negative despite correct geometry.
  if (classStatVisibility.gridHeight < 46) {
    throw new Error(\`HIGHFLY creator class stat matrix is vertically compressed: \${JSON.stringify(classStatVisibility)}\`);
  }
  if (classStatVisibility.gridTop < classStatVisibility.detailsTop - 1 || classStatVisibility.gridBottom > classStatVisibility.detailsBottom + 1) {
    throw new Error(\`HIGHFLY creator stat matrix escapes the visible dossier: \${JSON.stringify(classStatVisibility)}\`);
  }
  const hiddenStat = classStatVisibility.cells.find((cell) =>
    cell.top < classStatVisibility.detailsTop - 1 ||
    cell.bottom > classStatVisibility.detailsBottom + 1 ||
    cell.height < 20 ||
    cell.width < 80 ||
    cell.display === 'none' ||
    cell.visibility === 'hidden' ||
    Number(cell.opacity) <= 0
  );
  if (hiddenStat) {
    throw new Error(\`HIGHFLY creator class stat is physically clipped/hidden: \${JSON.stringify(classStatVisibility)}\`);
  }
  const rowTops = [...new Set(classStatVisibility.cells.map((cell) => Math.round(cell.top)))];
  if (rowTops.length !== 2) {
    throw new Error(\`HIGHFLY creator class stats are not a real visible 3x2 matrix: \${JSON.stringify(classStatVisibility)}\`);
  }

${anchor}`;
  smoke = replaceRequired(smoke, anchor, replacement, 'six-stat physical visibility smoke');
  write(path, smoke);
}

{
  const path = 'tests/highfly_v0802_creator_stat_visibility.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY v0.8.0.2 creator six-stat visibility', () => {
  it('uses free vertical stage instead of compressing the class controls', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    expect(css).toContain('HIGHFLY v0.8.0.2 — use the free S23 vertical stage');
    expect(css).toContain('height: min(315px, calc(100vh - 97px)) !important');
    expect(css).toContain('height: 47px !important');
    expect(css).toContain('grid-template-rows: repeat(2, 22px) !important');
    expect(css).toContain('height: 94px !important');
  });

  it('keeps the approved Action Sweep and Fitness Core untouched', () => {
    const combat = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');
    const rms = fs.readFileSync('src/highfly/training_rm_math.ts', 'utf8');
    expect(combat).toContain("ability.id === 'sinister_strike'");
    expect(rms).toContain('highflyEstimateE1rm');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.8.0.2] larger Class stage + physical six-stat smoke applied; combat/fitness untouched.');

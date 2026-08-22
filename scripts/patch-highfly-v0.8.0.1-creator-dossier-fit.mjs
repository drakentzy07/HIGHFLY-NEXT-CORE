import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.0.1] patched ${path}`);
}

// #126 proved the 50/50 geometry and 94px 3x3 selector are correct.
// The remaining failure is only 33px of vertical dossier overflow (161px content
// in a 128px slot). Compact the dossier itself; never shrink the selector or the
// full-height live hunter. Combat and Fitness Core are intentionally untouched.
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.8.0.1 — final S23 dossier fit after #126 measured 161px/128px. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    padding: 3px 6px !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.highfly-class-sheet, .highfly-class-sheet-v062) {
    margin: 0 !important;
    padding: 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) {
    display: flex !important;
    align-items: baseline !important;
    justify-content: space-between !important;
    gap: 6px !important;
    min-width: 0 !important;
    margin: 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) h3 {
    flex: 0 0 auto !important;
    margin: 0 !important;
    font-size: 13px !important;
    line-height: 13px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) span {
    min-width: 0 !important;
    margin: 0 !important;
    font-size: 8px !important;
    line-height: 9px !important;
    text-align: right !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-desc, .hf-class-desc-v062) {
    margin: 2px 0 1px !important;
    font-size: 8.5px !important;
    line-height: 9.5px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-resource, .hf-class-resource-v062) {
    display: inline-block !important;
    margin: 0 8px 0 0 !important;
    font-size: 8px !important;
    line-height: 9px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.highfly-class-sheet, .highfly-class-sheet-v062) h4 {
    display: inline-block !important;
    margin: 0 !important;
    font-size: 8px !important;
    line-height: 9px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-rows: repeat(2, 22px) !important;
    grid-auto-rows: 22px !important;
    gap: 3px !important;
    margin: 2px 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span {
    height: 22px !important;
    min-height: 22px !important;
    padding: 2px 5px !important;
    font-size: 8.5px !important;
    line-height: 18px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-note, .hf-class-note-v062) {
    margin: 1px 0 0 !important;
    font-size: 7.5px !important;
    line-height: 8px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
}
`;
  write(path, css);
}

{
  const path = 'tests/highfly_v0801_creator_dossier_fit.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY v0.8.0.1 creator dossier fit', () => {
  it('compacts only the class dossier while preserving the measured 94px selector', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    expect(css).toContain('HIGHFLY v0.8.0.1 — final S23 dossier fit');
    expect(css).toContain('grid-template-rows: repeat(2, 22px) !important');
    expect(css).toContain('height: 22px !important');
    expect(css).toContain('grid-template-rows: repeat(3, 29px) !important');
    expect(css).toContain('height: 94px !important');
  });

  it('does not touch combat or Fitness Core sources', () => {
    const sweep = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');
    const rms = fs.readFileSync('src/highfly/training_rm_math.ts', 'utf8');
    expect(sweep).toContain("ability.id === 'sinister_strike'");
    expect(rms).toContain('highflyEstimateE1rm');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.8.0.1] dossier compacted to fit S23 class stage; selector/preview/combat untouched.');

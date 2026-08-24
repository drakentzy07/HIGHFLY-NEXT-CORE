import fs from 'node:fs';

const cssPath = 'src/styles/highfly.native.css';
let css = fs.readFileSync(cssPath, 'utf8');

css += `

/* HIGHFLY v0.6.6.1 — hard creator stage ownership.
   Appearance uses the entire right 50% as a real preview stage. Absolute inset
   removes every remaining ClaudeCraft mobile height/sticky/flex constraint. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="appearance"] .charselect-col-right {
    position: relative !important;
    display: block !important;
    height: 100% !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-preview-container {
    position: absolute !important;
    inset: 0 !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    left: 0 !important;
    width: auto !important;
    height: auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    order: 0 !important;
    align-self: auto !important;
    justify-self: auto !important;
    flex: none !important;
    transform: none !important;
    z-index: 1 !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-preview-container canvas {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    max-width: none !important;
    max-height: none !important;
  }
}
`;

fs.writeFileSync(cssPath, css, 'utf8');

const testPath = 'tests/highfly_v0661_creator_stage.test.ts';
fs.writeFileSync(
  testPath,
  `import fs from 'node:fs';\nimport { describe, expect, it } from 'vitest';\n\ndescribe('HIGHFLY v0.6.6.1 creator stage ownership', () => {\n  it('pins Appearance preview to the complete right-half stage', () => {\n    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');\n    expect(css).toContain('#offline-select[data-hf-creator-step="appearance"] .charselect-col-right');\n    expect(css).toContain('position: absolute !important');\n    expect(css).toContain('inset: 0 !important');\n    expect(css).toContain('#offline-preview-container canvas');\n  });\n});\n`,
  'utf8',
);

console.log('[HIGHFLY v0.6.6.1] full right-half creator preview stage applied.');

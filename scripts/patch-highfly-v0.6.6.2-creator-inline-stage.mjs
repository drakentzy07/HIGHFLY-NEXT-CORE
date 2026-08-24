import fs from 'node:fs';

const path = 'src/highfly/creator_steps.ts';
let source = fs.readFileSync(path, 'utf8');

const helperAnchor = `function syncPreview(): void {\n  window.dispatchEvent(new Event('resize'));\n}\n`;
const helper = `${helperAnchor}\nfunction highflyApplyCreatorGeometry(refs: CreatorRefs, appearance: boolean): void {\n  const right = refs.preview.parentElement as HTMLElement | null;\n  if (!right) return;\n\n  const important = (el: HTMLElement, prop: string, value: string): void => {\n    el.style.setProperty(prop, value, 'important');\n  };\n\n  if (appearance) {\n    important(right, 'position', 'relative');\n    important(right, 'display', 'block');\n    important(right, 'height', '100%');\n    important(right, 'min-height', '0');\n    important(right, 'overflow', 'hidden');\n    right.style.removeProperty('grid-template-rows');\n    right.style.removeProperty('gap');\n\n    important(refs.preview, 'position', 'absolute');\n    important(refs.preview, 'top', '0');\n    important(refs.preview, 'right', '0');\n    important(refs.preview, 'bottom', '0');\n    important(refs.preview, 'left', '0');\n    important(refs.preview, 'width', 'auto');\n    important(refs.preview, 'height', 'auto');\n    important(refs.preview, 'min-height', '0');\n    important(refs.preview, 'max-height', 'none');\n    important(refs.preview, 'margin', '0');\n    important(refs.preview, 'transform', 'none');\n\n    refs.classDetails.style.removeProperty('height');\n    refs.classDetails.style.removeProperty('min-height');\n    refs.classDetails.style.removeProperty('max-height');\n    refs.classDetails.style.removeProperty('overflow');\n    refs.classDetails.style.removeProperty('padding');\n    refs.classDetails.style.removeProperty('box-sizing');\n    return;\n  }\n\n  // CLASS: HIGHFLY owns the complete right half. Keep the character large but\n  // reserve a guaranteed sheet region that can display every class field.\n  important(right, 'position', 'relative');\n  important(right, 'display', 'grid');\n  important(right, 'grid-template-rows', 'minmax(128px, 0.92fr) minmax(143px, 1.08fr)');\n  important(right, 'gap', '6px');\n  important(right, 'height', '100%');\n  important(right, 'min-height', '0');\n  important(right, 'overflow', 'hidden');\n\n  important(refs.preview, 'position', 'relative');\n  refs.preview.style.removeProperty('top');\n  refs.preview.style.removeProperty('right');\n  refs.preview.style.removeProperty('bottom');\n  refs.preview.style.removeProperty('left');\n  important(refs.preview, 'inset', 'auto');\n  important(refs.preview, 'width', '100%');\n  important(refs.preview, 'height', '100%');\n  important(refs.preview, 'min-height', '128px');\n  important(refs.preview, 'max-height', 'none');\n  important(refs.preview, 'margin', '0');\n  important(refs.preview, 'transform', 'none');\n  important(refs.preview, 'align-self', 'stretch');\n  important(refs.preview, 'justify-self', 'stretch');\n\n  important(refs.classDetails, 'position', 'relative');\n  important(refs.classDetails, 'inset', 'auto');\n  important(refs.classDetails, 'width', '100%');\n  important(refs.classDetails, 'height', '100%');\n  important(refs.classDetails, 'min-height', '143px');\n  important(refs.classDetails, 'max-height', 'none');\n  important(refs.classDetails, 'overflow', 'hidden');\n  important(refs.classDetails, 'box-sizing', 'border-box');\n  important(refs.classDetails, 'padding', '5px 7px');\n  important(refs.classDetails, 'margin', '0');\n  important(refs.classDetails, 'align-self', 'stretch');\n  important(refs.classDetails, 'justify-self', 'stretch');\n}\n`;

if (!source.includes(helperAnchor)) throw new Error('Anchor not found: creator syncPreview helper');
source = source.replace(helperAnchor, helper);

const callAnchor = `    setVisible(refs.preview, true);\n\n    title.textContent = appearance ? 'APARIENCIA' : 'CLASE';`;
const callReplacement = `    setVisible(refs.preview, true);\n    highflyApplyCreatorGeometry(refs, appearance);\n\n    title.textContent = appearance ? 'APARIENCIA' : 'CLASE';`;
if (!source.includes(callAnchor)) throw new Error('Anchor not found: creator geometry application point');
source = source.replace(callAnchor, callReplacement);

fs.writeFileSync(path, source, 'utf8');

// FINAL creator stylesheet authority. The live class renderer from v0.6.2 uses
// -v062 suffixes; target both canonical and v062 names so no historical layer can
// silently escape the final HIGHFLY layout again.
const cssPath = 'src/styles/highfly.native.css';
let css = fs.readFileSync(cssPath, 'utf8');
css += `

/* HIGHFLY v0.6.6.2 — FINAL class-sheet authority for S23 landscape. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    padding: 5px 7px !important;
  }
  body.native-app #offline-select[data-hf-creator-step="class"] .highfly-class-sheet {
    display: grid !important;
    grid-template-rows: auto auto auto auto auto auto !important;
    align-content: start !important;
    gap: 1px !important;
    margin: 0 !important;
    padding: 0 !important;
    min-height: 0 !important;
  }
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) {
    margin: 0 !important;
    padding: 0 !important;
    min-height: 0 !important;
    line-height: 1 !important;
  }
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) h3 {
    margin: 0 !important;
    padding: 0 !important;
    font-size: 13px !important;
    line-height: 1 !important;
  }
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) span {
    margin: 0 !important;
    padding: 0 !important;
    font-size: 8px !important;
    line-height: 1 !important;
  }
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-desc, .hf-class-desc-v062) {
    margin: 2px 0 !important;
    padding: 0 !important;
    font-size: 9px !important;
    line-height: 1.08 !important;
  }
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-resource, .hf-class-resource-v062) {
    margin: 0 !important;
    padding: 0 !important;
    font-size: 8.5px !important;
    line-height: 1 !important;
  }
  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details h4 {
    margin: 1px 0 !important;
    padding: 0 !important;
    font-size: 8px !important;
    line-height: 1 !important;
  }
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) {
    display: grid !important;
    grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
    gap: 3px !important;
    margin: 2px 0 !important;
    padding: 0 !important;
  }
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span {
    min-width: 0 !important;
    min-height: 23px !important;
    height: 23px !important;
    padding: 2px !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    font-size: 7.5px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span > * {
    margin: 0 !important;
    padding: 0 !important;
    line-height: 1 !important;
  }
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-note, .hf-class-note-v062) {
    margin: 1px 0 0 !important;
    padding: 0 !important;
    font-size: 7.5px !important;
    line-height: 1.02 !important;
  }
}
`;
fs.writeFileSync(cssPath, css, 'utf8');

const testPath = 'tests/highfly_v066_creator_combat_flow.test.ts';
let test = fs.readFileSync(testPath, 'utf8');
const testAnchor = `    expect(framing).toContain("sheet: { y: 1.38, z: 3.8, lookY: 1.25 }");`;
const testReplacement = `${testAnchor}\n    const steps = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');\n    expect(steps).toContain('highflyApplyCreatorGeometry(refs, appearance)');\n    expect(steps).toContain("important(refs.preview, 'position', 'absolute')");\n    expect(steps).toContain("important(refs.preview, 'bottom', '0')");\n    expect(steps).toContain("important(right, 'grid-template-rows', 'minmax(128px, 0.92fr) minmax(143px, 1.08fr)')");\n    expect(steps).toContain("important(refs.classDetails, 'min-height', '143px')");\n    expect(css).toContain('.hf-class-stats-v062');\n    expect(css).toContain('grid-template-columns: repeat(6, minmax(0, 1fr)) !important');`;
if (!test.includes(testAnchor)) throw new Error('Anchor not found: v0.6.6 creator geometry contract');
test = test.replace(testAnchor, testReplacement);
fs.writeFileSync(testPath, test, 'utf8');

console.log('[HIGHFLY v0.6.6.2] runtime-owned creator geometry + real v062 class sheet authority applied.');

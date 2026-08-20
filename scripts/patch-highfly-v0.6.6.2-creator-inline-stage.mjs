import fs from 'node:fs';

const path = 'src/highfly/creator_steps.ts';
let source = fs.readFileSync(path, 'utf8');

const helperAnchor = `function syncPreview(): void {\n  window.dispatchEvent(new Event('resize'));\n}\n`;
const helper = `${helperAnchor}\nfunction highflyApplyCreatorGeometry(refs: CreatorRefs, appearance: boolean): void {\n  const right = refs.preview.parentElement as HTMLElement | null;\n  if (!right) return;\n\n  const clear = (el: HTMLElement, props: string[]): void => {\n    for (const prop of props) el.style.removeProperty(prop);\n  };\n\n  if (appearance) {\n    // Runtime ownership beats every legacy ClaudeCraft mobile selector, including\n    // body.mobile-touch preview height/sticky rules. The right column itself is\n    // the containing block and the live 3D preview is pinned to every edge.\n    right.style.setProperty('position', 'relative', 'important');\n    right.style.setProperty('display', 'block', 'important');\n    right.style.setProperty('height', '100%', 'important');\n    right.style.setProperty('min-height', '0', 'important');\n    right.style.setProperty('overflow', 'hidden', 'important');\n\n    refs.preview.style.setProperty('position', 'absolute', 'important');\n    refs.preview.style.setProperty('top', '0', 'important');\n    refs.preview.style.setProperty('right', '0', 'important');\n    refs.preview.style.setProperty('bottom', '0', 'important');\n    refs.preview.style.setProperty('left', '0', 'important');\n    refs.preview.style.setProperty('width', 'auto', 'important');\n    refs.preview.style.setProperty('height', 'auto', 'important');\n    refs.preview.style.setProperty('min-height', '0', 'important');\n    refs.preview.style.setProperty('max-height', 'none', 'important');\n    refs.preview.style.setProperty('margin', '0', 'important');\n    refs.preview.style.setProperty('transform', 'none', 'important');\n    return;\n  }\n\n  clear(right, ['position', 'display', 'height', 'min-height', 'overflow']);\n  clear(refs.preview, [\n    'position', 'top', 'right', 'bottom', 'left', 'width', 'height',\n    'min-height', 'max-height', 'margin', 'transform',\n  ]);\n}\n`;

if (!source.includes(helperAnchor)) throw new Error('Anchor not found: creator syncPreview helper');
source = source.replace(helperAnchor, helper);

const callAnchor = `    setVisible(refs.preview, true);\n\n    title.textContent = appearance ? 'APARIENCIA' : 'CLASE';`;
const callReplacement = `    setVisible(refs.preview, true);\n    highflyApplyCreatorGeometry(refs, appearance);\n\n    title.textContent = appearance ? 'APARIENCIA' : 'CLASE';`;
if (!source.includes(callAnchor)) throw new Error('Anchor not found: creator geometry application point');
source = source.replace(callAnchor, callReplacement);

fs.writeFileSync(path, source, 'utf8');

const testPath = 'tests/highfly_v066_creator_combat_flow.test.ts';
let test = fs.readFileSync(testPath, 'utf8');
const testAnchor = `    expect(framing).toContain("sheet: { y: 1.38, z: 3.8, lookY: 1.25 }");`;
const testReplacement = `${testAnchor}\n    const steps = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');\n    expect(steps).toContain('highflyApplyCreatorGeometry(refs, appearance)');\n    expect(steps).toContain("refs.preview.style.setProperty('position', 'absolute', 'important')");\n    expect(steps).toContain("refs.preview.style.setProperty('bottom', '0', 'important')");`;
if (!test.includes(testAnchor)) throw new Error('Anchor not found: v0.6.6 creator geometry contract');
test = test.replace(testAnchor, testReplacement);
fs.writeFileSync(testPath, test, 'utf8');

console.log('[HIGHFLY v0.6.6.2] runtime-owned full creator preview stage applied.');

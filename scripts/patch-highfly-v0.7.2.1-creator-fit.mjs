import fs from 'node:fs';

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

function replaceLastRequired(source, from, to, label) {
  const index = source.lastIndexOf(from);
  if (index < 0) throw new Error(`Anchor not found: ${label}`);
  return source.slice(0, index) + to + source.slice(index + from.length);
}

const path = 'src/styles/highfly.native.css';
let css = fs.readFileSync(path, 'utf8');

css += `

/* HIGHFLY v0.7.2.1 — fit the complete class dossier in the existing panel. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    padding: 4px 6px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) h3 {
    margin: 0 !important;
    font-size: 14px !important;
    line-height: .95 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) span {
    font-size: 8px !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-desc, .hf-class-desc-v062) {
    margin: 2px 0 !important;
    font-size: 8.5px !important;
    line-height: 1.05 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-resource, .hf-class-resource-v062) {
    margin: 1px 0 !important;
    font-size: 8px !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .highfly-class-sheet h4,
  body.native-app #offline-select[data-hf-creator-step="class"] .highfly-class-sheet-v062 h4 {
    margin: 1px 0 2px !important;
    font-size: 8px !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) {
    grid-auto-rows: 20px !important;
    gap: 3px 5px !important;
    margin: 2px 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span {
    min-height: 20px !important;
    height: 20px !important;
    padding: 2px 5px !important;
    font-size: 7.5px !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-note, .hf-class-note-v062) {
    margin: 2px 0 0 !important;
    font-size: 7.5px !important;
    line-height: 1 !important;
  }
}

/* HIGHFLY v0.7.2.3 — S23 class creator geometry authority.
   Appearance remains true 50/50. Class deliberately gives the live character
   + dossier more horizontal room so the entire right block begins further left. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-layout {
    display: grid !important;
    grid-template-columns: minmax(0, 42fr) minmax(0, 58fr) !important;
    gap: 8px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right {
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
    justify-self: stretch !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-step="class"] .char-create {
    overflow-x: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right {
    grid-template-rows: 102px minmax(0, 1fr) !important;
    gap: 4px !important;
    min-height: 0 !important;
    overflow: visible !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-preview-container {
    min-height: 0 !important;
    max-height: 102px !important;
    height: 100% !important;
    margin: 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    min-height: 0 !important;
    max-height: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    transform: none !important;
    translate: none !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    box-sizing: border-box !important;
  }
}
`;

fs.writeFileSync(path, css, 'utf8');

// Runtime inline !important is the final authority. v0.7.1 still forced a
// 120px + 158px composition, and older creator layers could retain fixed/equal
// child widths. Own the actual layout element and both grid items directly.
const creatorPath = 'src/highfly/creator_steps.ts';
let creator = fs.readFileSync(creatorPath, 'utf8');
creator = replaceRequired(
  creator,
  `  const right = refs.preview.parentElement as HTMLElement | null;\n  if (!right) return;`,
  `  const right = refs.preview.parentElement as HTMLElement | null;\n  const layout = right?.parentElement as HTMLElement | null;\n  const left = layout?.querySelector<HTMLElement>('.charselect-col-left') ?? null;\n  if (!right || !layout || !left) return;`,
  'creator layout runtime refs',
);
creator = replaceRequired(
  creator,
  `  if (appearance) {\n    important(right, 'position', 'relative');`,
  `  if (appearance) {\n    important(layout, 'display', 'grid');\n    important(layout, 'grid-template-columns', 'minmax(0, 1fr) minmax(0, 1fr)');\n    important(layout, 'gap', '10px');\n    important(left, 'width', '100%');\n    important(left, 'min-width', '0');\n    important(left, 'max-width', 'none');\n    important(right, 'width', '100%');\n    important(right, 'max-width', 'none');\n    important(right, 'position', 'relative');`,
  'appearance runtime 50/50 authority',
);
creator = replaceRequired(
  creator,
  `  // CLASS: HIGHFLY owns the complete right half. Keep the character large but\n  // reserve a guaranteed sheet region that can display every class field.\n  important(right, 'position', 'relative');`,
  `  // CLASS: HIGHFLY intentionally gives the character+dossier side more room.\n  // This moves the whole right block left and prevents the class sheet from\n  // being squeezed by historical 50/50/fixed-width creator rules.\n  important(layout, 'display', 'grid');\n  important(layout, 'grid-template-columns', 'minmax(0, 42fr) minmax(0, 58fr)');\n  important(layout, 'gap', '8px');\n  important(left, 'width', '100%');\n  important(left, 'min-width', '0');\n  important(left, 'max-width', 'none');\n  important(left, 'justify-self', 'stretch');\n  important(right, 'width', '100%');\n  important(right, 'max-width', 'none');\n  important(right, 'justify-self', 'stretch');\n  important(right, 'position', 'relative');`,
  'class runtime horizontal authority',
);
creator = replaceRequired(
  creator,
  "important(right, 'grid-template-rows', 'minmax(120px, 0.88fr) minmax(158px, 1.12fr)');",
  "important(right, 'grid-template-rows', '102px minmax(0, 1fr)');",
  'class right rows must fit parent',
);
creator = replaceRequired(
  creator,
  "important(right, 'gap', '6px');",
  "important(right, 'gap', '4px');",
  'class right gap',
);
creator = replaceLastRequired(
  creator,
  "important(right, 'overflow', 'hidden');",
  "important(right, 'overflow', 'visible');",
  'class right overflow',
);
creator = replaceRequired(
  creator,
  "important(refs.preview, 'min-height', '120px');",
  "important(refs.preview, 'min-height', '0');",
  'class preview intrinsic minimum',
);
creator = replaceRequired(
  creator,
  "important(refs.classDetails, 'min-height', '158px');",
  "important(refs.classDetails, 'min-height', '0');",
  'class dossier intrinsic minimum',
);
creator = replaceRequired(
  creator,
  "important(refs.classDetails, 'max-height', 'none');",
  "important(refs.classDetails, 'max-height', '100%');",
  'class dossier parent containment',
);
creator = replaceRequired(
  creator,
  "important(refs.classDetails, 'margin', '0');",
  "important(refs.classDetails, 'margin', '0');\n  important(refs.classDetails, 'transform', 'none');\n  important(refs.classDetails, 'translate', 'none');",
  'class dossier vertical transform reset',
);
fs.writeFileSync(creatorPath, creator, 'utf8');

// Keep historical creator regression contracts active, but align assertions
// deliberately superseded by this final structural layout.
for (const testPath of [
  'tests/highfly_v066_creator_combat_flow.test.ts',
  'tests/highfly_v071_combat_matrix_creator.test.ts',
]) {
  let test = fs.readFileSync(testPath, 'utf8');
  test = test.replaceAll(
    "minmax(120px, 0.88fr) minmax(158px, 1.12fr)",
    "102px minmax(0, 1fr)",
  );
  test = test.replaceAll(
    "important(refs.classDetails, 'min-height', '158px')",
    "important(refs.classDetails, 'min-height', '0')",
  );
  fs.writeFileSync(testPath, test, 'utf8');
}

const laneCreatorTestPath = 'tests/highfly_v072_lane_aim_creator.test.ts';
let laneCreatorTest = fs.readFileSync(laneCreatorTestPath, 'utf8');
laneCreatorTest = laneCreatorTest.replace(
  "grid-template-columns: repeat(2, minmax(0, 1fr)) !important",
  "grid-template-columns: minmax(0, 42fr) minmax(0, 58fr) !important",
);
fs.writeFileSync(laneCreatorTestPath, laneCreatorTest, 'utf8');

// v0.7.2 intentionally replaced the old angular micro-assist with a physical
// world-space lane. Keep the v0.7.0 regression suite enabled, but align its one
// superseded assertion with the newer manual-aim contract.
const combatCoreTestPath = 'tests/highfly_v070_combat_core.test.ts';
let combatCoreTest = fs.readFileSync(combatCoreTestPath, 'utf8');
const staleManualAimContract = `    expect(hud).toContain("const maxAngle = profile.shape === 'cone'");`;
const laneManualAimContract = `    expect(hud).toContain('highflyDirectionalLaneMetrics(player.pos, entity.pos, aimFacing)');\n    expect(hud).not.toContain("const maxAngle = profile.shape === 'cone'");`;
if (!combatCoreTest.includes(staleManualAimContract)) {
  throw new Error('Anchor not found: v0.7.0 superseded manual-aim contract');
}
combatCoreTest = combatCoreTest.replace(staleManualAimContract, laneManualAimContract);
fs.writeFileSync(combatCoreTestPath, combatCoreTest, 'utf8');

// The smoke test still encoded the retired Class 50/50 geometry. Update only
// the class-stage contract: Appearance must remain 50/50, while Class must prove
// that the right block is wider, fully contained and has no hidden stats.
const smokePath = '../scripts/highfly_runtime_smoke.mjs';
let smoke = fs.readFileSync(smokePath, 'utf8');
smoke = replaceRequired(
  smoke,
  `      rightHeight: rr.height,\n      previewHeight: pr.height,`,
  `      rightHeight: rr.height,\n      rightBottom: rr.bottom,\n      previewHeight: pr.height,`,
  'smoke class right bottom geometry',
);
smoke = replaceRequired(
  smoke,
  `  if (Math.abs(classGeometry.leftWidth - classGeometry.rightWidth) > 12) {\n    throw new Error(\`HIGHFLY creator Class columns are not true 50/50: \${JSON.stringify(classGeometry)}\`);\n  }`,
  `  if (classGeometry.rightWidth < classGeometry.leftWidth * 1.25) {\n    throw new Error(\`HIGHFLY creator Class right block did not move left / widen enough: \${JSON.stringify(classGeometry)}\`);\n  }`,
  'smoke class horizontal ratio',
);
smoke = replaceRequired(
  smoke,
  `  if (classGeometry.previewHeight < 115 || classGeometry.detailsHeight < 150) {`,
  `  if (classGeometry.previewHeight < 96 || classGeometry.detailsHeight < 165) {`,
  'smoke class vertical split',
);
smoke = replaceRequired(
  smoke,
  `  if (classGeometry.descriptionBottom > classGeometry.detailsBottom + 2) {`,
  `  if (classGeometry.detailsBottom > classGeometry.rightBottom + 2) {\n    throw new Error(\`HIGHFLY creator Class dossier escapes the right panel: \${JSON.stringify(classGeometry)}\`);\n  }\n  if (classGeometry.descriptionBottom > classGeometry.detailsBottom + 2) {`,
  'smoke class panel containment',
);
smoke = smoke.replace(
  '50/50 Apariencia -> Clase -> world boot OK',
  'Apariencia 50/50 -> Clase 42/58 -> world boot OK',
);
fs.writeFileSync(smokePath, smoke, 'utf8');

console.log('[HIGHFLY v0.7.2.3] runtime 42/58 class creator + full dossier containment + updated smoke contract applied.');

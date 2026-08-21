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

/* HIGHFLY v0.7.2.2 — structural S23 class creator fix.
   The class step is intentionally NOT 50/50: the character + dossier column
   gets the room it actually needs, starts further left, and owns the complete
   available height without intrinsic minimums forcing it below its parent. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-layout {
    grid-template-columns: minmax(0, 42%) minmax(0, 58%) !important;
    gap: 8px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-step="class"] .char-create {
    min-width: 0 !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right {
    grid-template-rows: 102px minmax(0, 1fr) !important;
    gap: 4px !important;
    min-width: 0 !important;
    max-width: 100% !important;
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
    overflow-x: hidden !important;
    overflow-y: auto !important;
    box-sizing: border-box !important;
  }
}
`;

fs.writeFileSync(path, css, 'utf8');

// Runtime inline !important is stronger than CSS. v0.7.1 still forced a
// 120px + 158px + gap composition into a 283px parent, so the dossier could
// physically extend outside the clipped right column. Make the runtime itself
// flexible and let the second row consume exactly the remaining height.
const creatorPath = 'src/highfly/creator_steps.ts';
let creator = fs.readFileSync(creatorPath, 'utf8');
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
fs.writeFileSync(creatorPath, creator, 'utf8');

// Keep historical creator regression contracts active, but align the assertions
// that were deliberately superseded by this final structural layout.
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
  "grid-template-columns: minmax(0, 42%) minmax(0, 58%) !important",
);
fs.writeFileSync(laneCreatorTestPath, laneCreatorTest, 'utf8');

// v0.7.2 intentionally replaced the old angular micro-assist with a physical
// world-space lane. Keep the v0.7.0 regression suite enabled, but align its one
// superseded assertion with the newer manual-aim contract instead of requiring
// both mutually exclusive implementations at the same time.
const combatCoreTestPath = 'tests/highfly_v070_combat_core.test.ts';
let combatCoreTest = fs.readFileSync(combatCoreTestPath, 'utf8');
const staleManualAimContract = `    expect(hud).toContain("const maxAngle = profile.shape === 'cone'");`;
const laneManualAimContract = `    expect(hud).toContain('highflyDirectionalLaneMetrics(player.pos, entity.pos, aimFacing)');\n    expect(hud).not.toContain("const maxAngle = profile.shape === 'cone'");`;
if (!combatCoreTest.includes(staleManualAimContract)) {
  throw new Error('Anchor not found: v0.7.0 superseded manual-aim contract');
}
combatCoreTest = combatCoreTest.replace(staleManualAimContract, laneManualAimContract);
fs.writeFileSync(combatCoreTestPath, combatCoreTest, 'utf8');

console.log('[HIGHFLY v0.7.2.2] class creator shifted left + dossier parent containment + lane-aim regression alignment applied.');

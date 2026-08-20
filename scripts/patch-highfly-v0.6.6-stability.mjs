import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.6.6] patched ${path}`);
}
function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}
function replaceRegexRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(pattern, replacement);
}

// ---------------------------------------------------------------------------
// 1) TRAINING BOOT SAFETY + LEGACY ROUTINE MIGRATION
// v0.6.5 replaced the old HIGHFLY HÍBRIDO/FUERZA/etc preset keys with D1..D5,
// while v0.6.3's draftForRoutine/loadDraft still referenced HIGHFLY HÍBRIDO.
// During startGame that became undefined.map(...) and ClaudeCraft's broad entry
// guard mislabeled it as a renderer failure. Keep logged rows, normalize only the
// stale routine key, and guarantee that no missing routine can crash world boot.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/training_ui.ts';
  let source = read(path);

  const routineEnd = `  'HIGHFLY D5 · FRONTAL + POSTERIOR': ['clean', 'front_squat', 'zercher_good_morning', 'bulgarian', 'front_raise', 'face_pull'],\n};`;
  source = replaceRequired(
    source,
    routineEnd,
    `${routineEnd}\n\nconst DEFAULT_ROUTINE = 'HIGHFLY D1 · PIERNA + HOMBRO';\n\nfunction normalizeRoutineName(value: unknown): string {\n  const name = typeof value === 'string' ? value : '';\n  return Object.prototype.hasOwnProperty.call(ROUTINES, name) ? name : DEFAULT_ROUTINE;\n}`,
    'current HIGHFLY routine catalog',
  );

  source = replaceRegexRequired(
    source,
    /function draftForRoutine\(name: string\): WorkoutDraft \{[\s\S]*?\n\}\n\nfunction storageKey/,
    `function draftForRoutine(name: string): WorkoutDraft {\n  const routine = normalizeRoutineName(name);\n  const exerciseIds = ROUTINES[routine] ?? ROUTINES[DEFAULT_ROUTINE] ?? [];\n  return {\n    version: 1,\n    dayKey: dayKeyLocal(),\n    startedAt: null,\n    routine,\n    rows: exerciseIds.map(defaultRow),\n  };\n}\n\nfunction storageKey`,
    'safe routine draft builder',
  );

  source = replaceRegexRequired(
    source,
    /function loadDraft\(world: HighflyTrainingWorld\): WorkoutDraft \{[\s\S]*?\n\}\n\nfunction saveDraft/,
    `function loadDraft(world: HighflyTrainingWorld): WorkoutDraft {\n  try {\n    const raw = localStorage.getItem(storageKey(world));\n    if (raw) {\n      const parsed = JSON.parse(raw) as WorkoutDraft;\n      if (parsed.version === 1 && parsed.dayKey === dayKeyLocal() && Array.isArray(parsed.rows)) {\n        // Keep today's actual logged work. Only migrate an obsolete routine key.\n        return { ...parsed, routine: normalizeRoutineName(parsed.routine) };\n      }\n    }\n  } catch { /* corrupt/legacy local draft falls back safely */ }\n  return draftForRoutine(DEFAULT_ROUTINE);\n}\n\nfunction saveDraft`,
    'legacy routine draft migration',
  );

  // A stale local draft can contain an old routine label while its real rows are
  // still worth preserving. The select must always point to a current option.
  source = replaceRequired(
    source,
    `  routineEl.value = draft.routine;`,
    `  draft.routine = normalizeRoutineName(draft.routine);\n  routineEl.value = draft.routine;`,
    'routine select normalization',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) RM INSTALLER: NO GLOBAL DOM OBSERVER
// The RM panel can be installed when Training opens. A short startup probe handles
// immediate/offline boot; the explicit highfly:open-training event handles users
// who spend a long time in the creator. No full-document MutationObserver remains.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/training_rms.ts';
  let source = read(path);
  source = replaceRegexRequired(
    source,
    /export function installHighflyRmTraining\(\): void \{[\s\S]*?\n\}\n\ninstallHighflyRmTraining\(\);/,
    `export function installHighflyRmTraining(): void {\n  const scan = (): boolean => {\n    brandTrainingEntry();\n    const panel = document.querySelector<HTMLElement>('.hf-training-shell');\n    if (!panel) return false;\n    installPanel(panel);\n    return true;\n  };\n\n  scan();\n  window.addEventListener('highfly:open-training', () => window.setTimeout(scan, 0));\n\n  let attempts = 0;\n  const startupProbe = window.setInterval(() => {\n    attempts += 1;\n    if (scan() || attempts >= 48) window.clearInterval(startupProbe);\n  }, 250);\n}\n\ninstallHighflyRmTraining();`,
    'bounded RM installer',
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) CREATOR-SPECIFIC 3D CAMERA FRAMING
// The preview was designed for a narrow ClaudeCraft side card (sheet z=5.1).
// HIGHFLY now gives creation almost half the screen, so use a dedicated closer
// camera only for the offline/online creator containers. Character sheet/inspect
// framings remain untouched.
// ---------------------------------------------------------------------------
{
  const path = 'src/render/characters/preview_framing.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    `  sheet: { y: 1.45, z: 5.1, lookY: 1.3 },\n  // Inspect another player:`,
    `  sheet: { y: 1.45, z: 5.1, lookY: 1.3 },\n  // HIGHFLY creator: larger, closer turntable without changing in-game sheets.\n  creator: { y: 1.4, z: 4.15, lookY: 1.25 },\n  // Inspect another player:`,
    'creator preview framing',
  );
  write(path, source);
}

{
  const path = 'src/render/characters/preview.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    `    this.applyFraming(PREVIEW_FRAMING.sheet);`,
    `    const creatorPreview =\n      this.container.id === 'offline-preview-container' ||\n      this.container.id === 'online-preview-container';\n    this.applyFraming(creatorPreview ? PREVIEW_FRAMING.creator : PREVIEW_FRAMING.sheet);`,
    'creator-only preview camera',
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) AUTHORITATIVE S23 LANDSCAPE CREATOR LAYOUT
// Do not add another competing structural controller: v0.6.5.2 already owns the
// two stages correctly. This final CSS makes that existing structure a true ~50/50
// editor/preview composition and gives class information enough vertical room.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.6.6 — authoritative creator composition (S23 landscape). */
@media (orientation: landscape) and (max-height: 560px) {
  body.native-app #offline-select[data-hf-creator-steps="2"] {
    --hf-creator-gap: 14px;
  }

  body.native-app #offline-select[data-hf-creator-steps="2"] .charselect-layout {
    display:grid !important;
    grid-template-columns:minmax(0,52fr) minmax(0,48fr) !important;
    gap:var(--hf-creator-gap) !important;
    align-items:stretch !important;
    min-height:0 !important;
    flex:1 1 auto !important;
    width:100% !important;
    overflow:hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-steps="2"] .char-create,
  body.native-app #offline-select[data-hf-creator-steps="2"] .charselect-col-right {
    width:auto !important;
    max-width:none !important;
    min-width:0 !important;
    min-height:0 !important;
    height:100% !important;
    box-sizing:border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="appearance"] .charselect-col-right {
    display:grid !important;
    grid-template-rows:minmax(0,1fr) !important;
    gap:0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-preview-container {
    width:100% !important;
    height:100% !important;
    min-height:0 !important;
    max-height:none !important;
  }

  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-appearance {
    min-height:0 !important;
    height:100% !important;
    overflow-y:auto !important;
    overflow-x:hidden !important;
    overscroll-behavior:contain;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .char-create {
    align-self:stretch !important;
    overflow:hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .mini-class-row {
    grid-template-columns:repeat(3,minmax(0,1fr)) !important;
    grid-auto-rows:minmax(38px,auto) !important;
    gap:8px !important;
    margin:8px 0 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .mini-class {
    min-height:38px !important;
    padding:5px 9px !important;
    box-sizing:border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right {
    display:grid !important;
    grid-template-rows:minmax(190px,54%) minmax(150px,46%) !important;
    gap:10px !important;
    overflow:hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-preview-container {
    width:100% !important;
    height:100% !important;
    min-height:190px !important;
    max-height:none !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    width:100% !important;
    height:100% !important;
    min-height:150px !important;
    max-height:none !important;
    padding:12px 14px !important;
    box-sizing:border-box !important;
    overflow-y:auto !important;
    overflow-x:hidden !important;
    overscroll-behavior:contain;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .highfly-class-sheet {
    height:auto !important;
    min-height:max-content !important;
    max-height:none !important;
    overflow:visible !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-desc {
    display:block !important;
    max-height:none !important;
    overflow:visible !important;
    margin:6px 0 9px !important;
    line-height:1.32 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-stats {
    grid-template-columns:repeat(3,minmax(0,1fr)) !important;
    gap:6px !important;
    padding-bottom:4px !important;
  }

  body.native-app #offline-select[data-hf-creator-steps="2"] .hf-creator-stagebar {
    min-height:46px !important;
    padding:6px 10px !important;
    margin-top:6px !important;
    flex:0 0 46px !important;
  }

  body.native-app #offline-select[data-hf-creator-steps="2"] .hf-stage-actions button {
    min-width:190px !important;
    height:36px !important;
    border-radius:18px !important;
  }
}
`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// 5) STABILITY CONTRACTS
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v066_stability.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY v0.6.6 stabilization contracts', () => {
  it('migrates obsolete workout routine keys without undefined.map', () => {
    const ui = fs.readFileSync('src/highfly/training_ui.ts', 'utf8');
    expect(ui).toContain("const DEFAULT_ROUTINE = 'HIGHFLY D1 · PIERNA + HOMBRO'");
    expect(ui).toContain('function normalizeRoutineName(value: unknown)');
    expect(ui).toContain('ROUTINES[routine] ?? ROUTINES[DEFAULT_ROUTINE] ?? []');
    expect(ui).toContain('return { ...parsed, routine: normalizeRoutineName(parsed.routine) }');
    expect(ui).not.toContain("ROUTINES['HIGHFLY HÍBRIDO']).map");
    expect(ui).not.toContain("draftForRoutine('HIGHFLY HÍBRIDO')");
  });

  it('does not keep a global MutationObserver in the RM installer', () => {
    const rms = fs.readFileSync('src/highfly/training_rms.ts', 'utf8');
    expect(rms).not.toContain('new MutationObserver(scan)');
    expect(rms).toContain("window.addEventListener('highfly:open-training'");
    expect(rms).toContain('startupProbe');
  });

  it('uses a dedicated larger creator framing without changing sheet framing', () => {
    const framing = fs.readFileSync('src/render/characters/preview_framing.ts', 'utf8');
    const preview = fs.readFileSync('src/render/characters/preview.ts', 'utf8');
    expect(framing).toContain('sheet: { y: 1.45, z: 5.1, lookY: 1.3 }');
    expect(framing).toContain('creator: { y: 1.4, z: 4.15, lookY: 1.25 }');
    expect(preview).toContain("this.container.id === 'offline-preview-container'");
    expect(preview).toContain('PREVIEW_FRAMING.creator');
  });

  it('owns the landscape creator as an approximately 50/50 composition', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    expect(css).toContain('grid-template-columns:minmax(0,52fr) minmax(0,48fr) !important');
    expect(css).toContain('grid-template-rows:minmax(190px,54%) minmax(150px,46%) !important');
    expect(css).toContain('min-height:150px !important');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.6.6] stability + safe training migration + 50/50 creator applied.');

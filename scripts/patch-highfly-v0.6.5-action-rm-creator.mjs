import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.6.5] patched ${path}`);
}
function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// 0) REPAIR v0.6.4 RAW CSS ESCAPES
// v0.6.4 used String.raw for a CSS block containing \n escapes. That leaves
// literal backslash-n tokens in the generated stylesheet and Lightning CSS
// correctly rejects the resulting `n` identifier. Repair only that block.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  const brokenMarker = '\\n\\n/* HIGHFLY v0.6.4 — two-step creator.';
  const markerAt = css.indexOf(brokenMarker);
  if (markerAt >= 0) {
    css = css.slice(0, markerAt) + css.slice(markerAt).replaceAll('\\n', '\n');
  }
  write(path, css);
}

// ---------------------------------------------------------------------------
// 1) TRUE TWO-STAGE CREATOR
// This is structural state, not a media-query illusion: the original class row,
// appearance editor and class details are explicitly hidden/shown by the stage.
// The original ClaudeCraft controls stay authoritative, so selected appearance,
// class and preview state are never duplicated.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/creator_steps.ts';
  const content = `type CreatorStep = 'appearance' | 'class';

function forceVisible(el: HTMLElement | null, visible: boolean): void {
  if (!el) return;
  el.hidden = !visible;
  if (visible) el.style.removeProperty('display');
  else el.style.setProperty('display', 'none', 'important');
}

function syncPreview(): void {
  window.dispatchEvent(new Event('resize'));
}

export function installHighflyCreatorSteps(): void {
  const activate = (): void => {
    if (!document.body.classList.contains('native-app')) return;
    const root = document.getElementById('offline-select');
    if (!root) return;

    const classRow = root.querySelector<HTMLElement>('.mini-class-row');
    const skinRow = root.querySelector<HTMLElement>('#offline-skin-row');
    const appearanceEditor = root.querySelector<HTMLElement>('#offline-appearance');
    const classDetails = root.querySelector<HTMLElement>('#offline-class-details');
    const preview = root.querySelector<HTMLElement>('#offline-preview-container');
    const actions = root.querySelector<HTMLElement>('.auth-actions');
    const start = root.querySelector<HTMLButtonElement>('#btn-start-offline');
    const oldBack = root.querySelector<HTMLButtonElement>('#btn-offline-back');
    if (!classRow || !appearanceEditor || !classDetails || !actions || !start || !preview) return;

    root.dataset.hfCreatorSteps = '2';
    classRow.classList.add('hf-class-picker');

    let nav = root.querySelector<HTMLElement>('.hf-creator-stagebar');
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'hf-creator-stagebar';
      nav.innerHTML =
        '<div class="hf-stage-copy"><b data-hf-stage-title>APARIENCIA</b><span data-hf-stage-progress>PASO 1 DE 2</span></div>' +
        '<div class="hf-stage-actions">' +
          '<button type="button" data-hf-creator-back>← APARIENCIA</button>' +
          '<button type="button" data-hf-creator-next>SIGUIENTE · CLASE →</button>' +
        '</div>';
      actions.parentElement?.insertBefore(nav, actions);
    }

    const back = nav.querySelector<HTMLButtonElement>('[data-hf-creator-back]')!;
    const next = nav.querySelector<HTMLButtonElement>('[data-hf-creator-next]')!;
    const title = nav.querySelector<HTMLElement>('[data-hf-stage-title]')!;
    const progress = nav.querySelector<HTMLElement>('[data-hf-stage-progress]')!;

    const setStep = (step: CreatorStep): void => {
      root.dataset.hfCreatorStep = step;
      const appearance = step === 'appearance';

      forceVisible(classRow, !appearance);
      forceVisible(classDetails, !appearance);
      forceVisible(appearanceEditor, appearance);
      forceVisible(skinRow, appearance);
      forceVisible(back, !appearance);
      forceVisible(next, appearance);
      forceVisible(start, !appearance);
      forceVisible(oldBack, false);

      title.textContent = appearance ? 'APARIENCIA' : 'CLASE';
      progress.textContent = appearance ? 'PASO 1 DE 2' : 'PASO 2 DE 2';

      // The preview belongs to both stages and must never collapse when its
      // sibling panel changes visibility.
      forceVisible(preview, true);
      requestAnimationFrame(syncPreview);
      window.setTimeout(syncPreview, 80);
    };

    if (nav.dataset.hfBound !== '1') {
      nav.dataset.hfBound = '1';
      back.addEventListener('click', () => setStep('appearance'));
      next.addEventListener('click', () => setStep('class'));
    }

    // Always recover to Appearance when the offline creator is reopened.
    if (!root.dataset.hfCreatorStep || root.hidden === false) setStep('appearance');
  };

  activate();
  const observer = new MutationObserver(activate);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'hidden'],
  });
}

installHighflyCreatorSteps();
`;
  write(path, content);
}

// ---------------------------------------------------------------------------
// 2) BASIC ATTACK = PERSISTENT COMBAT INTENT, NOT A 140 ms RESTART LOOP
// ClaudeCraft's auto-attack driver already ticks independently from movement and
// its Hunter ranged branch has no movement gate. HIGHFLY therefore only needs to
// engage/reacquire once, then let locomotion + swing cadence run concurrently.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);
  const start = source.indexOf('    let highflyAttackHoldTimer: number | null = null;');
  const endAnchor = '    bindTouchTap(attackBtn, () => {';
  const end = source.indexOf(endAnchor, start);
  if (start < 0 || end < 0) throw new Error('Anchor not found: HIGHFLY attack hold loop');
  const replacement = `    const stopHighflyAttackHold = (): void => {\n      attackBtn.classList.remove('highfly-held');\n    };\n\n    attackBtn.addEventListener(\n      'pointerdown',\n      (event) => {\n        if (\n          event.pointerType !== 'touch' ||\n          !document.body.classList.contains('native-app') ||\n          !document.body.classList.contains('mobile-touch')\n        ) {\n          return;\n        }\n        // One press expresses persistent attack intent. The simulation owns the\n        // actual cadence; movement input is never cleared or restarted here.\n        attackBtn.classList.add('highfly-held');\n        highflyEngageAttack();\n      },\n      true,\n    );\n    attackBtn.addEventListener('pointerup', stopHighflyAttackHold, true);\n    attackBtn.addEventListener('pointercancel', stopHighflyAttackHold, true);\n    attackBtn.addEventListener('lostpointercapture', stopHighflyAttackHold, true);\n\n`;
  source = source.slice(0, start) + replacement + source.slice(end);
  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) TRAINING: REAL RM SOURCE + AUTHORED HIGHFLY DAYS
// No invented 60 kg RM / 40 kg working weight. A fresh row begins at zero and
// the RM panel below becomes the source of truth for percentage prescriptions.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/training_ui.ts';
  let source = read(path);
  source = replaceRequired(source, "    rm: def.weighted ? 60 : 0,", "    rm: 0,", 'remove fake default RM');
  source = replaceRequired(source, "    kg: def.weighted ? 40 : 0,", "    kg: 0,", 'remove fake default kg');

  const routinePattern = /const ROUTINES: Record<string, readonly string\[]> = \{[\s\S]*?\n\};\n\nfunction dayKeyLocal/;
  if (!routinePattern.test(source)) throw new Error('Anchor not found: training routines');
  source = source.replace(
    routinePattern,
    `const ROUTINES: Record<string, readonly string[]> = {\n  'HIGHFLY D1 · PIERNA + HOMBRO': ['clean', 'squat', 'zercher', 'hamstring', 'lateral_raise', 'face_pull'],\n  'HIGHFLY D2 · PECHO + ESPALDA': ['explosive_pushup', 'bench', 'incline_db_bench', 'one_arm_row', 'gironda_row', 'rear_delt', 'arms'],\n  'HIGHFLY D3 · POTENCIA + TIRÓN': ['clean', 'deadlift', 'pendlay', 'leg_press', 'quad_extension', 'hamstring'],\n  'HIGHFLY D4 · HOMBROS + TORSO': ['push_press', 'ohp', 'incline_barbell', 'pullup', 'gironda_row', 'arms', 'face_pull'],\n  'HIGHFLY D5 · FRONTAL + POSTERIOR': ['clean', 'front_squat', 'zercher_good_morning', 'bulgarian', 'front_raise', 'face_pull'],\n};\n\nfunction dayKeyLocal`,
  );

  const exerciseAnchor = `];\n\nconst ROUTINES: Record<string, readonly string[]>`;
  const extras = `  { id: 'zercher', label: 'Sentadilla Zercher', kind: 'strength', stimulus: { str: 44, agi: 7, vit: 31, per: 14, int: 4 }, weighted: true },\n  { id: 'hamstring', label: 'Isquios', kind: 'hypertrophy', stimulus: { str: 28, agi: 7, vit: 48, per: 13, int: 4 }, weighted: true },\n  { id: 'lateral_raise', label: 'Elevaciones laterales', kind: 'hypertrophy', stimulus: { str: 18, agi: 10, vit: 47, per: 20, int: 5 }, weighted: true },\n  { id: 'face_pull', label: 'Face Pull', kind: 'technique', stimulus: { str: 18, agi: 10, vit: 30, per: 36, int: 6 }, weighted: true },\n  { id: 'explosive_pushup', label: 'Flexiones explosivas', kind: 'power', stimulus: { str: 24, agi: 45, vit: 14, per: 13, int: 4 }, weighted: false },\n  { id: 'incline_db_bench', label: 'Press inclinado mancuernas', kind: 'hypertrophy', stimulus: { str: 32, agi: 8, vit: 42, per: 14, int: 4 }, weighted: true },\n  { id: 'one_arm_row', label: 'Remo con mancuerna', kind: 'pull', stimulus: { str: 35, agi: 8, vit: 27, per: 25, int: 5 }, weighted: true },\n  { id: 'gironda_row', label: 'Remo Gironda', kind: 'pull', stimulus: { str: 34, agi: 7, vit: 28, per: 26, int: 5 }, weighted: true },\n  { id: 'rear_delt', label: 'Pájaros / deltoide posterior', kind: 'hypertrophy', stimulus: { str: 17, agi: 10, vit: 44, per: 24, int: 5 }, weighted: true },\n  { id: 'arms', label: 'Brazos', kind: 'hypertrophy', stimulus: { str: 27, agi: 7, vit: 48, per: 13, int: 5 }, weighted: true },\n  { id: 'pendlay', label: 'Remo Pendlay', kind: 'pull', stimulus: { str: 40, agi: 8, vit: 24, per: 24, int: 4 }, weighted: true },\n  { id: 'leg_press', label: 'Prensa', kind: 'hypertrophy', stimulus: { str: 32, agi: 5, vit: 50, per: 9, int: 4 }, weighted: true },\n  { id: 'quad_extension', label: 'Extensión de cuádriceps', kind: 'hypertrophy', stimulus: { str: 21, agi: 5, vit: 57, per: 13, int: 4 }, weighted: true },\n  { id: 'incline_barbell', label: 'Press inclinado barra', kind: 'strength', stimulus: { str: 39, agi: 7, vit: 35, per: 14, int: 5 }, weighted: true },\n  { id: 'bulgarian', label: 'Sentadilla búlgara', kind: 'hypertrophy', stimulus: { str: 29, agi: 12, vit: 43, per: 12, int: 4 }, weighted: true },\n  { id: 'zercher_good_morning', label: 'Buenos días Zercher', kind: 'strength', stimulus: { str: 38, agi: 7, vit: 35, per: 16, int: 4 }, weighted: true },\n  { id: 'front_raise', label: 'Elevaciones frontales', kind: 'hypertrophy', stimulus: { str: 18, agi: 9, vit: 48, per: 20, int: 5 }, weighted: true },\n];\n\nconst ROUTINES: Record<string, readonly string[]>`;
  source = replaceRequired(source, exerciseAnchor, extras, 'extend HIGHFLY exercise catalog');
  write(path, source);
}

// RM panel augments the existing logger instead of replacing it. It persists per
// local HIGHFLY installation and pushes values into the real draft via DOM events,
// so validation still runs through the original training model.
{
  const path = 'src/highfly/training_rms.ts';
  const content = `const RM_STORE = 'highfly.training.rms.v1';

type RmProfile = Record<string, number>;

type Prescription = { pct: number; sets: number; reps: number; rest: number };

const RM_EXERCISES: readonly { id: string; label: string }[] = [
  { id: 'clean', label: 'Hang Power Clean' },
  { id: 'squat', label: 'Sentadilla trasera' },
  { id: 'front_squat', label: 'Sentadilla frontal' },
  { id: 'deadlift', label: 'Peso muerto / Rack Pull' },
  { id: 'bench', label: 'Press banca' },
  { id: 'incline_barbell', label: 'Press inclinado barra' },
  { id: 'ohp', label: 'Press militar' },
  { id: 'push_press', label: 'Push Press' },
  { id: 'pendlay', label: 'Remo Pendlay' },
  { id: 'zercher', label: 'Sentadilla Zercher' },
  { id: 'incline_db_bench', label: 'Press inclinado mancuernas' },
  { id: 'one_arm_row', label: 'Remo con mancuerna' },
  { id: 'gironda_row', label: 'Remo Gironda' },
  { id: 'leg_press', label: 'Prensa' },
];

const PLAN: Record<string, Prescription> = {
  clean: { pct: 0.65, sets: 3, reps: 3, rest: 90 },
  push_press: { pct: 0.70, sets: 3, reps: 3, rest: 90 },
  squat: { pct: 0.82, sets: 3, reps: 5, rest: 180 },
  front_squat: { pct: 0.80, sets: 3, reps: 5, rest: 180 },
  deadlift: { pct: 0.82, sets: 2, reps: 5, rest: 180 },
  bench: { pct: 0.80, sets: 3, reps: 5, rest: 180 },
  ohp: { pct: 0.78, sets: 3, reps: 5, rest: 180 },
  incline_barbell: { pct: 0.75, sets: 3, reps: 6, rest: 120 },
  pendlay: { pct: 0.78, sets: 3, reps: 6, rest: 120 },
  zercher: { pct: 0.72, sets: 3, reps: 6, rest: 120 },
  zercher_good_morning: { pct: 0.60, sets: 3, reps: 8, rest: 120 },
  incline_db_bench: { pct: 0.68, sets: 3, reps: 8, rest: 90 },
  one_arm_row: { pct: 0.70, sets: 3, reps: 8, rest: 90 },
  gironda_row: { pct: 0.68, sets: 3, reps: 10, rest: 90 },
  leg_press: { pct: 0.70, sets: 3, reps: 10, rest: 90 },
  hamstring: { pct: 0.60, sets: 3, reps: 10, rest: 90 },
  quad_extension: { pct: 0.60, sets: 3, reps: 10, rest: 90 },
  lateral_raise: { pct: 0.45, sets: 3, reps: 12, rest: 60 },
  rear_delt: { pct: 0.45, sets: 3, reps: 12, rest: 60 },
  face_pull: { pct: 0.50, sets: 3, reps: 12, rest: 60 },
  arms: { pct: 0.55, sets: 3, reps: 10, rest: 60 },
  bulgarian: { pct: 0.55, sets: 3, reps: 10, rest: 90 },
  front_raise: { pct: 0.45, sets: 3, reps: 12, rest: 60 },
};

function loadRm(): RmProfile {
  try {
    const parsed = JSON.parse(localStorage.getItem(RM_STORE) ?? '{}') as RmProfile;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveRm(profile: RmProfile): void {
  localStorage.setItem(RM_STORE, JSON.stringify(profile));
}

function roundLoad(value: number): number {
  return Math.max(0, Math.round(value / 2.5) * 2.5);
}

function fire(el: HTMLInputElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function sourceRm(profile: RmProfile, exerciseId: string): number {
  if (profile[exerciseId] > 0) return profile[exerciseId];
  // Accessories may use a closely related stored base when no individual RM is
  // available. They never invent a number from thin air.
  if (exerciseId === 'zercher_good_morning') return profile.zercher ?? 0;
  return 0;
}

function applyPrescription(panel: HTMLElement, profile: RmProfile): void {
  for (const row of panel.querySelectorAll<HTMLElement>('.hf-exercise-row')) {
    const exercise = row.querySelector<HTMLSelectElement>('[data-field="exercise"]');
    const rm = row.querySelector<HTMLInputElement>('[data-field="rm"]');
    const kg = row.querySelector<HTMLInputElement>('[data-field="kg"]');
    const sets = row.querySelector<HTMLInputElement>('[data-field="sets"]');
    const reps = row.querySelector<HTMLInputElement>('[data-field="reps"]');
    const rest = row.querySelector<HTMLInputElement>('[data-field="rest"]');
    if (!exercise || !rm || !kg || !sets || !reps) continue;
    const base = sourceRm(profile, exercise.value);
    const plan = PLAN[exercise.value];
    rm.value = base > 0 ? String(base) : '0';
    if (plan) {
      kg.value = base > 0 ? String(roundLoad(base * plan.pct)) : '0';
      sets.value = String(plan.sets);
      reps.value = String(plan.reps);
      if (rest) rest.value = String(plan.rest);
    }
    fire(rm);
    fire(kg);
    fire(sets);
    fire(reps);
    if (rest) fire(rest);
  }
}

function brandTrainingEntry(): void {
  const nodes = [
    document.getElementById('mm-discord'),
    document.querySelector<HTMLElement>('[data-action="discord"]'),
  ].filter((node): node is HTMLElement => !!node);
  for (const node of nodes) {
    if (node.dataset.hfTrainingBrand === '1') continue;
    node.dataset.hfTrainingBrand = '1';
    node.removeAttribute('data-i18n');
    node.removeAttribute('data-i18n-aria');
    node.setAttribute('aria-label', 'Entrenamiento');
    node.setAttribute('title', 'Entrenamiento');
    const svg = node.querySelector('svg');
    if (svg) {
      svg.outerHTML = '<svg class="hf-training-entry-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/></svg>';
    }
    const text = node.querySelector<HTMLElement>('span');
    if (text) text.textContent = 'Entrenamiento';
  }
}

function installPanel(panel: HTMLElement): void {
  if (panel.dataset.hfRmPanel === '1') return;
  panel.dataset.hfRmPanel = '1';

  const summary = panel.querySelector<HTMLElement>('[data-hf-summary]');
  const rows = panel.querySelector<HTMLElement>('[data-hf-rows]');
  if (!summary || !rows) return;

  const tabs = document.createElement('div');
  tabs.className = 'hf-training-tabs';
  tabs.innerHTML = '<button type="button" class="active" data-hf-training-tab="routine">RUTINA</button><button type="button" data-hf-training-tab="rm">RM</button>';
  summary.insertAdjacentElement('afterend', tabs);

  const rmPanel = document.createElement('section');
  rmPanel.className = 'hf-rm-panel';
  rmPanel.hidden = true;
  rmPanel.innerHTML =
    '<div class="hf-rm-head"><div><b>RM DEL CAZADOR</b><span>Guardá tus marcas reales. HIGHFLY calcula las cargas de trabajo desde acá.</span></div><button type="button" data-hf-rm-apply>APLICAR A RUTINA</button></div>' +
    '<div class="hf-rm-grid">' +
      RM_EXERCISES.map((item) => '<label><span>' + item.label + '</span><input type="number" min="0" step="2.5" inputmode="decimal" data-hf-rm="' + item.id + '"><em>kg</em></label>').join('') +
    '</div>';
  tabs.insertAdjacentElement('afterend', rmPanel);

  let profile = loadRm();
  for (const input of rmPanel.querySelectorAll<HTMLInputElement>('[data-hf-rm]')) {
    input.value = profile[input.dataset.hfRm ?? ''] ? String(profile[input.dataset.hfRm ?? '']) : '';
    input.addEventListener('change', () => {
      const id = input.dataset.hfRm;
      if (!id) return;
      const value = Math.max(0, Number(input.value) || 0);
      if (value > 0) profile[id] = value;
      else delete profile[id];
      saveRm(profile);
    });
  }

  const setTab = (tab: 'routine' | 'rm'): void => {
    const routine = tab === 'routine';
    rmPanel.hidden = routine;
    rows.closest<HTMLElement>('.hf-training-shell')?.classList.toggle('hf-show-rm', !routine);
    for (const button of tabs.querySelectorAll<HTMLButtonElement>('[data-hf-training-tab]')) {
      button.classList.toggle('active', button.dataset.hfTrainingTab === tab);
    }
  };

  tabs.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-hf-training-tab]');
    if (!button) return;
    setTab(button.dataset.hfTrainingTab === 'rm' ? 'rm' : 'routine');
  });

  rmPanel.querySelector<HTMLButtonElement>('[data-hf-rm-apply]')?.addEventListener('click', () => {
    profile = loadRm();
    applyPrescription(panel, profile);
    setTab('routine');
  });

  const routineSelect = panel.querySelector<HTMLSelectElement>('[data-hf-routine]');
  routineSelect?.addEventListener('change', () => {
    window.setTimeout(() => applyPrescription(panel, loadRm()), 0);
  });

  rows.addEventListener('change', (event) => {
    const target = event.target as HTMLElement;
    if (target.matches('[data-field="exercise"]')) {
      window.setTimeout(() => applyPrescription(panel, loadRm()), 0);
    }
  });

  // Existing drafts created before RM ownership may still contain the old fake
  // 60/40 defaults. Apply only saved real marks; otherwise clear those placeholders.
  applyPrescription(panel, profile);
}

export function installHighflyRmTraining(): void {
  const scan = (): void => {
    brandTrainingEntry();
    const panel = document.querySelector<HTMLElement>('.hf-training-shell');
    if (panel) installPanel(panel);
  };
  scan();
  window.addEventListener('highfly:open-training', () => window.setTimeout(scan, 0));
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

installHighflyRmTraining();
`;
  write(path, content);
}

{
  const path = 'src/main.ts';
  let source = read(path);
  if (!source.includes("import './highfly/training_rms';")) {
    const anchor = "import { installHighflyTrainingUi } from './highfly/training_ui';";
    source = replaceRequired(source, anchor, `${anchor}\nimport './highfly/training_rms';`, 'training RM import');
  }
  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) MOBILE LAYOUT + READABLE CLASS SHEET + RM TAB
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.6.5 — structural creator, RM ownership and action locomotion. */
body.native-app #offline-select[data-hf-creator-steps="2"] .hf-creator-nav { display:none !important; }
body.native-app #offline-select[data-hf-creator-steps="2"] .hf-creator-stagebar {
  order:90; flex:0 0 auto; width:100%; min-height:42px; display:flex; align-items:center;
  justify-content:space-between; gap:12px; padding:5px 8px; box-sizing:border-box;
  border:1px solid rgba(214,174,65,.42); border-radius:12px; background:rgba(7,8,15,.92);
}
body.native-app #offline-select[data-hf-creator-steps="2"] .hf-stage-copy { display:flex; align-items:baseline; gap:10px; min-width:0; }
body.native-app #offline-select[data-hf-creator-steps="2"] .hf-stage-copy b { color:#f4c84a; font:800 12px/1 sans-serif; letter-spacing:1.4px; }
body.native-app #offline-select[data-hf-creator-steps="2"] .hf-stage-copy span { color:#aaa28a; font:700 8px/1 sans-serif; letter-spacing:.8px; }
body.native-app #offline-select[data-hf-creator-steps="2"] .hf-stage-actions { margin-left:auto; display:flex; gap:8px; }
body.native-app #offline-select[data-hf-creator-steps="2"] .hf-stage-actions button {
  position:static !important; min-width:170px; height:32px; padding:0 14px; border:1px solid rgba(224,184,76,.72);
  border-radius:16px; background:linear-gradient(180deg,#3b2b0b,#171007); color:#ffe49b; font:800 10px/1 sans-serif;
}
body.native-app #offline-select[data-hf-creator-steps="2"] [hidden] { display:none !important; }
body.native-app #offline-select[data-hf-creator-step="appearance"] .mini-class-row,
body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-class-details { display:none !important; }
body.native-app #offline-select[data-hf-creator-step="class"] #offline-appearance,
body.native-app #offline-select[data-hf-creator-step="class"] #offline-skin-row { display:none !important; }
body.native-app #offline-select[data-hf-creator-step="class"] .mini-class-row {
  display:grid !important; grid-template-columns:repeat(3,minmax(0,1fr)) !important; gap:5px !important; margin:4px 0 6px !important;
}
body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
  display:block !important; min-height:0 !important; max-height:none !important; overflow:auto !important; padding:10px 12px !important;
}
body.native-app #offline-select[data-hf-creator-step="class"] .highfly-class-sheet { min-height:0 !important; }
body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-desc { margin:5px 0 7px !important; line-height:1.25 !important; }
body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-stats {
  display:grid !important; grid-template-columns:repeat(3,minmax(0,1fr)) !important; gap:5px !important;
}
body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-stats span {
  min-height:34px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px solid rgba(210,170,67,.3); border-radius:8px;
}
body.native-app #offline-select[data-hf-creator-step="class"] .auth-actions { min-height:42px !important; flex:0 0 42px !important; }
body.native-app #offline-select[data-hf-creator-step="class"] #btn-start-offline {
  display:block !important; position:static !important; width:min(520px,55%) !important; height:38px !important; margin:0 auto !important;
}

body.native-app .hf-training-tabs { display:flex; gap:8px; margin:0 0 8px; }
body.native-app .hf-training-tabs button {
  min-width:118px; height:34px; border:1px solid rgba(61,176,225,.42); border-radius:10px; background:#0b1220; color:#a9b9d8;
  font:800 11px/1 sans-serif; letter-spacing:.7px;
}
body.native-app .hf-training-tabs button.active { color:#fff; border-color:#50cfff; box-shadow:0 0 0 1px rgba(80,207,255,.2) inset; }
body.native-app .hf-rm-panel { min-height:0; overflow:auto; border:1px solid rgba(77,177,221,.28); border-radius:12px; padding:10px; background:rgba(5,10,21,.88); }
body.native-app .hf-rm-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:9px; }
body.native-app .hf-rm-head div { display:flex; flex-direction:column; gap:3px; }
body.native-app .hf-rm-head b { color:#72d8ff; font-size:13px; }
body.native-app .hf-rm-head span { color:#8995ae; font-size:9px; }
body.native-app .hf-rm-head button { height:34px; padding:0 14px; border:1px solid #4bc9ff; border-radius:10px; background:#0b1b30; color:#e8f8ff; font-weight:800; }
body.native-app .hf-rm-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; }
body.native-app .hf-rm-grid label { display:grid; grid-template-columns:minmax(0,1fr) 74px 18px; gap:6px; align-items:center; padding:6px 8px; border:1px solid rgba(69,91,132,.36); border-radius:9px; }
body.native-app .hf-rm-grid label span { color:#dce7fa; font:700 9px/1.15 sans-serif; }
body.native-app .hf-rm-grid input { width:100%; height:30px; box-sizing:border-box; border:1px solid rgba(70,173,219,.38); border-radius:7px; background:#080e1a; color:#fff; text-align:center; font-weight:800; }
body.native-app .hf-rm-grid em { color:#72809a; font:700 8px/1 sans-serif; font-style:normal; }
body.native-app .hf-training-shell.hf-show-rm .hf-training-columns,
body.native-app .hf-training-shell.hf-show-rm [data-hf-rows],
body.native-app .hf-training-shell.hf-show-rm .hf-training-footer { display:none !important; }

@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-steps="2"] .charselect-layout { min-height:0 !important; }
  body.native-app #offline-select[data-hf-creator-step="appearance"] .char-create { min-height:0 !important; }
  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-appearance { min-height:0 !important; overflow:auto !important; }
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right { display:grid !important; grid-template-rows:minmax(105px,40%) minmax(0,60%) !important; gap:6px !important; }
  body.native-app #offline-select[data-hf-creator-step="class"] #offline-preview-container { min-height:105px !important; height:100% !important; }
  body.native-app .hf-rm-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// 5) CONTRACTS
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v065_action_rms_creator.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY v0.6.5 action / RM / creator contracts', () => {
  it('uses structural creator steps instead of breakpoint-only visibility', () => {
    const steps = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');
    expect(steps).toContain("querySelector<HTMLElement>('.mini-class-row')");
    expect(steps).toContain('forceVisible(classRow, !appearance)');
    expect(steps).toContain('forceVisible(classDetails, !appearance)');
    expect(steps).toContain('forceVisible(appearanceEditor, appearance)');
  });

  it('does not restart the basic attack every 140ms', () => {
    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
    expect(hud).not.toContain('window.setInterval(highflyEngageAttack, 140)');
    expect(hud).toContain('movement input is never cleared or restarted here');
  });

  it('owns RM values and removes fake 60/40 defaults', () => {
    const ui = fs.readFileSync('src/highfly/training_ui.ts', 'utf8');
    const rms = fs.readFileSync('src/highfly/training_rms.ts', 'utf8');
    expect(ui).not.toContain('rm: def.weighted ? 60 : 0');
    expect(ui).not.toContain('kg: def.weighted ? 40 : 0');
    expect(rms).toContain("const RM_STORE = 'highfly.training.rms.v1'");
    expect(rms).toContain('APLICAR A RUTINA');
    expect(rms).toContain('hf-training-entry-icon');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.6.5] structural creator + fluid attack intent + RM training pass applied.');

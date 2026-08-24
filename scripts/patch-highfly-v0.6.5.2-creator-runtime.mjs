import fs from 'node:fs';

const path = 'src/highfly/creator_steps.ts';
const content = `type CreatorStep = 'appearance' | 'class';

interface CreatorRefs {
  classRow: HTMLElement;
  skinRow: HTMLElement | null;
  appearanceEditor: HTMLElement;
  classDetails: HTMLElement;
  preview: HTMLElement;
  actions: HTMLElement;
  start: HTMLButtonElement;
  oldBack: HTMLButtonElement | null;
}

function setVisible(el: HTMLElement | null, visible: boolean): void {
  if (!el) return;
  const shouldHide = !visible;
  if (el.hidden !== shouldHide) el.hidden = shouldHide;
  if (visible) {
    if (el.style.getPropertyValue('display') === 'none') el.style.removeProperty('display');
  } else if (el.style.getPropertyValue('display') !== 'none') {
    el.style.setProperty('display', 'none', 'important');
  }
}

function resolveRefs(root: HTMLElement): CreatorRefs | null {
  const classRow = root.querySelector<HTMLElement>('.mini-class-row');
  const appearanceEditor = root.querySelector<HTMLElement>('#offline-appearance');
  const classDetails = root.querySelector<HTMLElement>('#offline-class-details');
  const preview = root.querySelector<HTMLElement>('#offline-preview-container');
  const actions = root.querySelector<HTMLElement>('.auth-actions');
  const start = root.querySelector<HTMLButtonElement>('#btn-start-offline');
  if (!classRow || !appearanceEditor || !classDetails || !preview || !actions || !start) return null;
  return {
    classRow,
    skinRow: root.querySelector<HTMLElement>('#offline-skin-row'),
    appearanceEditor,
    classDetails,
    preview,
    actions,
    start,
    oldBack: root.querySelector<HTMLButtonElement>('#btn-offline-back'),
  };
}

function syncPreview(): void {
  window.dispatchEvent(new Event('resize'));
}

export function installHighflyCreatorSteps(): void {
  let currentStep: CreatorStep = 'appearance';
  let lastOpen = false;
  let ready = false;
  let activeRoot: HTMLElement | null = null;

  const ensureStagebar = (root: HTMLElement, refs: CreatorRefs): HTMLElement => {
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
      refs.actions.parentElement?.insertBefore(nav, refs.actions);
    }
    return nav;
  };

  const applyStep = (root: HTMLElement, step: CreatorStep): boolean => {
    const refs = resolveRefs(root);
    if (!refs) return false;

    refs.classRow.classList.add('hf-class-picker');
    const nav = ensureStagebar(root, refs);
    const back = nav.querySelector<HTMLButtonElement>('[data-hf-creator-back]');
    const next = nav.querySelector<HTMLButtonElement>('[data-hf-creator-next]');
    const title = nav.querySelector<HTMLElement>('[data-hf-stage-title]');
    const progress = nav.querySelector<HTMLElement>('[data-hf-stage-progress]');
    if (!back || !next || !title || !progress) return false;

    if (nav.dataset.hfBound !== '1') {
      nav.dataset.hfBound = '1';
      back.addEventListener('click', () => {
        currentStep = 'appearance';
        applyStep(root, currentStep);
      });
      next.addEventListener('click', () => {
        currentStep = 'class';
        applyStep(root, currentStep);
      });
    }

    const appearance = step === 'appearance';
    root.dataset.hfCreatorSteps = '2';
    root.dataset.hfCreatorStep = step;

    setVisible(refs.classRow, !appearance);
    setVisible(refs.classDetails, !appearance);
    setVisible(refs.appearanceEditor, appearance);
    setVisible(refs.skinRow, appearance);
    setVisible(back, !appearance);
    setVisible(next, appearance);
    setVisible(refs.start, !appearance);
    setVisible(refs.oldBack, false);
    setVisible(refs.preview, true);

    title.textContent = appearance ? 'APARIENCIA' : 'CLASE';
    progress.textContent = appearance ? 'PASO 1 DE 2' : 'PASO 2 DE 2';

    requestAnimationFrame(syncPreview);
    window.setTimeout(syncPreview, 90);
    return true;
  };

  const tick = (): void => {
    if (!document.body.classList.contains('native-app')) return;
    const root = document.getElementById('offline-select');
    if (!root) return;

    const open = !root.hidden;
    if (!open) {
      if (lastOpen) {
        ready = false;
        currentStep = 'appearance';
      }
      lastOpen = false;
      activeRoot = root;
      return;
    }

    if (!lastOpen || activeRoot !== root) {
      ready = false;
      currentStep = 'appearance';
      activeRoot = root;
    }
    lastOpen = true;

    // ClaudeCraft builds parts of the creator after opening the panel. Retry only
    // while those refs are not ready; once mounted, do not touch the DOM again
    // unless the stagebar itself is unexpectedly replaced.
    if (!ready || !root.querySelector('.hf-creator-stagebar')) {
      ready = applyStep(root, currentStep);
    }
  };

  tick();
  window.setInterval(tick, 200);
}

installHighflyCreatorSteps();
`;

fs.writeFileSync(path, content, 'utf8');
console.log('[HIGHFLY v0.6.5.2] creator runtime observer removed; panel-scoped controller installed.');

function patchContract(testPath, replacements) {
  let source = fs.readFileSync(testPath, 'utf8');
  for (const [from, to, label] of replacements) {
    if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
    source = source.replace(from, to);
  }
  fs.writeFileSync(testPath, source, 'utf8');
  console.log(`[HIGHFLY v0.6.5.2] updated ${testPath}`);
}

// v0.6.4/v0.6.5 originally asserted implementation-specific helper names.
// The safe runtime controller intentionally replaced setStep/forceVisible with
// applyStep/setVisible. Keep the behavioral contract, not the obsolete spelling.
patchContract('tests/highfly_v064_control_creator.test.ts', [
  [
    `expect(steps).toContain("setStep('appearance')");`,
    `expect(steps).toContain("currentStep = 'appearance'");\n    expect(steps).toContain('applyStep(root, currentStep)');`,
    'v0.6.4 appearance stage contract',
  ],
  [
    `expect(steps).toContain("setStep('class')");`,
    `expect(steps).toContain("currentStep = 'class'");\n    expect(steps).not.toContain('new MutationObserver');`,
    'v0.6.4 class stage contract',
  ],
]);

patchContract('tests/highfly_v065_action_rms_creator.test.ts', [
  [
    `expect(steps).toContain('forceVisible(classRow, !appearance)');`,
    `expect(steps).toContain('setVisible(refs.classRow, !appearance)');`,
    'v0.6.5 class row contract',
  ],
  [
    `expect(steps).toContain('forceVisible(classDetails, !appearance)');`,
    `expect(steps).toContain('setVisible(refs.classDetails, !appearance)');`,
    'v0.6.5 class details contract',
  ],
  [
    `expect(steps).toContain('forceVisible(appearanceEditor, appearance)');`,
    `expect(steps).toContain('setVisible(refs.appearanceEditor, appearance)');\n    expect(steps).not.toContain('new MutationObserver');\n    expect(steps).toContain('window.setInterval(tick, 200)');`,
    'v0.6.5 appearance/runtime contract',
  ],
]);

console.log('[HIGHFLY v0.6.5.2] creator runtime contracts aligned with safe controller.');

import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.0.3] patched ${path}`);
}

function stripMarkedMediaBlock(css, marker) {
  let removed = 0;
  while (true) {
    const markerAt = css.indexOf(marker);
    if (markerAt < 0) break;
    const commentStart = css.lastIndexOf('/*', markerAt);
    const commentEnd = css.indexOf('*/', markerAt);
    const mediaStart = css.indexOf('@media', commentEnd + 2);
    const braceStart = css.indexOf('{', mediaStart);
    if (commentStart < 0 || commentEnd < 0 || mediaStart < 0 || braceStart < 0) {
      throw new Error(`Could not isolate historical creator block: ${marker}`);
    }
    let depth = 0;
    let blockEnd = -1;
    for (let i = braceStart; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          blockEnd = i + 1;
          break;
        }
      }
    }
    if (blockEnd < 0) throw new Error(`Unclosed historical creator block: ${marker}`);
    css = css.slice(0, commentStart) + css.slice(blockEnd);
    removed += 1;
  }
  return { css, removed };
}

// ---------------------------------------------------------------------------
// 1) REMOVE THE STACKED CLASS AUTHORITIES
//
// These were all valid experiments at their time, but together they leave stale
// height/grid/overflow declarations that fight on a real phone. Remove the old
// class-only layers from the GENERATED stylesheet and replace them with ONE final
// layout below. Appearance keeps its established styling.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  const markers = [
    'HIGHFLY v0.6.6.2 — FINAL class-sheet authority for S23 landscape.',
    'HIGHFLY v0.7.2.1 — fit the complete class dossier in the existing panel.',
    'HIGHFLY v0.7.2.3 — S23 class creator geometry authority.',
    'HIGHFLY v0.7.3 — final S23 class creator: choices | character | dossier.',
    'HIGHFLY v0.7.3.1 — prevent inherited class grid placement from restacking.',
    'HIGHFLY v0.7.4 — S23 creator visual hierarchy authority.',
    'HIGHFLY v0.7.5 — clean Class screen: information 50% | character 50%.',
    'HIGHFLY v0.7.5.1 — #123 class-grid lock only.',
    'HIGHFLY v0.8.0.1 — final S23 dossier fit after #126 measured 161px/128px.',
    'HIGHFLY v0.8.0.2 — use the free S23 vertical stage; never hide stat row 2.',
  ];
  let totalRemoved = 0;
  for (const marker of markers) {
    const result = stripMarkedMediaBlock(css, marker);
    css = result.css;
    totalRemoved += result.removed;
  }
  if (totalRemoved < 8) {
    throw new Error(`Creator cleanup removed too few historical blocks: ${totalRemoved}`);
  }

  css += `

/* HIGHFLY v0.8.0.3 — CLEAN CREATOR AUTHORITY.
   One layout only. Class = information 50% | live hunter 50%.
   Footer is outside the workspace flow. No historical class height stack survives. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-steps="2"] {
    position: relative !important;
  }

  body.native-app #offline-select[data-hf-creator-steps="2"] .charselect-layout {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
    gap: 10px !important;
    width: 100% !important;
    height: min(300px, calc(100vh - 112px)) !important;
    min-height: 0 !important;
    max-height: min(300px, calc(100vh - 112px)) !important;
    margin: 0 !important;
    overflow: visible !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-steps="2"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-steps="2"] .charselect-col-right {
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    box-sizing: border-box !important;
  }

  /* Footer is no longer allowed to steal vertical room from name/classes/stats. */
  body.native-app #offline-select[data-hf-creator-steps="2"] .hf-creator-stagebar {
    position: absolute !important;
    left: 16px !important;
    right: 16px !important;
    bottom: 8px !important;
    width: auto !important;
    height: 56px !important;
    min-height: 56px !important;
    margin: 0 !important;
    z-index: 20 !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-steps="2"] .auth-actions {
    position: static !important;
    flex: 0 0 0 !important;
    width: 0 !important;
    height: 0 !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    overflow: visible !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #btn-start-offline {
    display: block !important;
    position: absolute !important;
    left: 50% !important;
    right: auto !important;
    bottom: 14px !important;
    transform: translateX(-50%) !important;
    width: min(420px, 36%) !important;
    height: 44px !important;
    min-height: 44px !important;
    margin: 0 !important;
    z-index: 25 !important;
  }

  /* APPEARANCE stays simple 50/50 and preview-only on the right. */
  body.native-app #offline-select[data-hf-creator-step="appearance"] .charselect-col-right {
    position: relative !important;
    display: block !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-preview-container {
    position: absolute !important;
    inset: 0 !important;
    width: auto !important;
    height: auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    overflow: hidden !important;
  }

  /* CLASS LEFT: name input + readable 3x3 classes + full dossier. */
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-left,
  body.native-app #offline-select[data-hf-creator-step="class"] .char-create,
  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-info-stack {
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .char-create,
  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-info-stack {
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
    padding-bottom: 0 !important;
    box-sizing: border-box !important;
  }

  /* The name was already explained on Appearance. Keep the input, remove the
     redundant label on step 2 and spend those pixels on the stat matrix. */
  body.native-app #offline-select[data-hf-creator-step="class"] .auth-label[for="char-name"] {
    display: none !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .char-input-group {
    flex: 0 0 38px !important;
    width: 100% !important;
    height: 38px !important;
    min-height: 38px !important;
    max-height: 38px !important;
    margin: 0 0 2px !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #char-name {
    width: 100% !important;
    height: 38px !important;
    min-height: 38px !important;
    max-height: 38px !important;
    padding: 0 12px !important;
    font-size: 13px !important;
    line-height: 38px !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.mini-class-row.hf-class-picker, .hf-class-picker) {
    display: grid !important;
    flex: 0 0 94px !important;
    flex-grow: 0 !important;
    flex-shrink: 0 !important;
    flex-basis: 94px !important;
    width: 100% !important;
    height: 94px !important;
    min-height: 94px !important;
    max-height: 94px !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-rows: repeat(3, 29px) !important;
    grid-auto-rows: 29px !important;
    gap: 4px !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker .mini-class {
    width: 100% !important;
    min-width: 0 !important;
    height: 29px !important;
    min-height: 29px !important;
    max-height: 29px !important;
    padding: 3px 8px !important;
    gap: 6px !important;
    font-size: 10.5px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker .mini-class-portrait {
    flex: 0 0 19px !important;
    width: 19px !important;
    height: 19px !important;
    min-width: 19px !important;
    min-height: 19px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    position: relative !important;
    inset: auto !important;
    flex: 1 1 0 !important;
    display: block !important;
    width: 100% !important;
    height: auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: 100% !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 5px 7px !important;
    overflow: hidden !important;
    transform: none !important;
    translate: none !important;
    grid-column: auto !important;
    grid-row: auto !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.highfly-class-sheet, .highfly-class-sheet-v062) {
    display: grid !important;
    grid-template-rows: auto auto auto auto 64px !important;
    align-content: start !important;
    gap: 1px !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) {
    display: flex !important;
    align-items: baseline !important;
    justify-content: space-between !important;
    gap: 6px !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) h3 {
    flex: 0 0 auto !important;
    margin: 0 !important;
    padding: 0 !important;
    font-size: 14px !important;
    line-height: 15px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) span {
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    font-size: 8.5px !important;
    line-height: 10px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-desc, .hf-class-desc-v062) {
    display: -webkit-box !important;
    -webkit-box-orient: vertical !important;
    -webkit-line-clamp: 2 !important;
    margin: 2px 0 !important;
    padding: 0 !important;
    font-size: 9px !important;
    line-height: 11px !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-resource, .hf-class-resource-v062),
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.highfly-class-sheet, .highfly-class-sheet-v062) h4 {
    margin: 0 !important;
    padding: 0 !important;
    font-size: 8.5px !important;
    line-height: 10px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-rows: repeat(2, 30px) !important;
    grid-auto-rows: 30px !important;
    gap: 4px !important;
    width: 100% !important;
    height: 64px !important;
    min-height: 64px !important;
    max-height: 64px !important;
    margin: 2px 0 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    box-sizing: border-box !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 4px !important;
    width: 100% !important;
    min-width: 0 !important;
    height: 30px !important;
    min-height: 30px !important;
    max-height: 30px !important;
    padding: 4px 7px !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    font-size: 9.5px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  /* Secondary explanation is available elsewhere. Step 2 prioritizes the six
     actual base attributes instead of clipping them to keep this note. */
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-note, .hf-class-note-v062) {
    display: none !important;
  }

  /* CLASS RIGHT: only the hunter, full stage. */
  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right {
    position: relative !important;
    display: block !important;
    grid-template-columns: none !important;
    grid-template-rows: none !important;
    gap: 0 !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-preview-container {
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
    overflow: hidden !important;
    grid-column: auto !important;
    grid-row: auto !important;
    transform: none !important;
  }
}
`;

  write(path, css);
}

// ---------------------------------------------------------------------------
// 2) REPLACE THE PATCH-ON-PATCH RUNTIME CONTROLLER WITH ONE CLEAN CONTROLLER
// ---------------------------------------------------------------------------
{
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

function important(el: HTMLElement, prop: string, value: string): void {
  el.style.setProperty(prop, value, 'important');
}

function setVisible(el: HTMLElement | null, visible: boolean): void {
  if (!el) return;
  el.hidden = !visible;
  if (visible) {
    if (el.style.getPropertyValue('display') === 'none') el.style.removeProperty('display');
  } else {
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

function highflyApplyCreatorGeometry(refs: CreatorRefs, appearance: boolean): void {
  const right = refs.preview.parentElement as HTMLElement | null;
  const layout = right?.parentElement as HTMLElement | null;
  const left = layout?.querySelector<HTMLElement>('.charselect-col-left') ?? null;
  const classHost = refs.classRow.parentElement as HTMLElement | null;
  if (!right || !layout || !left || !classHost) return;

  important(layout, 'display', 'grid');
  important(layout, 'grid-template-columns', 'minmax(0, 1fr) minmax(0, 1fr)');
  important(layout, 'gap', '10px');
  important(left, 'width', '100%');
  important(left, 'min-width', '0');
  important(left, 'max-width', 'none');
  important(right, 'width', '100%');
  important(right, 'min-width', '0');
  important(right, 'max-width', 'none');
  important(right, 'position', 'relative');
  important(right, 'display', 'block');
  important(right, 'height', '100%');
  important(right, 'min-height', '0');
  important(right, 'overflow', 'hidden');

  important(refs.preview, 'position', 'absolute');
  important(refs.preview, 'top', '0');
  important(refs.preview, 'right', '0');
  important(refs.preview, 'bottom', '0');
  important(refs.preview, 'left', '0');
  important(refs.preview, 'inset', '0');
  important(refs.preview, 'width', 'auto');
  important(refs.preview, 'height', 'auto');
  important(refs.preview, 'min-width', '0');
  important(refs.preview, 'min-height', '0');
  important(refs.preview, 'max-width', 'none');
  important(refs.preview, 'max-height', 'none');
  important(refs.preview, 'margin', '0');
  important(refs.preview, 'transform', 'none');
  refs.preview.style.removeProperty('grid-column');
  refs.preview.style.removeProperty('grid-row');

  if (appearance) return;

  // One real information column: name -> 3x3 class grid -> dossier.
  if (refs.classDetails.parentElement !== classHost) {
    classHost.appendChild(refs.classDetails);
  }
  classHost.classList.add('hf-class-info-stack');

  important(classHost, 'display', 'flex');
  important(classHost, 'flex-direction', 'column');
  important(classHost, 'gap', '4px');
  important(classHost, 'height', '100%');
  important(classHost, 'min-height', '0');
  important(classHost, 'padding-bottom', '0');
  important(classHost, 'overflow', 'hidden');

  important(refs.classRow, 'display', 'grid');
  important(refs.classRow, 'flex', '0 0 94px');
  important(refs.classRow, 'flex-grow', '0');
  important(refs.classRow, 'flex-shrink', '0');
  important(refs.classRow, 'flex-basis', '94px');
  important(refs.classRow, 'height', '94px');
  important(refs.classRow, 'min-height', '94px');
  important(refs.classRow, 'max-height', '94px');
  important(refs.classRow, 'grid-template-columns', 'repeat(3, minmax(0, 1fr))');
  important(refs.classRow, 'grid-template-rows', 'repeat(3, 29px)');
  important(refs.classRow, 'grid-auto-rows', '29px');
  important(refs.classRow, 'gap', '4px');

  important(refs.classDetails, 'position', 'relative');
  important(refs.classDetails, 'inset', 'auto');
  important(refs.classDetails, 'flex', '1 1 0');
  important(refs.classDetails, 'width', '100%');
  important(refs.classDetails, 'height', 'auto');
  important(refs.classDetails, 'min-width', '0');
  important(refs.classDetails, 'min-height', '0');
  important(refs.classDetails, 'max-width', '100%');
  important(refs.classDetails, 'max-height', 'none');
  important(refs.classDetails, 'overflow', 'hidden');
  important(refs.classDetails, 'box-sizing', 'border-box');
  important(refs.classDetails, 'padding', '5px 7px');
  important(refs.classDetails, 'margin', '0');
  important(refs.classDetails, 'transform', 'none');
  important(refs.classDetails, 'translate', 'none');
  refs.classDetails.style.removeProperty('grid-column');
  refs.classDetails.style.removeProperty('grid-row');
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
    root.dataset.hfCreatorClean = '1';

    setVisible(refs.classRow, !appearance);
    setVisible(refs.classDetails, !appearance);
    setVisible(refs.appearanceEditor, appearance);
    setVisible(refs.skinRow, appearance);
    setVisible(back, !appearance);
    setVisible(next, appearance);
    setVisible(refs.start, !appearance);
    setVisible(refs.oldBack, false);
    setVisible(refs.preview, true);

    highflyApplyCreatorGeometry(refs, appearance);

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

    if (!ready || !root.querySelector('.hf-creator-stagebar')) {
      ready = applyStep(root, currentStep);
    }
  };

  tick();
  window.setInterval(tick, 200);
}

installHighflyCreatorSteps();
`;
  write(path, content);
}

// ---------------------------------------------------------------------------
// 3) FINAL RUNTIME CONTRACT: BIG, PHYSICALLY VISIBLE 3x2 STATS
// ---------------------------------------------------------------------------
{
  const path = '../scripts/highfly_runtime_smoke.mjs';
  let smoke = read(path);
  smoke = smoke.replace('cell.height < 20 ||', 'cell.height < 27 ||');
  const anchor = `  const rowTops = [...new Set(classStatVisibility.cells.map((cell) => Math.round(cell.top)))];`;
  if (!smoke.includes(anchor)) throw new Error('Anchor not found: final six-stat row check');
  smoke = smoke.replace(
    anchor,
    `  if (classStatVisibility.detailsBottom - classStatVisibility.gridBottom < 6) {\n    throw new Error(\`HIGHFLY creator stat matrix has no visible bottom breathing room: \${JSON.stringify(classStatVisibility)}\`);\n  }\n  const rowTops = [...new Set(classStatVisibility.cells.map((cell) => Math.round(cell.top)))];`,
  );
  write(path, smoke);
}

// ---------------------------------------------------------------------------
// 4) ALIGN CREATOR-ONLY REGRESSIONS WITH THE CLEAN AUTHORITY
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v066_creator_combat_flow.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY creator + combat flow final authority', () => {
  it('uses the clean 50/50 two-stage creator and full preview stage', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    const steps = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');
    const framing = fs.readFileSync('src/render/characters/preview_framing.ts', 'utf8');
    expect(css).toContain('HIGHFLY v0.8.0.3 — CLEAN CREATOR AUTHORITY');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important');
    expect(steps).toContain('highflyApplyCreatorGeometry(refs, appearance)');
    expect(steps).toContain("important(refs.preview, 'position', 'absolute')");
    expect(steps).toContain("important(refs.classDetails, 'overflow', 'hidden')");
    expect(framing).toContain("sheet: { y: 1.34, z: 3.25, lookY: 1.22 }");
  });

  it('keeps combat hard-casts mobile while world interactions remain stationary', () => {
    const motion = fs.readFileSync('src/sim/player_motion.ts', 'utf8');
    expect(motion).toContain('const HIGHFLY_STATIONARY_CASTS = new Set<string>');
    expect(motion).toContain('highflyCombatCastMoves(p.castingAbility)');
    expect(motion).toContain('FISHING_CAST_ID');
    expect(motion).toContain('GATHER_CAST_ID');
    expect(motion).toContain('CRAFT_CAST_ID');
  });

  it('keeps the real simulation swing cadence', () => {
    const attacks = fs.readFileSync('src/sim/combat/auto_attack.ts', 'utf8');
    expect(attacks).toContain('HIGHFLY_AUTO_ATTACK_INTERVAL_MULT = 0.60');
    expect(attacks).toContain('* HIGHFLY_AUTO_ATTACK_INTERVAL_MULT');
  });
});
`;
  write(path, content);
}

for (const path of [
  'tests/highfly_v074_creator_visual_hierarchy.test.ts',
  'tests/highfly_v075_creator_balanced_layout.test.ts',
  'tests/highfly_v0751_class_grid_lock.test.ts',
  'tests/highfly_v0801_creator_dossier_fit.test.ts',
  'tests/highfly_v0802_creator_stat_visibility.test.ts',
]) {
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY clean creator authority', () => {
  it('has one readable 50/50 Class layout with a 3x3 selector and 3x2 stat matrix', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    const steps = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');
    expect(css).toContain('HIGHFLY v0.8.0.3 — CLEAN CREATOR AUTHORITY');
    expect(css).toContain('grid-template-rows: repeat(3, 29px) !important');
    expect(css).toContain('grid-template-rows: repeat(2, 30px) !important');
    expect(css).toContain('height: 64px !important');
    expect(css).toContain('.auth-label[for="char-name"]');
    expect(steps).toContain("important(refs.classRow, 'height', '94px')");
    expect(steps).toContain('classHost.appendChild(refs.classDetails)');
  });

  it('keeps approved Action Sweep and Fitness Core intact', () => {
    const combat = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');
    const rms = fs.readFileSync('src/highfly/training_rm_math.ts', 'utf8');
    expect(combat).toContain("ability.id === 'sinister_strike'");
    expect(combat).toContain('highflySweepHalfAngle');
    expect(rms).toContain('highflyEstimateE1rm');
  });
});
`;
  write(path, content);
}

{
  const path = 'tests/highfly_v0803_creator_clean_reset.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY v0.8.0.3 creator clean reset', () => {
  it('removes the stacked historical class-layout authorities', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    expect(css).toContain('HIGHFLY v0.8.0.3 — CLEAN CREATOR AUTHORITY');
    expect(css).not.toContain('HIGHFLY v0.6.6.2 — FINAL class-sheet authority');
    expect(css).not.toContain('HIGHFLY v0.7.2.3 — S23 class creator geometry authority');
    expect(css).not.toContain('HIGHFLY v0.7.3 — final S23 class creator');
    expect(css).not.toContain('HIGHFLY v0.7.4 — S23 creator visual hierarchy authority');
    expect(css).not.toContain('HIGHFLY v0.7.5 — clean Class screen');
    expect(css).not.toContain('HIGHFLY v0.8.0.1 — final S23 dossier fit');
    expect(css).not.toContain('HIGHFLY v0.8.0.2 — use the free S23 vertical stage');
  });

  it('dedicates physical space to both stat rows instead of hiding row two', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    expect(css).toContain('grid-template-rows: repeat(2, 30px) !important');
    expect(css).toContain('height: 30px !important');
    expect(css).toContain('height: 64px !important');
    expect(css).toContain('display: none !important');
  });

  it('does not modify the approved spatial combat implementation', () => {
    const combat = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');
    expect(combat).toContain("ability.id === 'sinister_strike'");
    expect(combat).toContain('highflyExtraHits');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.8.0.3] historical class CSS removed; single clean creator authority installed; combat/fitness untouched.');

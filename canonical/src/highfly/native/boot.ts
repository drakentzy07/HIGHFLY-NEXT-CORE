import type { PlayerClass } from '../../sim/types';

const PROFILE_KEY = 'highfly.profile.v1';
const NATIVE_ROOT_ID = 'highfly-native-root';

type ClassId = PlayerClass;
type ProfileSeed = {
  hunterName: string;
  classId: ClassId;
  subclassId: ClassId | null;
};

type ClassMeta = {
  label: string;
};

type AdoptedNode = {
  node: HTMLElement;
  parent: Node;
  next: ChildNode | null;
};

type UpstreamCreatorParts = {
  panel: HTMLElement;
  nameLabel: HTMLLabelElement;
  nameGroup: HTMLElement;
  nameInput: HTMLInputElement;
  classRow: HTMLElement;
  skinRow: HTMLElement;
  appearance: HTMLElement;
  preview: HTMLElement;
  details: HTMLElement;
  start: HTMLButtonElement;
};

const CLASS_ORDER: readonly ClassId[] = [
  'warrior',
  'paladin',
  'hunter',
  'rogue',
  'priest',
  'shaman',
  'mage',
  'warlock',
  'druid',
];

const CLASS_META: Record<ClassId, ClassMeta> = {
  warrior: { label: 'Guerrero' },
  paladin: { label: 'Paladín' },
  hunter: { label: 'Cazador' },
  rogue: { label: 'Pícaro' },
  priest: { label: 'Sacerdote' },
  shaman: { label: 'Chamán' },
  mage: { label: 'Mago' },
  warlock: { label: 'Brujo' },
  druid: { label: 'Druida' },
};

let adoptedNodes: AdoptedNode[] = [];

function root(): HTMLElement {
  const el = document.getElementById(NATIVE_ROOT_ID);
  if (!(el instanceof HTMLElement)) throw new Error('HIGHFLY native root missing');
  return el;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function readProfile(): ProfileSeed | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ProfileSeed>;
    if (!value.classId || !CLASS_ORDER.includes(value.classId as ClassId)) return null;
    const subclassId = value.subclassId && CLASS_ORDER.includes(value.subclassId as ClassId)
      ? (value.subclassId as ClassId)
      : null;
    return {
      hunterName: typeof value.hunterName === 'string' && value.hunterName.trim() ? value.hunterName.trim() : 'CAZADOR',
      classId: value.classId as ClassId,
      subclassId,
    };
  } catch {
    return null;
  }
}

function saveProfile(profile: ProfileSeed): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

async function waitFor<T>(probe: () => T | null | undefined | false, timeoutMs = 12000): Promise<T> {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    const value = probe();
    if (value) return value as T;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 40));
  }
  throw new Error('Tiempo de espera agotado');
}

function showLoading(copy = 'Preparando tu mundo offline…'): void {
  restoreAdoptedNodes();
  root().innerHTML = `
    <div class="hf-boot-shell" data-highfly-screen="loading">
      <div class="hf-brand"><strong>HIGHFLY</strong><span>NEXUS · OFFLINE</span></div>
      <div class="hf-loading">
        <div class="hf-loading-core">
          <div class="hf-loading-title">ENTRANDO AL SISTEMA</div>
          <div class="hf-loading-copy">${copy}</div>
          <div class="hf-loading-bar" aria-hidden="true"></div>
        </div>
      </div>
    </div>`;
}

function findClassButton(container: ParentNode, classId: ClassId): HTMLButtonElement | null {
  const direct = container.querySelector<HTMLButtonElement>(
    `button[data-class="${classId}"], button[data-cls="${classId}"], button[data-value="${classId}"]`,
  );
  if (direct) return direct;

  const labels = new Set([
    normalize(CLASS_META[classId].label),
    normalize(classId),
    classId === 'warrior' ? 'guerrero' : '',
    classId === 'hunter' ? 'cazador' : '',
    classId === 'rogue' ? 'picaro' : '',
    classId === 'priest' ? 'sacerdote' : '',
    classId === 'shaman' ? 'chaman' : '',
    classId === 'warlock' ? 'brujo' : '',
  ]);
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
    const text = normalize(button.textContent ?? '');
    return [...labels].filter(Boolean).some((label) => text === label || text.includes(label));
  }) ?? null;
}

async function prepareUpstreamOffline(): Promise<HTMLElement> {
  const existing = document.getElementById('offline-select');
  if (existing instanceof HTMLElement && !existing.hasAttribute('hidden')) return existing;

  const offline = await waitFor(() => document.getElementById('btn-offline') as HTMLButtonElement | null);
  offline.click();
  return waitFor(() => {
    const panel = document.getElementById('offline-select');
    return panel instanceof HTMLElement && !panel.hasAttribute('hidden') ? panel : null;
  });
}

function adopt(node: HTMLElement, target: HTMLElement): void {
  if (!adoptedNodes.some((entry) => entry.node === node)) {
    adoptedNodes.push({ node, parent: node.parentNode!, next: node.nextSibling });
  }
  target.appendChild(node);
}

function restoreAdoptedNodes(): void {
  for (let i = adoptedNodes.length - 1; i >= 0; i -= 1) {
    const { node, parent, next } = adoptedNodes[i];
    if (!parent.isConnected) continue;
    if (next && next.parentNode === parent) parent.insertBefore(node, next);
    else parent.appendChild(node);
  }
  adoptedNodes = [];
}

function selectedClassFrom(container: ParentNode): ClassId {
  const selected = container.querySelector<HTMLElement>('.mini-class.sel');
  const value = selected?.dataset.class as ClassId | undefined;
  return value && CLASS_ORDER.includes(value) ? value : 'warrior';
}

async function resolveUpstreamCreator(seed: ProfileSeed): Promise<UpstreamCreatorParts> {
  const panel = await prepareUpstreamOffline();
  const wantedClass = findClassButton(panel, seed.classId);
  wantedClass?.click();

  const nameInput = await waitFor(() => document.getElementById('char-name') as HTMLInputElement | null);
  const nameLabel = panel.querySelector<HTMLLabelElement>('label[for="char-name"]');
  const nameGroup = nameInput.closest<HTMLElement>('.char-input-group');
  const classRow = panel.querySelector<HTMLElement>('.mini-class-row');
  const skinRow = document.getElementById('offline-skin-row');
  const appearance = document.getElementById('offline-appearance');
  const preview = document.getElementById('offline-preview-container');
  const details = document.getElementById('offline-class-details');
  const start = document.getElementById('btn-start-offline');

  if (!(nameLabel instanceof HTMLLabelElement)) throw new Error('Creator 0.40: name label missing');
  if (!(nameGroup instanceof HTMLElement)) throw new Error('Creator 0.40: name group missing');
  if (!(classRow instanceof HTMLElement)) throw new Error('Creator 0.40: class row missing');
  if (!(skinRow instanceof HTMLElement)) throw new Error('Creator 0.40: skin row missing');
  if (!(appearance instanceof HTMLElement)) throw new Error('Creator 0.40: appearance customizer missing');
  if (!(preview instanceof HTMLElement)) throw new Error('Creator 0.40: preview missing');
  if (!(details instanceof HTMLElement)) throw new Error('Creator 0.40: class details missing');
  if (!(start instanceof HTMLButtonElement)) throw new Error('Creator 0.40: start button missing');

  // Force one canonical render pass before adoption. ClaudeCraft owns these
  // widgets; HIGHFLY only changes where they are composed on screen.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

  nameInput.value = seed.hunterName;
  nameInput.placeholder = 'NOMBRE DEL CAZADOR';
  nameLabel.textContent = 'NOMBRE DEL CAZADOR';

  return { panel, nameLabel, nameGroup, nameInput, classRow, skinRow, appearance, preview, details, start };
}

function rebuildSubclass(select: HTMLSelectElement, selectedClass: ClassId, preferred: ClassId | null): void {
  const remembered = select.value as ClassId | '';
  select.replaceChildren();

  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Sin subclase por ahora';
  select.appendChild(empty);

  for (const id of CLASS_ORDER) {
    if (id === selectedClass) continue;
    const option = document.createElement('option');
    option.value = id;
    option.textContent = CLASS_META[id].label;
    select.appendChild(option);
  }

  const next = remembered && remembered !== selectedClass
    ? remembered
    : preferred && preferred !== selectedClass
      ? preferred
      : '';
  select.value = next;
}

async function enterWorld(profile: ProfileSeed): Promise<void> {
  showLoading('Aplicando perfil del cazador y preparando el motor…');
  const panel = await prepareUpstreamOffline();

  const name = await waitFor(() => document.getElementById('char-name') as HTMLInputElement | null);
  name.value = profile.hunterName;
  name.dispatchEvent(new Event('input', { bubbles: true }));
  name.dispatchEvent(new Event('change', { bubbles: true }));

  const classButton = findClassButton(panel, profile.classId);
  if (!classButton) throw new Error(`No se encontró la clase ${profile.classId} en el adaptador 0.40`);
  classButton.click();

  const start = await waitFor(() => document.getElementById('btn-start-offline') as HTMLButtonElement | null);
  start.click();

  await waitFor(() => {
    const ui = document.getElementById('ui');
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    return ui && canvas && canvas.width > 0 && canvas.height > 0 ? true : false;
  }, 45000);

  document.body.classList.add('highfly-world-ready');
  root().hidden = true;
}

async function showCreator(initial?: ProfileSeed | null): Promise<void> {
  restoreAdoptedNodes();
  document.body.classList.remove('highfly-world-ready');

  const nativeRoot = root();
  nativeRoot.hidden = false;
  const seed = initial ?? { hunterName: '', classId: 'warrior' as ClassId, subclassId: null };
  const parts = await resolveUpstreamCreator(seed);
  let selectedClass: ClassId = selectedClassFrom(parts.classRow);

  nativeRoot.innerHTML = `
    <div class="hf-boot-shell hf-creator-shell" data-highfly-screen="creator">
      <header class="hf-brand hf-creator-brand">
        <strong>HIGHFLY</strong>
        <span>NEXUS · CREAR CAZADOR</span>
        <nav class="hf-creator-steps" aria-label="Etapas del creador">
          <button type="button" data-step-target="appearance" data-active="true"><b>1</b> APARIENCIA</button>
          <span></span>
          <button type="button" data-step-target="class" data-active="false"><b>2</b> CLASE Y PERFIL</button>
        </nav>
      </header>

      <main class="hf-creator-body">
        <section class="hf-step" data-highfly-step="appearance">
          <div class="hf-step-panel hf-step-panel-scroll">
            <div class="hf-step-kicker">PASO 1</div>
            <h2>CREÁ TU CAZADOR</h2>
            <p class="hf-step-copy">Usá el editor completo del motor: género, rostro, pelo, barba, ojos, accesorios y colores.</p>
            <div id="hf-name-slot" class="hf-adopt-slot hf-name-slot"></div>
            <div class="hf-subheading">APARIENCIA</div>
            <div id="hf-skin-slot" class="hf-adopt-slot hf-skin-slot"></div>
            <div id="hf-appearance-slot" class="hf-adopt-slot hf-appearance-slot"></div>
          </div>
          <div class="hf-step-panel hf-preview-panel">
            <div id="hf-preview-slot-appearance" class="hf-preview-slot"></div>
            <div class="hf-preview-caption"><strong>PREVISUALIZACIÓN 3D</strong><span>Arrastrá el personaje para girarlo.</span></div>
          </div>
        </section>

        <section class="hf-step" data-highfly-step="class" hidden>
          <div class="hf-step-panel hf-class-panel">
            <div class="hf-step-kicker">PASO 2</div>
            <h2>CLASE DEL CAZADOR</h2>
            <p class="hf-step-copy">Elegí la clase principal. El panel derecho muestra los stats base y el equipo real de ClaudeCraft 0.40.</p>
            <div id="hf-class-slot" class="hf-adopt-slot hf-class-slot"></div>
            <label class="hf-subclass-field"><span>SUBCLASE HIGHFLY</span><select id="hf-subclass"></select></label>
          </div>
          <div class="hf-step-panel hf-class-preview-panel">
            <div id="hf-preview-slot-class" class="hf-preview-slot hf-preview-slot-class"></div>
            <div id="hf-details-slot" class="hf-adopt-slot hf-details-slot"></div>
          </div>
        </section>
      </main>

      <footer class="hf-creator-footer">
        <div id="hf-creator-error" class="hf-creator-error" aria-live="polite"></div>
        <div class="hf-footer-actions" data-footer-step="appearance">
          <button id="hf-next" class="hf-action hf-action-primary" type="button">SIGUIENTE · CLASE</button>
        </div>
        <div class="hf-footer-actions" data-footer-step="class" hidden>
          <button id="hf-back" class="hf-action hf-action-secondary" type="button">VOLVER · APARIENCIA</button>
          <button id="hf-enter" class="hf-action hf-action-primary" type="button">ENTRAR A HIGHFLY</button>
        </div>
      </footer>
    </div>`;

  const appearanceStep = nativeRoot.querySelector<HTMLElement>('[data-highfly-step="appearance"]')!;
  const classStep = nativeRoot.querySelector<HTMLElement>('[data-highfly-step="class"]')!;
  const appearanceFooter = nativeRoot.querySelector<HTMLElement>('[data-footer-step="appearance"]')!;
  const classFooter = nativeRoot.querySelector<HTMLElement>('[data-footer-step="class"]')!;
  const stepAppearanceButton = nativeRoot.querySelector<HTMLButtonElement>('[data-step-target="appearance"]')!;
  const stepClassButton = nativeRoot.querySelector<HTMLButtonElement>('[data-step-target="class"]')!;
  const nameSlot = nativeRoot.querySelector<HTMLElement>('#hf-name-slot')!;
  const skinSlot = nativeRoot.querySelector<HTMLElement>('#hf-skin-slot')!;
  const appearanceSlot = nativeRoot.querySelector<HTMLElement>('#hf-appearance-slot')!;
  const classSlot = nativeRoot.querySelector<HTMLElement>('#hf-class-slot')!;
  const appearancePreviewSlot = nativeRoot.querySelector<HTMLElement>('#hf-preview-slot-appearance')!;
  const classPreviewSlot = nativeRoot.querySelector<HTMLElement>('#hf-preview-slot-class')!;
  const detailsSlot = nativeRoot.querySelector<HTMLElement>('#hf-details-slot')!;
  const subclass = nativeRoot.querySelector<HTMLSelectElement>('#hf-subclass')!;
  const next = nativeRoot.querySelector<HTMLButtonElement>('#hf-next')!;
  const back = nativeRoot.querySelector<HTMLButtonElement>('#hf-back')!;
  const enter = nativeRoot.querySelector<HTMLButtonElement>('#hf-enter')!;
  const errorBox = nativeRoot.querySelector<HTMLElement>('#hf-creator-error')!;

  adopt(parts.nameLabel, nameSlot);
  adopt(parts.nameGroup, nameSlot);
  adopt(parts.skinRow, skinSlot);
  adopt(parts.appearance, appearanceSlot);
  adopt(parts.classRow, classSlot);
  adopt(parts.details, detailsSlot);
  adopt(parts.preview, appearancePreviewSlot);

  parts.nameInput.value = seed.hunterName;
  parts.nameLabel.textContent = 'NOMBRE DEL CAZADOR';
  rebuildSubclass(subclass, selectedClass, seed.subclassId);

  const showStep = (step: 'appearance' | 'class') => {
    const appearanceActive = step === 'appearance';
    appearanceStep.hidden = !appearanceActive;
    classStep.hidden = appearanceActive;
    appearanceFooter.hidden = !appearanceActive;
    classFooter.hidden = appearanceActive;
    stepAppearanceButton.dataset.active = String(appearanceActive);
    stepClassButton.dataset.active = String(!appearanceActive);
    stepAppearanceButton.setAttribute('aria-current', appearanceActive ? 'step' : 'false');
    stepClassButton.setAttribute('aria-current', appearanceActive ? 'false' : 'step');
    adopt(parts.preview, appearanceActive ? appearancePreviewSlot : classPreviewSlot);
    window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  };

  const syncSelectedClass = () => {
    selectedClass = selectedClassFrom(parts.classRow);
    rebuildSubclass(subclass, selectedClass, seed.subclassId);
  };

  parts.classRow.addEventListener('click', () => window.queueMicrotask(syncSelectedClass));
  parts.classRow.addEventListener('keydown', () => window.queueMicrotask(syncSelectedClass));

  next.addEventListener('click', () => {
    errorBox.textContent = '';
    showStep('class');
  });
  back.addEventListener('click', () => {
    errorBox.textContent = '';
    showStep('appearance');
  });
  stepAppearanceButton.addEventListener('click', () => showStep('appearance'));
  stepClassButton.addEventListener('click', () => showStep('class'));

  enter.addEventListener('click', async () => {
    const hunterName = parts.nameInput.value.trim();
    if (!hunterName) {
      showStep('appearance');
      parts.nameInput.focus();
      parts.nameInput.setCustomValidity('Ingresá un nombre para tu cazador');
      parts.nameInput.reportValidity();
      return;
    }

    parts.nameInput.setCustomValidity('');
    errorBox.textContent = '';
    enter.disabled = true;
    syncSelectedClass();

    const profile: ProfileSeed = {
      hunterName,
      classId: selectedClass,
      subclassId: subclass.value ? (subclass.value as ClassId) : null,
    };
    saveProfile(profile);

    try {
      await enterWorld(profile);
    } catch (error) {
      console.error('[HIGHFLY] native world entry failed', error);
      const message = error instanceof Error ? error.message : 'No se pudo entrar al mundo.';
      await showCreator(profile);
      const nextError = root().querySelector<HTMLElement>('#hf-creator-error');
      if (nextError) nextError.textContent = message;
    }
  });

  showStep('appearance');
}

async function boot(): Promise<void> {
  document.documentElement.classList.add('highfly-native');
  document.title = 'HIGHFLY';
  showLoading('Inicializando HIGHFLY…');

  const profile = readProfile();
  if (profile) {
    try {
      await enterWorld(profile);
      return;
    } catch (error) {
      console.error('[HIGHFLY] saved profile entry failed; returning to creator', error);
    }
  }

  try {
    await showCreator(profile);
  } catch (error) {
    console.error('[HIGHFLY] canonical creator boot failed', error);
    showLoading(error instanceof Error ? error.message : 'No se pudo abrir el creador.');
  }
}

void boot();

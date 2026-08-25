import { CharacterPreview } from '../../render/characters';
import { charactersReady } from '../../render/characters/assets';
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
  role: string;
  weapon: string;
  armor: string;
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
  warrior: { label: 'Guerrero', role: 'Combate frontal, presión y barridos', weapon: 'Espada / hacha / arma pesada', armor: 'Malla / pesada' },
  paladin: { label: 'Paladín', role: 'Tanque híbrido, soporte y aguante', weapon: 'Arma + escudo / mandoble', armor: 'Pesada' },
  hunter: { label: 'Cazador', role: 'Daño a distancia y movilidad', weapon: 'Arco / proyectiles', armor: 'Cuero / malla' },
  rogue: { label: 'Pícaro', role: 'Asesino móvil y ráfaga corta', weapon: 'Dagas / hojas ligeras', armor: 'Cuero' },
  priest: { label: 'Sacerdote', role: 'Sanación, soporte y daño sagrado', weapon: 'Báculo / foco', armor: 'Tela' },
  shaman: { label: 'Chamán', role: 'Híbrido elemental y soporte', weapon: 'Maza / foco', armor: 'Malla / cuero' },
  mage: { label: 'Mago', role: 'Daño mágico y control de área', weapon: 'Báculo / foco', armor: 'Tela' },
  warlock: { label: 'Brujo', role: 'Daño oscuro e invocaciones', weapon: 'Báculo / foco', armor: 'Tela' },
  druid: { label: 'Druida', role: 'Híbrido adaptable, formas y naturaleza', weapon: 'Báculo / maza', armor: 'Cuero' },
};

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

function upstreamClassButton(panel: HTMLElement, classId: ClassId): HTMLButtonElement | null {
  const direct = panel.querySelector<HTMLButtonElement>(
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
  return Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
    const text = normalize(button.textContent ?? '');
    return [...labels].filter(Boolean).some((label) => text === label || text.includes(label));
  }) ?? null;
}

async function prepareUpstreamOffline(): Promise<HTMLElement> {
  const offline = await waitFor(() => document.getElementById('btn-offline') as HTMLButtonElement | null);
  offline.click();
  return waitFor(() => document.getElementById('offline-select') as HTMLElement | null);
}

async function enterWorld(profile: ProfileSeed): Promise<void> {
  showLoading('Aplicando perfil del cazador y preparando el motor…');
  const panel = await prepareUpstreamOffline();

  const name = await waitFor(() => document.getElementById('char-name') as HTMLInputElement | null);
  name.value = profile.hunterName;
  name.dispatchEvent(new Event('input', { bubbles: true }));
  name.dispatchEvent(new Event('change', { bubbles: true }));

  const classButton = upstreamClassButton(panel, profile.classId);
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
  const nativeRoot = root();
  nativeRoot.hidden = false;
  const seed = initial ?? { hunterName: '', classId: 'warrior' as ClassId, subclassId: null };
  let selectedClass: ClassId = seed.classId;

  nativeRoot.innerHTML = `
    <div class="hf-boot-shell" data-highfly-screen="creator">
      <div class="hf-brand"><strong>HIGHFLY</strong><span>NEXUS · CREAR CAZADOR</span></div>
      <div class="hf-creator">
        <section class="hf-creator-left">
          <label class="hf-field"><span>NOMBRE DEL CAZADOR</span><input id="hf-hunter-name" maxlength="20" autocomplete="off" placeholder="NOMBRE DEL CAZADOR"></label>
          <div class="hf-section-label">CLASE</div>
          <div id="hf-class-grid" class="hf-class-grid"></div>
          <label class="hf-field"><span>SUBCLASE</span><select id="hf-subclass"></select></label>
          <div id="hf-class-info" class="hf-class-info"></div>
          <button id="hf-enter" class="hf-enter" type="button">ENTRAR A HIGHFLY</button>
        </section>
        <section class="hf-creator-right">
          <div id="hf-preview-host"><canvas id="hf-preview-canvas"></canvas><div id="hf-preview-status" class="hf-preview-status">Cargando modelo 3D…</div></div>
          <div id="hf-preview-meta" class="hf-preview-meta"></div>
        </section>
      </div>
    </div>`;

  const nameInput = nativeRoot.querySelector<HTMLInputElement>('#hf-hunter-name')!;
  const classGrid = nativeRoot.querySelector<HTMLElement>('#hf-class-grid')!;
  const subclass = nativeRoot.querySelector<HTMLSelectElement>('#hf-subclass')!;
  const classInfo = nativeRoot.querySelector<HTMLElement>('#hf-class-info')!;
  const meta = nativeRoot.querySelector<HTMLElement>('#hf-preview-meta')!;
  const enter = nativeRoot.querySelector<HTMLButtonElement>('#hf-enter')!;
  nameInput.value = seed.hunterName;

  for (const id of CLASS_ORDER) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hf-class-btn';
    button.dataset.classId = id;
    button.textContent = CLASS_META[id].label;
    classGrid.appendChild(button);
  }

  const previewHost = nativeRoot.querySelector<HTMLElement>('#hf-preview-host')!;
  const previewCanvas = nativeRoot.querySelector<HTMLCanvasElement>('#hf-preview-canvas')!;
  const previewStatus = nativeRoot.querySelector<HTMLElement>('#hf-preview-status')!;
  let preview: CharacterPreview | null = null;

  const rebuildSubclass = () => {
    const remembered = subclass.value as ClassId | '';
    subclass.replaceChildren();
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Sin subclase por ahora';
    subclass.appendChild(empty);
    for (const id of CLASS_ORDER) {
      if (id === selectedClass) continue;
      const option = document.createElement('option');
      option.value = id;
      option.textContent = CLASS_META[id].label;
      subclass.appendChild(option);
    }
    if (remembered && remembered !== selectedClass) subclass.value = remembered;
    else if (seed.subclassId && seed.subclassId !== selectedClass) subclass.value = seed.subclassId;
  };

  const paint = () => {
    const data = CLASS_META[selectedClass];
    for (const button of classGrid.querySelectorAll<HTMLButtonElement>('.hf-class-btn')) {
      button.dataset.active = String(button.dataset.classId === selectedClass);
    }
    classInfo.innerHTML = `<b>${data.label.toUpperCase()}</b> · ${data.role}<br>Arma: ${data.weapon} · Armadura: ${data.armor}`;
    meta.innerHTML = `<strong>${data.label.toUpperCase()}</strong><span>${data.role}</span><small>${data.weapon} · ${data.armor}</small>`;
    rebuildSubclass();
    preview?.setClass(selectedClass);
  };

  classGrid.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('.hf-class-btn');
    if (!button?.dataset.classId) return;
    selectedClass = button.dataset.classId as ClassId;
    paint();
  });

  paint();

  try {
    await charactersReady(3);
    preview = new CharacterPreview(previewHost, previewCanvas, { constrainedMemory: false });
    preview.setClass(selectedClass);
    previewStatus.textContent = 'Arrastrá para girar';
  } catch (error) {
    console.error('[HIGHFLY] creator preview boot failed', error);
    previewStatus.textContent = 'No se pudo cargar la previsualización 3D';
  }

  enter.addEventListener('click', async () => {
    const hunterName = nameInput.value.trim();
    if (!hunterName) {
      nameInput.focus();
      nameInput.setCustomValidity('Ingresá un nombre para tu cazador');
      nameInput.reportValidity();
      return;
    }
    nameInput.setCustomValidity('');
    enter.disabled = true;
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
      await showCreator(profile);
      const info = root().querySelector<HTMLElement>('#hf-class-info');
      if (info) info.textContent = error instanceof Error ? error.message : 'No se pudo entrar al mundo.';
    }
  });
}

async function boot(): Promise<void> {
  document.documentElement.classList.add('highfly-native');
  document.title = 'HIGHFLY';
  showLoading('Inicializando HIGHFLY…');

  // Initialize the upstream offline flow behind the owned HIGHFLY surface. It is
  // an engine adapter only: its creator/product UI remains permanently hidden.
  try {
    await prepareUpstreamOffline();
  } catch (error) {
    console.error('[HIGHFLY] offline engine bootstrap failed', error);
  }

  const profile = readProfile();
  if (profile) {
    try {
      await enterWorld(profile);
      return;
    } catch (error) {
      console.error('[HIGHFLY] saved profile entry failed; returning to creator', error);
    }
  }
  await showCreator(profile);
}

void boot();

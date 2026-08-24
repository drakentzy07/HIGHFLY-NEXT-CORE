import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.6.3] patched ${path}`);
}
function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}
function replaceBetween(source, startNeedle, endNeedle, replacement, label) {
  const start = source.indexOf(startNeedle);
  if (start < 0) throw new Error(`Start anchor not found: ${label}`);
  const end = source.indexOf(endNeedle, start);
  if (end < 0) throw new Error(`End anchor not found: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// ---------------------------------------------------------------------------
// 1) REAL WORKOUT LOGGER
// Replace the temporary score/minutes/checklist surface with an actual session
// logger: exercises, RM, sets, reps, load, rest prescription, live session timer
// and rest timer. The final validator derives quality + stimulus from the logged
// work and still calls the v0.6 authoritative one-session-per-day seam.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/training_ui.ts';
  const content = String.raw`import type { IWorld } from '../world_api';
import type {
  HighflyTrainingApplyResult,
  HighflyTrainingProfile,
  HighflyTrainingSession,
  HighflyTrainingVector,
} from './training';

interface HighflyTrainingWorld extends IWorld {
  readonly highflyTrainingProfile: HighflyTrainingProfile;
  highflyApplyTrainingSession(session: HighflyTrainingSession): HighflyTrainingApplyResult;
}

type ExerciseKind = 'strength' | 'power' | 'hypertrophy' | 'pull' | 'technique' | 'conditioning';

interface ExerciseDef {
  id: string;
  label: string;
  kind: ExerciseKind;
  stimulus: HighflyTrainingVector;
  weighted: boolean;
}

interface ExerciseRow {
  uid: string;
  exerciseId: string;
  rm: number;
  sets: number;
  reps: number;
  kg: number;
  restSec: number;
  done: boolean;
}

interface WorkoutDraft {
  version: 1;
  dayKey: string;
  startedAt: number | null;
  routine: string;
  rows: ExerciseRow[];
}

const EXERCISES: readonly ExerciseDef[] = [
  { id: 'squat', label: 'Sentadilla', kind: 'strength', stimulus: { str: 44, agi: 5, vit: 35, per: 12, int: 4 }, weighted: true },
  { id: 'front_squat', label: 'Sentadilla frontal', kind: 'strength', stimulus: { str: 38, agi: 8, vit: 34, per: 15, int: 5 }, weighted: true },
  { id: 'deadlift', label: 'Peso muerto', kind: 'strength', stimulus: { str: 50, agi: 5, vit: 28, per: 13, int: 4 }, weighted: true },
  { id: 'bench', label: 'Press banca', kind: 'strength', stimulus: { str: 45, agi: 5, vit: 32, per: 13, int: 5 }, weighted: true },
  { id: 'ohp', label: 'Press militar', kind: 'strength', stimulus: { str: 38, agi: 8, vit: 30, per: 18, int: 6 }, weighted: true },
  { id: 'row', label: 'Remo', kind: 'pull', stimulus: { str: 38, agi: 7, vit: 25, per: 25, int: 5 }, weighted: true },
  { id: 'pullup', label: 'Dominadas / Jalón', kind: 'pull', stimulus: { str: 32, agi: 10, vit: 25, per: 28, int: 5 }, weighted: false },
  { id: 'clean', label: 'Hang Power Clean', kind: 'power', stimulus: { str: 28, agi: 44, vit: 8, per: 16, int: 4 }, weighted: true },
  { id: 'push_press', label: 'Push Press', kind: 'power', stimulus: { str: 31, agi: 39, vit: 10, per: 15, int: 5 }, weighted: true },
  { id: 'jump', label: 'Saltos / Pliometría', kind: 'power', stimulus: { str: 15, agi: 50, vit: 15, per: 16, int: 4 }, weighted: false },
  { id: 'accessory', label: 'Accesorio / Hipertrofia', kind: 'hypertrophy', stimulus: { str: 27, agi: 8, vit: 46, per: 14, int: 5 }, weighted: true },
  { id: 'technique', label: 'Técnica / Control', kind: 'technique', stimulus: { str: 8, agi: 28, vit: 10, per: 38, int: 16 }, weighted: false },
  { id: 'conditioning', label: 'Cardio / Acondicionamiento', kind: 'conditioning', stimulus: { str: 4, agi: 39, vit: 38, per: 14, int: 5 }, weighted: false },
];

const ROUTINES: Readonly<Record<string, readonly string[]>> = {
  'HIGHFLY HÍBRIDO': ['clean', 'squat', 'bench', 'row', 'accessory'],
  'FUERZA': ['squat', 'deadlift', 'bench', 'ohp', 'row'],
  'POTENCIA': ['clean', 'push_press', 'jump', 'front_squat', 'technique'],
  'HIPERTROFIA': ['squat', 'bench', 'row', 'accessory', 'pullup'],
  'ATLETA': ['clean', 'jump', 'row', 'conditioning', 'technique'],
};

function dayKeyLocal(): string {
  const d = new Date();
  return String(d.getFullYear()) + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function uid(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function exercise(id: string): ExerciseDef {
  return EXERCISES.find((item) => item.id === id) ?? EXERCISES[0];
}

function defaultRow(exerciseId: string): ExerciseRow {
  const def = exercise(exerciseId);
  return {
    uid: uid(),
    exerciseId,
    rm: def.weighted ? 60 : 0,
    sets: 3,
    reps: def.kind === 'power' ? 5 : def.kind === 'strength' ? 6 : 10,
    kg: def.weighted ? 40 : 0,
    restSec: def.kind === 'strength' ? 180 : def.kind === 'power' ? 120 : 90,
    done: false,
  };
}

function draftForRoutine(name: string): WorkoutDraft {
  return {
    version: 1,
    dayKey: dayKeyLocal(),
    startedAt: null,
    routine: name,
    rows: (ROUTINES[name] ?? ROUTINES['HIGHFLY HÍBRIDO']).map(defaultRow),
  };
}

function storageKey(world: HighflyTrainingWorld): string {
  const player = world.player as typeof world.player & { name?: string };
  return 'highfly.workout.v063.' + String(player.name ?? player.id ?? 'hunter');
}

function loadDraft(world: HighflyTrainingWorld): WorkoutDraft {
  try {
    const raw = localStorage.getItem(storageKey(world));
    if (raw) {
      const parsed = JSON.parse(raw) as WorkoutDraft;
      if (parsed.version === 1 && parsed.dayKey === dayKeyLocal() && Array.isArray(parsed.rows)) return parsed;
    }
  } catch { /* fresh draft */ }
  return draftForRoutine('HIGHFLY HÍBRIDO');
}

function saveDraft(world: HighflyTrainingWorld, draft: WorkoutDraft): void {
  try { localStorage.setItem(storageKey(world), JSON.stringify(draft)); } catch { /* session still works */ }
}

function formatClock(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}

function n(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(digits).replace(/\.0$/, '');
}

function hunterPower(world: HighflyTrainingWorld): number {
  const p = world.player;
  const offense = Math.max(p.attackPower ?? 0, p.rangedPower ?? 0, p.spellPower ?? 0);
  const defense = (p.maxHp ?? 0) * 0.32 + (p.stats?.armor ?? 0) * 0.06;
  const precision = (p.hitRating ?? 0) * 1.35 + (p.critRating ?? 0) * 0.8;
  return Math.max(1, Math.round((p.level ?? 1) * 24 + offense * 3.8 + defense + precision));
}

function rejectMessage(result: HighflyTrainingApplyResult): string {
  if (result.ok) return '';
  switch (result.reason) {
    case 'already_trained_today_or_older_day': return 'Ya validaste el entrenamiento de hoy.';
    case 'session_too_short': return 'La sesión real debe durar al menos 25 minutos.';
    case 'recovery_not_met': return 'Faltan series válidas o descansos mínimos en el registro.';
    case 'empty_stimulus': return 'No hay trabajo completado suficiente para generar estímulo.';
    default: return 'La sesión todavía no cumple las reglas de validación.';
  }
}

function compileSession(draft: WorkoutDraft): HighflyTrainingSession | null {
  if (!draft.startedAt) return null;
  const done = draft.rows.filter((row) => row.done && row.sets > 0 && row.reps > 0);
  if (!done.length) return null;
  const stimulus: HighflyTrainingVector = { str: 0, agi: 0, vit: 0, per: 0, int: 0 };
  let totalSets = 0;
  let totalReps = 0;
  let intensitySum = 0;
  let intensityCount = 0;

  for (const row of done) {
    const def = exercise(row.exerciseId);
    const intensity = def.weighted && row.rm > 0 ? Math.max(0.2, Math.min(1.2, row.kg / row.rm)) : 0.62;
    const workWeight = Math.max(1, row.sets) * Math.max(1, row.reps) * (0.55 + intensity);
    totalSets += row.sets;
    totalReps += row.sets * row.reps;
    intensitySum += intensity;
    intensityCount += 1;
    stimulus.str += def.stimulus.str * workWeight;
    stimulus.agi += def.stimulus.agi * workWeight;
    stimulus.vit += def.stimulus.vit * workWeight;
    stimulus.per += def.stimulus.per * workWeight;
    stimulus.int += def.stimulus.int * workWeight;
  }

  const durationMinutes = Math.max(0, (Date.now() - draft.startedAt) / 60000);
  const avgIntensity = intensityCount ? intensitySum / intensityCount : 0;
  const score = Math.min(120, Math.max(1, totalSets * 5.4 + totalReps * 0.11 + avgIntensity * 28));
  const recoveryOk = totalSets >= 6 && done.length >= 2 && done.every((row) => row.restSec >= 45);
  return {
    dayKey: draft.dayKey,
    score,
    durationMinutes,
    recoveryOk,
    stimulus,
    purity: 0.2,
  };
}

export function installHighflyTrainingUi(worldInput: IWorld): void {
  if (!('highflyApplyTrainingSession' in (worldInput as object))) return;
  if (document.getElementById('highfly-training-shell')) return;
  const world = worldInput as HighflyTrainingWorld;
  let draft = loadDraft(world);
  let restEndsAt = 0;
  let ticker = 0;

  const shell = document.createElement('div');
  shell.id = 'highfly-training-shell';
  shell.hidden = true;
  shell.innerHTML =
    '<section id="highfly-training-panel" role="dialog" aria-modal="true" aria-label="Entrenamiento HIGHFLY">' +
      '<header><div><b>ENTRENAMIENTO</b><small>POTENCIAL REAL DEL CAZADOR</small></div>' +
      '<div class="hf-training-timers"><span data-hf-session-clock>00:00</span><span data-hf-rest-clock>DESCANSO —</span></div>' +
      '<button type="button" data-hf-close aria-label="Cerrar">×</button></header>' +
      '<div class="hf-training-body">' +
        '<div class="hf-training-summary" data-hf-summary></div>' +
        '<div class="hf-training-toolbar">' +
          '<label>RUTINA<select data-hf-routine></select></label>' +
          '<button type="button" data-hf-start>INICIAR SESIÓN</button>' +
          '<button type="button" data-hf-add>+ EJERCICIO</button>' +
        '</div>' +
        '<div class="hf-training-columns"><span>EJERCICIO</span><span>1RM</span><span>SERIES</span><span>REPES</span><span>KG</span><span>DESC.</span><span>OK</span></div>' +
        '<div class="hf-training-exercises" data-hf-rows></div>' +
        '<div class="hf-training-footer">' +
          '<div data-hf-combat class="hf-training-combat"></div>' +
          '<output data-hf-result></output>' +
          '<button type="button" data-hf-submit>VALIDAR SESIÓN REAL DE HOY</button>' +
        '</div>' +
      '</div>' +
    '</section>';
  document.body.appendChild(shell);

  const q = <T extends HTMLElement>(selector: string): T => shell.querySelector(selector) as T;
  const rowsEl = q<HTMLElement>('[data-hf-rows]');
  const routineEl = q<HTMLSelectElement>('[data-hf-routine]');
  const resultEl = q<HTMLOutputElement>('[data-hf-result]');
  const submitEl = q<HTMLButtonElement>('[data-hf-submit]');
  const startEl = q<HTMLButtonElement>('[data-hf-start]');

  routineEl.innerHTML = Object.keys(ROUTINES).map((name) => '<option value="' + name + '">' + name + '</option>').join('');
  routineEl.value = draft.routine;

  const options = (): string => EXERCISES.map((item) => '<option value="' + item.id + '">' + item.label + '</option>').join('');

  const persist = (): void => saveDraft(world, draft);

  const renderSummary = (): void => {
    const profile = world.highflyTrainingProfile;
    const effective = profile.trainingXp;
    q<HTMLElement>('[data-hf-summary]').innerHTML =
      '<div><span>PODER</span><b>' + hunterPower(world) + '</b></div>' +
      '<div><span>TRAINING XP</span><b>' + n(effective, 0) + '</b></div>' +
      '<div><span>SESIONES</span><b>' + profile.validatedSessions + '</b></div>' +
      '<div><span>HOY</span><b>' + (profile.lastTrainingDay === dayKeyLocal() ? 'VALIDADO' : 'PENDIENTE') + '</b></div>';
    const p = world.player;
    q<HTMLElement>('[data-hf-combat]').innerHTML =
      '<span>HP <b>' + Math.round(p.maxHp ?? 0) + '</b></span>' +
      '<span>AP <b>' + Math.round(p.attackPower ?? 0) + '</b></span>' +
      '<span>RP <b>' + Math.round(p.rangedPower ?? 0) + '</b></span>' +
      '<span>SP <b>' + Math.round(p.spellPower ?? 0) + '</b></span>' +
      '<span>HIT <b>' + n(p.hitRating ?? 0) + '</b></span>' +
      '<span>CRIT <b>' + n(p.critRating ?? 0) + '</b></span>';
    submitEl.disabled = profile.lastTrainingDay === dayKeyLocal();
  };

  const renderRows = (): void => {
    rowsEl.innerHTML = '';
    for (const row of draft.rows) {
      const card = document.createElement('div');
      card.className = 'hf-exercise-row' + (row.done ? ' is-done' : '');
      card.dataset.uid = row.uid;
      card.innerHTML =
        '<select data-field="exercise">' + options() + '</select>' +
        '<input data-field="rm" type="number" min="0" step="2.5" inputmode="decimal" value="' + row.rm + '">' +
        '<input data-field="sets" type="number" min="1" max="20" step="1" inputmode="numeric" value="' + row.sets + '">' +
        '<input data-field="reps" type="number" min="1" max="100" step="1" inputmode="numeric" value="' + row.reps + '">' +
        '<input data-field="kg" type="number" min="0" step="2.5" inputmode="decimal" value="' + row.kg + '">' +
        '<button type="button" class="hf-rest-btn" data-rest>' + row.restSec + 's</button>' +
        '<label class="hf-done"><input data-field="done" type="checkbox"' + (row.done ? ' checked' : '') + '><span>✓</span></label>' +
        '<button type="button" class="hf-remove" data-remove aria-label="Quitar ejercicio">×</button>';
      const select = card.querySelector<HTMLSelectElement>('[data-field="exercise"]');
      if (select) select.value = row.exerciseId;
      rowsEl.appendChild(card);
    }
  };

  const syncRow = (target: Element): void => {
    const card = target.closest<HTMLElement>('.hf-exercise-row');
    if (!card) return;
    const row = draft.rows.find((item) => item.uid === card.dataset.uid);
    if (!row) return;
    const field = (target as HTMLElement).dataset.field;
    if (field === 'exercise') row.exerciseId = (target as HTMLSelectElement).value;
    else if (field === 'done') row.done = (target as HTMLInputElement).checked;
    else if (field && field in row) (row as unknown as Record<string, number>)[field] = Number((target as HTMLInputElement).value) || 0;
    card.classList.toggle('is-done', row.done);
    persist();
  };

  rowsEl.addEventListener('input', (event) => syncRow(event.target as Element));
  rowsEl.addEventListener('change', (event) => syncRow(event.target as Element));
  rowsEl.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const card = target.closest<HTMLElement>('.hf-exercise-row');
    const row = draft.rows.find((item) => item.uid === card?.dataset.uid);
    if (!row) return;
    if (target.closest('[data-rest]')) {
      restEndsAt = Date.now() + Math.max(45, row.restSec) * 1000;
      return;
    }
    if (target.closest('[data-remove]')) {
      draft.rows = draft.rows.filter((item) => item.uid !== row.uid);
      persist();
      renderRows();
    }
  });

  q<HTMLButtonElement>('[data-hf-add]').addEventListener('click', () => {
    draft.rows.push(defaultRow('accessory'));
    persist();
    renderRows();
  });

  routineEl.addEventListener('change', () => {
    if (draft.startedAt && !confirm('Cambiar la rutina reinicia el registro de hoy. ¿Continuar?')) {
      routineEl.value = draft.routine;
      return;
    }
    draft = draftForRoutine(routineEl.value);
    persist();
    renderRows();
    renderSummary();
  });

  startEl.addEventListener('click', () => {
    if (!draft.startedAt) draft.startedAt = Date.now();
    persist();
    startEl.textContent = 'SESIÓN EN CURSO';
    startEl.disabled = true;
  });

  const tick = (): void => {
    const elapsed = draft.startedAt ? (Date.now() - draft.startedAt) / 1000 : 0;
    q<HTMLElement>('[data-hf-session-clock]').textContent = 'SESIÓN ' + formatClock(elapsed);
    const rest = Math.max(0, (restEndsAt - Date.now()) / 1000);
    q<HTMLElement>('[data-hf-rest-clock]').textContent = rest > 0 ? 'DESCANSO ' + formatClock(rest) : 'DESCANSO —';
  };

  const open = (): void => {
    shell.hidden = false;
    renderSummary();
    renderRows();
    startEl.textContent = draft.startedAt ? 'SESIÓN EN CURSO' : 'INICIAR SESIÓN';
    startEl.disabled = !!draft.startedAt;
    tick();
    if (!ticker) ticker = window.setInterval(tick, 250);
  };
  const close = (): void => {
    shell.hidden = true;
    if (ticker) window.clearInterval(ticker);
    ticker = 0;
  };

  q<HTMLButtonElement>('[data-hf-close]').addEventListener('click', close);
  shell.addEventListener('pointerdown', (event) => { if (event.target === shell) close(); });

  submitEl.addEventListener('click', () => {
    const session = compileSession(draft);
    if (!session) {
      resultEl.dataset.kind = 'error';
      resultEl.textContent = 'Iniciá la sesión y marcá ejercicios realmente completados.';
      return;
    }
    const before = hunterPower(world);
    const applied = world.highflyApplyTrainingSession(session);
    if (!applied.ok) {
      resultEl.dataset.kind = 'error';
      resultEl.textContent = rejectMessage(applied);
      renderSummary();
      return;
    }
    const after = hunterPower(world);
    resultEl.dataset.kind = 'ok';
    resultEl.textContent = '+' + Math.round(applied.gainedXp) + ' Training XP · Poder ' + before + ' → ' + after;
    renderSummary();
  });

  // HIGHFLY owns the Discord slot on native/offline. Capture-phase prevents the
  // original Discord click handlers from opening their panel underneath Training.
  const ownHudButton = (button: HTMLButtonElement | null, label: string): void => {
    if (!button) return;
    button.hidden = false;
    button.removeAttribute('data-i18n-title');
    button.removeAttribute('data-i18n-aria');
    button.removeAttribute('data-icon');
    button.title = 'Entrenamiento HIGHFLY';
    button.setAttribute('aria-label', 'Entrenamiento HIGHFLY');
    button.dataset.highflyTraining = '1';
    const mobileLabel = button.querySelector<HTMLElement>('.mobile-label');
    if (mobileLabel) {
      mobileLabel.removeAttribute('data-i18n');
      mobileLabel.textContent = 'Entreno';
    } else {
      button.innerHTML = '<span class="hf-training-hud-glyph">HF</span>';
    }
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      open();
    }, true);
    const observer = new MutationObserver(() => { if (button.hidden) button.hidden = false; });
    observer.observe(button, { attributes: true, attributeFilter: ['hidden'] });
  };

  ownHudButton(document.getElementById('mm-discord') as HTMLButtonElement | null, 'HF');
  ownHudButton(document.getElementById('mobile-discord') as HTMLButtonElement | null, 'Entreno');

  const discordWindow = document.getElementById('discord-window');
  const discordCta = document.getElementById('discord-cta-banner');
  if (discordWindow) discordWindow.hidden = true;
  if (discordCta) discordCta.hidden = true;

  // Fallback only if a stripped HUD variant has neither Discord entry.
  if (!document.querySelector('[data-highfly-training="1"]')) {
    const fallback = document.createElement('button');
    fallback.id = 'highfly-training-launcher';
    fallback.type = 'button';
    fallback.textContent = 'ENTRENO';
    fallback.addEventListener('click', open);
    document.body.appendChild(fallback);
  }

  renderSummary();
  renderRows();
}
`;
  write(path, content);
}

// ---------------------------------------------------------------------------
// 2) MOBILE-LEGENDS-STYLE WORLD TELEGRAPH
// The button remains the thumb joystick. The visible telegraph is a world-space
// cyan floor decal from the player: line/dash/cone/circle + max-range ring.
// ---------------------------------------------------------------------------
{
  const path = 'src/render/highfly_directional_aim_visual.ts';
  const content = String.raw`import * as THREE from 'three';

export type HighflyAimGuideKind = 'skill' | 'dash';
export type HighflyAimGuideShape = 'line' | 'dash' | 'cone' | 'circle';

export interface HighflyAimGuideState {
  x: number;
  z: number;
  facing: number;
  range: number;
  width: number;
  kind: HighflyAimGuideKind;
  assisted: boolean;
  shape?: HighflyAimGuideShape;
  radius?: number;
  angleDeg?: number;
  distance?: number;
}

const LIFT = 0.085;
const CYAN = 0x45ddff;
const VALID = 0x79ffaf;

export class HighflyDirectionalAimVisual {
  readonly group = new THREE.Group();
  private readonly fillGeometry = new THREE.BufferGeometry();
  private readonly fillMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.18, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  private readonly fill = new THREE.Mesh(this.fillGeometry, this.fillMaterial);
  private readonly outlineGeometry = new THREE.BufferGeometry();
  private readonly outlineMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.92, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending });
  private readonly outline = new THREE.LineLoop(this.outlineGeometry, this.outlineMaterial);
  private readonly spineGeometry = new THREE.BufferGeometry();
  private readonly spineMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.88, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending });
  private readonly spine = new THREE.Line(this.spineGeometry, this.spineMaterial);
  private readonly rangeMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.24, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  private readonly rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 72), this.rangeMaterial);
  private elapsed = 0;
  private assisted = false;
  private disposed = false;

  constructor(private readonly scene: THREE.Scene, private readonly heightAt: (x: number, z: number) => number, private readonly colorBoost = 1) {
    this.group.name = 'highfly-directional-aim';
    this.group.visible = false;
    this.rangeRing.geometry.rotateX(-Math.PI / 2);
    for (const object of [this.fill, this.outline, this.spine, this.rangeRing]) {
      object.frustumCulled = false;
      object.renderOrder = 5;
      this.group.add(object);
    }
    this.scene.add(this.group);
  }

  setAim(aim: HighflyAimGuideState | null): void {
    if (this.disposed) return;
    if (!aim) { this.group.visible = false; return; }
    this.assisted = aim.assisted;
    const color = aim.assisted ? VALID : CYAN;
    for (const material of [this.fillMaterial, this.outlineMaterial, this.spineMaterial, this.rangeMaterial]) {
      material.color.setHex(color);
      material.color.multiplyScalar(this.colorBoost);
    }
    this.rebuild(aim);
    this.group.visible = true;
  }

  update(dt: number): void {
    if (!this.group.visible || this.disposed) return;
    this.elapsed += Math.max(0, dt);
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * Math.PI * 3.2);
    this.fillMaterial.opacity = (this.assisted ? 0.25 : 0.16) + pulse * 0.06;
    this.outlineMaterial.opacity = 0.78 + pulse * 0.2;
    this.spineMaterial.opacity = 0.65 + pulse * 0.24;
    this.rangeMaterial.opacity = 0.14 + pulse * 0.08;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.group);
    this.fillGeometry.dispose();
    this.outlineGeometry.dispose();
    this.spineGeometry.dispose();
    this.rangeRing.geometry.dispose();
    this.fillMaterial.dispose();
    this.outlineMaterial.dispose();
    this.spineMaterial.dispose();
    this.rangeMaterial.dispose();
  }

  private rebuild(aim: HighflyAimGuideState): void {
    const shape: HighflyAimGuideShape = aim.shape ?? (aim.kind === 'dash' ? 'dash' : 'line');
    const range = Math.max(1.5, aim.range);
    const width = Math.max(0.65, aim.width || 1.7);
    const distance = Math.max(0.8, Math.min(range, aim.distance ?? range));
    const dirX = Math.sin(aim.facing);
    const dirZ = Math.cos(aim.facing);
    const rightX = Math.cos(aim.facing);
    const rightZ = -Math.sin(aim.facing);
    const points: THREE.Vector2[] = [];

    if (shape === 'circle') {
      const radius = Math.max(1.4, aim.radius ?? 3.5);
      const cx = dirX * distance;
      const cz = dirZ * distance;
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        points.push(new THREE.Vector2(cx + Math.sin(a) * radius, cz + Math.cos(a) * radius));
      }
    } else if (shape === 'cone') {
      const half = ((aim.angleDeg ?? 64) * Math.PI) / 360;
      points.push(new THREE.Vector2(0, 0));
      for (let i = 0; i <= 30; i++) {
        const a = -half + (i / 30) * half * 2;
        points.push(new THREE.Vector2(Math.sin(a) * range, Math.cos(a) * range));
      }
    } else {
      const half = width * 0.5;
      const start = 0.22;
      const arrowStart = Math.max(start + 0.6, range * (shape === 'dash' ? 0.68 : 0.77));
      const arrowHalf = half * (shape === 'dash' ? 2.2 : 1.8);
      points.push(new THREE.Vector2(-half, start));
      points.push(new THREE.Vector2(-half, arrowStart));
      points.push(new THREE.Vector2(-arrowHalf, arrowStart));
      points.push(new THREE.Vector2(0, range));
      points.push(new THREE.Vector2(arrowHalf, arrowStart));
      points.push(new THREE.Vector2(half, arrowStart));
      points.push(new THREE.Vector2(half, start));
    }

    const triangles = THREE.ShapeUtils.triangulateShape(points, []);
    const positions = new Float32Array(triangles.length * 9);
    let p = 0;
    for (const tri of triangles) {
      for (const idx of tri) {
        const local = points[idx];
        const wx = aim.x + rightX * local.x + dirX * local.y;
        const wz = aim.z + rightZ * local.x + dirZ * local.y;
        positions[p++] = wx;
        positions[p++] = this.heightAt(wx, wz) + LIFT;
        positions[p++] = wz;
      }
    }
    this.fillGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.fillGeometry.computeBoundingSphere();

    const outline = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      const local = points[i];
      const wx = aim.x + rightX * local.x + dirX * local.y;
      const wz = aim.z + rightZ * local.x + dirZ * local.y;
      outline[i * 3] = wx;
      outline[i * 3 + 1] = this.heightAt(wx, wz) + LIFT + 0.025;
      outline[i * 3 + 2] = wz;
    }
    this.outlineGeometry.setAttribute('position', new THREE.BufferAttribute(outline, 3));
    this.outlineGeometry.computeBoundingSphere();

    const spineEnd = shape === 'circle' ? distance : range;
    const spine = new Float32Array(6);
    spine[0] = aim.x;
    spine[1] = this.heightAt(aim.x, aim.z) + LIFT + 0.035;
    spine[2] = aim.z;
    const sx = aim.x + dirX * spineEnd;
    const sz = aim.z + dirZ * spineEnd;
    spine[3] = sx;
    spine[4] = this.heightAt(sx, sz) + LIFT + 0.035;
    spine[5] = sz;
    this.spineGeometry.setAttribute('position', new THREE.BufferAttribute(spine, 3));
    this.spineGeometry.computeBoundingSphere();

    this.rangeRing.position.set(aim.x, this.heightAt(aim.x, aim.z) + LIFT * 0.65, aim.z);
    this.rangeRing.scale.setScalar(range);
  }
}
`;
  write(path, content);
}

// ---------------------------------------------------------------------------
// 3) HUD AIM OWNERSHIP
// Broaden manual aim to real offensive mage/ranged skills, show the telegraph as
// soon as the skill is held (before the thumb moves), and feed the world renderer
// instead of relying on a screen-space HTML bar.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);

  const guideField = /  private highflyDirectionalGuideState:\s*\{[\s\S]*?\}\s*\| null = null;/;
  if (!guideField.test(source)) throw new Error('Anchor not found: extended directional guide field');
  source = source.replace(guideField, `  private highflyDirectionalGuideState: {\n    x: number;\n    z: number;\n    facing: number;\n    range: number;\n    width: number;\n    kind: 'skill' | 'dash';\n    assisted: boolean;\n    shape?: 'line' | 'dash' | 'cone' | 'circle';\n    radius?: number;\n    angleDeg?: number;\n    distance?: number;\n  } | null = null;`);

  const mobileDefStart = '  private highflyMobileAimDef(';
  const mobileDefEnd = '\n  private highflyAimProfile(';
  const mobileDef = `  private highflyMobileAimDef(barSlot: number): ResolvedAbility | null {\n    const resolved = this.abilityForSlot(barSlot);\n    if (!resolved) return null;\n    const def = resolved.def;\n    if (def.selfCentered || def.targetType === 'friendly' || def.targetsDead) return null;\n    if (def.targetMode === 'position') return resolved;\n    const effects = (resolved.effects ?? []) as unknown as Array<Record<string, unknown>>;\n    const offensive = effects.some((effect) => {\n      const type = String(effect.type ?? '').toLowerCase();\n      return /damage|weapon|dot|bleed|ignite|charge|reposition|knockback|execute|projectile/.test(type);\n    });\n    if (def.requiresTarget || offensive || (def.range ?? 0) >= 4) return resolved;\n    return null;\n  }\n`;
  source = replaceBetween(source, mobileDefStart, mobileDefEnd, mobileDef, 'broaden mobile aim abilities');

  const paintStart = '  private highflyPaintSkillStick(';
  const paintEnd = '\n  private highflyHideSkillStick(): void {';
  const paintMethod = `  private highflyPaintSkillStick(\n    barSlot: number,\n    screenDx: number,\n    screenDy: number,\n    hasTarget: boolean,\n  ): void {\n    const profile = this.highflyAimProfile(barSlot);\n    const facing = this.highflyScreenAimFacing(screenDx, screenDy);\n    const rawLength = Math.hypot(screenDx, screenDy);\n    const dragPct = Math.max(0.18, Math.min(1, rawLength / 112));\n    this.highflyDirectionalGuideState = {\n      x: this.sim.player.pos.x,\n      z: this.sim.player.pos.z,\n      facing,\n      range: profile.range,\n      width: profile.shape === 'dash' ? Math.max(1.6, profile.width) : Math.max(1.15, profile.width),\n      kind: profile.shape === 'dash' ? 'dash' : 'skill',\n      assisted: hasTarget,\n      shape: profile.shape,\n      radius: profile.radius,\n      angleDeg: profile.angleDeg,\n      distance: profile.shape === 'circle' ? profile.range * dragPct : profile.range,\n    };\n    this.highflySkillStick?.classList.remove('active', 'has-target');\n  }\n`;
  source = replaceBetween(source, paintStart, paintEnd, paintMethod, 'world-space MOBA paint');

  source = replaceRequired(
    source,
    `  private highflyHideSkillStick(): void {\n    this.highflySkillStick?.classList.remove('active', 'has-target');\n  }`,
    `  private highflyHideSkillStick(): void {\n    this.highflySkillStick?.classList.remove('active', 'has-target');\n    if (this.highflyDirectionalGuideState?.kind === 'skill') this.highflyDirectionalGuideState = null;\n  }`,
    'clear world skill telegraph',
  );

  source = replaceRequired(
    source,
    `        manual = false;\n        this.highflyCancelSkillAim();\n        try { button.setPointerCapture(event.pointerId); } catch { /* optional */ }`,
    `        manual = false;\n        this.highflyCancelSkillAim();\n        const previewFacing = this.highflyScreenAimFacing(0, -48);\n        const previewTarget = this.highflyPickDirectionalTarget(slot, previewFacing);\n        this.highflyPaintSkillStick(slot, 0, -48, previewTarget !== null);\n        try { button.setPointerCapture(event.pointerId); } catch { /* optional */ }`,
    'show telegraph on hold',
  );
  source = source.replace('Math.hypot(dx, dy) < 12', 'Math.hypot(dx, dy) < 6');
  source = source.replace('dragLength >= 12', 'dragLength >= 6');

  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) S23 / PHONE LANDSCAPE LAYOUT + HUD TRAINING SLOT
// Target the real ~915x412 CSS-pixel class of modern phones instead of scaling a
// desktop creator. More left workspace, smaller right preview, larger details,
// larger colour swatches and internal scrolling only.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += String.raw`

/* HIGHFLY v0.6.3 — phone-landscape creator + Training HUD ownership. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select.highfly-native-creator {
    width: calc(100vw - 8px) !important;
    max-width: calc(100vw - 8px) !important;
    height: calc(100dvh - 6px) !important;
    max-height: calc(100dvh - 6px) !important;
    margin: 3px auto !important;
    padding: 3px 6px 4px !important;
  }
  body.native-app #offline-select.highfly-native-creator > .auth-title {
    height: 22px !important;
    min-height: 22px !important;
    line-height: 22px !important;
    margin: 0 0 2px !important;
    font-size: clamp(15px, 4.6vh, 21px) !important;
  }
  body.native-app #offline-select.highfly-native-creator .charselect-layout {
    grid-template-columns: minmax(0, 70%) minmax(0, 30%) !important;
    gap: 7px !important;
    height: calc(100% - 24px) !important;
  }
  body.native-app #offline-select.highfly-native-creator .charselect-col-right {
    grid-template-rows: minmax(112px, 34%) minmax(0, 66%) !important;
    gap: 5px !important;
  }
  body.native-app #offline-select.highfly-native-creator .char-create {
    display: flex !important;
    flex-direction: column !important;
    gap: 3px !important;
    height: 100% !important;
    padding-bottom: 31px !important;
  }
  body.native-app #offline-select.highfly-native-creator #offline-appearance {
    flex: 1 1 auto !important;
    min-height: 0 !important;
  }
  body.native-app #offline-select.highfly-native-creator #offline-appearance .ac-page.active {
    height: 100% !important;
    max-height: 100% !important;
    padding-bottom: 4px !important;
    scrollbar-width: auto !important;
  }
  body.native-app #offline-select.highfly-native-creator #offline-appearance .ac-page.active::-webkit-scrollbar,
  body.native-app #offline-select.highfly-native-creator #offline-class-details::-webkit-scrollbar {
    width: 8px !important;
    height: 8px !important;
  }
  body.native-app #offline-select.highfly-native-creator #offline-appearance .ac-page.active::-webkit-scrollbar-thumb,
  body.native-app #offline-select.highfly-native-creator #offline-class-details::-webkit-scrollbar-thumb {
    background: rgba(205,166,68,.72) !important;
    border-radius: 99px !important;
  }
  body.native-app #offline-select.highfly-native-creator .ac-swatches,
  body.native-app #offline-select.highfly-native-creator .ac-color-swatches,
  body.native-app #offline-select.highfly-native-creator .ac-swatch-row {
    gap: 6px !important;
    min-height: 44px !important;
    padding-bottom: 3px !important;
  }
  body.native-app #offline-select.highfly-native-creator .ac-swatch,
  body.native-app #offline-select.highfly-native-creator .ac-color-swatch {
    width: 38px !important;
    height: 38px !important;
    min-width: 38px !important;
  }
  body.native-app #offline-select.highfly-native-creator #offline-preview-container {
    min-height: 0 !important;
  }
  body.native-app #offline-select.highfly-native-creator #offline-class-details {
    padding: 7px 8px 9px !important;
  }
  body.native-app #offline-class-details .hf-class-title-v062 h3 {
    font-size: clamp(17px, 4.4vh, 23px) !important;
  }
  body.native-app #offline-class-details .hf-class-title-v062 span,
  body.native-app #offline-class-details .hf-class-desc-v062,
  body.native-app #offline-class-details .hf-class-note-v062,
  body.native-app #offline-class-details .hf-class-resource-v062,
  body.native-app #offline-class-details h4 {
    font-size: 8.7px !important;
  }
  body.native-app #offline-class-details .hf-class-stats-v062 span {
    padding: 4px 5px !important;
    font-size: 8px !important;
  }
  body.native-app #offline-select.highfly-native-creator .auth-actions {
    height: 28px !important;
    min-height: 28px !important;
    bottom: 1px !important;
  }
  body.native-app #offline-select.highfly-native-creator #btn-start-offline {
    width: min(260px, 38%) !important;
    height: 27px !important;
    min-height: 27px !important;
    line-height: 25px !important;
  }
}

/* HIGHFLY replaces Discord's native/offline HUD slots with Training. */
body.native-app #discord-window,
body.native-app #discord-cta-banner { display: none !important; }
body.native-app #mm-discord[data-highfly-training="1"],
body.native-app #mobile-discord[data-highfly-training="1"] { display: inline-flex !important; }
body.native-app #mm-discord[data-highfly-training="1"] .hf-training-hud-glyph {
  font: 900 9px/1 sans-serif !important;
  letter-spacing: -.3px !important;
  color: #78e8ff !important;
}

/* Advanced workout logger. */
#highfly-training-panel {
  width: min(1060px, 96vw) !important;
  max-height: 94dvh !important;
}
#highfly-training-panel > header {
  gap: 10px !important;
  padding: 7px 11px !important;
}
#highfly-training-panel > header > div:first-child { display:flex; align-items:baseline; gap:7px; }
#highfly-training-panel > header small { margin:0 !important; }
.hf-training-timers { margin-left:auto; display:flex; gap:7px; }
.hf-training-timers span { min-width:82px; padding:5px 7px; border:1px solid rgba(80,207,255,.28); border-radius:7px; text-align:center; font:800 9px/1 sans-serif; color:#aeefff; }
.hf-training-body { max-height: calc(94dvh - 42px) !important; padding:8px 10px 10px !important; }
.hf-training-summary { grid-template-columns:repeat(4,minmax(0,1fr)) !important; }
.hf-training-summary > div { padding:5px !important; }
.hf-training-summary strong, .hf-training-summary b { font-size:13px !important; }
.hf-training-toolbar { display:grid; grid-template-columns:minmax(220px,1fr) auto auto; gap:7px; align-items:end; margin-top:7px; }
.hf-training-toolbar label { font:800 8px/1 sans-serif; color:#abb7dc; }
.hf-training-toolbar select { width:100%; margin-top:3px; height:30px; border:1px solid rgba(84,185,255,.35); border-radius:7px; background:#090d18; color:#fff; padding:0 8px; }
.hf-training-toolbar button { height:30px; padding:0 12px; border:1px solid rgba(78,213,255,.48); border-radius:7px; background:#101a32; color:#fff; font:800 8px/1 sans-serif; }
.hf-training-columns, .hf-exercise-row { display:grid; grid-template-columns:minmax(180px,2.2fr) .7fr .62fr .62fr .7fr .72fr .48fr 24px; gap:5px; align-items:center; }
.hf-training-columns { margin-top:7px; padding:0 4px; color:#8291b7; font:800 7.5px/1 sans-serif; }
.hf-training-exercises { display:grid; gap:5px; margin-top:4px; }
.hf-exercise-row { padding:5px; border:1px solid rgba(94,119,190,.22); border-radius:8px; background:rgba(255,255,255,.025); }
.hf-exercise-row.is-done { border-color:rgba(90,237,164,.52); background:rgba(58,170,114,.08); }
.hf-exercise-row select, .hf-exercise-row input { width:100%; min-width:0; height:29px; box-sizing:border-box; border:1px solid rgba(88,120,197,.32); border-radius:6px; background:#080c16; color:#fff; padding:0 6px; font:700 9px/1 sans-serif; }
.hf-rest-btn { height:29px; border:1px solid rgba(83,215,255,.42); border-radius:6px; background:#0d1b2d; color:#bcefff; font:800 8px/1 sans-serif; }
.hf-done { display:grid; place-items:center; height:29px; }
.hf-done input { position:absolute; opacity:0; pointer-events:none; }
.hf-done span { display:grid; place-items:center; width:24px; height:24px; border:1px solid rgba(121,147,214,.4); border-radius:6px; color:transparent; }
.hf-done input:checked + span { color:#82ffb5; border-color:#64e99e; background:rgba(75,220,143,.12); }
.hf-remove { border:0; background:transparent; color:#ff9b9b; font-size:18px; }
.hf-training-footer { display:grid; grid-template-columns:1fr auto; gap:6px 10px; align-items:center; margin-top:7px; }
.hf-training-combat { grid-column:1; display:flex !important; gap:5px; flex-wrap:wrap; margin:0 !important; }
.hf-training-combat span { min-width:62px; padding:5px 7px !important; }
.hf-training-footer output { grid-column:1; min-height:16px; font:800 9px/1.2 sans-serif; }
.hf-training-footer [data-hf-submit] { grid-column:2; grid-row:1 / span 2; min-width:210px; height:42px; border:1px solid #55d8ff; border-radius:8px; background:linear-gradient(90deg,#17285c,#4a317c); color:#fff; font:900 9px/1 sans-serif; }
.hf-training-footer [data-hf-submit]:disabled { opacity:.45; }
.hf-training-footer output[data-kind=ok] { color:#7af0a5; }
.hf-training-footer output[data-kind=error] { color:#ff9696; }

/* The old screen-space stick is deliberately disabled: the renderer now owns the floor telegraph. */
body.native-app.mobile-touch #highfly-skill-stick { display:none !important; }
`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// 5) CONTRACT TEST
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v063_mobile_polish.test.ts';
  const content = String.raw`import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('HIGHFLY v0.6.3 mobile polish contracts', () => {
  it('uses the Discord HUD slot for Training and removes manual score/minutes', () => {
    const ui = fs.readFileSync('src/highfly/training_ui.ts', 'utf8');
    expect(ui).toContain("document.getElementById('mm-discord')");
    expect(ui).toContain("document.getElementById('mobile-discord')");
    expect(ui).toContain('1RM');
    expect(ui).toContain('SERIES');
    expect(ui).toContain('REPES');
    expect(ui).toContain('restEndsAt');
    expect(ui).not.toContain('data-hf-score');
    expect(ui).not.toContain('data-hf-duration');
  });

  it('renders player-origin line/dash/cone/circle world telegraphs', () => {
    const visual = fs.readFileSync('src/render/highfly_directional_aim_visual.ts', 'utf8');
    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
    expect(visual).toContain("'line' | 'dash' | 'cone' | 'circle'");
    expect(visual).toContain('rangeRing');
    expect(hud).toContain('show telegraph');
    expect(hud).toContain("shape: profile.shape");
  });

  it('targets phone-landscape creator geometry rather than desktop scaling', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    expect(css).toContain('(max-height: 520px)');
    expect(css).toContain('70%');
    expect(css).toContain('34%');
    expect(css).toContain('66%');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.6.3] mobile polish applied.');

import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.1] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// HIGHFLY SYSTEM ENGINE
// Facts are immutable inputs; calculations are derived; narrative is an output.
// The System NEVER invents physical stats. STR/AGI/VIT/PER/INT remain owned by
// real validated training. System progression grants missions, knowledge,
// access/unlocks, titles and game rewards instead.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/system_core.ts';
  const content = `export type HighflySystemEventType =
  | 'training.session.validated'
  | 'training.exercise.validated'
  | 'training.pr'
  | 'combat.kill'
  | 'combat.death'
  | 'world.dungeon.clear'
  | 'world.boss.kill'
  | 'progress.level.up'
  | 'progress.rank.up';

export type HighflySystemNoticeKind = 'system' | 'mission' | 'reward' | 'alert' | 'unlock';
export type HighflySystemMissionKind = 'daily' | 'weekly' | 'breakthrough' | 'class' | 'world';
export type HighflyHunterRank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS' | 'NACIONAL';

export interface HighflySystemEvent {
  id: string;
  type: HighflySystemEventType;
  at: string;
  dayKey?: string;
  data?: Record<string, string | number | boolean | null | undefined>;
}

export interface HighflySystemNotice {
  id: string;
  eventId: string;
  kind: HighflySystemNoticeKind;
  title: string;
  body: string;
  at: string;
  priority: 1 | 2 | 3 | 4 | 5;
}

export interface HighflySystemMission {
  id: string;
  kind: HighflySystemMissionKind;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardSystemXp: number;
  rewardUnlock?: string;
  completed: boolean;
  claimed: boolean;
  expiresDayKey?: string;
}

export interface HighflySystemState {
  version: 1;
  systemXp: number;
  hunterRank: HighflyHunterRank;
  processedEventIds: string[];
  notices: HighflySystemNotice[];
  activeMissions: HighflySystemMission[];
  completedMissionIds: string[];
  unlocks: string[];
  titles: string[];
  trainingStreak: number;
  lastTrainingDay: string | null;
  validatedTrainingSessions: number;
  personalRecords: number;
  combatKills: number;
  bossKills: number;
  dungeonClears: number;
  deaths: number;
}

export interface HighflySystemProcessResult {
  state: HighflySystemState;
  notices: HighflySystemNotice[];
  gainedSystemXp: number;
  newUnlocks: string[];
  completedMissions: string[];
  duplicate: boolean;
}

const RANKS: readonly HighflyHunterRank[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'NACIONAL'];
const MAX_PROCESSED = 600;
const MAX_NOTICES = 120;

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dayOrdinal(dayKey: string | null | undefined): number | null {
  if (!dayKey || !/^\\d{4}-\\d{2}-\\d{2}$/.test(dayKey)) return null;
  const [y, m, d] = dayKey.split('-').map(Number);
  const time = Date.UTC(y, m - 1, d);
  return Number.isFinite(time) ? Math.floor(time / 86400000) : null;
}

function nextTrainingStreak(previousDay: string | null, dayKey: string | undefined, current: number): number {
  const before = dayOrdinal(previousDay);
  const now = dayOrdinal(dayKey);
  if (now == null) return Math.max(1, current);
  if (before == null) return 1;
  if (now === before) return current;
  if (now === before + 1) return current + 1;
  return 1;
}

export function createHighflySystemState(): HighflySystemState {
  return {
    version: 1,
    systemXp: 0,
    hunterRank: 'F',
    processedEventIds: [],
    notices: [],
    activeMissions: [],
    completedMissionIds: [],
    unlocks: ['system.status'],
    titles: [],
    trainingStreak: 0,
    lastTrainingDay: null,
    validatedTrainingSessions: 0,
    personalRecords: 0,
    combatKills: 0,
    bossKills: 0,
    dungeonClears: 0,
    deaths: 0,
  };
}

export function normalizeHighflySystemState(value: Partial<HighflySystemState> | null | undefined): HighflySystemState {
  const base = createHighflySystemState();
  if (!value) return base;
  const rank = RANKS.includes(value.hunterRank as HighflyHunterRank) ? value.hunterRank as HighflyHunterRank : 'F';
  return {
    version: 1,
    systemXp: Math.max(0, safeNumber(value.systemXp)),
    hunterRank: rank,
    processedEventIds: Array.isArray(value.processedEventIds) ? value.processedEventIds.filter((x): x is string => typeof x === 'string').slice(-MAX_PROCESSED) : [],
    notices: Array.isArray(value.notices) ? value.notices.slice(-MAX_NOTICES) as HighflySystemNotice[] : [],
    activeMissions: Array.isArray(value.activeMissions) ? value.activeMissions as HighflySystemMission[] : [],
    completedMissionIds: Array.isArray(value.completedMissionIds) ? value.completedMissionIds.filter((x): x is string => typeof x === 'string') : [],
    unlocks: Array.isArray(value.unlocks) ? Array.from(new Set(value.unlocks.filter((x): x is string => typeof x === 'string'))) : [...base.unlocks],
    titles: Array.isArray(value.titles) ? Array.from(new Set(value.titles.filter((x): x is string => typeof x === 'string'))) : [],
    trainingStreak: Math.max(0, Math.floor(safeNumber(value.trainingStreak))),
    lastTrainingDay: typeof value.lastTrainingDay === 'string' ? value.lastTrainingDay : null,
    validatedTrainingSessions: Math.max(0, Math.floor(safeNumber(value.validatedTrainingSessions))),
    personalRecords: Math.max(0, Math.floor(safeNumber(value.personalRecords))),
    combatKills: Math.max(0, Math.floor(safeNumber(value.combatKills))),
    bossKills: Math.max(0, Math.floor(safeNumber(value.bossKills))),
    dungeonClears: Math.max(0, Math.floor(safeNumber(value.dungeonClears))),
    deaths: Math.max(0, Math.floor(safeNumber(value.deaths))),
  };
}

function notice(event: HighflySystemEvent, kind: HighflySystemNoticeKind, title: string, body: string, priority: HighflySystemNotice['priority']): HighflySystemNotice {
  return { id: event.id + ':' + kind + ':' + title, eventId: event.id, kind, title, body, at: event.at, priority };
}

function addUnlock(state: HighflySystemState, key: string, newUnlocks: string[]): void {
  if (!state.unlocks.includes(key)) {
    state.unlocks.push(key);
    newUnlocks.push(key);
  }
}

function updateMissionProgress(state: HighflySystemState, event: HighflySystemEvent, completed: string[]): number {
  let reward = 0;
  for (const mission of state.activeMissions) {
    if (mission.completed) continue;
    let delta = 0;
    if (mission.id === 'daily.training' && event.type === 'training.session.validated') delta = 1;
    if (mission.id === 'weekly.consistency' && event.type === 'training.session.validated') delta = 1;
    if (mission.id === 'world.first-blood' && event.type === 'combat.kill') delta = 1;
    if (mission.id === 'world.first-dungeon' && event.type === 'world.dungeon.clear') delta = 1;
    if (!delta) continue;
    mission.progress = Math.min(mission.target, mission.progress + delta);
    if (mission.progress >= mission.target) {
      mission.completed = true;
      completed.push(mission.id);
      if (!state.completedMissionIds.includes(mission.id)) state.completedMissionIds.push(mission.id);
      reward += mission.rewardSystemXp;
    }
  }
  return reward;
}

export function highflyPersonalImprovementRatio(previousInput: number, nextInput: number): number {
  const previous = Math.max(0, safeNumber(previousInput));
  const next = Math.max(0, safeNumber(nextInput));
  if (next <= 0) return 0;
  if (previous <= 0) return 0;
  return Math.max(0, (next - previous) / previous);
}

export function highflyPrReward(previousInput: number, nextInput: number): number {
  const ratio = highflyPersonalImprovementRatio(previousInput, nextInput);
  if (ratio <= 0) return 0;
  // Personal improvement, not absolute kilograms. +2% at 20kg and +2% at 120kg
  // are treated equally by the System. Cap prevents a bad baseline from farming XP.
  return Math.round(8 + clamp(ratio, 0, 0.25) * 168);
}

export function ensureHighflyStarterMissions(state: HighflySystemState, dayKey?: string): void {
  const has = (id: string) => state.activeMissions.some((m) => m.id === id && !m.claimed);
  if (!has('daily.training')) {
    state.activeMissions.push({
      id: 'daily.training', kind: 'daily', title: 'DEMOSTRÁ TU PROGRESO',
      description: 'Validá una sesión real de entrenamiento.', progress: 0, target: 1,
      rewardSystemXp: 25, completed: false, claimed: false, expiresDayKey: dayKey,
    });
  }
  if (!has('weekly.consistency')) {
    state.activeMissions.push({
      id: 'weekly.consistency', kind: 'weekly', title: 'CONSTANCIA DEL CAZADOR',
      description: 'Validá 3 sesiones reales en días distintos.', progress: 0, target: 3,
      rewardSystemXp: 60, completed: false, claimed: false,
    });
  }
  if (!has('world.first-blood') && !state.completedMissionIds.includes('world.first-blood')) {
    state.activeMissions.push({
      id: 'world.first-blood', kind: 'world', title: 'PRIMERA CACERÍA',
      description: 'Derrotá a un enemigo en el mundo.', progress: 0, target: 1,
      rewardSystemXp: 15, rewardUnlock: 'system.combat-log', completed: false, claimed: false,
    });
  }
}

export function processHighflySystemEvent(stateInput: HighflySystemState, event: HighflySystemEvent): HighflySystemProcessResult {
  const state = normalizeHighflySystemState(stateInput);
  if (!event.id || state.processedEventIds.includes(event.id)) {
    return { state, notices: [], gainedSystemXp: 0, newUnlocks: [], completedMissions: [], duplicate: true };
  }

  ensureHighflyStarterMissions(state, event.dayKey);
  const notices: HighflySystemNotice[] = [];
  const newUnlocks: string[] = [];
  const completedMissions: string[] = [];
  let gainedSystemXp = 0;

  if (event.type === 'training.session.validated') {
    const gainedTrainingXp = Math.max(0, safeNumber(event.data?.gainedTrainingXp));
    const beforePower = Math.max(0, safeNumber(event.data?.beforePower));
    const afterPower = Math.max(0, safeNumber(event.data?.afterPower));
    state.trainingStreak = nextTrainingStreak(state.lastTrainingDay, event.dayKey, state.trainingStreak);
    state.lastTrainingDay = event.dayKey ?? state.lastTrainingDay;
    state.validatedTrainingSessions += 1;
    gainedSystemXp += 12 + Math.min(18, Math.round(gainedTrainingXp / 8));
    notices.push(notice(event, 'system', 'ENTRENAMIENTO VALIDADO',
      'La sesión fue aceptada. Training XP +' + Math.round(gainedTrainingXp) + (afterPower > beforePower ? ' · Poder ' + beforePower + ' → ' + afterPower : ''), 3));
    if (state.trainingStreak === 3) {
      addUnlock(state, 'system.streaks', newUnlocks);
      notices.push(notice(event, 'unlock', 'RACHA DETECTADA', 'Tres días consecutivos. Seguimiento de rachas desbloqueado.', 4));
    }
  }

  if (event.type === 'training.exercise.validated') {
    const kg = safeNumber(event.data?.kg);
    const reps = Math.floor(safeNumber(event.data?.reps));
    if (kg > 0 && reps > 0) {
      notices.push(notice(event, 'system', 'EVIDENCIA REGISTRADA', kg + ' kg × ' + reps + ' fue incorporado al historial validado.', 1));
    }
  }

  if (event.type === 'training.pr') {
    const previous = safeNumber(event.data?.previousE1rm);
    const next = safeNumber(event.data?.nextE1rm);
    const reward = highflyPrReward(previous, next);
    state.personalRecords += 1;
    gainedSystemXp += reward;
    if (previous > 0 && next > previous) {
      const pct = highflyPersonalImprovementRatio(previous, next) * 100;
      notices.push(notice(event, 'reward', 'NUEVO UMBRAL DETECTADO',
        'e1RM ' + previous.toFixed(1) + ' → ' + next.toFixed(1) + ' kg · mejora personal +' + pct.toFixed(1) + '%.', 5));
    } else {
      notices.push(notice(event, 'system', 'REFERENCIA ESTABLECIDA', 'Primera referencia válida de fuerza registrada.', 3));
    }
    if (state.personalRecords === 1) addUnlock(state, 'system.records', newUnlocks);
  }

  if (event.type === 'combat.kill') {
    state.combatKills += 1;
    gainedSystemXp += 2;
  }
  if (event.type === 'combat.death') {
    state.deaths += 1;
    notices.push(notice(event, 'alert', 'CAZADOR DERROTADO', 'Analizá el encuentro, mejorá equipo o estrategia y volvé a intentarlo.', 2));
  }
  if (event.type === 'world.dungeon.clear') {
    state.dungeonClears += 1;
    gainedSystemXp += 25;
    notices.push(notice(event, 'reward', 'MAZMORRA COMPLETADA', 'Registro de conquista actualizado.', 4));
  }
  if (event.type === 'world.boss.kill') {
    state.bossKills += 1;
    gainedSystemXp += 40;
    notices.push(notice(event, 'reward', 'OBJETIVO DE ALTO RIESGO ELIMINADO', 'La amenaza fue registrada como derrotada.', 5));
  }
  if (event.type === 'progress.level.up') {
    const level = Math.max(1, Math.floor(safeNumber(event.data?.level)));
    notices.push(notice(event, 'system', 'NIVEL ' + level, 'Capacidad de combate actualizada.', 3));
  }
  if (event.type === 'progress.rank.up') {
    const nextRank = String(event.data?.rank ?? '') as HighflyHunterRank;
    if (RANKS.includes(nextRank)) state.hunterRank = nextRank;
    notices.push(notice(event, 'unlock', 'RANGO ' + state.hunterRank, 'Nuevas condiciones de acceso pueden estar disponibles.', 5));
  }

  const missionReward = updateMissionProgress(state, event, completedMissions);
  gainedSystemXp += missionReward;
  for (const missionId of completedMissions) {
    const mission = state.activeMissions.find((m) => m.id === missionId);
    if (!mission) continue;
    notices.push(notice(event, 'mission', 'MISIÓN COMPLETADA', mission.title + ' · +' + mission.rewardSystemXp + ' XP de Sistema', 4));
    if (mission.rewardUnlock) addUnlock(state, mission.rewardUnlock, newUnlocks);
  }

  state.systemXp += gainedSystemXp;
  state.processedEventIds.push(event.id);
  state.processedEventIds = state.processedEventIds.slice(-MAX_PROCESSED);
  state.notices.push(...notices);
  state.notices = state.notices.slice(-MAX_NOTICES);

  return { state, notices, gainedSystemXp, newUnlocks, completedMissions, duplicate: false };
}
`;
  write(path, content);
}

// ---------------------------------------------------------------------------
// Runtime bridge: one persistent System per hunter in the first offline layer.
// Later PlayerMeta can absorb the exact same serializable state without changing
// the pure rules above.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/system_runtime.ts';
  const content = `import { createHighflySystemState, normalizeHighflySystemState, processHighflySystemEvent, type HighflySystemEvent, type HighflySystemNotice, type HighflySystemState } from './system_core';

const STORE_PREFIX = 'highfly.system.v1.';

function hunterKey(): string {
  const player = document.body.dataset.playerName || document.body.dataset.playerId || 'hunter';
  return STORE_PREFIX + player;
}

function loadState(): HighflySystemState {
  try {
    const raw = localStorage.getItem(hunterKey());
    return raw ? normalizeHighflySystemState(JSON.parse(raw) as Partial<HighflySystemState>) : createHighflySystemState();
  } catch {
    return createHighflySystemState();
  }
}

function saveState(state: HighflySystemState): void {
  try { localStorage.setItem(hunterKey(), JSON.stringify(state)); } catch { /* runtime remains functional */ }
}

let state = loadState();
let sequence = 0;

function id(prefix: string, detail?: Record<string, unknown>): string {
  const supplied = detail?.eventId;
  if (typeof supplied === 'string' && supplied) return supplied;
  sequence += 1;
  return prefix + ':' + Date.now() + ':' + sequence;
}

function emitNotices(notices: HighflySystemNotice[]): void {
  for (const item of notices) window.dispatchEvent(new CustomEvent('highfly:system-notice', { detail: item }));
  window.dispatchEvent(new CustomEvent('highfly:system-state', { detail: state }));
}

export function highflySystemDispatch(event: HighflySystemEvent): HighflySystemState {
  const result = processHighflySystemEvent(state, event);
  state = result.state;
  if (!result.duplicate) saveState(state);
  emitNotices(result.notices);
  return state;
}

export function highflySystemState(): HighflySystemState {
  return normalizeHighflySystemState(state);
}

function onValidatedExercise(event: Event): void {
  const d = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
  highflySystemDispatch({
    id: id('training.exercise', d), type: 'training.exercise.validated', at: new Date().toISOString(),
    dayKey: typeof d.dayKey === 'string' ? d.dayKey : undefined,
    data: { kg: Number(d.kg) || 0, reps: Number(d.reps) || 0, sets: Number(d.sets) || 0, exerciseId: String(d.exerciseId ?? '') },
  });
}

function onTrainingValidated(event: Event): void {
  const d = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
  highflySystemDispatch({
    id: id('training.session', d), type: 'training.session.validated', at: new Date().toISOString(),
    dayKey: typeof d.dayKey === 'string' ? d.dayKey : undefined,
    data: { gainedTrainingXp: Number(d.gainedTrainingXp) || 0, beforePower: Number(d.beforePower) || 0, afterPower: Number(d.afterPower) || 0 },
  });
}

function onPr(event: Event): void {
  const d = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
  highflySystemDispatch({
    id: id('training.pr', d), type: 'training.pr', at: new Date().toISOString(),
    dayKey: typeof d.dayKey === 'string' ? d.dayKey : undefined,
    data: { exerciseId: String(d.exerciseId ?? ''), previousE1rm: Number(d.previousE1rm) || 0, nextE1rm: Number(d.nextE1rm) || 0 },
  });
}

export function installHighflySystemRuntime(): void {
  if ((window as typeof window & { __highflySystemInstalled?: boolean }).__highflySystemInstalled) return;
  (window as typeof window & { __highflySystemInstalled?: boolean }).__highflySystemInstalled = true;
  window.addEventListener('highfly:validated-exercise', onValidatedExercise);
  window.addEventListener('highfly:training-validated', onTrainingValidated);
  window.addEventListener('highfly:personal-record', onPr);
  window.dispatchEvent(new CustomEvent('highfly:system-state', { detail: state }));
}

installHighflySystemRuntime();
`;
  write(path, content);
}

// ---------------------------------------------------------------------------
// Presentation layer: queue System messages, never own game truth.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/system_ui.ts';
  const content = `import type { HighflySystemNotice } from './system_core';

const LABEL: Record<HighflySystemNotice['kind'], string> = {
  system: 'SISTEMA', mission: 'MISIÓN', reward: 'RECOMPENSA', alert: 'ALERTA', unlock: 'DESBLOQUEO',
};

let queue: HighflySystemNotice[] = [];
let showing = false;

function host(): HTMLElement {
  let node = document.getElementById('highfly-system-toast');
  if (!node) {
    node = document.createElement('aside');
    node.id = 'highfly-system-toast';
    node.setAttribute('aria-live', 'polite');
    node.hidden = true;
    document.body.appendChild(node);
  }
  return node;
}

function showNext(): void {
  if (showing || queue.length === 0) return;
  showing = true;
  const item = queue.shift()!;
  const node = host();
  node.dataset.kind = item.kind;
  node.innerHTML = '<div class="hf-system-sigil">◇</div><div class="hf-system-copy"><small>[' + LABEL[item.kind] + ']</small><b>' + item.title + '</b><span>' + item.body + '</span></div>';
  node.hidden = false;
  node.classList.add('is-visible');
  const life = item.priority >= 4 ? 4600 : 3200;
  window.setTimeout(() => {
    node.classList.remove('is-visible');
    window.setTimeout(() => { node.hidden = true; showing = false; showNext(); }, 220);
  }, life);
}

export function installHighflySystemUi(): void {
  host();
  window.addEventListener('highfly:system-notice', (event) => {
    const item = (event as CustomEvent<HighflySystemNotice>).detail;
    if (!item?.id) return;
    queue.push(item);
    queue.sort((a, b) => b.priority - a.priority);
    showNext();
  });
}

installHighflySystemUi();
`;
  write(path, content);
}

// ---------------------------------------------------------------------------
// Training emits session truth and PR truth. RM module remains the authority for
// e1RM evidence; the System only listens and narrates/rewards the result.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/training_ui.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    `    resultEl.dataset.kind = 'ok';\n    resultEl.textContent = '[SISTEMA] +' + Math.round(applied.gainedXp) + ' Training XP · Poder ' + before + ' → ' + after;\n    renderSummary();`,
    `    window.dispatchEvent(new CustomEvent('highfly:training-validated', {\n      detail: {\n        eventId: 'training.session:' + draft.dayKey,\n        dayKey: draft.dayKey,\n        gainedTrainingXp: applied.gainedXp,\n        beforePower: before,\n        afterPower: after,\n      },\n    }));\n\n    resultEl.dataset.kind = 'ok';\n    resultEl.textContent = '[SISTEMA] +' + Math.round(applied.gainedXp) + ' Training XP · Poder ' + before + ' → ' + after;\n    renderSummary();`,
    'System session event after authoritative training acceptance',
  );
  write(path, source);
}

{
  const path = 'src/highfly/training_rms.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    `      evidence[id] = {\n        bestE1rm: Math.max(previous, estimate),\n        bestKg: kg,\n        bestReps: reps,\n        bestSets: sets,\n        updatedAt: String(detail?.dayKey ?? new Date().toISOString().slice(0, 10)),\n      };\n      saveE1rm(evidence);\n      renderEvidence();`,
    `      const next = Math.max(previous, estimate);\n      evidence[id] = {\n        bestE1rm: next,\n        bestKg: kg,\n        bestReps: reps,\n        bestSets: sets,\n        updatedAt: String(detail?.dayKey ?? new Date().toISOString().slice(0, 10)),\n      };\n      saveE1rm(evidence);\n      renderEvidence();\n      if (next > previous + 0.05) {\n        window.dispatchEvent(new CustomEvent('highfly:personal-record', {\n          detail: {\n            eventId: 'training.pr:' + id + ':' + String(detail?.dayKey ?? '') + ':' + next,\n            exerciseId: id, previousE1rm: previous, nextE1rm: next,\n            dayKey: String(detail?.dayKey ?? new Date().toISOString().slice(0, 10)),\n          },\n        }));\n      }`,
    'System PR event after RM authority updates evidence',
  );
  write(path, source);
}

// Wire runtime + presentation after RM/training modules. This patch is authored
// separately and is intentionally activated only after v0.8.0.1 is green.
{
  const path = 'src/main.ts';
  let source = read(path);
  const anchor = `import './highfly/training_rms';`;
  source = replaceRequired(
    source,
    anchor,
    `${anchor}\nimport './highfly/system_runtime';\nimport './highfly/system_ui';`,
    'System runtime imports',
  );
  write(path, source);
}

{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.8.1 — System presentation, original HIGHFLY visual language. */
#highfly-system-toast {
  position: fixed;
  z-index: 10050;
  top: max(10px, env(safe-area-inset-top));
  left: 50%;
  width: min(520px, calc(100vw - 180px));
  min-width: 330px;
  transform: translate(-50%, -14px) scale(.985);
  opacity: 0;
  display: flex;
  align-items: stretch;
  padding: 0;
  overflow: hidden;
  pointer-events: none;
  border: 1px solid rgba(85, 216, 255, .62);
  border-radius: 6px;
  background: linear-gradient(105deg, rgba(3, 8, 18, .97), rgba(12, 12, 32, .95));
  box-shadow: 0 0 24px rgba(58, 164, 255, .22), inset 0 0 18px rgba(97, 58, 255, .08);
  color: #eafaff;
  transition: opacity .18s ease, transform .22s ease;
}
#highfly-system-toast.is-visible { opacity: 1; transform: translate(-50%, 0) scale(1); }
#highfly-system-toast .hf-system-sigil {
  display: grid; place-items: center; width: 42px; flex: 0 0 42px;
  background: linear-gradient(180deg, rgba(44, 199, 255, .16), rgba(122, 71, 255, .12));
  border-right: 1px solid rgba(85, 216, 255, .28);
  color: #72e4ff; font-size: 21px; text-shadow: 0 0 12px currentColor;
}
#highfly-system-toast .hf-system-copy { min-width: 0; display: grid; gap: 2px; padding: 7px 10px 8px; }
#highfly-system-toast .hf-system-copy small { color: #63dcff; font-size: 8px; letter-spacing: .18em; }
#highfly-system-toast .hf-system-copy b { color: #fff; font-size: 12px; line-height: 1.05; letter-spacing: .05em; }
#highfly-system-toast .hf-system-copy span { color: rgba(222, 241, 250, .84); font-size: 9px; line-height: 1.2; }
#highfly-system-toast[data-kind="reward"], #highfly-system-toast[data-kind="unlock"] { border-color: rgba(159, 113, 255, .72); box-shadow: 0 0 28px rgba(116, 77, 255, .3); }
#highfly-system-toast[data-kind="alert"] { border-color: rgba(255, 112, 129, .7); }
`;
  write(path, css);
}

{
  const path = 'tests/highfly_v081_system_engine.test.ts';
  const content = `import { describe, expect, it } from 'vitest';
import { createHighflySystemState, highflyPersonalImprovementRatio, highflyPrReward, processHighflySystemEvent } from '../src/highfly/system_core';

describe('HIGHFLY v0.8.1 System Engine', () => {
  it('is idempotent: the same event can never reward twice', () => {
    const event = { id: 'session:2026-08-22', type: 'training.session.validated' as const, at: '2026-08-22T10:00:00Z', dayKey: '2026-08-22', data: { gainedTrainingXp: 100, beforePower: 100, afterPower: 104 } };
    const first = processHighflySystemEvent(createHighflySystemState(), event);
    expect(first.duplicate).toBe(false);
    expect(first.gainedSystemXp).toBeGreaterThan(0);
    const second = processHighflySystemEvent(first.state, event);
    expect(second.duplicate).toBe(true);
    expect(second.gainedSystemXp).toBe(0);
    expect(second.state.systemXp).toBe(first.state.systemXp);
  });

  it('rewards PERSONAL improvement equally regardless of absolute strength', () => {
    expect(highflyPersonalImprovementRatio(20, 20.4)).toBeCloseTo(highflyPersonalImprovementRatio(120, 122.4), 8);
    expect(highflyPrReward(20, 20.4)).toBe(highflyPrReward(120, 122.4));
  });

  it('never treats a first baseline as a huge PR reward', () => {
    expect(highflyPrReward(0, 120)).toBe(0);
    const result = processHighflySystemEvent(createHighflySystemState(), { id: 'pr:first', type: 'training.pr', at: '2026-08-22T10:00:00Z', data: { previousE1rm: 0, nextE1rm: 120 } });
    expect(result.notices.some((n) => n.title === 'REFERENCIA ESTABLECIDA')).toBe(true);
  });

  it('training advances System missions but System does not contain physical stat mutation', () => {
    const result = processHighflySystemEvent(createHighflySystemState(), { id: 'session:1', type: 'training.session.validated', at: '2026-08-22T10:00:00Z', dayKey: '2026-08-22', data: { gainedTrainingXp: 80 } });
    expect(result.completedMissions).toContain('daily.training');
    expect(JSON.stringify(result.state)).not.toContain('trainingPowerBudget');
    expect(JSON.stringify(result.state)).not.toContain('strBonus');
  });

  it('supports world events without granting fake real-world physical stats', () => {
    const first = processHighflySystemEvent(createHighflySystemState(), { id: 'kill:1', type: 'combat.kill', at: '2026-08-22T10:00:00Z' });
    expect(first.state.combatKills).toBe(1);
    const boss = processHighflySystemEvent(first.state, { id: 'boss:1', type: 'world.boss.kill', at: '2026-08-22T10:05:00Z' });
    expect(boss.state.bossKills).toBe(1);
    expect(boss.notices.some((n) => n.kind === 'reward')).toBe(true);
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.8.1] System Engine authored: facts -> rules -> missions/unlocks -> narrative; physical stats remain training-owned.');

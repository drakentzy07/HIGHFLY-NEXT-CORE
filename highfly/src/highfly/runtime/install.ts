import type { Input } from '../../game/input';
import type { Sim } from '../../sim/sim';
import { skillOneForClass } from '../combat/action';
import { HighflyCombatRuntime, type CastResult } from '../combat/runtime';
import { movementVector, facingForDirection } from '../movement/movement';
import { ClaudeCraft040Adapter } from './claudecraft040';
import { installHighflyCreatorShell, readCreatorDraft } from '../creator/runtime';
import {
  applyHighflyEvent,
  createHighflyProfile,
  normalizeHighflyProfile,
  type HighflyProfile,
} from '../system/system';
import {
  completeTrainingSession,
  createTrainingSession,
  parseTrainingSession,
  recordTested1Rm,
  registerTrainingSet,
  summarizeTrainingSession,
  type HighflyTrainingSession,
} from '../training/session';
import './runtime.css';

const SESSION_KEY = 'highfly.training.session.v1';
const RECORDS_KEY = 'highfly.training.records.v1';
let runtimeInstalled = false;

const EXERCISES: ReadonlyArray<[string, string]> = [
  ['hang_power_clean', 'Hang Power Clean'],
  ['sentadilla_trasera', 'Sentadilla trasera'],
  ['sentadilla_frontal', 'Sentadilla frontal'],
  ['zercher_squat', 'Zercher squat'],
  ['peso_muerto', 'Peso muerto / Rack Pull'],
  ['banco_plano', 'Banco plano'],
  ['banco_inclinado', 'Banco inclinado'],
  ['press_militar', 'Press militar'],
  ['push_press', 'Push Press'],
  ['remo_pendlay', 'Remo Pendlay'],
  ['remo_gironda', 'Remo Gironda'],
  ['jalon', 'Jalón'],
  ['isquios', 'Isquios'],
  ['core', 'Core'],
];

function safeParse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the running session alive even if Android storage is temporarily blocked.
  }
}

function loadProfile(adapter: ClaudeCraft040Adapter): HighflyProfile {
  let profile = createHighflyProfile();
  const raw = adapter.loadProfile();
  if (raw) {
    try {
      profile = normalizeHighflyProfile(JSON.parse(raw));
    } catch {
      profile = createHighflyProfile();
    }
  }
  const draft = readCreatorDraft();
  if (draft) {
    profile = {
      ...profile,
      hunterName: draft.hunterName || profile.hunterName,
      classId: draft.classId,
      subclassId: draft.subclassId,
    };
  } else {
    profile = { ...profile, classId: adapter.playerClass() };
  }
  adapter.persistProfile(JSON.stringify(profile));
  return profile;
}

function installBrandBoundary(): void {
  const replace = (root: Node) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      if (parent && !['SCRIPT', 'STYLE'].includes(parent.tagName) && node.nodeValue?.includes('ClaudeCraft')) {
        node.nodeValue = node.nodeValue.replaceAll('World of ClaudeCraft', 'HIGHFLY').replaceAll('ClaudeCraft', 'HIGHFLY');
      }
      node = walker.nextNode();
    }
    if (root instanceof Element) {
      for (const attr of ['title', 'aria-label', 'alt']) {
        const value = root.getAttribute(attr);
        if (value?.includes('ClaudeCraft')) root.setAttribute(attr, value.replaceAll('World of ClaudeCraft', 'HIGHFLY').replaceAll('ClaudeCraft', 'HIGHFLY'));
      }
    }
  };
  replace(document.body);
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) replace(node);
    }
  }).observe(document.body, { childList: true, subtree: true });
}

function flash(button: HTMLButtonElement, result: CastResult): void {
  button.classList.remove('hf-hit', 'hf-blocked');
  void button.offsetWidth;
  button.classList.add(result.blockedBy ? 'hf-blocked' : 'hf-hit');
  window.setTimeout(() => button.classList.remove('hf-hit', 'hf-blocked'), 180);
}

function mountCombatDock(combat: HighflyCombatRuntime, onDash: () => boolean, classId: ReturnType<ClaudeCraft040Adapter['playerClass']>): void {
  document.getElementById('highfly-combat-dock')?.remove();
  const dock = document.createElement('div');
  dock.id = 'highfly-combat-dock';
  const skill = skillOneForClass(classId);
  dock.innerHTML = `
    <button id="hf-skill-one" class="hf-combat-btn hf-skill" type="button"><b>${skill.label ?? 'SKILL 1'}</b><small>ÁREA</small></button>
    <button id="hf-dash" class="hf-combat-btn hf-dash" type="button"><b>DASH</b><small>ESQUIVAR</small></button>
    <button id="hf-basic-attack" class="hf-combat-btn hf-attack" type="button"><b>ATAQUE</b><small>SIN TARGET</small></button>
  `;
  document.body.appendChild(dock);

  const attack = dock.querySelector('#hf-basic-attack') as HTMLButtonElement;
  const skillBtn = dock.querySelector('#hf-skill-one') as HTMLButtonElement;
  const dashBtn = dock.querySelector('#hf-dash') as HTMLButtonElement;

  let repeat: number | null = null;
  const fireAttack = () => flash(attack, combat.basic());
  attack.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    fireAttack();
    repeat = window.setInterval(fireAttack, 430);
  });
  const stopRepeat = () => {
    if (repeat !== null) window.clearInterval(repeat);
    repeat = null;
  };
  attack.addEventListener('pointerup', stopRepeat);
  attack.addEventListener('pointercancel', stopRepeat);
  attack.addEventListener('pointerleave', stopRepeat);
  skillBtn.addEventListener('click', () => flash(skillBtn, combat.skillOne()));
  dashBtn.addEventListener('click', () => {
    dashBtn.classList.toggle('hf-hit', onDash());
    window.setTimeout(() => dashBtn.classList.remove('hf-hit'), 180);
  });
}

function mountProductNav(
  getProfile: () => HighflyProfile,
  setProfile: (profile: HighflyProfile) => void,
): void {
  document.getElementById('highfly-main-nav')?.remove();
  document.getElementById('highfly-overlay')?.remove();

  const nav = document.createElement('nav');
  nav.id = 'highfly-main-nav';
  nav.innerHTML = `
    <button data-view="training">ENTRENAMIENTO</button>
    <button data-view="hunt">CACERÍA</button>
    <button data-view="hunter">CAZADOR</button>
    <button data-view="system">SISTEMA</button>
  `;
  document.body.appendChild(nav);

  const overlay = document.createElement('section');
  overlay.id = 'highfly-overlay';
  overlay.hidden = true;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.hidden = true;
    overlay.replaceChildren();
  };

  const renderHunter = () => {
    const p = getProfile();
    overlay.innerHTML = `
      <div class="hf-window">
        <header><b>CAZADOR</b><button data-close>×</button></header>
        <div class="hf-hunter-grid">
          <div class="hf-rank">${p.rank}<small>RANGO</small></div>
          <div><h2>${p.hunterName}</h2><p>Nivel ${p.level} · XP ${Math.round(p.xp)}</p><p>Clase: ${p.classId.toUpperCase()}${p.subclassId ? ` · Subclase: ${p.subclassId.toUpperCase()}` : ''}</p></div>
          <div class="hf-stats">
            <span>STR <b>${p.stats.str.toFixed(2)}</b></span><span>AGI <b>${p.stats.agi.toFixed(2)}</b></span><span>VIT <b>${p.stats.vit.toFixed(2)}</b></span><span>PER <b>${p.stats.per.toFixed(2)}</b></span><span>INT <b>${p.stats.int.toFixed(2)}</b></span>
          </div>
        </div>
      </div>`;
    overlay.hidden = false;
    overlay.querySelector('[data-close]')?.addEventListener('click', close);
  };

  const renderSystem = () => {
    const p = getProfile();
    overlay.innerHTML = `
      <div class="hf-window">
        <header><b>SISTEMA HIGHFLY</b><button data-close>×</button></header>
        <div class="hf-system-copy">
          <h2>TU VIDA REAL ES EL SISTEMA DE PROGRESIÓN DEL RPG</h2>
          <p>Entrenamiento real → RM / e1RM / PR → XP y atributos → Cazador → Cacería.</p>
          <p><b>Eventos procesados:</b> ${p.processedEventIds.length} · <b>Rango:</b> ${p.rank} · <b>Nivel:</b> ${p.level}</p>
        </div>
      </div>`;
    overlay.hidden = false;
    overlay.querySelector('[data-close]')?.addEventListener('click', close);
  };

  const renderTraining = () => {
    let session = parseTrainingSession(localStorage.getItem(SESSION_KEY)) ?? createTrainingSession();
    if (!localStorage.getItem(SESSION_KEY)) saveJson(SESSION_KEY, session);
    let records = safeParse<Record<string, number>>(RECORDS_KEY, {});

    overlay.innerHTML = `
      <div class="hf-window hf-training-window">
        <header><b>ENTRENAMIENTO</b><button data-close>×</button></header>
        <div class="hf-training-form">
          <label>EJERCICIO<select id="hf-exercise">${EXERCISES.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
          <label>PESO KG<input id="hf-weight" type="number" min="0" step="0.5" inputmode="decimal" value="0"></label>
          <label>REPS<input id="hf-reps" type="number" min="1" step="1" inputmode="numeric" value="5"></label>
          <button id="hf-register-set" type="button">REGISTRAR SERIE</button>
          <label>RM TESTEADO<input id="hf-tested-rm" type="number" min="0" step="0.5" inputmode="decimal" placeholder="kg"></label>
          <button id="hf-save-rm" type="button">GUARDAR RM</button>
        </div>
        <div id="hf-training-summary"></div>
        <div class="hf-training-actions"><button id="hf-finish-session" type="button">FINALIZAR SESIÓN</button><button id="hf-new-session" type="button">NUEVA SESIÓN</button></div>
      </div>`;
    overlay.hidden = false;

    const exercise = overlay.querySelector('#hf-exercise') as HTMLSelectElement;
    const weight = overlay.querySelector('#hf-weight') as HTMLInputElement;
    const reps = overlay.querySelector('#hf-reps') as HTMLInputElement;
    const testedRm = overlay.querySelector('#hf-tested-rm') as HTMLInputElement;
    const summary = overlay.querySelector('#hf-training-summary') as HTMLElement;

    const paint = () => {
      const result = summarizeTrainingSession(session);
      const rows = Object.entries(result.evidenceByExercise)
        .map(([id, evidence]) => {
          const label = EXERCISES.find(([key]) => key === id)?.[1] ?? id;
          return `<tr><td>${label}</td><td>${evidence.tested1RmKg?.toFixed(1) ?? '—'}</td><td>${evidence.estimated1RmKg?.toFixed(1) ?? '—'}</td><td>${records[id]?.toFixed(1) ?? '—'}</td></tr>`;
        })
        .join('');
      summary.innerHTML = `
        <div class="hf-training-kpis"><span>SERIES <b>${result.summary.completedSets}</b></span><span>VOLUMEN <b>${Math.round(result.summary.tonnageKg)} kg</b></span><span>ESTADO <b>${session.status.toUpperCase()}</b></span></div>
        <table><thead><tr><th>Ejercicio</th><th>RM real</th><th>e1RM</th><th>Récord</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Registrá tu primera serie.</td></tr>'}</tbody></table>`;
    };

    overlay.querySelector('#hf-register-set')?.addEventListener('click', () => {
      if (session.status === 'completed') session = createTrainingSession();
      const weightKg = Number(weight.value);
      const repCount = Math.round(Number(reps.value));
      const eventId = `set:${session.id}:${session.sets.length}`;
      try {
        session = registerTrainingSet(session, { exerciseId: exercise.value, weightKg, reps: repCount });
        saveJson(SESSION_KEY, session);
        const profile = applyHighflyEvent(getProfile(), {
          id: eventId,
          type: 'SET_COMPLETED',
          payload: { reps: repCount, weightKg, exerciseId: exercise.value },
        });
        setProfile(profile);
        paint();
      } catch (error) {
        summary.textContent = error instanceof Error ? error.message : 'No se pudo registrar la serie.';
      }
    });

    overlay.querySelector('#hf-save-rm')?.addEventListener('click', () => {
      const value = Number(testedRm.value);
      if (value <= 0) return;
      try {
        session = recordTested1Rm(session, exercise.value, value);
        saveJson(SESSION_KEY, session);
        paint();
      } catch {
        // Form remains editable; no destructive write.
      }
    });

    overlay.querySelector('#hf-finish-session')?.addEventListener('click', () => {
      const result = completeTrainingSession(session);
      session = result.session;
      let profile = applyHighflyEvent(getProfile(), {
        id: `session:${session.id}`,
        type: 'SESSION_COMPLETED',
        payload: { tonnageKg: result.summary.tonnageKg },
      });
      for (const [id, evidence] of Object.entries(result.evidenceByExercise)) {
        const candidate = Math.max(evidence.tested1RmKg ?? 0, evidence.estimated1RmKg ?? 0);
        const previous = records[id] ?? 0;
        if (candidate > previous + 0.01) {
          profile = applyHighflyEvent(profile, {
            id: `pr:${session.id}:${id}`,
            type: 'PR_ACHIEVED',
            payload: { deltaKg: candidate - previous },
          });
          records = { ...records, [id]: candidate };
        }
      }
      setProfile(profile);
      saveJson(RECORDS_KEY, records);
      saveJson(SESSION_KEY, session);
      paint();
    });

    overlay.querySelector('#hf-new-session')?.addEventListener('click', () => {
      session = createTrainingSession();
      saveJson(SESSION_KEY, session);
      paint();
    });
    overlay.querySelector('[data-close]')?.addEventListener('click', close);
    paint();
  };

  nav.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-view]');
    if (!button) return;
    const view = button.dataset.view;
    if (view === 'training') renderTraining();
    else if (view === 'hunter') renderHunter();
    else if (view === 'system') renderSystem();
    else close();
  });
}

export function installHighflyOfflineRuntime(args: { sim: Sim | null; input: Input }): void {
  if (!args.sim || runtimeInstalled || typeof document === 'undefined') return;
  runtimeInstalled = true;

  const sim = args.sim;
  const input = args.input;
  const adapter = new ClaudeCraft040Adapter(sim);
  const combat = new HighflyCombatRuntime(adapter);
  let profile = loadProfile(adapter);
  const setProfile = (next: HighflyProfile) => {
    profile = next;
    adapter.persistProfile(JSON.stringify(next));
  };

  // Replace MMO backpedal/strafe semantics with HIGHFLY action movement: the
  // input vector chooses travel direction, the body turns to that vector, and
  // the camera remains free. Thus holding "back" turns and runs, never moonwalks.
  const rawReadMove = input.readMoveInput.bind(input);
  input.readMoveInput = () => {
    const raw = rawReadMove();
    const player = sim.player;
    const plan = movementVector(raw, input.camYaw, player.facing);
    if (!plan.hasInput || player.dead) return raw;
    player.facing = facingForDirection(plan.direction);
    return {
      ...raw,
      forward: true,
      back: false,
      strafeLeft: false,
      strafeRight: false,
      turnLeft: false,
      turnRight: false,
    };
  };

  let dashReadyAt = 0;
  const dash = (): boolean => {
    const now = performance.now();
    if (now < dashReadyAt || sim.player.dead) return false;
    const raw = rawReadMove();
    const player = sim.player;
    const plan = movementVector(raw, input.camYaw, player.facing);
    const distance = 4.25;
    const x = player.pos.x + plan.direction.x * distance;
    const z = player.pos.z + plan.direction.z * distance;
    const ground = sim.groundPos(x, z);
    player.pos.x = x;
    player.pos.y = ground.y;
    player.pos.z = z;
    player.facing = facingForDirection(plan.direction);
    sim.ctx.rebucket(player);
    dashReadyAt = now + 950;
    return true;
  };

  const hooks = globalThis as typeof globalThis & { __HIGHFLY_ATTACK__?: () => void };
  hooks.__HIGHFLY_ATTACK__ = () => {
    combat.basic();
  };

  mountCombatDock(combat, dash, adapter.playerClass());
  mountProductNav(() => profile, setProfile);
  installBrandBoundary();
  document.body.classList.add('highfly-runtime-integrated');
}

export { installHighflyCreatorShell };

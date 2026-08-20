import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.6.1] patched ${path}`);
}
function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// ---------------------------------------------------------------------------
// 1) VISIBLE TRAINING UI — the v0.6 core already changes real combat stats.
// v0.6.1 finally exposes that system on-device: one validated session/day,
// presets, recovery confirmation, Training XP, effective potential and the real
// combat stats/Hunter Power that changed because of the workout.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/training_ui.ts';
  const content = `import type { IWorld } from '../world_api';
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

interface RoutinePreset {
  id: string;
  label: string;
  detail: string;
  stimulus: HighflyTrainingVector;
  purity: number;
}

const PRESETS: readonly RoutinePreset[] = [
  {
    id: 'hybrid',
    label: 'HIGHFLY HÍBRIDO',
    detail: 'Fuerza + potencia + hipertrofia + técnica + acondicionamiento.',
    stimulus: { str: 30, agi: 25, vit: 20, per: 17, int: 8 },
    purity: 0.14,
  },
  {
    id: 'strength',
    label: 'FUERZA',
    detail: 'Dominante en fuerza con soporte de vitalidad y percepción técnica.',
    stimulus: { str: 62, agi: 7, vit: 20, per: 8, int: 3 },
    purity: 0.36,
  },
  {
    id: 'power',
    label: 'POTENCIA',
    detail: 'Explosividad, velocidad de producción de fuerza y técnica.',
    stimulus: { str: 32, agi: 43, vit: 10, per: 12, int: 3 },
    purity: 0.28,
  },
  {
    id: 'hypertrophy',
    label: 'HIPERTROFIA',
    detail: 'Volumen, tolerancia al trabajo y desarrollo muscular.',
    stimulus: { str: 32, agi: 12, vit: 44, per: 9, int: 3 },
    purity: 0.30,
  },
  {
    id: 'athlete',
    label: 'ATLETA',
    detail: 'Agilidad, capacidad de trabajo, percepción y resistencia.',
    stimulus: { str: 16, agi: 36, vit: 27, per: 17, int: 4 },
    purity: 0.18,
  },
];

function dayKeyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return \`${'${y}'}-${'${m}'}-${'${day}'}\`;
}

function n(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(digits).replace(/\\.0$/, '');
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
    case 'recovery_not_met': return 'Marcá descansos/recuperación completados antes de validar.';
    case 'session_too_short': return 'La sesión válida debe durar al menos 25 minutos.';
    case 'invalid_score': return 'El score de la sesión no es válido.';
    case 'empty_stimulus': return 'La rutina no generó estímulo válido.';
    default: return 'No se pudo validar la sesión.';
  }
}

export function installHighflyTrainingUi(worldInput: IWorld): void {
  if (document.getElementById('highfly-training-launcher')) return;
  if (!('highflyApplyTrainingSession' in (worldInput as object))) return;
  const world = worldInput as HighflyTrainingWorld;

  const launcher = document.createElement('button');
  launcher.id = 'highfly-training-launcher';
  launcher.type = 'button';
  launcher.textContent = 'ENTRENO';
  launcher.setAttribute('aria-label', 'Abrir Entrenamiento HIGHFLY');

  const shell = document.createElement('div');
  shell.id = 'highfly-training-shell';
  shell.hidden = true;
  shell.innerHTML = \`
    <section id="highfly-training-panel" role="dialog" aria-modal="true" aria-label="Entrenamiento HIGHFLY">
      <header>
        <div><b>ENTRENAMIENTO</b><small> POTENCIAL REAL DEL CAZADOR</small></div>
        <button type="button" data-hf-close aria-label="Cerrar">×</button>
      </header>
      <div class="hf-training-body">
        <div class="hf-training-summary">
          <div><span>PODER</span><strong data-hf-power>0</strong></div>
          <div><span>TRAINING XP</span><strong data-hf-xp>0</strong></div>
          <div><span>SESIONES</span><strong data-hf-sessions>0</strong></div>
          <div><span>ÚLTIMA</span><strong data-hf-last>—</strong></div>
        </div>
        <div class="hf-training-stats" data-hf-stats></div>
        <div class="hf-training-combat" data-hf-combat></div>
        <div class="hf-training-form">
          <label>RUTINA
            <select data-hf-preset>${'${PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join(\'\')}'}</select>
          </label>
          <p data-hf-preset-detail></p>
          <div class="hf-training-fields">
            <label>MINUTOS<input data-hf-duration type="number" min="25" max="240" step="5" value="75"></label>
            <label>SCORE<input data-hf-score type="number" min="1" max="120" step="1" value="100"></label>
          </div>
          <label class="hf-training-check"><input data-hf-recovery type="checkbox"> Completé la sesión y sus descansos/recuperación.</label>
          <button type="button" data-hf-submit>VALIDAR ENTRENAMIENTO DE HOY</button>
          <output data-hf-result></output>
        </div>
      </div>
    </section>\`;

  document.body.append(launcher, shell);

  const q = <T extends HTMLElement>(selector: string): T => shell.querySelector(selector) as T;
  const close = q<HTMLButtonElement>('[data-hf-close]');
  const preset = q<HTMLSelectElement>('[data-hf-preset]');
  const detail = q<HTMLElement>('[data-hf-preset-detail]');
  const duration = q<HTMLInputElement>('[data-hf-duration]');
  const score = q<HTMLInputElement>('[data-hf-score]');
  const recovery = q<HTMLInputElement>('[data-hf-recovery]');
  const submit = q<HTMLButtonElement>('[data-hf-submit]');
  const result = q<HTMLOutputElement>('[data-hf-result]');

  const currentPreset = (): RoutinePreset => PRESETS.find((p) => p.id === preset.value) ?? PRESETS[0];

  const render = (): void => {
    const profile = world.highflyTrainingProfile;
    const p = world.player;
    q<HTMLElement>('[data-hf-power]').textContent = String(hunterPower(world));
    q<HTMLElement>('[data-hf-xp]').textContent = n(profile.trainingXp, 0);
    q<HTMLElement>('[data-hf-sessions]').textContent = String(profile.validatedSessions);
    q<HTMLElement>('[data-hf-last]').textContent = profile.lastTrainingDay ?? '—';

    const total = (profile.pure.str + profile.pure.agi + profile.pure.vit + profile.pure.per + profile.pure.int) +
      (profile.adaptive.str + profile.adaptive.agi + profile.adaptive.vit + profile.adaptive.per + profile.adaptive.int);
    const stat = (key: keyof HighflyTrainingVector): number => total > 0
      ? ((profile.pure[key] + profile.adaptive[key]) / total) * profile.trainingXp
      : 0;
    q<HTMLElement>('[data-hf-stats]').innerHTML = [
      ['STR', stat('str')], ['AGI', stat('agi')], ['VIT', stat('vit')], ['PER', stat('per')], ['INT', stat('int')],
    ].map(([label, value]) => \`<div><span>${'${label}'}</span><b>${'${n(value as number)}'}</b></div>\`).join('');

    q<HTMLElement>('[data-hf-combat]').innerHTML = \`
      <span>HP <b>${'${Math.round(p.maxHp ?? 0)}'}</b></span>
      <span>AP <b>${'${Math.round(p.attackPower ?? 0)}'}</b></span>
      <span>RP <b>${'${Math.round(p.rangedPower ?? 0)}'}</b></span>
      <span>SP <b>${'${Math.round(p.spellPower ?? 0)}'}</b></span>
      <span>HIT <b>${'${n(p.hitRating ?? 0)}'}</b></span>
      <span>CRIT <b>${'${n(p.critRating ?? 0)}'}</b></span>\`;

    const trainedToday = profile.lastTrainingDay === dayKeyLocal();
    submit.disabled = trainedToday;
    submit.textContent = trainedToday ? 'ENTRENAMIENTO DE HOY VALIDADO' : 'VALIDAR ENTRENAMIENTO DE HOY';
    detail.textContent = currentPreset().detail;
  };

  launcher.addEventListener('click', () => {
    shell.hidden = false;
    render();
  });
  close.addEventListener('click', () => { shell.hidden = true; });
  shell.addEventListener('pointerdown', (event) => {
    if (event.target === shell) shell.hidden = true;
  });
  preset.addEventListener('change', render);

  submit.addEventListener('click', () => {
    const plan = currentPreset();
    const session: HighflyTrainingSession = {
      dayKey: dayKeyLocal(),
      durationMinutes: Number(duration.value),
      score: Number(score.value),
      recoveryOk: recovery.checked,
      stimulus: { ...plan.stimulus },
      purity: plan.purity,
    };
    const before = hunterPower(world);
    const applied = world.highflyApplyTrainingSession(session);
    if (!applied.ok) {
      result.dataset.kind = 'error';
      result.textContent = rejectMessage(applied);
      render();
      return;
    }
    const after = hunterPower(world);
    result.dataset.kind = 'ok';
    result.textContent = \`+${'${applied.gainedXp}'} Training XP · Poder ${'${before}'} → ${'${after}'}\`;
    recovery.checked = false;
    render();
  });

  render();
}
`;
  write(path, content);
}

// Thread training UI into the one shared HUD/world construction path. Native
// offline gets the Sim seam; online ClientWorld simply fails the feature check.
{
  const path = 'src/main.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    "import { Sim } from './sim/sim';",
    "import { Sim } from './sim/sim';\nimport { installHighflyTrainingUi } from './highfly/training_ui';",
    'training UI import',
  );
  const hudAnchor = `    hud = new Hud(world, renderer, keybinds, {
      dailyRewardsEnabled: NATIVE_APP ? await walletCapabilityReady : true,
      devCommandsEnabled: import.meta.env.DEV,
      constrainedMemory: GFX.constrainedMemory,
    });`;
  source = replaceRequired(
    source,
    hudAnchor,
    `${hudAnchor}\n    if (NATIVE_APP && import.meta.env.VITE_HIGHFLY_OFFLINE === '1') {\n      installHighflyTrainingUi(world);\n    }`,
    'install visible training UI',
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) CREATOR RECOVERY v2 — keep the working 3D canvas, but stop shrinking or
// clipping information. Native gets a full Spanish class sheet with real base
// stats and its own scroll. Only the appearance editor scrolls on the left.
// ---------------------------------------------------------------------------
{
  const path = 'src/main.ts';
  let source = read(path);
  const anchor = '  if (!classDef || !details) return;';
  const block = `  if (!classDef || !details) return;\n\n  if (NATIVE_APP && panelId === 'offline-class-details') {\n    const hfNames: Record<PlayerClass, string> = {\n      warrior: 'GUERRERO', paladin: 'PALADÍN', hunter: 'CAZADOR', rogue: 'PÍCARO',\n      priest: 'SACERDOTE', shaman: 'CHAMÁN', mage: 'MAGO', warlock: 'BRUJO', druid: 'DRUIDA',\n    };\n    const hfRoles: Record<PlayerClass, string> = {\n      warrior: 'TANQUE / DPS CUERPO A CUERPO',\n      paladin: 'SANADOR / TANQUE / DPS CUERPO A CUERPO',\n      hunter: 'DPS A DISTANCIA', rogue: 'DPS CUERPO A CUERPO',\n      priest: 'SANADOR / DPS A DISTANCIA', shaman: 'HÍBRIDO / SANADOR / DPS',\n      mage: 'DPS MÁGICO A DISTANCIA', warlock: 'DPS MÁGICO / INVOCACIÓN',\n      druid: 'HÍBRIDO / TANQUE / SANADOR / DPS',\n    };\n    const hfDesc: Record<PlayerClass, string> = {\n      warrior: 'Combatiente físico resistente que domina armas pesadas, presión cuerpo a cuerpo y defensa.',\n      paladin: 'Guerrero sagrado capaz de proteger, sanar y castigar enemigos en primera línea.',\n      hunter: 'Especialista a distancia con movilidad, precisión y compañero de combate.',\n      rogue: 'Atacante veloz que explota sigilo, energía, posicionamiento y golpes críticos.',\n      priest: 'Canaliza poder espiritual para sanar aliados, protegerlos o dañar desde distancia.',\n      shaman: 'Híbrido elemental que combina armas, magia, tótems y soporte según su especialización.',\n      mage: 'Maestro del daño mágico, control de área y hechizos de alto impacto a distancia.',\n      warlock: 'Caster de daño prolongado, maldiciones e invocaciones demoníacas.',\n      druid: 'Clase extremadamente versátil que cambia de forma y puede cubrir múltiples roles.',\n    };\n    const hfResource: Record<string, string> = { rage: 'IRA', mana: 'MANÁ', energy: 'ENERGÍA', focus: 'ENFOQUE' };\n    const s = classDef.baseStats;\n    panel.innerHTML = \`\n      <div class="highfly-class-sheet">\n        <div class="hf-class-title"><h3>\${hfNames[className]}</h3><span>\${hfRoles[className]}</span></div>\n        <p class="hf-class-desc">\${hfDesc[className]}</p>\n        <div class="hf-class-resource">RECURSO · <b>\${hfResource[classDef.resourceType] ?? classDef.resourceType}</b></div>\n        <h4>ATRIBUTOS BASE</h4>\n        <div class="hf-class-stats">\n          <span>FUERZA <b>\${s.str}</b></span><span>AGILIDAD <b>\${s.agi}</b></span>\n          <span>AGUANTE <b>\${s.sta}</b></span><span>INTELECTO <b>\${s.int}</b></span>\n          <span>ESPÍRITU <b>\${s.spi}</b></span><span>ARMADURA <b>\${s.armor}</b></span>\n        </div>\n        <div class="hf-class-note">Estos atributos se combinan con nivel, equipo, talentos y Potencial Real HIGHFLY.</div>\n      </div>\`;\n    return;\n  }`;
  source = replaceRequired(source, anchor, block, 'native full Spanish class sheet');
  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) DASH COLLISION GUARD — at dash velocity, probe the same collision resolver
// BEFORE the normal physics pass. If the direct path is clipped by a wall, use
// the clipped endpoint and terminate the dash instead of letting high-speed
// movement tunnel through thin city walls/fences/buildings.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/player_motion.ts';
  let source = read(path);
  const oldStep = `    const stepX = slide ? slide.x * STEEP_SLIDE_SPEED : movingOnGround ? wishX * wishSpeed : p.vx;
    const stepZ = slide ? slide.z * STEEP_SLIDE_SPEED : movingOnGround ? wishZ * wishSpeed : p.vz;`;
  const newStep = `    let stepX = slide ? slide.x * STEEP_SLIDE_SPEED : movingOnGround ? wishX * wishSpeed : p.vx;
    let stepZ = slide ? slide.z * STEEP_SLIDE_SPEED : movingOnGround ? wishZ * wishSpeed : p.vz;
    if ((p.highflyDashTime ?? 0) > 0 && p.onGround) {
      const desiredX = p.pos.x + stepX * DT;
      const desiredZ = p.pos.z + stepZ * DT;
      const dashProbe = deps.resolveMove(p.pos.x, p.pos.z, desiredX, desiredZ, BODY_RADIUS, p, false);
      const clipped = Math.hypot(dashProbe.x - desiredX, dashProbe.z - desiredZ) > 0.015;
      if (clipped) {
        stepX = (dashProbe.x - p.pos.x) / DT;
        stepZ = (dashProbe.z - p.pos.z) / DT;
        p.highflyDashTime = 0;
      }
    }`;
  source = replaceRequired(source, oldStep, newStep, 'dash collision pre-probe');
  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) AIM READABILITY PASS — v0.5.5 got the world-space origin right. v0.6.1
// makes it read like a mobile skillshot: lane starts at the hunter's feet,
// stronger translucent path, clear terminal range ring and brighter assist lock.
// The thumb still drags from the skill button; only the intent is rendered in-world.
// ---------------------------------------------------------------------------
{
  const path = 'src/render/highfly_directional_aim_visual.ts';
  let source = read(path);
  source = source
    .replace('opacity: 0.2,', 'opacity: 0.30,')
    .replace('const startDistance = Math.min(0.72, range * 0.12);', 'const startDistance = Math.min(0.24, range * 0.035);')
    .replace('this.ribbonMaterial.opacity = this.assisted ? 0.26 : 0.18;', 'this.ribbonMaterial.opacity = this.assisted ? 0.38 : 0.27;')
    .replace('const ringScale = Math.max(0.55, width * 0.9);', 'const ringScale = Math.max(0.68, width * 1.05);');
  write(path, source);
}

// ---------------------------------------------------------------------------
// 5) S23 LANDSCAPE LAYOUT + TRAINING PANEL. Overrides only; no more destructive
// scale-downs. Right class panel gets real width and independent scroll.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.6.1 — creator recovery + visible training + action aim polish */
@media (orientation: landscape) and (max-height: 940px) {
  body.native-app #offline-select.highfly-native-creator {
    padding: 7px 10px 7px !important;
  }
  body.native-app #offline-select.highfly-native-creator > .auth-title {
    height: 27px !important;
    min-height: 27px !important;
    flex-basis: 27px !important;
    font-size: clamp(17px, 3.2vh, 24px) !important;
    line-height: 27px !important;
    margin: 0 0 5px !important;
  }
  body.native-app #offline-select.highfly-native-creator .charselect-layout {
    grid-template-columns: minmax(0, 66%) minmax(0, 34%) !important;
    gap: 9px !important;
    height: calc(100% - 32px) !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }
  body.native-app #offline-select.highfly-native-creator .charselect-col-left,
  body.native-app #offline-select.highfly-native-creator .charselect-col-right {
    min-width: 0 !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }
  body.native-app #offline-select.highfly-native-creator .charselect-col-right {
    display: grid !important;
    grid-template-rows: minmax(150px, 46%) minmax(0, 54%) !important;
    gap: 7px !important;
  }
  body.native-app #offline-select.highfly-native-creator #offline-preview-container,
  body.native-app #offline-select.highfly-native-creator .char-preview-container {
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }
  body.native-app #offline-select.highfly-native-creator #offline-class-details,
  body.native-app #offline-select.highfly-native-creator .class-details-panel {
    min-width: 0 !important;
    min-height: 0 !important;
    width: 100% !important;
    height: 100% !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    box-sizing: border-box !important;
    padding: 9px 10px !important;
  }
  body.native-app #offline-select.highfly-native-creator #offline-appearance {
    min-height: 0 !important;
    overflow: hidden !important;
  }
  body.native-app #offline-select.highfly-native-creator #offline-appearance .ac-page.active {
    overflow-y: auto !important;
    overflow-x: hidden !important;
    min-width: 0 !important;
    padding-right: 4px !important;
  }
  body.native-app #offline-select.highfly-native-creator .auth-actions {
    left: 10px !important;
    right: 34.8% !important;
    width: auto !important;
    height: 29px !important;
    min-height: 29px !important;
    bottom: 4px !important;
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
  }
  body.native-app #offline-select.highfly-native-creator #btn-start-offline {
    display: block !important;
    width: min(42%, 330px) !important;
    min-width: 240px !important;
    height: 28px !important;
    min-height: 28px !important;
    margin: 0 auto !important;
    border-radius: 14px !important;
    font-size: 10px !important;
    line-height: 24px !important;
  }

  body.native-app #offline-class-details .highfly-class-sheet {
    display: flex !important;
    flex-direction: column !important;
    gap: 5px !important;
    width: 100% !important;
    min-width: 0 !important;
    color: #d8cfb6 !important;
  }
  body.native-app #offline-class-details .hf-class-title h3 {
    margin: 0 !important;
    font-size: clamp(20px, 4.1vh, 30px) !important;
    line-height: 1 !important;
    color: #f08a61 !important;
  }
  body.native-app #offline-class-details .hf-class-title span {
    display: block !important;
    margin-top: 4px !important;
    color: #f2dc3d !important;
    font: 800 10px/1.1 sans-serif !important;
  }
  body.native-app #offline-class-details .hf-class-desc {
    margin: 3px 0 !important;
    font: italic 11px/1.28 Georgia, serif !important;
    color: #c7c2b9 !important;
  }
  body.native-app #offline-class-details .hf-class-resource,
  body.native-app #offline-class-details .hf-class-note {
    font: 700 9px/1.2 sans-serif !important;
    color: #bdb59d !important;
  }
  body.native-app #offline-class-details h4 {
    margin: 4px 0 1px !important;
    font: 800 9px/1 sans-serif !important;
    letter-spacing: 1px !important;
    color: #f0c95a !important;
  }
  body.native-app #offline-class-details .hf-class-stats {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 4px !important;
  }
  body.native-app #offline-class-details .hf-class-stats span {
    display: flex !important;
    justify-content: space-between !important;
    min-width: 0 !important;
    padding: 5px 6px !important;
    border: 1px solid rgba(206,165,65,.32) !important;
    border-radius: 5px !important;
    background: rgba(9,10,18,.45) !important;
    font: 700 8.5px/1 sans-serif !important;
  }
  body.native-app #offline-class-details .hf-class-stats b { color: #f4d46a !important; }
}

body.native-app.game-active #highfly-training-launcher {
  position: fixed;
  left: max(0px, env(safe-area-inset-left));
  top: 43%;
  z-index: 2147482100;
  width: 22px;
  height: 74px;
  border: 1px solid rgba(91,220,255,.72);
  border-left: 0;
  border-radius: 0 10px 10px 0;
  background: rgba(5,9,19,.82);
  color: #d9f8ff;
  font: 800 8px/1 sans-serif;
  letter-spacing: .7px;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  touch-action: manipulation;
}
body.native-app:not(.game-active) #highfly-training-launcher { display: none !important; }
#highfly-training-shell[hidden] { display: none !important; }
#highfly-training-shell {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: grid;
  place-items: center;
  padding: max(8px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  background: rgba(0,0,0,.56);
  backdrop-filter: blur(3px);
}
#highfly-training-panel {
  width: min(760px, 92vw);
  max-height: 90dvh;
  overflow: hidden;
  border: 1px solid rgba(84,205,255,.58);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(10,15,29,.98), rgba(5,8,18,.98));
  color: #f1f4ff;
  box-shadow: 0 18px 70px rgba(0,0,0,.62), 0 0 26px rgba(76,105,255,.18);
}
#highfly-training-panel > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(103,184,255,.28);
}
#highfly-training-panel > header b { color: #73ddff; letter-spacing: 1.4px; }
#highfly-training-panel > header small { color: #a995ff; font-size: 9px; }
#highfly-training-panel > header button { border:0; background:transparent; color:#fff; font-size:26px; }
.hf-training-body { overflow:auto; max-height: calc(90dvh - 46px); padding: 11px 13px 13px; }
.hf-training-summary, .hf-training-stats, .hf-training-combat { display:grid; gap:6px; }
.hf-training-summary { grid-template-columns: repeat(4,minmax(0,1fr)); }
.hf-training-stats { grid-template-columns: repeat(5,minmax(0,1fr)); margin-top:7px; }
.hf-training-combat { grid-template-columns: repeat(6,minmax(0,1fr)); margin-top:7px; }
.hf-training-summary > div, .hf-training-stats > div, .hf-training-combat > span {
  min-width:0; padding:7px 6px; text-align:center; border:1px solid rgba(118,137,255,.22); border-radius:8px; background:rgba(255,255,255,.035);
}
.hf-training-summary span, .hf-training-stats span, .hf-training-combat span { font:700 8px/1 sans-serif; color:#9ba7c9; }
.hf-training-summary strong, .hf-training-stats b, .hf-training-combat b { display:block; margin-top:4px; color:#fff; font:800 15px/1 sans-serif; }
.hf-training-form { margin-top:10px; display:grid; gap:7px; }
.hf-training-form label { font:800 9px/1 sans-serif; letter-spacing:.6px; color:#b7c2e5; }
.hf-training-form select, .hf-training-form input[type=number] { width:100%; margin-top:4px; min-height:31px; box-sizing:border-box; border:1px solid rgba(102,151,255,.38); border-radius:7px; background:#090d19; color:#fff; padding:5px 8px; }
.hf-training-form p { margin:0; color:#aeb5c9; font:500 10px/1.25 sans-serif; }
.hf-training-fields { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.hf-training-check { display:flex; gap:7px; align-items:center; min-height:26px; }
.hf-training-form [data-hf-submit] { min-height:34px; border:1px solid #54d7ff; border-radius:8px; background:linear-gradient(90deg,#16255b,#452d75); color:#fff; font:900 10px/1 sans-serif; letter-spacing:.8px; }
.hf-training-form [data-hf-submit]:disabled { opacity:.48; }
.hf-training-form output { min-height:18px; font:700 10px/1.2 sans-serif; }
.hf-training-form output[data-kind=ok] { color:#76f0a0; }
.hf-training-form output[data-kind=error] { color:#ff8f8f; }
`;
  write(path, css);
}

console.log('[HIGHFLY v0.6.1] full pass applied.');

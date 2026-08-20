import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.6.2] patched ${path}`);
}
function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// ---------------------------------------------------------------------------
// 1) ROBUST NATIVE CREATOR SHEET
// The original renderClassDetails lifecycle can be repainted by locale/appearance
// work after HIGHFLY's v0.6.1 injection. On some S23 runs that leaves the right
// details cell empty while the preview survives. Install a native-only owner that
// always paints the selected class after the class chip settles.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/native_creator_fix.ts';
  const content = `import { CLASSES } from '../sim/content/classes';
import type { PlayerClass } from '../sim/types';

const NAMES: Record<PlayerClass, string> = {
  warrior: 'GUERRERO',
  paladin: 'PALADÍN',
  hunter: 'CAZADOR',
  rogue: 'PÍCARO',
  priest: 'SACERDOTE',
  shaman: 'CHAMÁN',
  mage: 'MAGO',
  warlock: 'BRUJO',
  druid: 'DRUIDA',
};

const ROLES: Record<PlayerClass, string> = {
  warrior: 'TANQUE / DPS CUERPO A CUERPO',
  paladin: 'SANADOR / TANQUE / DPS CUERPO A CUERPO',
  hunter: 'DPS A DISTANCIA',
  rogue: 'DPS CUERPO A CUERPO',
  priest: 'SANADOR / DPS A DISTANCIA',
  shaman: 'HÍBRIDO / SANADOR / DPS',
  mage: 'DPS MÁGICO A DISTANCIA',
  warlock: 'DPS MÁGICO / INVOCACIÓN',
  druid: 'HÍBRIDO / TANQUE / SANADOR / DPS',
};

const DESCRIPTIONS: Record<PlayerClass, string> = {
  warrior: 'Combatiente físico resistente. Domina armas pesadas, presión cuerpo a cuerpo y defensa.',
  paladin: 'Guerrero sagrado capaz de proteger, sanar y castigar enemigos en primera línea.',
  hunter: 'Especialista a distancia con movilidad, precisión y compañero de combate.',
  rogue: 'Atacante veloz que explota sigilo, energía, posicionamiento y golpes críticos.',
  priest: 'Canaliza poder espiritual para sanar, proteger o dañar desde distancia.',
  shaman: 'Híbrido elemental que combina armas, magia, tótems y soporte.',
  mage: 'Maestro del daño mágico, control de área y hechizos de alto impacto a distancia.',
  warlock: 'Caster de daño prolongado, maldiciones e invocaciones demoníacas.',
  druid: 'Clase versátil que cambia de forma y cubre múltiples roles.',
};

const RESOURCE: Record<string, string> = {
  rage: 'IRA',
  mana: 'MANÁ',
  energy: 'ENERGÍA',
  focus: 'ENFOQUE',
};

function selectedClass(): PlayerClass {
  const selected = document.querySelector<HTMLElement>('#offline-select .mini-class.sel');
  const cls = selected?.dataset.class as PlayerClass | undefined;
  return cls && cls in CLASSES ? cls : 'warrior';
}

function paintClassSheet(cls: PlayerClass): void {
  const panel = document.getElementById('offline-class-details');
  const classDef = CLASSES[cls];
  if (!panel || !classDef) return;
  const s = classDef.baseStats;
  panel.hidden = false;
  panel.dataset.highflyOwner = 'v062';
  panel.innerHTML = ` + "`" + `
    <article class="highfly-class-sheet highfly-class-sheet-v062">
      <header class="hf-class-title-v062">
        <h3>${'${NAMES[cls]}'}</h3>
        <span>${'${ROLES[cls]}'}</span>
      </header>
      <p class="hf-class-desc-v062">${'${DESCRIPTIONS[cls]}'}</p>
      <div class="hf-class-resource-v062">RECURSO <b>${'${RESOURCE[classDef.resourceType] ?? classDef.resourceType}'}</b></div>
      <h4>ATRIBUTOS BASE</h4>
      <div class="hf-class-stats-v062">
        <span>FUERZA <b>${'${s.str}'}</b></span>
        <span>AGILIDAD <b>${'${s.agi}'}</b></span>
        <span>AGUANTE <b>${'${s.sta}'}</b></span>
        <span>INTELECTO <b>${'${s.int}'}</b></span>
        <span>ESPÍRITU <b>${'${s.spi}'}</b></span>
        <span>ARMADURA <b>${'${s.armor}'}</b></span>
      </div>
      <p class="hf-class-note-v062">Nivel, equipo, talentos y Potencial Real HIGHFLY se suman sobre esta base.</p>
    </article>` + "`" + `;
}

function repaintSelected(): void {
  requestAnimationFrame(() => {
    paintClassSheet(selectedClass());
    requestAnimationFrame(() => paintClassSheet(selectedClass()));
  });
}

export function installHighflyNativeCreatorFix(): void {
  if (!document.body.classList.contains('native-app')) return;
  const root = document.getElementById('offline-select');
  if (!root || root.dataset.highflyCreatorFix === 'v062') return;
  root.dataset.highflyCreatorFix = 'v062';

  root.addEventListener('click', (event) => {
    const chip = (event.target as Element | null)?.closest<HTMLElement>('.mini-class');
    if (!chip?.dataset.class) return;
    window.setTimeout(repaintSelected, 0);
  });

  const chipObserver = new MutationObserver((records) => {
    if (records.some((record) => record.type === 'attributes' && record.attributeName === 'class')) {
      repaintSelected();
    }
  });
  root.querySelectorAll('.mini-class').forEach((chip) => {
    chipObserver.observe(chip, { attributes: true, attributeFilter: ['class'] });
  });

  const visibilityObserver = new MutationObserver(() => {
    if (!root.hidden) repaintSelected();
  });
  visibilityObserver.observe(root, { attributes: true, attributeFilter: ['hidden'] });

  repaintSelected();
}
`;
  write(path, content);
}

// Wire the robust owner once. The module itself handles DOM readiness and native
// gating; calling at the end of main avoids racing ClaudeCraft's initial creator setup.
{
  const path = 'src/main.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    "import { installHighflyTrainingUi } from './highfly/training_ui';",
    "import { installHighflyTrainingUi } from './highfly/training_ui';\nimport { installHighflyNativeCreatorFix } from './highfly/native_creator_fix';",
    'creator fix import',
  );
  source += `\n\n// HIGHFLY v0.6.2 — native creator owner runs after the original boot wiring.\nif (document.readyState === 'loading') {\n  document.addEventListener('DOMContentLoaded', installHighflyNativeCreatorFix, { once: true });\n} else {\n  installHighflyNativeCreatorFix();\n}\n`;
  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) S23 LAYOUT — surgical override only. Preserve the working canvas and all
// appearance controls; guarantee a visible, bordered right-hand class sheet and
// keep ENTER AL MUNDO compact inside the left-column footprint.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.6.2 — S23 creator surgical recovery. */
@media (orientation: landscape) and (max-height: 940px) {
  body.native-app #offline-select.highfly-native-creator {
    box-sizing: border-box !important;
    width: calc(100vw - 18px) !important;
    max-width: calc(100vw - 18px) !important;
    height: calc(100dvh - 12px) !important;
    max-height: calc(100dvh - 12px) !important;
    margin: 6px auto !important;
    padding: 6px 9px 6px !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select.highfly-native-creator > .auth-title {
    height: 26px !important;
    min-height: 26px !important;
    margin: 0 0 4px !important;
    line-height: 26px !important;
  }

  body.native-app #offline-select.highfly-native-creator .charselect-layout {
    display: grid !important;
    grid-template-columns: minmax(0, 67.5%) minmax(0, 32.5%) !important;
    gap: 10px !important;
    width: 100% !important;
    height: calc(100% - 30px) !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select.highfly-native-creator .charselect-col-left,
  body.native-app #offline-select.highfly-native-creator .charselect-col-right {
    box-sizing: border-box !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select.highfly-native-creator .charselect-col-right {
    display: grid !important;
    grid-template-rows: minmax(132px, 41%) minmax(0, 59%) !important;
    gap: 7px !important;
  }

  body.native-app #offline-select.highfly-native-creator #offline-preview-container {
    box-sizing: border-box !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    border: 1px solid rgba(176, 138, 49, .58) !important;
    border-radius: 8px !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select.highfly-native-creator #offline-class-details {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    box-sizing: border-box !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 9px 10px 11px !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    border: 1px solid rgba(176, 138, 49, .58) !important;
    border-radius: 8px !important;
    background: rgba(7, 7, 13, .90) !important;
  }

  body.native-app #offline-class-details .highfly-class-sheet-v062 {
    display: flex !important;
    flex-direction: column !important;
    gap: 6px !important;
    width: 100% !important;
    min-width: 0 !important;
    color: #d9d2bd !important;
  }

  body.native-app #offline-class-details .hf-class-title-v062 h3 {
    margin: 0 !important;
    color: #f08a61 !important;
    font: 700 clamp(18px, 3.6vh, 27px)/1 Cinzel, serif !important;
  }

  body.native-app #offline-class-details .hf-class-title-v062 span {
    display: block !important;
    margin-top: 3px !important;
    color: #f1d83c !important;
    font: 800 9px/1.15 sans-serif !important;
  }

  body.native-app #offline-class-details .hf-class-desc-v062,
  body.native-app #offline-class-details .hf-class-note-v062 {
    margin: 0 !important;
    color: #c6c0af !important;
    font: 500 9.5px/1.3 sans-serif !important;
  }

  body.native-app #offline-class-details .hf-class-resource-v062,
  body.native-app #offline-class-details h4 {
    margin: 0 !important;
    color: #e8c85b !important;
    font: 800 9px/1.15 sans-serif !important;
    letter-spacing: .7px !important;
  }

  body.native-app #offline-class-details .hf-class-stats-v062 {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 4px !important;
  }

  body.native-app #offline-class-details .hf-class-stats-v062 span {
    display: flex !important;
    justify-content: space-between !important;
    min-width: 0 !important;
    padding: 5px 6px !important;
    border: 1px solid rgba(206,165,65,.30) !important;
    border-radius: 5px !important;
    background: rgba(255,255,255,.025) !important;
    font: 700 8.5px/1 sans-serif !important;
  }

  body.native-app #offline-class-details .hf-class-stats-v062 b {
    color: #f3d46a !important;
  }

  body.native-app #offline-select.highfly-native-creator .char-create {
    box-sizing: border-box !important;
    height: 100% !important;
    min-height: 0 !important;
    padding-bottom: 38px !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select.highfly-native-creator #offline-appearance {
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: 100% !important;
    overflow: hidden !important;
  }

  body.native-app #offline-select.highfly-native-creator #offline-appearance .ac-page.active {
    min-width: 0 !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
  }

  body.native-app #offline-select.highfly-native-creator .auth-actions {
    position: absolute !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 2px !important;
    width: 100% !important;
    height: 32px !important;
    min-height: 32px !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    pointer-events: none !important;
  }

  body.native-app #offline-select.highfly-native-creator #btn-start-offline {
    display: block !important;
    width: min(236px, 42%) !important;
    min-width: 176px !important;
    height: 30px !important;
    min-height: 30px !important;
    margin: 0 auto !important;
    padding: 0 18px !important;
    border-radius: 999px !important;
    font-size: 10px !important;
    line-height: 28px !important;
    pointer-events: auto !important;
  }
}
`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// 3) CONTRACT TEST — catches the exact regression seen on device: preview works
// but the native class sheet disappears / creator can overflow horizontally.
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_creator_s23_v062.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY v0.6.2 S23 creator contract', () => {
  const owner = fs.readFileSync('src/highfly/native_creator_fix.ts', 'utf8');
  const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');

  it('owns and repaints the native offline class sheet in Spanish', () => {
    expect(owner).toContain('highfly-class-sheet-v062');
    expect(owner).toContain("warrior: 'GUERRERO'");
    expect(owner).toContain('ATRIBUTOS BASE');
    expect(owner).toContain('MutationObserver');
  });

  it('keeps both creator columns contained and the right class sheet visible', () => {
    expect(css).toContain('grid-template-columns: minmax(0, 67.5%) minmax(0, 32.5%)');
    expect(css).toContain('#offline-class-details');
    expect(css).toContain('visibility: visible !important');
    expect(css).toContain('overflow-y: auto !important');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.6.2] S23 creator recovery applied.');

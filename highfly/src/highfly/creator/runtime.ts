import { CharacterPreview } from '../../render/characters';
import type { PlayerClass } from '../../sim/types';
import type { HighflyClassId } from '../combat/action';

const CREATOR_DRAFT_KEY = 'highfly.creator.v1';

const CLASS_META: Readonly<Record<HighflyClassId, { label: string; role: string; weapon: string; armor: string }>> = {
  warrior: { label: 'Guerrero', role: 'Combatiente frontal · presión y barridos', weapon: 'Espadas, hachas, armas pesadas', armor: 'Malla / pesada' },
  paladin: { label: 'Paladín', role: 'Tanque híbrido · soporte y aguante', weapon: 'Arma + escudo / mandoble', armor: 'Pesada' },
  hunter: { label: 'Cazador', role: 'Daño a distancia · movilidad', weapon: 'Arco / armas de proyectil', armor: 'Cuero / malla' },
  rogue: { label: 'Pícaro', role: 'Asesino móvil · ráfaga corta', weapon: 'Dagas / espadas ligeras', armor: 'Cuero' },
  priest: { label: 'Sacerdote', role: 'Sanación · soporte · daño sagrado', weapon: 'Báculo / foco', armor: 'Tela' },
  shaman: { label: 'Chamán', role: 'Híbrido elemental · soporte', weapon: 'Maza / foco', armor: 'Malla / cuero' },
  mage: { label: 'Mago', role: 'Daño mágico · control de área', weapon: 'Báculo / foco', armor: 'Tela' },
  warlock: { label: 'Brujo', role: 'Daño oscuro · invocaciones', weapon: 'Báculo / foco', armor: 'Tela' },
  druid: { label: 'Druida', role: 'Híbrido adaptable · formas y naturaleza', weapon: 'Báculo / maza', armor: 'Cuero' },
};

const CLASS_IDS = Object.keys(CLASS_META) as HighflyClassId[];

function normalizedText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function classForButton(button: HTMLButtonElement): HighflyClassId | null {
  const explicit = button.dataset.class ?? button.dataset.cls;
  if (explicit && CLASS_IDS.includes(explicit as HighflyClassId)) return explicit as HighflyClassId;
  const text = normalizedText(button.textContent ?? '');
  return CLASS_IDS.find((id) => text.includes(normalizedText(CLASS_META[id].label))) ?? null;
}

function saveDraft(name: string, classId: HighflyClassId, subclassId: HighflyClassId | null): void {
  try {
    localStorage.setItem(CREATOR_DRAFT_KEY, JSON.stringify({ hunterName: name.trim(), classId, subclassId }));
  } catch {
    // Native storage can be unavailable during a transient WebView reset.
  }
}

export function readCreatorDraft(): { hunterName: string; classId: HighflyClassId; subclassId: HighflyClassId | null } | null {
  try {
    const raw = localStorage.getItem(CREATOR_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { hunterName?: unknown; classId?: unknown; subclassId?: unknown };
    if (!CLASS_IDS.includes(parsed.classId as HighflyClassId)) return null;
    return {
      hunterName: typeof parsed.hunterName === 'string' ? parsed.hunterName : '',
      classId: parsed.classId as HighflyClassId,
      subclassId: CLASS_IDS.includes(parsed.subclassId as HighflyClassId)
        ? (parsed.subclassId as HighflyClassId)
        : null,
    };
  } catch {
    return null;
  }
}

export function installHighflyCreatorShell(): void {
  if (typeof document === 'undefined') return;

  let attempts = 0;
  const mount = () => {
    const panel = document.getElementById('offline-select');
    const previewHost = document.getElementById('offline-preview-container');
    const nameInput = document.getElementById('char-name') as HTMLInputElement | null;
    if (!panel || !previewHost || !nameInput) {
      attempts += 1;
      if (attempts < 100) window.setTimeout(mount, 50);
      return;
    }
    if (panel.dataset.highflyCreatorMounted === '1') return;
    panel.dataset.highflyCreatorMounted = '1';
    panel.classList.add('highfly-creator');

    const buttons = Array.from(panel.querySelectorAll('button')).filter(
      (button): button is HTMLButtonElement => button instanceof HTMLButtonElement && classForButton(button) !== null,
    );
    let selectedClass: HighflyClassId =
      classForButton(buttons.find((button) => button.classList.contains('selected') || button.getAttribute('aria-pressed') === 'true') ?? buttons[0]) ??
      'warrior';

    const card = document.createElement('div');
    card.id = 'highfly-class-card';
    previewHost.insertAdjacentElement('afterend', card);

    const left = panel.querySelector('.charselect-col-left');
    const subclassWrap = document.createElement('label');
    subclassWrap.id = 'highfly-subclass-wrap';
    subclassWrap.innerHTML = '<span>SUBCLASE</span>';
    const subclass = document.createElement('select');
    subclass.id = 'highfly-subclass';
    subclassWrap.appendChild(subclass);
    left?.appendChild(subclassWrap);

    const refreshSubclass = () => {
      const previous = subclass.value as HighflyClassId | '';
      subclass.replaceChildren();
      const none = document.createElement('option');
      none.value = '';
      none.textContent = 'Elegir más adelante';
      subclass.appendChild(none);
      for (const id of CLASS_IDS) {
        if (id === selectedClass) continue;
        const option = document.createElement('option');
        option.value = id;
        option.textContent = CLASS_META[id].label;
        subclass.appendChild(option);
      }
      if (previous && previous !== selectedClass) subclass.value = previous;
    };

    const paintCard = () => {
      const meta = CLASS_META[selectedClass];
      card.innerHTML = `
        <strong>${meta.label.toUpperCase()}</strong>
        <span>${meta.role}</span>
        <small><b>ARMA:</b> ${meta.weapon}</small>
        <small><b>ARMADURA:</b> ${meta.armor}</small>
      `;
      refreshSubclass();
    };

    let preview: CharacterPreview | null = null;
    const canvas = document.createElement('canvas');
    canvas.id = 'highfly-creator-preview-canvas';
    previewHost.replaceChildren(canvas);
    try {
      preview = new CharacterPreview(previewHost, canvas, { constrainedMemory: false });
      preview.setClass(selectedClass as PlayerClass);
    } catch (error) {
      console.error('[HIGHFLY] creator preview failed', error);
      previewHost.dataset.previewError = '1';
    }

    const selectClass = (classId: HighflyClassId) => {
      selectedClass = classId;
      preview?.setClass(classId as PlayerClass);
      paintCard();
      buttons.forEach((button) => {
        const active = classForButton(button) === classId;
        button.classList.toggle('highfly-class-active', active);
      });
    };

    for (const button of buttons) {
      const classId = classForButton(button);
      if (!classId) continue;
      button.dataset.highflyClass = classId;
      button.addEventListener('click', () => window.setTimeout(() => selectClass(classId), 0));
    }

    const draft = readCreatorDraft();
    if (draft) {
      if (!nameInput.value.trim() && draft.hunterName) nameInput.value = draft.hunterName;
      selectedClass = draft.classId;
    }
    selectClass(selectedClass);
    if (draft?.subclassId && draft.subclassId !== selectedClass) subclass.value = draft.subclassId;

    const start = document.getElementById('btn-start-offline');
    start?.addEventListener(
      'click',
      () => saveDraft(nameInput.value || 'CAZADOR', selectedClass, (subclass.value || null) as HighflyClassId | null),
      { capture: true },
    );
    nameInput.addEventListener('input', () => saveDraft(nameInput.value, selectedClass, (subclass.value || null) as HighflyClassId | null));
    subclass.addEventListener('change', () => saveDraft(nameInput.value, selectedClass, (subclass.value || null) as HighflyClassId | null));
  };

  mount();
}

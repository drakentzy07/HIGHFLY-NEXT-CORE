import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.6.0] patched ${path}`);
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

function removeBalancedIfAfterMarker(source, marker, ifNeedle, label) {
  const markerAt = source.indexOf(marker);
  if (markerAt < 0) throw new Error(`Marker not found: ${label}`);
  const ifAt = source.indexOf(ifNeedle, markerAt);
  if (ifAt < 0) throw new Error(`If anchor not found: ${label}`);
  const openAt = source.indexOf('{', ifAt);
  if (openAt < 0) throw new Error(`Opening brace not found: ${label}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let endAt = -1;
  for (let i = openAt; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        endAt = i + 1;
        break;
      }
    }
  }
  if (endAt < 0) throw new Error(`Balanced block end not found: ${label}`);

  let removeStart = markerAt;
  while (removeStart > 0 && source[removeStart - 1] === ' ') removeStart -= 1;
  let removeEnd = endAt;
  while (removeEnd < source.length && (source[removeEnd] === '\n' || source[removeEnd] === '\r')) removeEnd += 1;
  return source.slice(0, removeStart) + source.slice(removeEnd);
}

fs.mkdirSync('src/highfly', { recursive: true });

// ---------------------------------------------------------------------------
// 1) HIGHFLY TRAINING CORE
// One validated workout per calendar day, character-bound progression, class
// affinity with fixed power budget, and REAL stat conversion into ClaudeCraft.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/training.ts';
  const content = `import type { Entity, PlayerClass } from '../sim/types';

export type HighflyTrainingStat = 'str' | 'agi' | 'vit' | 'per' | 'int';

export interface HighflyTrainingVector {
  str: number;
  agi: number;
  vit: number;
  per: number;
  int: number;
}

export interface HighflyTrainingSave {
  version: 1;
  trainingXp: number;
  pure: HighflyTrainingVector;
  adaptive: HighflyTrainingVector;
  validatedSessions: number;
  lastTrainingDay: string | null;
}

export interface HighflyTrainingProfile extends HighflyTrainingSave {}

export interface HighflyTrainingSession {
  /** Local YYYY-MM-DD in offline mode; server day replaces this online later. */
  dayKey: string;
  /** 0..120 quality/work score after volume, intensity, completion and progression. */
  score: number;
  /** Minutes of the validated session. HIGHFLY is not a one-minute spam reward. */
  durationMinutes: number;
  /** Set by the workout validator after prescribed recovery/rest rules pass. */
  recoveryOk: boolean;
  /** Relative physical/technical stimulus. It is normalized by the engine. */
  stimulus: HighflyTrainingVector;
  /** 0 = fully class-adaptive, 1 = pure stat identity. */
  purity: number;
}

export type HighflyTrainingRejectReason =
  | 'invalid_day'
  | 'already_trained_today_or_older_day'
  | 'recovery_not_met'
  | 'session_too_short'
  | 'invalid_score'
  | 'empty_stimulus';

export type HighflyTrainingApplyResult =
  | {
      ok: true;
      gainedXp: number;
      validatedSessions: number;
      trainingPowerBudget: number;
    }
  | { ok: false; reason: HighflyTrainingRejectReason };

export interface HighflyTrainingCombatBonus {
  str: number;
  agi: number;
  sta: number;
  int: number;
  hitRating: number;
  critRating: number;
  trainingPowerBudget: number;
}

const ZERO_VECTOR: HighflyTrainingVector = { str: 0, agi: 0, vit: 0, per: 0, int: 0 };
const STATS: readonly HighflyTrainingStat[] = ['str', 'agi', 'vit', 'per', 'int'];

// Long-term tuning target: a consistent hunter approaches, but never instantly
// reaches, ~18 equivalent primary-stat points. At roughly one solid session/day,
// six months is close to the asymptote while the first weeks still matter.
export const HIGHFLY_TRAINING_STAT_CAP = 18;
export const HIGHFLY_TRAINING_XP_TAU = 7000;
export const HIGHFLY_MIN_SESSION_MINUTES = 25;
export const HIGHFLY_MAX_SESSION_SCORE = 120;

// Affinity changes DISTRIBUTION only. Adaptive potential is re-normalized back to
// the same total budget, so no class can manufacture more Training Power merely
// because its affinity weights sum higher.
export const HIGHFLY_CLASS_AFFINITY: Readonly<Record<PlayerClass, HighflyTrainingVector>> = {
  warrior: { str: 1.4, agi: 0.85, vit: 1.25, per: 0.95, int: 0.55 },
  paladin: { str: 1.2, agi: 0.75, vit: 1.2, per: 0.95, int: 0.9 },
  hunter: { str: 0.7, agi: 1.4, vit: 1.0, per: 1.25, int: 0.65 },
  rogue: { str: 0.75, agi: 1.45, vit: 0.9, per: 1.3, int: 0.55 },
  priest: { str: 0.45, agi: 0.65, vit: 0.95, per: 1.2, int: 1.45 },
  shaman: { str: 1.0, agi: 0.9, vit: 1.1, per: 1.05, int: 1.1 },
  mage: { str: 0.4, agi: 0.7, vit: 0.9, per: 1.25, int: 1.5 },
  warlock: { str: 0.45, agi: 0.65, vit: 1.05, per: 1.15, int: 1.4 },
  druid: { str: 0.9, agi: 0.95, vit: 1.1, per: 1.05, int: 1.1 },
};

export function createHighflyTrainingProfile(): HighflyTrainingProfile {
  return {
    version: 1,
    trainingXp: 0,
    pure: { ...ZERO_VECTOR },
    adaptive: { ...ZERO_VECTOR },
    validatedSessions: 0,
    lastTrainingDay: null,
  };
}

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeVector(value: Partial<HighflyTrainingVector> | null | undefined): HighflyTrainingVector {
  return {
    str: finiteNonNegative(value?.str),
    agi: finiteNonNegative(value?.agi),
    vit: finiteNonNegative(value?.vit),
    per: finiteNonNegative(value?.per),
    int: finiteNonNegative(value?.int),
  };
}

export function normalizeHighflyTrainingProfile(
  value: Partial<HighflyTrainingSave> | null | undefined,
): HighflyTrainingProfile {
  if (!value) return createHighflyTrainingProfile();
  const last = typeof value.lastTrainingDay === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(value.lastTrainingDay)
    ? value.lastTrainingDay
    : null;
  return {
    version: 1,
    trainingXp: finiteNonNegative(value.trainingXp),
    pure: normalizeVector(value.pure),
    adaptive: normalizeVector(value.adaptive),
    validatedSessions: Math.max(0, Math.floor(finiteNonNegative(value.validatedSessions))),
    lastTrainingDay: last,
  };
}

export function serializeHighflyTrainingProfile(profile: HighflyTrainingProfile): HighflyTrainingSave {
  const p = normalizeHighflyTrainingProfile(profile);
  return {
    version: 1,
    trainingXp: p.trainingXp,
    pure: { ...p.pure },
    adaptive: { ...p.adaptive },
    validatedSessions: p.validatedSessions,
    lastTrainingDay: p.lastTrainingDay,
  };
}

function vectorSum(v: HighflyTrainingVector): number {
  return STATS.reduce((sum, key) => sum + v[key], 0);
}

function normalizedStimulus(v: HighflyTrainingVector): HighflyTrainingVector | null {
  const clean = normalizeVector(v);
  const total = vectorSum(clean);
  if (total <= 0) return null;
  return {
    str: clean.str / total,
    agi: clean.agi / total,
    vit: clean.vit / total,
    per: clean.per / total,
    int: clean.int / total,
  };
}

export function highflyTrainingPowerBudget(trainingXp: number): number {
  const xp = Math.max(0, Number.isFinite(trainingXp) ? trainingXp : 0);
  return HIGHFLY_TRAINING_STAT_CAP * (1 - Math.exp(-xp / HIGHFLY_TRAINING_XP_TAU));
}

export function applyHighflyTrainingSession(
  profile: HighflyTrainingProfile,
  session: HighflyTrainingSession,
): HighflyTrainingApplyResult {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(session.dayKey)) return { ok: false, reason: 'invalid_day' };
  if (profile.lastTrainingDay && session.dayKey <= profile.lastTrainingDay)
    return { ok: false, reason: 'already_trained_today_or_older_day' };
  if (!session.recoveryOk) return { ok: false, reason: 'recovery_not_met' };
  if (!Number.isFinite(session.durationMinutes) || session.durationMinutes < HIGHFLY_MIN_SESSION_MINUTES)
    return { ok: false, reason: 'session_too_short' };
  if (!Number.isFinite(session.score) || session.score <= 0)
    return { ok: false, reason: 'invalid_score' };

  const stimulus = normalizedStimulus(session.stimulus);
  if (!stimulus) return { ok: false, reason: 'empty_stimulus' };

  const gainedXp = Math.min(HIGHFLY_MAX_SESSION_SCORE, Math.max(1, session.score));
  const purity = Math.min(1, Math.max(0, Number.isFinite(session.purity) ? session.purity : 0));
  const pureXp = gainedXp * purity;
  const adaptiveXp = gainedXp - pureXp;

  for (const stat of STATS) {
    profile.pure[stat] += stimulus[stat] * pureXp;
    profile.adaptive[stat] += stimulus[stat] * adaptiveXp;
  }
  profile.trainingXp += gainedXp;
  profile.validatedSessions += 1;
  profile.lastTrainingDay = session.dayKey;

  return {
    ok: true,
    gainedXp,
    validatedSessions: profile.validatedSessions,
    trainingPowerBudget: highflyTrainingPowerBudget(profile.trainingXp),
  };
}

export function highflyEffectivePotential(
  profileInput: HighflyTrainingProfile | null | undefined,
  cls: PlayerClass,
): HighflyTrainingVector {
  const profile = normalizeHighflyTrainingProfile(profileInput);
  const pure = profile.pure;
  const adaptive = profile.adaptive;
  const adaptiveTotal = vectorSum(adaptive);
  const affinity = HIGHFLY_CLASS_AFFINITY[cls];

  const weighted: HighflyTrainingVector = {
    str: adaptive.str * affinity.str,
    agi: adaptive.agi * affinity.agi,
    vit: adaptive.vit * affinity.vit,
    per: adaptive.per * affinity.per,
    int: adaptive.int * affinity.int,
  };
  const weightedTotal = vectorSum(weighted);
  const adaptiveScale = adaptiveTotal > 0 && weightedTotal > 0 ? adaptiveTotal / weightedTotal : 0;
  const combined: HighflyTrainingVector = {
    str: pure.str + weighted.str * adaptiveScale,
    agi: pure.agi + weighted.agi * adaptiveScale,
    vit: pure.vit + weighted.vit * adaptiveScale,
    per: pure.per + weighted.per * adaptiveScale,
    int: pure.int + weighted.int * adaptiveScale,
  };
  const compositionTotal = vectorSum(combined);
  if (compositionTotal <= 0) return { ...ZERO_VECTOR };

  const budget = highflyTrainingPowerBudget(profile.trainingXp);
  const scale = budget / compositionTotal;
  return {
    str: combined.str * scale,
    agi: combined.agi * scale,
    vit: combined.vit * scale,
    per: combined.per * scale,
    int: combined.int * scale,
  };
}

export function highflyTrainingCombatBonus(
  profile: HighflyTrainingProfile | null | undefined,
  cls: PlayerClass,
): HighflyTrainingCombatBonus {
  const e = highflyEffectivePotential(profile, cls);
  return {
    str: e.str,
    agi: e.agi,
    sta: e.vit,
    int: e.int,
    // PER is intentionally NOT Spirit. It feeds the engine's unified hit/crit
    // rating surfaces, so it changes real miss/resist/crit outcomes.
    hitRating: e.per * 3.5,
    critRating: e.per * 1.0,
    trainingPowerBudget: highflyTrainingPowerBudget(profile?.trainingXp ?? 0),
  };
}

export type HighflyTrainingCarrier = Entity & { highflyTraining?: HighflyTrainingProfile };

export function attachHighflyTraining(entity: Entity, profile: HighflyTrainingProfile): void {
  (entity as HighflyTrainingCarrier).highflyTraining = profile;
}

export function highflyTrainingFromEntity(entity: Entity): HighflyTrainingProfile | undefined {
  return (entity as HighflyTrainingCarrier).highflyTraining;
}
`;
  write(path, content);
}

// ---------------------------------------------------------------------------
// 2) REAL COMBAT STAT INTEGRATION
// Training bonuses enter the same core stat pass as class/level/gear. No fake
// Power number: HP/AP/SP/hit/crit change because the existing engine sees them.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/entity.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    "import { BATTLE_STANCE, buildStanceAura } from './combat/warrior_stances';",
    "import { BATTLE_STANCE, buildStanceAura } from './combat/warrior_stances';\nimport { attachHighflyTraining, createHighflyTrainingProfile, highflyTrainingCombatBonus, highflyTrainingFromEntity } from '../highfly/training';",
    'entity training import',
  );

  source = replaceRequired(
    source,
    `  e.resourceType = def.resourceType;\n  e.color = def.color;`,
    `  e.resourceType = def.resourceType;\n  e.color = def.color;\n  // New hunter birth: training starts at zero. Loading an existing character\n  // replaces this mirror from PlayerMeta before the first stat recalculation.\n  attachHighflyTraining(e, createHighflyTrainingProfile());`,
    'new hunter training birth',
  );

  source = replaceRequired(
    source,
    `  const setCounts = new Map<string, number>();\n  let bonusSp = 0; // flat Spell Power from gear affixes + buff_spellpower auras\n  let bonusCritRating = 0;\n  let bonusHasteRating = 0;\n  let bonusHitRating = 0;`,
    `  const highflyTraining = highflyTrainingCombatBonus(highflyTrainingFromEntity(e), cls);\n  // Apply HIGHFLY before downstream AP/SP/HP/crit/hit derivations. These are\n  // therefore genuine combat stats and stack with class, level and equipment.\n  s.str += highflyTraining.str;\n  s.agi += highflyTraining.agi;\n  s.sta += highflyTraining.sta;\n  s.int += highflyTraining.int;\n\n  const setCounts = new Map<string, number>();\n  let bonusSp = 0; // flat Spell Power from gear affixes + buff_spellpower auras\n  let bonusCritRating = highflyTraining.critRating;\n  let bonusHasteRating = 0;\n  let bonusHitRating = highflyTraining.hitRating;`,
    'training into actual core stats',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) CHARACTER-BOUND PERSISTENCE + ONE-SESSION COMMAND SEAM
// PlayerMeta/CharacterState own the profile. Changing class keeps the same meta;
// creating a new character creates a fresh profile.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/sim.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    "import { DEFAULT_MOUNT, type MountKey } from './content/mounts';",
    `import {\n  applyHighflyTrainingSession,\n  attachHighflyTraining,\n  createHighflyTrainingProfile,\n  highflyEffectivePotential,\n  highflyTrainingCombatBonus,\n  normalizeHighflyTrainingProfile,\n  serializeHighflyTrainingProfile,\n  type HighflyTrainingApplyResult,\n  type HighflyTrainingProfile,\n  type HighflyTrainingSave,\n  type HighflyTrainingSession,\n} from '../highfly/training';\nimport { DEFAULT_MOUNT, type MountKey } from './content/mounts';`,
    'sim training imports',
  );

  source = replaceRequired(
    source,
    `  restedXp: number;\n  // Gathering profession proficiency`,
    `  restedXp: number;\n  // HIGHFLY Real Potential. Character-bound: class-change retains it, a new\n  // character starts from createHighflyTrainingProfile().\n  highflyTraining: HighflyTrainingProfile;\n  // Gathering profession proficiency`,
    'PlayerMeta training field',
  );

  source = replaceRequired(
    source,
    `  restedXp?: number;\n  // Lifetime played time`,
    `  restedXp?: number;\n  // HIGHFLY training is optional for backward compatibility with every save\n  // produced before v0.6.0. Missing means a new zero training profile.\n  highflyTraining?: HighflyTrainingSave;\n  // Lifetime played time`,
    'CharacterState training field',
  );

  source = replaceRequired(
    source,
    `      restedXp: 0,\n      gatheringProficiency: emptyGatheringProficiency(),`,
    `      restedXp: 0,\n      highflyTraining: createHighflyTrainingProfile(),\n      gatheringProficiency: emptyGatheringProficiency(),`,
    'PlayerMeta fresh training',
  );

  source = replaceRequired(
    source,
    `      meta.prestigeRank = s.prestigeRank ?? 0;\n      meta.restedXp = Math.max(0, s.restedXp ?? 0);`,
    `      meta.prestigeRank = s.prestigeRank ?? 0;\n      meta.restedXp = Math.max(0, s.restedXp ?? 0);\n      meta.highflyTraining = normalizeHighflyTrainingProfile(s.highflyTraining);\n      attachHighflyTraining(player, meta.highflyTraining);`,
    'restore persisted training',
  );

  source = replaceRequired(
    source,
    `    this.refreshKnownAbilities(meta, false);\n    recalcPlayerStats(player, cls, meta.equipment, meta.talentMods, meta.equipmentInstance);`,
    `    this.refreshKnownAbilities(meta, false);\n    // Mirror persisted character-bound training into the live entity before the\n    // normal stat pass. A future class-change simply calls the same stat pass\n    // with another cls and reinterprets the SAME profile.\n    attachHighflyTraining(player, meta.highflyTraining);\n    recalcPlayerStats(player, cls, meta.equipment, meta.talentMods, meta.equipmentInstance);`,
    'training mirror before initial recalc',
  );

  source = replaceRequired(
    source,
    `      restedXp: meta.restedXp,\n      // Fold this session's elapsed time`,
    `      restedXp: meta.restedXp,\n      highflyTraining: serializeHighflyTrainingProfile(meta.highflyTraining),\n      // Fold this session's elapsed time`,
    'serialize training profile',
  );

  source = replaceRequired(
    source,
    `  get restedXp(): number {\n    return this.primary.restedXp;\n  }\n  // IWorldProgressionXp.playtimeSeconds`,
    `  get restedXp(): number {\n    return this.primary.restedXp;\n  }\n\n  /** HIGHFLY character-bound training profile for the primary hunter. */\n  get highflyTrainingProfile(): HighflyTrainingProfile {\n    return this.primary.highflyTraining;\n  }\n\n  /**\n   * The only sim seam that can validate a real workout. One call can succeed per\n   * day; a second call that day is rejected by the training core. On success we\n   * immediately run ClaudeCraft's REAL stat recalculation.\n   */\n  highflyApplyTrainingSession(\n    session: HighflyTrainingSession,\n    pid = this.playerId,\n  ): HighflyTrainingApplyResult {\n    const meta = this.players.get(pid);\n    const e = this.entities.get(pid);\n    if (!meta || !e || e.kind !== 'player') return { ok: false, reason: 'invalid_day' };\n    const result = applyHighflyTrainingSession(meta.highflyTraining, session);\n    if (!result.ok) return result;\n    attachHighflyTraining(e, meta.highflyTraining);\n    recalcPlayerStats(e, meta.cls, meta.equipment, this.playerMods(meta), meta.equipmentInstance);\n    return result;\n  }\n\n  highflyTrainingView(pid = this.playerId) {\n    const meta = this.players.get(pid);\n    if (!meta) return null;\n    return {\n      profile: serializeHighflyTrainingProfile(meta.highflyTraining),\n      effective: highflyEffectivePotential(meta.highflyTraining, meta.cls),\n      combatBonus: highflyTrainingCombatBonus(meta.highflyTraining, meta.cls),\n    };\n  }\n\n  // IWorldProgressionXp.playtimeSeconds`,
    'Sim training seam',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) CREATOR RECOVERY
// v0.5.5 replaced the original rich class details with a compact native summary.
// Remove ONLY that replacement and preserve the proven native canvas/offline fixes.
// ---------------------------------------------------------------------------
{
  const path = 'src/main.ts';
  let source = read(path);
  source = removeBalancedIfAfterMarker(
    source,
    '  // HIGHFLY native creator uses a compact Spanish combat profile.',
    "  if (NATIVE_APP && panelId === 'offline-class-details') {",
    'remove compact creator summary',
  );
  write(path, source);
}

{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.6.0 — creator recovery: preserve CONTENT, fix only containment. */
@media (orientation: landscape) and (max-height: 820px) {
  body.native-app.mobile-touch #offline-select.highfly-native-creator:not([hidden]) {
    box-sizing: border-box !important;
    width: calc(100vw - 12px) !important;
    max-width: calc(100vw - 12px) !important;
    height: calc(100dvh - 8px) !important;
    max-height: calc(100dvh - 8px) !important;
    margin: 4px 6px !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-layout {
    box-sizing: border-box !important;
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
    grid-template-columns: minmax(0, 1.48fr) minmax(0, 0.82fr) !important;
    gap: 8px !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-left,
  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-right {
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: 100% !important;
    max-height: 100% !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .char-create {
    box-sizing: border-box !important;
    display: flex !important;
    flex-direction: column !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: 100% !important;
    padding-bottom: 0 !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .auth-actions {
    position: static !important;
    flex: 0 0 auto !important;
    width: 100% !important;
    min-height: 34px !important;
    margin: 4px 0 0 !important;
    padding: 0 !important;
    transform: none !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    overflow: visible !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-start-offline,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-start-offline:focus,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-start-offline:focus-visible {
    display: block !important;
    width: min(62%, 270px) !important;
    min-width: 170px !important;
    height: 32px !important;
    min-height: 32px !important;
    margin: 0 auto !important;
    padding: 0 20px !important;
    outline: none !important;
    border: 1px solid rgba(188, 146, 54, 0.82) !important;
    border-radius: 10px !important;
    background: linear-gradient(180deg, rgba(91, 66, 17, 0.98), rgba(38, 28, 10, 0.98)) !important;
    box-shadow: 0 3px 10px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,225,145,0.14) !important;
    color: #f7d56a !important;
    font-size: 11.5px !important;
    line-height: 30px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-right {
    display: grid !important;
    grid-template-rows: minmax(145px, 0.46fr) minmax(0, 0.54fr) !important;
    gap: 6px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .char-preview-container,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-preview-container {
    box-sizing: border-box !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: 100% !important;
    max-height: 100% !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-preview-container canvas {
    max-width: 100% !important;
    max-height: 100% !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-class-details,
  body.native-app.mobile-touch #offline-select.highfly-native-creator .class-details-panel {
    box-sizing: border-box !important;
    display: block !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: 100% !important;
    max-height: 100% !important;
    margin: 0 !important;
    padding: 7px 9px 9px !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .class-details-content {
    min-width: 0 !important;
    max-width: 100% !important;
  }
}
`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// 5) TRAINING INTEGRATION TESTS
// These tests fail the build if Training Power becomes cosmetic, duplicates in a
// day, leaks between births, or creates unequal adaptive budgets between classes.
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_training.test.ts';
  const content = `import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import type { PlayerClass } from '../src/sim/types';
import {
  applyHighflyTrainingSession,
  createHighflyTrainingProfile,
  highflyEffectivePotential,
  highflyTrainingPowerBudget,
  serializeHighflyTrainingProfile,
  type HighflyTrainingSession,
} from '../src/highfly/training';

const CLASSES: PlayerClass[] = [
  'warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid',
];

const HYBRID: HighflyTrainingSession = {
  dayKey: '2026-08-20',
  score: 100,
  durationMinutes: 75,
  recoveryOk: true,
  purity: 0.25,
  stimulus: { str: 0.3, agi: 0.24, vit: 0.2, per: 0.16, int: 0.1 },
};

function sum(v: { str: number; agi: number; vit: number; per: number; int: number }): number {
  return v.str + v.agi + v.vit + v.per + v.int;
}

describe('HIGHFLY training contract', () => {
  it('allows only one validated session per day', () => {
    const p = createHighflyTrainingProfile();
    expect(applyHighflyTrainingSession(p, HYBRID).ok).toBe(true);
    const second = applyHighflyTrainingSession(p, { ...HYBRID, score: 120 });
    expect(second).toEqual({ ok: false, reason: 'already_trained_today_or_older_day' });
    expect(p.validatedSessions).toBe(1);
  });

  it('a new hunter birth starts with zero training regardless of another hunter history', () => {
    const oldHunter = createHighflyTrainingProfile();
    applyHighflyTrainingSession(oldHunter, HYBRID);
    const newHunter = createHighflyTrainingProfile();
    expect(oldHunter.trainingXp).toBeGreaterThan(0);
    expect(newHunter.trainingXp).toBe(0);
    expect(newHunter.validatedSessions).toBe(0);
  });

  it('class reinterpretation never mutates or duplicates the saved training profile', () => {
    const p = createHighflyTrainingProfile();
    applyHighflyTrainingSession(p, HYBRID);
    const before = serializeHighflyTrainingProfile(p);
    const warrior = highflyEffectivePotential(p, 'warrior');
    const mage = highflyEffectivePotential(p, 'mage');
    const after = serializeHighflyTrainingProfile(p);
    expect(after).toEqual(before);
    expect(warrior.str).toBeGreaterThan(mage.str);
    expect(mage.int).toBeGreaterThan(warrior.int);
  });

  it('adaptive affinity changes distribution but preserves the exact same total budget for all 9 classes', () => {
    const p = createHighflyTrainingProfile();
    applyHighflyTrainingSession(p, { ...HYBRID, purity: 0 });
    const target = highflyTrainingPowerBudget(p.trainingXp);
    for (const cls of CLASSES) {
      expect(sum(highflyEffectivePotential(p, cls))).toBeCloseTo(target, 8);
    }
  });

  it('pure stat stimulus remains pure even after class change', () => {
    const p = createHighflyTrainingProfile();
    applyHighflyTrainingSession(p, {
      ...HYBRID,
      purity: 1,
      stimulus: { str: 1, agi: 0, vit: 0, per: 0, int: 0 },
    });
    const warrior = highflyEffectivePotential(p, 'warrior');
    const mage = highflyEffectivePotential(p, 'mage');
    expect(warrior.str).toBeCloseTo(mage.str, 8);
    expect(warrior.agi + warrior.vit + warrior.per + warrior.int).toBeCloseTo(0, 8);
    expect(mage.agi + mage.vit + mage.per + mage.int).toBeCloseTo(0, 8);
  });

  it('training changes real ClaudeCraft combat stats for every class', () => {
    for (const cls of CLASSES) {
      const sim = new Sim({ seed: 42, playerClass: cls, autoEquip: true });
      const before = {
        maxHp: sim.player.maxHp,
        ap: sim.player.attackPower,
        rp: sim.player.rangedPower,
        sp: sim.player.spellPower,
        hit: sim.player.hitRating,
      };
      const result = sim.highflyApplyTrainingSession(HYBRID);
      expect(result.ok).toBe(true);
      const after = sim.player;
      const beforeTotal = before.maxHp + before.ap + before.rp + before.sp + before.hit;
      const afterTotal = after.maxHp + after.attackPower + after.rangedPower + after.spellPower + after.hitRating;
      expect(afterTotal, cls).toBeGreaterThan(beforeTotal);
      expect(after.maxHp, cls).toBeGreaterThanOrEqual(before.maxHp);
    }
  });

  it('serialized character state contains the exact training profile', () => {
    const sim = new Sim({ seed: 7, playerClass: 'rogue', autoEquip: true });
    sim.highflyApplyTrainingSession(HYBRID);
    const state = sim.serializeCharacter();
    expect(state.highflyTraining).toEqual(serializeHighflyTrainingProfile(sim.highflyTrainingProfile));
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.6.0] big-pass foundation applied.');

import type { HighflyClassId } from '../combat/action';

export type HunterStats = { str: number; agi: number; vit: number; per: number; int: number };
export type HunterRank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS' | 'NACIONAL';

export type HighflyProfile = {
  hunterName: string;
  classId: HighflyClassId;
  subclassId: HighflyClassId | null;
  level: number;
  xp: number;
  rank: HunterRank;
  stats: HunterStats;
  processedEventIds: string[];
};

export type HighflyEvent =
  | { id: string; type: 'SET_COMPLETED'; payload: { reps: number; weightKg: number; exerciseId?: string } }
  | { id: string; type: 'SESSION_COMPLETED'; payload: { tonnageKg: number } }
  | { id: string; type: 'PR_ACHIEVED'; payload: { deltaKg: number } }
  | { id: string; type: 'HUNT_COMPLETED'; payload: { difficulty: number } }
  | { id: string; type: 'BOSS_DEFEATED'; payload: { difficulty: number } };

export function createHighflyProfile(): HighflyProfile {
  return {
    hunterName: 'CAZADOR',
    classId: 'warrior',
    subclassId: null,
    level: 1,
    xp: 0,
    rank: 'F',
    stats: { str: 0, agi: 0, vit: 0, per: 0, int: 0 },
    processedEventIds: [],
  };
}

export function normalizeHighflyProfile(value: unknown): HighflyProfile {
  const fallback = createHighflyProfile();
  if (!value || typeof value !== 'object') return fallback;
  const raw = value as Partial<HighflyProfile>;
  const classes: HighflyClassId[] = ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid'];
  const classId = classes.includes(raw.classId as HighflyClassId) ? (raw.classId as HighflyClassId) : fallback.classId;
  const subclassId = classes.includes(raw.subclassId as HighflyClassId) ? (raw.subclassId as HighflyClassId) : null;
  const stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : fallback.stats;
  return {
    hunterName: typeof raw.hunterName === 'string' && raw.hunterName.trim() ? raw.hunterName.trim() : fallback.hunterName,
    classId,
    subclassId,
    level: Math.min(100, Math.max(1, Number(raw.level) || 1)),
    xp: Math.max(0, Number(raw.xp) || 0),
    rank: typeof raw.rank === 'string' ? raw.rank as HunterRank : fallback.rank,
    stats: {
      str: Number(stats.str) || 0,
      agi: Number(stats.agi) || 0,
      vit: Number(stats.vit) || 0,
      per: Number(stats.per) || 0,
      int: Number(stats.int) || 0,
    },
    processedEventIds: Array.isArray(raw.processedEventIds)
      ? raw.processedEventIds.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

function levelForXp(xp: number): number {
  return Math.min(100, Math.max(1, 1 + Math.floor(xp / 1000)));
}

function rankForLevel(level: number): HunterRank {
  if (level >= 100) return 'NACIONAL';
  if (level >= 90) return 'SSS';
  if (level >= 80) return 'SS';
  if (level >= 70) return 'S';
  if (level >= 60) return 'A';
  if (level >= 50) return 'B';
  if (level >= 40) return 'C';
  if (level >= 30) return 'D';
  if (level >= 20) return 'E';
  return 'F';
}

function applySetStats(stats: HunterStats, exerciseId: string, reps: number): void {
  const id = exerciseId.toLowerCase();
  const power = /(hang.*clean|power.*clean|push.*press|salto|jump)/.test(id);
  const back = /(remo|row|jal[oó]n|pull|dominada|pendlay)/.test(id);
  const core = /(core|plancha|abdominal)/.test(id);

  if (power) {
    stats.agi += 0.12;
    stats.str += 0.06;
    return;
  }
  if (back) {
    stats.str += 0.08;
    stats.per += 0.06;
    return;
  }
  if (core) {
    stats.per += 0.06;
    stats.vit += 0.06;
    return;
  }
  if (reps <= 5) stats.str += 0.12;
  else if (reps <= 7) {
    stats.str += 0.07;
    stats.vit += 0.04;
  } else if (reps <= 12) stats.vit += 0.12;
  else {
    stats.vit += 0.08;
    stats.per += 0.03;
  }
}

export function applyHighflyEvent(profile: HighflyProfile, event: HighflyEvent): HighflyProfile {
  if (profile.processedEventIds.includes(event.id)) return profile;

  const next: HighflyProfile = {
    ...profile,
    stats: { ...profile.stats },
    processedEventIds: [...profile.processedEventIds, event.id],
  };

  if (event.type === 'SET_COMPLETED') {
    next.xp += Math.max(1, Math.round((event.payload.reps * Math.max(1, event.payload.weightKg)) / 20));
    applySetStats(next.stats, event.payload.exerciseId ?? '', event.payload.reps);
  } else if (event.type === 'SESSION_COMPLETED') {
    next.xp += Math.max(25, Math.round(event.payload.tonnageKg / 100));
  } else if (event.type === 'PR_ACHIEVED') {
    next.xp += 100 + Math.max(0, Math.round(event.payload.deltaKg * 5));
    next.stats.str += 0.5;
  } else if (event.type === 'HUNT_COMPLETED') {
    next.xp += 50 * Math.max(1, event.payload.difficulty);
    next.stats.per += 0.2;
  } else if (event.type === 'BOSS_DEFEATED') {
    next.xp += 150 * Math.max(1, event.payload.difficulty);
  }

  // Levels/ranks are consequences of XP only; they never mint stat points.
  next.level = levelForXp(next.xp);
  next.rank = rankForLevel(next.level);
  return next;
}

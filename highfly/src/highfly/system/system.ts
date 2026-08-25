export type HunterStats = { str: number; agi: number; vit: number; per: number; int: number };
export type HunterRank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS' | 'NACIONAL';

export type HighflyProfile = {
  level: number;
  xp: number;
  rank: HunterRank;
  stats: HunterStats;
  processedEventIds: string[];
};

export type HighflyEvent =
  | { id: string; type: 'SET_COMPLETED'; payload: { reps: number; weightKg: number } }
  | { id: string; type: 'SESSION_COMPLETED'; payload: { tonnageKg: number } }
  | { id: string; type: 'PR_ACHIEVED'; payload: { deltaKg: number } }
  | { id: string; type: 'HUNT_COMPLETED'; payload: { difficulty: number } }
  | { id: string; type: 'BOSS_DEFEATED'; payload: { difficulty: number } };

export function createHighflyProfile(): HighflyProfile {
  return {
    level: 1,
    xp: 0,
    rank: 'F',
    stats: { str: 0, agi: 0, vit: 0, per: 0, int: 0 },
    processedEventIds: [],
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

export function applyHighflyEvent(profile: HighflyProfile, event: HighflyEvent): HighflyProfile {
  if (profile.processedEventIds.includes(event.id)) return profile;

  const next: HighflyProfile = {
    ...profile,
    stats: { ...profile.stats },
    processedEventIds: [...profile.processedEventIds, event.id],
  };

  if (event.type === 'SET_COMPLETED') {
    next.xp += Math.max(1, Math.round(event.payload.reps * Math.max(1, event.payload.weightKg) / 20));
  } else if (event.type === 'SESSION_COMPLETED') {
    next.xp += Math.max(25, Math.round(event.payload.tonnageKg / 100));
    next.stats.vit += 1;
  } else if (event.type === 'PR_ACHIEVED') {
    next.xp += 100 + Math.max(0, Math.round(event.payload.deltaKg * 5));
    next.stats.str += 1;
  } else if (event.type === 'HUNT_COMPLETED') {
    next.xp += 50 * Math.max(1, event.payload.difficulty);
    next.stats.per += 1;
  } else if (event.type === 'BOSS_DEFEATED') {
    next.xp += 150 * Math.max(1, event.payload.difficulty);
  }

  next.level = levelForXp(next.xp);
  next.rank = rankForLevel(next.level);
  return next;
}

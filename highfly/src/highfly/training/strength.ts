export type SetPerformance = {
  exerciseId: string;
  weightKg: number;
  reps: number;
  completedAt: number;
  rpe?: number;
};

export type StrengthEvidence = {
  exerciseId: string;
  tested1RmKg?: number;
  estimated1RmKg?: number;
  bestSet?: SetPerformance;
};

export type SessionStrengthSummary = {
  tonnageKg: number;
  completedSets: number;
  estimated1RmByExercise: Record<string, number>;
};

export function epley1RmKg(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || weightKg < 0 || reps < 1) return 0;
  if (reps === 1) return weightKg;
  if (reps > 10) return 0;
  return weightKg * (1 + reps / 30);
}

export function summarizeStrengthSession(sets: readonly SetPerformance[]): SessionStrengthSummary {
  const estimated1RmByExercise: Record<string, number> = {};
  let tonnageKg = 0;
  for (const set of sets) {
    tonnageKg += set.weightKg * set.reps;
    const estimate = epley1RmKg(set.weightKg, set.reps);
    if (estimate > (estimated1RmByExercise[set.exerciseId] ?? 0)) {
      estimated1RmByExercise[set.exerciseId] = estimate;
    }
  }
  return { tonnageKg, completedSets: sets.length, estimated1RmByExercise };
}

export function bestStrengthEvidence(
  exerciseId: string,
  sets: readonly SetPerformance[],
  tested1RmKg?: number,
): StrengthEvidence {
  const candidates = sets.filter((s) => s.exerciseId === exerciseId && s.reps >= 1 && s.reps <= 10);
  let bestSet: SetPerformance | undefined;
  let estimated1RmKg = 0;
  for (const set of candidates) {
    const estimate = epley1RmKg(set.weightKg, set.reps);
    if (estimate > estimated1RmKg) {
      estimated1RmKg = estimate;
      bestSet = set;
    }
  }
  return {
    exerciseId,
    tested1RmKg,
    estimated1RmKg: estimated1RmKg || undefined,
    bestSet,
  };
}

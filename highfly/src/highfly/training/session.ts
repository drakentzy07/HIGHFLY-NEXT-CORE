import {
  bestStrengthEvidence,
  summarizeStrengthSession,
  type SessionStrengthSummary,
  type SetPerformance,
  type StrengthEvidence,
} from './strength';

export type TrainingSessionStatus = 'active' | 'completed';

export type HighflyTrainingSession = {
  id: string;
  startedAt: number;
  completedAt?: number;
  status: TrainingSessionStatus;
  sets: SetPerformance[];
  tested1RmByExercise: Record<string, number>;
};

export type TrainingSessionResult = {
  session: HighflyTrainingSession;
  summary: SessionStrengthSummary;
  evidenceByExercise: Record<string, StrengthEvidence>;
};

export function createTrainingSession(now = Date.now(), id = `training-${now}`): HighflyTrainingSession {
  return {
    id,
    startedAt: now,
    status: 'active',
    sets: [],
    tested1RmByExercise: {},
  };
}

export function registerTrainingSet(
  session: HighflyTrainingSession,
  input: Omit<SetPerformance, 'completedAt'> & { completedAt?: number },
): HighflyTrainingSession {
  if (session.status !== 'active') throw new Error('Training session is already completed');
  if (!input.exerciseId.trim()) throw new Error('exerciseId is required');
  if (!Number.isFinite(input.weightKg) || input.weightKg < 0) throw new Error('weightKg must be >= 0');
  if (!Number.isInteger(input.reps) || input.reps < 1) throw new Error('reps must be a positive integer');
  return {
    ...session,
    sets: [
      ...session.sets,
      {
        ...input,
        exerciseId: input.exerciseId.trim(),
        completedAt: input.completedAt ?? Date.now(),
      },
    ],
  };
}

export function recordTested1Rm(
  session: HighflyTrainingSession,
  exerciseId: string,
  tested1RmKg: number,
): HighflyTrainingSession {
  if (!exerciseId.trim()) throw new Error('exerciseId is required');
  if (!Number.isFinite(tested1RmKg) || tested1RmKg <= 0) throw new Error('tested1RmKg must be > 0');
  return {
    ...session,
    tested1RmByExercise: {
      ...session.tested1RmByExercise,
      [exerciseId.trim()]: tested1RmKg,
    },
  };
}

export function summarizeTrainingSession(session: HighflyTrainingSession): TrainingSessionResult {
  const summary = summarizeStrengthSession(session.sets);
  const ids = new Set<string>([
    ...session.sets.map((set) => set.exerciseId),
    ...Object.keys(session.tested1RmByExercise),
  ]);
  const evidenceByExercise: Record<string, StrengthEvidence> = {};
  for (const id of ids) {
    evidenceByExercise[id] = bestStrengthEvidence(
      id,
      session.sets,
      session.tested1RmByExercise[id],
    );
  }
  return { session, summary, evidenceByExercise };
}

export function completeTrainingSession(
  session: HighflyTrainingSession,
  completedAt = Date.now(),
): TrainingSessionResult {
  const completed: HighflyTrainingSession =
    session.status === 'completed'
      ? session
      : { ...session, status: 'completed', completedAt };
  return summarizeTrainingSession(completed);
}

export function serializeTrainingSession(session: HighflyTrainingSession): string {
  return JSON.stringify(session);
}

export function parseTrainingSession(raw: string | null): HighflyTrainingSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<HighflyTrainingSession>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') return null;
    if (parsed.status !== 'active' && parsed.status !== 'completed') return null;
    if (!Array.isArray(parsed.sets)) return null;
    return {
      id: parsed.id,
      startedAt: Number(parsed.startedAt) || Date.now(),
      completedAt: parsed.completedAt == null ? undefined : Number(parsed.completedAt),
      status: parsed.status,
      sets: parsed.sets.filter((set): set is SetPerformance => {
        if (!set || typeof set !== 'object') return false;
        const candidate = set as SetPerformance;
        return (
          typeof candidate.exerciseId === 'string' &&
          Number.isFinite(candidate.weightKg) &&
          Number.isInteger(candidate.reps) &&
          candidate.reps > 0 &&
          Number.isFinite(candidate.completedAt)
        );
      }),
      tested1RmByExercise:
        parsed.tested1RmByExercise && typeof parsed.tested1RmByExercise === 'object'
          ? { ...parsed.tested1RmByExercise }
          : {},
    };
  } catch {
    return null;
  }
}

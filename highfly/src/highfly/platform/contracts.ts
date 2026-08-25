import type {
  ActionDefinition,
  ActionRequest,
  CombatBody,
  HighflyClassId,
  Vec2,
} from '../combat/action';

export type HighflyEntityId = number | string;

export interface HighflyPlatformAdapter {
  now(): number;
  playerId(): HighflyEntityId;
  playerClass(): HighflyClassId;
  playerPosition(): Vec2;
  playerFacing(): Vec2;
  playerFocusId(): HighflyEntityId | null;
  bodyById(id: HighflyEntityId): CombatBody | undefined;
  hostileBodiesInRadius(origin: Vec2, radius: number): CombatBody[];
  hasLineOfSight(from: HighflyEntityId, to: HighflyEntityId): boolean;
  trySpendResource(amount: number): boolean;
  playerResource(): { current: number; max: number };
  applyActionHit(action: ActionDefinition, sourceId: HighflyEntityId, targetId: HighflyEntityId): void;
  persistProfile(serialized: string): Promise<void> | void;
  loadProfile(): Promise<string | null> | string | null;
}

export type HighflyActionPort = {
  execute(def: ActionDefinition, request?: Partial<ActionRequest>): HighflyEntityId[];
};

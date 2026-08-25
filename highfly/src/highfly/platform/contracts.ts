import type { ActionDefinition, ActionRequest, CombatBody, Vec2 } from '../combat/action';

export type HighflyEntityId = number | string;

export interface HighflyPlatformAdapter {
  now(): number;
  playerId(): HighflyEntityId;
  playerPosition(): Vec2;
  playerFacing(): Vec2;
  bodyById(id: HighflyEntityId): CombatBody | undefined;
  hostileBodiesInRadius(origin: Vec2, radius: number): CombatBody[];
  hasLineOfSight(from: HighflyEntityId, to: HighflyEntityId): boolean;
  applyActionHit(action: ActionDefinition, sourceId: HighflyEntityId, targetId: HighflyEntityId): void;
  persistProfile(serialized: string): Promise<void> | void;
  loadProfile(): Promise<string | null> | string | null;
}

export type HighflyActionPort = {
  execute(def: ActionDefinition, request: ActionRequest): HighflyEntityId[];
};

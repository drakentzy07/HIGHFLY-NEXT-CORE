import {
  basicActionForClass,
  resolveActionBodies,
  skillOneForClass,
  type ActionDefinition,
  type ActionRequest,
} from './action';
import type { HighflyEntityId, HighflyPlatformAdapter } from '../platform/contracts';

export type CastResult = {
  actionId: string;
  hitIds: HighflyEntityId[];
  spentResource: number;
  blockedBy: 'cooldown' | 'resource' | null;
};

export class HighflyCombatRuntime {
  private readonly nextReadyAt = new Map<string, number>();

  constructor(private readonly platform: HighflyPlatformAdapter) {}

  basic(): CastResult {
    return this.execute(basicActionForClass(this.platform.playerClass()));
  }

  skillOne(): CastResult {
    return this.execute(skillOneForClass(this.platform.playerClass()));
  }

  execute(def: ActionDefinition, requestOverride: Partial<ActionRequest> = {}): CastResult {
    const now = this.platform.now();
    const readyAt = this.nextReadyAt.get(def.id) ?? 0;
    if (now < readyAt) {
      return { actionId: def.id, hitIds: [], spentResource: 0, blockedBy: 'cooldown' };
    }

    const cost = Math.max(0, def.resourceCost ?? 0);
    if (!this.platform.trySpendResource(cost)) {
      return { actionId: def.id, hitIds: [], spentResource: 0, blockedBy: 'resource' };
    }

    const sourceId = this.platform.playerId();
    const origin = requestOverride.origin ?? this.platform.playerPosition();
    const direction = requestOverride.direction ?? this.platform.playerFacing();
    const focusId = requestOverride.focusId ?? this.platform.playerFocusId();
    const request: ActionRequest = { origin, direction, focusId };

    const candidates = this.platform
      .hostileBodiesInRadius(origin, Math.max(def.range, def.radius ?? 0))
      .filter((body) => this.platform.hasLineOfSight(sourceId, body.id));
    const bodies = resolveActionBodies(def, request, candidates);

    // One action/cast transaction. Geometry fans the already-paid cast out over
    // every intersected body; resource and cooldown are never paid per target.
    for (const body of bodies) this.platform.applyActionHit(def, sourceId, body.id);

    this.nextReadyAt.set(def.id, now + Math.max(0, def.cooldownMs ?? 0));
    return {
      actionId: def.id,
      hitIds: bodies.map((body) => body.id),
      spentResource: cost,
      blockedBy: null,
    };
  }

  remainingCooldownMs(actionId: string): number {
    return Math.max(0, (this.nextReadyAt.get(actionId) ?? 0) - this.platform.now());
  }
}

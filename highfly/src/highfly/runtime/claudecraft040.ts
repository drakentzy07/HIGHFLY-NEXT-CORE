import type { Sim } from '../../sim/sim';
import type { Entity } from '../../sim/types';
import type { ActionDefinition, CombatBody, HighflyClassId, Vec2 } from '../combat/action';
import type { HighflyEntityId, HighflyPlatformAdapter } from '../platform/contracts';

const PROFILE_KEY = 'highfly.profile.v1';

function numericId(id: HighflyEntityId): number | null {
  return typeof id === 'number' && Number.isFinite(id) ? id : null;
}

export class ClaudeCraft040Adapter implements HighflyPlatformAdapter {
  constructor(readonly sim: Sim) {}

  now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  playerId(): number {
    return this.sim.playerId;
  }

  playerClass(): HighflyClassId {
    return this.sim.cfg.playerClass as HighflyClassId;
  }

  playerPosition(): Vec2 {
    const { x, z } = this.sim.player.pos;
    return { x, z };
  }

  playerFacing(): Vec2 {
    const facing = this.sim.player.facing;
    return { x: Math.sin(facing), z: Math.cos(facing) };
  }

  playerFocusId(): number | null {
    return this.sim.player.targetId;
  }

  bodyById(id: HighflyEntityId): CombatBody | undefined {
    const key = numericId(id);
    if (key === null) return undefined;
    const entity = this.sim.entities.get(key);
    if (!entity) return undefined;
    return this.toBody(entity);
  }

  hostileBodiesInRadius(origin: Vec2, radius: number): CombatBody[] {
    const player = this.sim.player;
    const out: CombatBody[] = [];
    for (const entity of this.sim.entities.values()) {
      if (entity.id === player.id || entity.dead) continue;
      if (!this.sim.ctx.isHostileTo(player, entity)) continue;
      if (Math.hypot(entity.pos.x - origin.x, entity.pos.z - origin.z) > radius) continue;
      out.push(this.toBody(entity));
    }
    return out;
  }

  hasLineOfSight(from: HighflyEntityId, to: HighflyEntityId): boolean {
    const aId = numericId(from);
    const bId = numericId(to);
    if (aId === null || bId === null) return false;
    const a = this.sim.entities.get(aId);
    const b = this.sim.entities.get(bId);
    return !!a && !!b && this.sim.ctx.hasLineOfSight(a, b);
  }

  trySpendResource(amount: number): boolean {
    if (amount <= 0) return true;
    const player = this.sim.player;
    if (player.resource < amount) return false;
    player.resource = Math.max(0, player.resource - amount);
    return true;
  }

  playerResource(): { current: number; max: number } {
    return { current: this.sim.player.resource, max: this.sim.player.maxResource };
  }

  applyActionHit(
    action: ActionDefinition,
    sourceId: HighflyEntityId,
    targetId: HighflyEntityId,
  ): void {
    const sourceKey = numericId(sourceId);
    const targetKey = numericId(targetId);
    if (sourceKey === null || targetKey === null) return;
    const source = this.sim.entities.get(sourceKey);
    const target = this.sim.entities.get(targetKey);
    if (!source || !target || target.dead || !this.sim.ctx.isHostileTo(source, target)) return;

    // HIGHFLY owns action geometry and cast transaction. ClaudeCraft remains the
    // authoritative damage/death/quest engine underneath, so tutorial credit,
    // aggro, death and loot stay on one world state instead of a parallel sim.
    const level = Math.max(1, source.level || 1);
    const base = action.id.startsWith('basic_') ? 16 + level * 2 : 24 + level * 3;
    const amount = Math.max(1, Math.round(base * (action.damageScale ?? 1)));
    this.sim.dealDamage(
      source,
      target,
      amount,
      false,
      action.damageSchool ?? 'physical',
      action.label ?? action.id,
      'hit',
    );
  }

  persistProfile(serialized: string): void {
    try {
      globalThis.localStorage?.setItem(PROFILE_KEY, serialized);
    } catch {
      // Storage may be unavailable in headless tests. Runtime remains playable.
    }
  }

  loadProfile(): string | null {
    try {
      return globalThis.localStorage?.getItem(PROFILE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private toBody(entity: Entity): CombatBody {
    return {
      id: entity.id,
      pos: { x: entity.pos.x, z: entity.pos.z },
      alive: !entity.dead,
      hostile: this.sim.ctx.isHostileTo(this.sim.player, entity),
    };
  }
}

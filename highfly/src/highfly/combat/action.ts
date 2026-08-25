export type Vec2 = { x: number; z: number };

export type ActionShape = 'single' | 'cone' | 'circle' | 'corridor' | 'projectile';
export type TargetPolicy = 'optional-focus' | 'required' | 'none';
export type AimMode = 'facing' | 'input-vector' | 'point';

export type ActionDefinition = {
  id: string;
  shape: ActionShape;
  range: number;
  angleDeg?: number;
  width?: number;
  radius?: number;
  maxTargets: number;
  targetPolicy: TargetPolicy;
  aimMode: AimMode;
  piercing?: boolean;
};

export type CombatBody = {
  id: number | string;
  pos: Vec2;
  alive: boolean;
  hostile: boolean;
};

export type ActionRequest = {
  origin: Vec2;
  direction: Vec2;
  focusId?: number | string | null;
};

const EPS = 1e-6;

function normalized(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.z);
  if (len <= EPS) return { x: 0, z: 1 };
  return { x: v.x / len, z: v.z / len };
}

function relative(origin: Vec2, p: Vec2): Vec2 {
  return { x: p.x - origin.x, z: p.z - origin.z };
}

function distance(v: Vec2): number {
  return Math.hypot(v.x, v.z);
}

function inCone(def: ActionDefinition, request: ActionRequest, body: CombatBody): boolean {
  const rel = relative(request.origin, body.pos);
  const d = distance(rel);
  if (d > def.range || d <= EPS) return false;
  const dir = normalized(request.direction);
  const dot = (rel.x / d) * dir.x + (rel.z / d) * dir.z;
  const half = ((def.angleDeg ?? 90) * Math.PI) / 360;
  return dot >= Math.cos(half);
}

function inCorridor(def: ActionDefinition, request: ActionRequest, body: CombatBody): boolean {
  const rel = relative(request.origin, body.pos);
  const dir = normalized(request.direction);
  const forward = rel.x * dir.x + rel.z * dir.z;
  if (forward < 0 || forward > def.range) return false;
  const lateral = Math.abs(rel.x * -dir.z + rel.z * dir.x);
  return lateral <= (def.width ?? 1) / 2;
}

function inCircle(def: ActionDefinition, request: ActionRequest, body: CombatBody): boolean {
  return distance(relative(request.origin, body.pos)) <= (def.radius ?? def.range);
}

function inside(def: ActionDefinition, request: ActionRequest, body: CombatBody): boolean {
  if (!body.alive || !body.hostile) return false;
  if (def.shape === 'circle') return inCircle(def, request, body);
  if (def.shape === 'cone' || def.shape === 'single') return inCone(def, request, body);
  if (def.shape === 'corridor' || def.shape === 'projectile') return inCorridor(def, request, body);
  return false;
}

export function resolveActionBodies(
  def: ActionDefinition,
  request: ActionRequest,
  bodies: readonly CombatBody[],
): CombatBody[] {
  const valid = bodies
    .filter((b) => inside(def, request, b))
    .sort((a, b) => distance(relative(request.origin, a.pos)) - distance(relative(request.origin, b.pos)));

  const focus = request.focusId == null ? undefined : valid.find((b) => b.id === request.focusId);
  const ordered = focus ? [focus, ...valid.filter((b) => b.id !== focus.id)] : valid;

  if (def.shape === 'projectile' && !def.piercing) return ordered.slice(0, 1);
  return ordered.slice(0, Math.max(0, def.maxTargets));
}

export const HIGHFLY_BASIC_MELEE: ActionDefinition = {
  id: 'basic_melee',
  shape: 'single',
  range: 3.2,
  angleDeg: 58,
  maxTargets: 1,
  targetPolicy: 'optional-focus',
  aimMode: 'facing',
};

export const HIGHFLY_REAVER_STRIKE: ActionDefinition = {
  id: 'reaver_strike',
  shape: 'cone',
  range: 5,
  angleDeg: 100,
  maxTargets: 5,
  targetPolicy: 'optional-focus',
  aimMode: 'facing',
};

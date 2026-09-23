import fs from "node:fs";
import path from "node:path";

import * as DATA from "./src/sim/data.ts";
import { WORLD_SEED } from "./src/sim/world_seed.ts";
import {
  terrainHeight,
  waterLevelAt,
  generateDecorations,
  WATER_LEVEL,
} from "./src/sim/world.ts";
import { TUNNELS } from "./src/sim/content/tunnels.ts";
import { FARM_PATCHES } from "./src/sim/content/farm_patches.ts";
import * as PROFESSIONS from "./src/sim/content/professions.ts";
import * as FISHING from "./src/sim/professions/fishing_zones.ts";

const outRoot = path.resolve(process.argv[2] || "highfly-unity-export");
const terrainRoot = path.join(outRoot, "terrain");
fs.mkdirSync(terrainRoot, { recursive: true });

function serializable(value: any, seen = new WeakSet<object>()): any {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (Array.isArray(value)) return value.map((v) => serializable(v, seen));
  if (value instanceof Set) return [...value].map((v) => serializable(v, seen));
  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()].map(([k, v]) => [String(k), serializable(v, seen)]),
    );
  }
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const sv = serializable(v, seen);
      if (sv !== undefined) out[k] = sv;
    }
    seen.delete(value);
    return out;
  }
  return String(value);
}

function writeJson(name: string, value: unknown): void {
  const file = path.join(outRoot, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(serializable(value), null, 2));
}

const stripMinX = DATA.STRIP_MIN_X;
const stripMaxX = DATA.STRIP_MAX_X;
const zones = DATA.ZONES;
const world = DATA.BUILTIN_WORLD;

const meta = {
  schema: "highfly-claudecraft-unity-export-v1",
  source: {
    repository: "levy-street/world-of-claudecraft",
    ref: "v0.43.3",
    worldSeed: WORLD_SEED,
  },
  coordinatePolicy: {
    sourceAxes: "ClaudeCraft x/z horizontal plane; source comments define +x as WEST in newer zones.",
    exportAxes: "Raw ClaudeCraft coordinates are preserved in JSON.",
    recommendedUnityMapping: "unityX = -sourceX; unityY = sampledHeight; unityZ = sourceZ",
    note: "Mirror X consistently for positions, paths and yaw when a compass-correct Unity world is desired.",
  },
  worldBounds: {
    minX: DATA.WORLD_MIN_X,
    maxX: DATA.WORLD_MAX_X,
    minZ: DATA.WORLD_MIN_Z,
    maxZ: DATA.WORLD_MAX_Z,
    stripMinX,
    stripMaxX,
  },
  waterLevel: WATER_LEVEL,
  terrainSampleStep: 4,
  counts: {
    zones: zones.length,
    roads: DATA.ROADS.length,
    portals: DATA.PORTALS.length,
    camps: DATA.CAMPS.length,
    npcs: Object.keys(DATA.NPCS).length,
    mobs: Object.keys(DATA.MOBS).length,
    quests: Object.keys(DATA.QUESTS).length,
    items: Object.keys(DATA.ITEMS).length,
    gatherNodes: DATA.GATHER_NODES.length,
    dungeons: Object.keys(DATA.DUNGEONS).length,
    delves: Object.keys(DATA.DELVES).length,
    groundObjects: DATA.GROUND_OBJECTS.length,
    decorations: 0,
    farmPatches: FARM_PATCHES.length,
  },
};

writeJson("world-core.json", {
  meta,
  playerStart: DATA.PLAYER_START,
  zones: DATA.ZONES,
  roads: DATA.ROADS,
  portals: DATA.PORTALS,
  props: DATA.PROPS,
  services: world.services,
  blockers: world.blockers ?? [],
  terrainEdits: world.terrainEdits ?? [],
  tunnels: TUNNELS,
  farmPatches: FARM_PATCHES,
  professions: {
    gathering: (PROFESSIONS as any).GATHERING_PROFESSIONS ?? null,
    gatheringIds: (PROFESSIONS as any).GATHERING_PROFESSION_IDS ?? null,
    craftRing: (PROFESSIONS as any).CRAFT_RING ?? null,
    toolEffects: (PROFESSIONS as any).TOOL_EFFECTS ?? null,
    stations: (PROFESSIONS as any).STATIONS ?? (DATA as any).STATIONS ?? null,
  },
  fishing: {
    zoneRodTiers: (FISHING as any).FISHING_ZONE_ROD_TIERS ?? null,
    defaultRodTier: (FISHING as any).DEFAULT_FISHING_ROD_TIER ?? null,
  },
});

writeJson("entities.json", {
  mobs: DATA.MOBS,
  npcs: DATA.NPCS,
  camps: DATA.CAMPS,
  groundObjects: DATA.GROUND_OBJECTS,
  escorts: DATA.ESCORTS,
  gatherNodes: DATA.GATHER_NODES,
});

writeJson("gameplay.json", {
  classes: (DATA as any).CLASSES ?? null,
  abilities: (DATA as any).ABILITIES ?? null,
  items: DATA.ITEMS,
  quests: DATA.QUESTS,
  questOrder: (DATA as any).QUEST_ORDER ?? null,
  recipes: (DATA as any).ALL_RECIPES ?? null,
  dungeons: DATA.DUNGEONS,
  dungeonList: (DATA as any).DUNGEON_LIST ?? null,
  delves: DATA.DELVES,
  delveList: (DATA as any).DELVE_LIST ?? null,
  delveModules: (DATA as any).DELVE_MODULES ?? null,
});

const decorations = generateDecorations(WORLD_SEED);
meta.counts.decorations = decorations.length;
writeJson("decorations.json", decorations);

const step = meta.terrainSampleStep;
const terrainIndex: any[] = [];
const terrainPayloads: any[] = [];

for (const zone of zones) {
  const minX = zone.xMin ?? stripMinX;
  const maxX = zone.xMax ?? stripMaxX;
  const minZ = zone.zMin;
  const maxZ = zone.zMax;
  const width = Math.floor((maxX - minX) / step) + 1;
  const depth = Math.floor((maxZ - minZ) / step) + 1;
  const heights: number[] = new Array(width * depth);
  const waterMask: number[] = new Array(width * depth);
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  let p = 0;

  for (let iz = 0; iz < depth; iz++) {
    const z = Math.min(maxZ, minZ + iz * step);
    for (let ix = 0; ix < width; ix++) {
      const x = Math.min(maxX, minX + ix * step);
      const h = terrainHeight(x, z, WORLD_SEED);
      const wl = waterLevelAt(x, z, WORLD_SEED);
      heights[p] = Number(h.toFixed(4));
      waterMask[p] = Number.isFinite(wl) ? 1 : 0;
      if (h < minHeight) minHeight = h;
      if (h > maxHeight) maxHeight = h;
      p++;
    }
  }

  const zoneFile = "terrain/" + zone.id + ".json";
  const terrainPayload = {
    zoneId: zone.id,
    step,
    minX,
    maxX,
    minZ,
    maxZ,
    width,
    depth,
    minHeight: Number(minHeight.toFixed(4)),
    maxHeight: Number(maxHeight.toFixed(4)),
    heights,
    waterMask,
    lakes: zone.lakes ?? [],
  };
  writeJson(zoneFile, terrainPayload);
  terrainPayloads.push(terrainPayload);

  terrainIndex.push({
    zoneId: zone.id,
    file: zoneFile,
    step,
    minX,
    maxX,
    minZ,
    maxZ,
    width,
    depth,
    minHeight: Number(minHeight.toFixed(4)),
    maxHeight: Number(maxHeight.toFixed(4)),
  });
}

writeJson("terrain/index.json", terrainIndex);
writeJson("meta.json", meta);

function sourcePoint(value: any): { x: number; z: number } | null {
  if (!value || typeof value !== "object") return null;
  if (Number.isFinite(value.x) && Number.isFinite(value.z)) return { x: value.x, z: value.z };
  if (value.pos) return sourcePoint(value.pos);
  if (value.position) return sourcePoint(value.position);
  if (value.center) return sourcePoint(value.center);
  return null;
}

const unityZones = zones.map((zone: any) => ({
  id: zone.id,
  name: zone.name ?? zone.id,
  biome: zone.biome ?? "",
  xMin: zone.xMin ?? stripMinX,
  xMax: zone.xMax ?? stripMaxX,
  zMin: zone.zMin,
  zMax: zone.zMax,
  hub: sourcePoint(zone.hub),
  lakes: Array.isArray(zone.lakes)
    ? zone.lakes.map((lake: any) => ({
        x: lake.x,
        z: lake.z,
        radius: lake.radius,
      }))
    : [],
}));

const unityRoads = DATA.ROADS.map((points: any[], index: number) => ({
  id: "road_" + index,
  points: points.map((p: any) => ({ x: p.x, z: p.z })),
}));

const unityCamps = DATA.CAMPS.map((camp: any, index: number) => {
  const p = sourcePoint(camp) ?? { x: 0, z: 0 };
  return {
    id: camp.id ?? ("camp_" + index),
    mobId: camp.mobId ?? "",
    x: p.x,
    z: p.z,
    radius: camp.radius ?? 1,
    count: camp.count ?? 1,
  };
});

const unityGather = DATA.GATHER_NODES.map((node: any, index: number) => {
  const p = sourcePoint(node) ?? { x: 0, z: 0 };
  return {
    id: node.id ?? ("gather_" + index),
    type: node.type ?? "",
    zoneId: node.zoneId ?? "",
    tier: node.tier ?? 1,
    x: p.x,
    z: p.z,
  };
});

const unityPortals = DATA.PORTALS.map((portal: any, index: number) => {
  const p = sourcePoint(portal) ?? { x: 0, z: 0 };
  const target = sourcePoint(portal.target ?? portal.destination ?? portal.to ?? null);
  return {
    id: portal.id ?? ("portal_" + index),
    x: p.x,
    z: p.z,
    targetX: target?.x ?? p.x,
    targetZ: target?.z ?? p.z,
  };
});

const unityDecorations = decorations
  .map((d: any, index: number) => {
    const p = sourcePoint(d);
    if (!p) return null;
    return {
      id: d.id ?? ("decor_" + index),
      kind: d.kind ?? d.type ?? "decor",
      x: p.x,
      z: p.z,
      scale: d.scale ?? 1,
      rotation: d.rotation ?? d.rot ?? 0,
    };
  })
  .filter(Boolean);

const unityProps: any[] = [];
function pushUnityProp(category: string, item: any, index: number): void {
  if (Array.isArray(item)) {
    if (Number.isFinite(item[0]) && Number.isFinite(item[1])) {
      unityProps.push({
        id: category + "_" + index,
        category,
        kind: category,
        x: item[0],
        z: item[1],
        count: Number.isFinite(item[2]) ? item[2] : 1,
        scale: 1,
      });
    }
    return;
  }
  const p = sourcePoint(item);
  if (!p) return;
  unityProps.push({
    id: item.id ?? (category + "_" + index),
    category,
    kind: item.kind ?? item.type ?? category,
    assetId: item.assetId ?? "",
    key: item.key ?? "",
    x: p.x,
    z: p.z,
    x2: Number.isFinite(item.x2) ? item.x2 : p.x,
    z2: Number.isFinite(item.z2) ? item.z2 : p.z,
    rot: item.rot ?? item.rotation ?? item.dir ?? 0,
    scale: item.scale ?? 1,
    radius: item.r ?? item.radius ?? item.ringR ?? 0,
    width: item.w ?? item.width ?? item.hw ?? 0,
    depth: item.d ?? item.depth ?? item.hd ?? 0,
    height: item.height ?? item.h ?? item.standableTop ?? 0,
    count: item.columns ?? item.count ?? 1,
  });
}

for (const [category, value] of Object.entries(DATA.PROPS as any)) {
  if (Array.isArray(value)) {
    value.forEach((item: any, index: number) => pushUnityProp(category, item, index));
  } else if (category === "raceCourse" && value) {
    const rc: any = value;
    if (rc.arch) pushUnityProp("raceArch", rc.arch, 0);
    if (Array.isArray(rc.jumps)) {
      rc.jumps.forEach((item: any, index: number) => pushUnityProp("raceJump", item, index));
    }
  }
}

writeJson("unity-world-v01.json", {
  schema: "highfly-unity-world-v01",
  sourceRef: "v0.43.3",
  worldSeed: WORLD_SEED,
  waterLevel: WATER_LEVEL,
  playerStart: {
    x: DATA.PLAYER_START.x,
    z: DATA.PLAYER_START.z,
  },
  zones: unityZones,
  terrain: terrainPayloads,
  roads: unityRoads,
  camps: unityCamps,
  gatherNodes: unityGather,
  portals: unityPortals,
  decorations: unityDecorations,
  props: unityProps,
});

const readme = [
  "# HIGHFLY ClaudeCraft -> Unity Data Export",
  "",
  "Source: levy-street/world-of-claudecraft v0.43.3",
  "",
  "This package is generated by executing ClaudeCraft's own TypeScript content tables and terrain functions.",
  "It is not a regex/source-code scrape.",
  "",
  "Files:",
  "- meta.json: source/version/counts/coordinate policy",
  "- world-core.json: zones, roads, portals, props, services, terrain edits, tunnels, farms, professions",
  "- entities.json: mobs, NPCs, camps/spawns, world objects, escorts, gather nodes",
  "- gameplay.json: classes, abilities, items, quests, recipes, dungeons, delves",
  "- decorations.json: deterministic world decoration placements for WORLD_SEED",
  "- terrain/*.json: sampled terrain height + water mask for each authored zone",
  "",
  "Unity policy:",
  "1. Preserve raw source data.",
  "2. Mirror X only in the Unity importer if compass-correct orientation is desired.",
  "3. Create terrain/scenes and placeholder objects automatically first.",
  "4. Map ClaudeCraft asset IDs/visual definitions to imported GLB/FBX prefabs.",
  "5. Keep HIGHFLY/Lucid player and combat separate from donor world data.",
  "",
  "License:",
  "ClaudeCraft source is MIT. Media assets are individually licensed; CREDITS.md remains authoritative.",
].join("\n");

fs.writeFileSync(path.join(outRoot, "README_UNITY_EXPORT.md"), readme);

for (const f of ["LICENSE", "CREDITS.md", "THIRD_PARTY_NOTICES.md"]) {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(outRoot, f));
}

console.log(JSON.stringify(meta, null, 2));
console.log("Unity export written to " + outRoot);

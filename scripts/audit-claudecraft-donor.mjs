import fs from "node:fs";
import path from "node:path";

const gameRoot = path.resolve(process.argv[2] || "game");
const outRoot = path.resolve(process.argv[3] || "donor-audit");

if (!fs.existsSync(gameRoot)) {
  console.error("ClaudeCraft root not found: " + gameRoot);
  process.exit(2);
}

fs.mkdirSync(outRoot, { recursive: true });

const WORLD_KEYWORDS = [
  "zone","world","terrain","water","weather","town","village","road","bridge",
  "dungeon","delve","rift","raid","boss","mob","creature","animal","spawn","npc",
  "quest","loot","item","profession","gather","mining","logging","herb","fish",
  "fishing","farm","craft","resource","mount","pet","vendor","market"
];

const ASSET_EXTS = new Set([
  ".glb",".gltf",".fbx",".obj",".blend",".png",".jpg",".jpeg",".webp",".tga",
  ".hdr",".exr",".wav",".ogg",".mp3",".json",".bin",".ktx2"
]);

const donorRoots = [
  "src/sim",
  "src/world_api",
  "src/render",
  "src/guide",
  "scripts/assets",
  "public/models",
  "public/textures",
  "public/env",
  "public/vfx",
  "public/audio"
];

const licenseFiles = [
  "LICENSE",
  "CREDITS.md",
  "THIRD_PARTY_NOTICES.md",
  "README.md",
  "package.json"
];

function walk(abs, relBase = "") {
  const rows = [];
  if (!fs.existsSync(abs)) return rows;
  const st = fs.statSync(abs);
  if (st.isFile()) {
    rows.push({ path: relBase || path.basename(abs), size: st.size });
    return rows;
  }
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const childAbs = path.join(abs, entry.name);
    const childRel = relBase ? path.posix.join(relBase, entry.name) : entry.name;
    if (entry.isDirectory()) rows.push(...walk(childAbs, childRel));
    else {
      const s = fs.statSync(childAbs);
      rows.push({ path: childRel.replaceAll("\\", "/"), size: s.size });
    }
  }
  return rows;
}

function human(bytes) {
  const units = ["B","KB","MB","GB","TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return n.toFixed(i === 0 ? 0 : 2) + " " + units[i];
}

const allFiles = walk(gameRoot);
const byExt = new Map();
const byTop = new Map();
let totalBytes = 0;

for (const f of allFiles) {
  totalBytes += f.size;
  const ext = path.extname(f.path).toLowerCase() || "(none)";
  byExt.set(ext, (byExt.get(ext) || 0) + 1);
  const top = f.path.split("/")[0];
  const prev = byTop.get(top) || { files: 0, bytes: 0 };
  prev.files++;
  prev.bytes += f.size;
  byTop.set(top, prev);
}

const candidateSource = allFiles.filter(f => {
  const p = f.path.toLowerCase();
  return p.startsWith("src/sim/") ||
    p.startsWith("src/world_api") ||
    p.startsWith("src/render/") ||
    p.startsWith("scripts/assets/") ||
    WORLD_KEYWORDS.some(k => p.includes(k));
});

const candidateAssets = allFiles.filter(f => {
  const p = f.path.toLowerCase();
  return (p.startsWith("public/") || p.startsWith("src/")) &&
    ASSET_EXTS.has(path.extname(p).toLowerCase()) &&
    (p.includes("/models/") || p.includes("/textures/") || p.includes("/env/") ||
     p.includes("/vfx/") || WORLD_KEYWORDS.some(k => p.includes(k)));
});

const semantic = {};
for (const keyword of WORLD_KEYWORDS) {
  semantic[keyword] = candidateSource
    .filter(f => f.path.toLowerCase().includes(keyword))
    .map(f => f.path)
    .slice(0, 500);
}

const expected = [
  "src/sim/content",
  "src/sim",
  "src/world_api.ts",
  "src/world_api",
  "src/render",
  "src/guide/content.generated.ts",
  "scripts/assets",
  "public/models",
  "public/textures",
  "public/env",
  "public/vfx",
  "LICENSE",
  "CREDITS.md",
  "THIRD_PARTY_NOTICES.md"
].map(p => ({ path: p, exists: fs.existsSync(path.join(gameRoot, p)) }));

const manifest = {
  generatedAt: new Date().toISOString(),
  source: {
    repository: "levy-street/world-of-claudecraft",
    ref: "v0.43.3"
  },
  totals: {
    files: allFiles.length,
    bytes: totalBytes,
    humanSize: human(totalBytes),
    candidateSourceFiles: candidateSource.length,
    candidateAssetFiles: candidateAssets.length
  },
  expectedPaths: expected,
  donorRoots,
  extensions: [...byExt.entries()]
    .sort((a,b) => b[1] - a[1])
    .map(([extension,count]) => ({ extension, count })),
  topLevel: [...byTop.entries()]
    .map(([name,v]) => ({ name, files: v.files, bytes: v.bytes, humanSize: human(v.bytes) }))
    .sort((a,b) => b.bytes - a.bytes),
  semantic,
  candidateSource,
  candidateAssets
};

fs.writeFileSync(
  path.join(outRoot, "claudecraft-donor-manifest.json"),
  JSON.stringify(manifest, null, 2)
);

const md = [];
md.push("# HIGHFLY — ClaudeCraft Full Donor Audit");
md.push("");
md.push("Source: levy-street/world-of-claudecraft @ v0.43.3");
md.push("");
md.push("## Objective");
md.push("");
md.push("REUSE FIRST: preserve/import as much finished ClaudeCraft world content and simulation as possible before creating replacement HIGHFLY systems.");
md.push("");
md.push("## Repository snapshot");
md.push("");
md.push("- Files scanned: **" + allFiles.length + "**");
md.push("- Checked-out size: **" + human(totalBytes) + "**");
md.push("- World/system source candidates: **" + candidateSource.length + "**");
md.push("- Unity/media candidates: **" + candidateAssets.length + "**");
md.push("");
md.push("## Required donor paths");
md.push("");
for (const e of expected) md.push("- " + (e.exists ? "✅" : "❌") + " " + e.path);
md.push("");
md.push("## Top-level size");
md.push("");
md.push("| Path | Files | Size |");
md.push("|---|---:|---:|");
for (const e of manifest.topLevel.slice(0,20)) {
  md.push("| " + e.name + " | " + e.files + " | " + e.humanSize + " |");
}
md.push("");
md.push("## High-value world/system keyword coverage");
md.push("");
md.push("| Domain | Matching files |");
md.push("|---|---:|");
for (const k of WORLD_KEYWORDS) md.push("| " + k + " | " + semantic[k].length + " |");
md.push("");
md.push("## HIGHFLY import policy");
md.push("");
md.push("1. DIRECT COPY: models/textures/environment/VFX that are technically compatible and license-cleared.");
md.push("2. AUTOMATED CONVERSION: authored world/content records converted to Unity-readable manifests.");
md.push("3. BRIDGE: keep ClaudeCraft simulation logic running externally where that avoids rewriting mature systems.");
md.push("4. REIMPLEMENT: only when direct reuse/conversion/bridge is not viable.");
md.push("");
md.push("## License gate");
md.push("");
md.push("ClaudeCraft source code is MIT, but media assets have per-asset licenses. CREDITS.md is authoritative. This artifact is an internal donor/audit package; do not redistribute media in HIGHFLY until each reused asset is cleared.");
md.push("");
md.push("## Next Unity step");
md.push("");
md.push("Generate a Unity importer from claudecraft-donor-manifest.json, then map zones/spawns/gathering/dungeons into HIGHFLY ScriptableObjects/scenes while keeping Lucid/HIGHFLY player/combat isolated.");
md.push("");

fs.writeFileSync(path.join(outRoot, "DONOR_AUDIT.md"), md.join("\n"));

for (const f of licenseFiles) {
  const src = path.join(gameRoot, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(outRoot, f.replaceAll("/", "_")));
}

console.log(md.join("\n"));

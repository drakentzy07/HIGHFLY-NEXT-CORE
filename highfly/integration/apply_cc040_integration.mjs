import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, value) => fs.writeFileSync(path.join(root, rel), value, 'utf8');

const pkg = JSON.parse(read('package.json'));
if (pkg.version !== '0.40.0') {
  throw new Error(`HIGHFLY cc040 integration requires ClaudeCraft 0.40.0; got ${pkg.version}`);
}

// One explicit client seam: HIGHFLY receives the real offline Sim + Input objects.
// Domain behavior stays in src/highfly; this installer never injects gameplay math.
let main = read('src/main.ts');
const inputImport = "import { Input } from './game/input';";
const runtimeImport = "import { installHighflyCreatorShell, installHighflyOfflineRuntime } from './highfly/runtime/install';";
if (!main.includes(runtimeImport)) {
  if (!main.includes(inputImport)) throw new Error('HIGHFLY cc040: Input import seam not found');
  main = main.replace(inputImport, `${inputImport}\n${runtimeImport}`);
}
const mobileAnchor = '  const mobileControls = new MobileControls(input, {';
const runtimeMount = '  // HIGHFLY_RUNTIME_CC040: bind canonical HIGHFLY systems to the real offline Sim/Input.\n  installHighflyOfflineRuntime({ sim: offlineSim, input });\n\n';
if (!main.includes('HIGHFLY_RUNTIME_CC040')) {
  if (!main.includes(mobileAnchor)) throw new Error('HIGHFLY cc040: MobileControls seam not found');
  main = main.replace(mobileAnchor, `${runtimeMount}${mobileAnchor}`);
}
if (!main.includes('HIGHFLY_CREATOR_CC040')) {
  main += `\n// HIGHFLY_CREATOR_CC040: replace the inherited offline creator presentation with HIGHFLY.\ninstallHighflyCreatorShell();\n`;
}
write('src/main.ts', main);

// The inherited mobile Attack helper used to acquire/select nearest before attacking.
// HIGHFLY routes the fixed Attack button into its action runtime when installed; the
// fallback is still action-first and never mutates target selection.
const hotbarPath = 'src/ui/hud/action_bar/hotbar.ts';
let hotbar = read(hotbarPath);
const fnStart = hotbar.indexOf('export function handleMobileAttackTap(');
const nextFn = hotbar.indexOf('\nexport function parseHotbarActions(', fnStart);
if (fnStart < 0 || nextFn < 0) throw new Error('HIGHFLY cc040: mobile Attack helper seam not found');
const existing = hotbar.slice(fnStart, nextFn);
if (!existing.includes('HIGHFLY_ATTACK_RUNTIME')) {
  const replacement = `export function handleMobileAttackTap(\n  state: { autoAttack: boolean; hasLiveHostileTarget: boolean },\n  actions: { activateAttack: () => void; attackNearest: (() => void) | null },\n): void {\n  // HIGHFLY_ATTACK_RUNTIME: target is optional focus, never an input prerequisite.\n  const hook = (globalThis as typeof globalThis & { __HIGHFLY_ATTACK__?: () => void }).__HIGHFLY_ATTACK__;\n  if (hook) {\n    hook();\n    return;\n  }\n  void state;\n  void actions.attackNearest;\n  actions.activateAttack();\n}\n`;
  hotbar = hotbar.slice(0, fnStart) + replacement + hotbar.slice(nextFn);
}
write(hotbarPath, hotbar);

console.log('[HIGHFLY] ClaudeCraft 0.40 runtime integration installed');

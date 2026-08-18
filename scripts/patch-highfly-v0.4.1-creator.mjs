import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.4.1] patched ${path}`);
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// ---------------------------------------------------------------------------
// 1) The native build opens Offline directly. CharacterPreview used to decide
//    its target by whichever panel happened to be visible when assets finished.
//    On a fast APK asset load that race could bind the shared preview canvas to
//    the online container before the queued Offline transition ran, leaving the
//    Offline creator with a large empty frame. Native HIGHFLY always targets the
//    Offline preview explicitly; web/online behavior remains unchanged.
// ---------------------------------------------------------------------------
{
  const path = 'src/main.ts';
  let source = read(path);
  const before = `      const activePanelId = ['#charselect-panel', '#offline-select'].find((id) => {\n        const panel = $(id) as HTMLElement | null;\n        return panel !== null && !panel.hasAttribute('hidden');\n      });`;
  const after = `      const activePanelId =\n        NATIVE_APP && import.meta.env.VITE_HIGHFLY_OFFLINE === '1'\n          ? '#offline-select'\n          : ['#charselect-panel', '#offline-select'].find((id) => {\n              const panel = $(id) as HTMLElement | null;\n              return panel !== null && !panel.hasAttribute('hidden');\n            });`;
  source = replaceRequired(source, before, after, 'native offline CharacterPreview target');
  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) ClaudeCraft's cs-wow class intentionally turns the preview into a desktop
//    full-stage absolute layer. That is useful on desktop but fights the compact
//    S23 two-column creator. Give the native Offline creator its own layout hook.
// ---------------------------------------------------------------------------
{
  const path = 'index.html';
  let source = read(path);
  source = replaceRequired(
    source,
    '<div id="offline-select" class="panel auth-panel auth-panel-premium cs-wow" hidden>',
    '<div id="offline-select" class="panel auth-panel auth-panel-premium highfly-native-creator" hidden>',
    'offline creator native layout class',
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) S23 landscape fit. Keep every original class + appearance control, but use
//    compact class rows, a scrollable appearance body, a permanently reachable
//    Enter World action, and a real preview/details split on the right.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `\n\n/* HIGHFLY v0.4.1 — native creator fit + preview containment */\n@media (orientation: landscape) and (max-height: 940px) {\n  body.native-app #offline-select.highfly-native-creator:not([hidden]) {\n    display: flex !important;\n    flex-direction: column !important;\n    width: 100% !important;\n    height: 100% !important;\n    min-height: 0 !important;\n    max-height: none !important;\n    padding: 6px 8px !important;\n    overflow: hidden !important;\n    box-sizing: border-box !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator > .auth-title {\n    flex: 0 0 auto !important;\n    margin: 0 0 4px !important;\n    font-size: clamp(18px, 3.2vh, 24px) !important;\n    line-height: 1 !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator .charselect-layout {\n    flex: 1 1 auto !important;\n    display: grid !important;\n    grid-template-columns: minmax(0, 1.28fr) minmax(260px, 0.72fr) !important;\n    gap: 8px !important;\n    width: 100% !important;\n    height: auto !important;\n    min-height: 0 !important;\n    overflow: hidden !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator .charselect-col-left,\n  body.native-app #offline-select.highfly-native-creator .charselect-col-right {\n    position: relative !important;\n    inset: auto !important;\n    width: auto !important;\n    height: auto !important;\n    min-width: 0 !important;\n    min-height: 0 !important;\n    overflow: hidden !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator .char-create {\n    display: flex !important;\n    flex-direction: column !important;\n    gap: 3px !important;\n    width: 100% !important;\n    height: 100% !important;\n    min-width: 0 !important;\n    min-height: 0 !important;\n    overflow: hidden !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator .auth-label {\n    flex: 0 0 auto !important;\n    margin: 0 !important;\n    font-size: clamp(10px, 1.8vh, 13px) !important;\n    line-height: 1.1 !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator .char-input-group {\n    flex: 0 0 auto !important;\n    margin: 0 !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator #char-name {\n    width: 100% !important;\n    height: 36px !important;\n    min-height: 36px !important;\n    padding: 4px 10px !important;\n    font-size: clamp(14px, 2.2vh, 18px) !important;\n    box-sizing: border-box !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator #offline-error {\n    min-height: 0 !important;\n    margin: 0 !important;\n    font-size: 10px !important;\n    line-height: 1 !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator .mini-class-row {\n    flex: 0 0 auto !important;\n    display: grid !important;\n    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;\n    gap: 3px !important;\n    width: 100% !important;\n    margin: 1px 0 2px !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator .mini-class {\n    min-width: 0 !important;\n    height: 35px !important;\n    min-height: 35px !important;\n    padding: 2px 5px !important;\n    font-size: clamp(10px, 1.8vh, 13px) !important;\n    line-height: 1 !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator #offline-skin-row {\n    flex: 0 0 auto !important;\n    max-height: 54px !important;\n    min-height: 0 !important;\n    margin: 0 !important;\n    overflow-x: auto !important;\n    overflow-y: hidden !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator #offline-appearance {\n    flex: 1 1 auto !important;\n    display: flex !important;\n    flex-direction: column !important;\n    width: 100% !important;\n    min-width: 0 !important;\n    min-height: 0 !important;\n    max-height: none !important;\n    overflow: hidden !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator #offline-appearance .ac-tabs {\n    flex: 0 0 auto !important;\n    display: grid !important;\n    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;\n    gap: 2px !important;\n    width: 100% !important;\n    margin: 0 !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator #offline-appearance .ac-tab {\n    min-width: 0 !important;\n    min-height: 30px !important;\n    padding: 4px 2px !important;\n    font-size: clamp(9px, 1.55vh, 12px) !important;\n    white-space: nowrap !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator #offline-appearance .ac-pages {\n    flex: 1 1 auto !important;\n    min-height: 0 !important;\n    max-height: none !important;\n    padding-right: 2px !important;\n    overflow-x: hidden !important;\n    overflow-y: auto !important;\n    overscroll-behavior: contain !important;\n    -webkit-overflow-scrolling: touch !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator .auth-actions {\n    position: relative !important;\n    inset: auto !important;\n    flex: 0 0 auto !important;\n    display: flex !important;\n    gap: 6px !important;\n    width: 100% !important;\n    margin: 3px 0 0 !important;\n    padding: 0 !important;\n    background: none !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator #btn-start-offline {\n    width: 100% !important;\n    min-height: 38px !important;\n    height: 38px !important;\n    padding: 4px 10px !important;\n    font-size: clamp(11px, 1.8vh, 14px) !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator .charselect-col-right {\n    display: grid !important;\n    grid-template-rows: minmax(0, 1.35fr) minmax(0, 0.65fr) !important;\n    gap: 6px !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator #offline-preview-container {\n    position: relative !important;\n    inset: auto !important;\n    top: auto !important;\n    right: auto !important;\n    bottom: auto !important;\n    left: auto !important;\n    z-index: 1 !important;\n    order: 0 !important;\n    width: 100% !important;\n    height: 100% !important;\n    min-width: 0 !important;\n    min-height: 0 !important;\n    margin: 0 !important;\n    overflow: hidden !important;\n    box-sizing: border-box !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator #offline-preview-container canvas,\n  body.native-app #offline-select.highfly-native-creator #char-preview-canvas {\n    display: block !important;\n    width: 100% !important;\n    height: 100% !important;\n    max-width: none !important;\n    max-height: none !important;\n  }\n\n  body.native-app #offline-select.highfly-native-creator #offline-class-details {\n    position: relative !important;\n    inset: auto !important;\n    z-index: 1 !important;\n    order: 1 !important;\n    width: 100% !important;\n    height: 100% !important;\n    min-width: 0 !important;\n    min-height: 0 !important;\n    max-height: none !important;\n    margin: 0 !important;\n    padding: 6px 8px !important;\n    overflow-x: hidden !important;\n    overflow-y: auto !important;\n    box-sizing: border-box !important;\n  }\n}\n`;
  write(path, css);
}

console.log('[HIGHFLY v0.4.1] creator hotfix complete');

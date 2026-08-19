import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.4.2] patched ${path}`);
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// ---------------------------------------------------------------------------
// HIGHFLY v0.4.2 creator repair
//
// Two Android-only issues were reproduced from the S23 screenshots:
// 1) CharacterPreview receives the OFFLINE container but ClaudeCraft's one shared
//    canvas still lives inside the hidden ONLINE panel. The constructor does not
//    reparent it; setContainer() does. Move the canvas before construction.
// 2) The S23 landscape CSS viewport is much shorter than the physical screenshot
//    height because of devicePixelRatio. Previous 35-38 CSS-px controls were too
//    tall. Own the whole native offline viewport and use the compact dimensions
//    ClaudeCraft already uses for short landscape phones.
// ---------------------------------------------------------------------------

{
  const path = 'src/main.ts';
  let source = read(path);

  const panelBefore = `      const activePanelId = ['#charselect-panel', '#offline-select'].find((id) => {\n        const panel = $(id) as HTMLElement | null;\n        return panel !== null && !panel.hasAttribute('hidden');\n      });`;
  const panelAfter = `      const activePanelId =\n        NATIVE_APP && import.meta.env.VITE_HIGHFLY_OFFLINE === '1'\n          ? '#offline-select'\n          : ['#charselect-panel', '#offline-select'].find((id) => {\n              const panel = $(id) as HTMLElement | null;\n              return panel !== null && !panel.hasAttribute('hidden');\n            });`;
  source = replaceRequired(source, panelBefore, panelAfter, 'native offline CharacterPreview target');

  const previewBefore = `      const container = $(containerId);\n      const canvas = $('#char-preview-canvas') as HTMLCanvasElement | null;\n      if (container && canvas) {\n        characterPreview = new CharacterPreview(container, canvas, {`;
  const previewAfter = `      const container = $(containerId);\n      const canvas = $('#char-preview-canvas') as HTMLCanvasElement | null;\n      if (container && canvas) {\n        // CharacterPreview's constructor sizes from \"container\" but intentionally\n        // does not move the supplied canvas. Native HIGHFLY enters Offline before\n        // the normal online->offline setContainer transition, so reparent first.\n        if (\n          NATIVE_APP &&\n          import.meta.env.VITE_HIGHFLY_OFFLINE === '1' &&\n          canvas.parentElement !== container\n        ) {\n          container.appendChild(canvas);\n        }\n        characterPreview = new CharacterPreview(container, canvas, {`;
  source = replaceRequired(source, previewBefore, previewAfter, 'native preview canvas reparent');

  // Give the native viewport one layout frame before opening the creator. This
  // lets --app-vh / safe-area values settle before CharacterPreview measures it.
  source = replaceRequired(
    source,
    '    queueMicrotask(handleOfflineSelect);',
    '    requestAnimationFrame(() => handleOfflineSelect());',
    'native offline creator deferred entry',
  );

  write(path, source);
}

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

{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.4.2 — S23 landscape creator owns the native viewport. */
@media (orientation: landscape) {
  body.native-app.mobile-touch[data-start-panel="offline-select"] {
    width: 100vw !important;
    height: var(--app-vh, 100dvh) !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch[data-start-panel="offline-select"] #start-screen,
  body.native-app.mobile-touch[data-start-panel="offline-select"] #homepage-views-container,
  body.native-app.mobile-touch[data-start-panel="offline-select"] #hero-view {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: var(--app-vh, 100dvh) !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch[data-start-panel="offline-select"] #homepage-views-container {
    display: block !important;
    padding: max(2px, env(safe-area-inset-top)) max(4px, env(safe-area-inset-right))
      max(2px, env(safe-area-inset-bottom)) max(4px, env(safe-area-inset-left)) !important;
  }

  body.native-app.mobile-touch[data-start-panel="offline-select"] #hero-view {
    position: relative !important;
    display: flex !important;
    align-items: stretch !important;
    justify-content: stretch !important;
    gap: 0 !important;
    padding: 0 !important;
  }

  body.native-app.mobile-touch[data-start-panel="offline-select"] #title-logo,
  body.native-app.mobile-touch[data-start-panel="offline-select"] .homepage-header,
  body.native-app.mobile-touch[data-start-panel="offline-select"] .homepage-footer,
  body.native-app.mobile-touch[data-start-panel="offline-select"] .official-site-copy,
  body.native-app.mobile-touch[data-start-panel="offline-select"] #intro-logo {
    display: none !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator:not([hidden]) {
    position: relative !important;
    inset: auto !important;
    flex: 1 1 auto !important;
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 3px 5px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    border-radius: 8px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator > .auth-title {
    flex: 0 0 18px !important;
    height: 18px !important;
    margin: 0 0 2px !important;
    font-size: 14px !important;
    line-height: 18px !important;
    white-space: nowrap !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-layout {
    flex: 1 1 auto !important;
    display: grid !important;
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr) !important;
    gap: 5px !important;
    width: 100% !important;
    height: calc(100% - 20px) !important;
    min-width: 0 !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-left,
  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-right {
    position: relative !important;
    inset: auto !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .char-create {
    display: flex !important;
    flex-direction: column !important;
    gap: 2px !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .auth-label {
    flex: 0 0 11px !important;
    height: 11px !important;
    margin: 0 !important;
    font-size: 9px !important;
    line-height: 11px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .char-input-group {
    flex: 0 0 27px !important;
    height: 27px !important;
    min-height: 0 !important;
    margin: 0 !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #char-name {
    width: 100% !important;
    height: 27px !important;
    min-height: 27px !important;
    padding: 2px 7px !important;
    font-size: 12px !important;
    line-height: 19px !important;
    box-sizing: border-box !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-error {
    position: absolute !important;
    inset: auto 0 0 0 !important;
    min-height: 0 !important;
    margin: 0 !important;
    font-size: 8px !important;
    line-height: 9px !important;
    pointer-events: none !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .mini-class-row {
    flex: 0 0 70px !important;
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-rows: repeat(3, 22px) !important;
    gap: 2px !important;
    width: 100% !important;
    min-height: 0 !important;
    margin: 0 !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .mini-class {
    min-width: 0 !important;
    width: 100% !important;
    height: 22px !important;
    min-height: 22px !important;
    padding: 1px 4px !important;
    gap: 4px !important;
    font-size: 9px !important;
    line-height: 1 !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .mini-class-portrait {
    flex: 0 0 16px !important;
    width: 16px !important;
    height: 16px !important;
    border-radius: 3px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-skin-row {
    flex: 0 0 auto !important;
    min-height: 0 !important;
    max-height: 30px !important;
    margin: 0 !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance {
    flex: 1 1 auto !important;
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-height: none !important;
    margin: 0 !important;
    overflow: hidden !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-head {
    flex: 0 0 25px !important;
    min-height: 25px !important;
    margin: 0 !important;
    padding: 0 2px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-title {
    font-size: 11px !important;
    line-height: 25px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-tools {
    gap: 3px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-tool {
    min-height: 23px !important;
    height: 23px !important;
    padding: 2px 5px !important;
    font-size: 9px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-tool svg {
    width: 12px !important;
    height: 12px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-tabs {
    flex: 0 0 23px !important;
    display: grid !important;
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
    gap: 1px !important;
    width: 100% !important;
    height: 23px !important;
    margin: 0 !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-tab {
    min-width: 0 !important;
    width: 100% !important;
    height: 23px !important;
    min-height: 23px !important;
    padding: 2px 1px !important;
    font-size: 8.5px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-pages {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    max-height: none !important;
    padding: 2px !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
    -webkit-overflow-scrolling: touch !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .auth-actions {
    position: relative !important;
    inset: auto !important;
    flex: 0 0 28px !important;
    display: flex !important;
    width: 100% !important;
    height: 28px !important;
    min-height: 28px !important;
    margin: 2px 0 0 !important;
    padding: 0 !important;
    background: none !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-start-offline {
    width: 100% !important;
    height: 28px !important;
    min-height: 28px !important;
    padding: 2px 8px !important;
    font-size: 10px !important;
    line-height: 20px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator .charselect-col-right {
    display: grid !important;
    grid-template-rows: minmax(0, 0.72fr) minmax(68px, 0.28fr) !important;
    gap: 4px !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-preview-container {
    position: relative !important;
    inset: auto !important;
    z-index: 1 !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    margin: 0 !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-preview-container #char-preview-canvas,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #char-preview-canvas {
    display: block !important;
    width: 100% !important;
    height: 100% !important;
    max-width: none !important;
    max-height: none !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-class-details {
    position: relative !important;
    inset: auto !important;
    z-index: 1 !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 4px 6px !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    box-sizing: border-box !important;
    font-size: 9px !important;
    line-height: 1.15 !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-class-details h2 {
    margin: 0 0 2px !important;
    font-size: 14px !important;
    line-height: 1 !important;
  }

  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-class-details h3,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-class-details p {
    margin: 2px 0 !important;
  }
}
`;
  write(path, css);
}

// Build-time guards for the two regressions this hotfix addresses.
const patchedMain = read('src/main.ts');
if (!patchedMain.includes('container.appendChild(canvas);')) {
  throw new Error('HIGHFLY v0.4.2 preview canvas reparent missing');
}
const patchedCss = read('src/styles/highfly.native.css');
if (!patchedCss.includes('grid-template-rows: repeat(3, 22px)')) {
  throw new Error('HIGHFLY v0.4.2 compact S23 creator CSS missing');
}

console.log('[HIGHFLY] v0.4.2 creator viewport + preview repair complete');

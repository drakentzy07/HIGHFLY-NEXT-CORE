import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';

const HOST = '127.0.0.1';
const PORT = 4173;
const BASE = `http://${HOST}:${PORT}`;
const DIST_MODE = process.env.HIGHFLY_SMOKE_DIST === '1';
const MODE_LABEL = DIST_MODE ? 'dist' : 'source';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/`);
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`HIGHFLY ${MODE_LABEL} runtime smoke: server did not become ready`);
}

const viteArgs = DIST_MODE
  ? ['exec', 'vite', 'preview', '--host', HOST, '--port', String(PORT), '--strictPort']
  : ['exec', 'vite', '--host', HOST, '--port', String(PORT), '--strictPort'];
const server = spawn('pnpm', viteArgs, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    VITE_NATIVE_APP: '1',
    VITE_HIGHFLY_OFFLINE: '1',
    VITE_API_ORIGIN: 'http://127.0.0.1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (chunk) => process.stdout.write(`[vite:${MODE_LABEL}] ${chunk}`));
server.stderr.on('data', (chunk) => process.stderr.write(`[vite:${MODE_LABEL}] ${chunk}`));

let browser;
try {
  await waitForServer();
  browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=915,412',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 915, height: 412, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  await page.evaluateOnNewDocument(() => {
    window.__highflySmokeCaught = [];
    const capture = (level, original) => (...args) => {
      try {
        const text = args
          .map((arg) => {
            if (arg instanceof Error) return arg.stack || arg.message || String(arg);
            if (typeof arg === 'string') return arg;
            try { return JSON.stringify(arg); } catch { return String(arg); }
          })
          .join(' ');
        window.__highflySmokeCaught.push(`${level.toUpperCase()} ${text}`);
        if (window.__highflySmokeCaught.length > 120) window.__highflySmokeCaught.shift();
      } catch {}
      original(...args);
    };
    console.info = capture('info', console.info.bind(console));
    console.warn = capture('warn', console.warn.bind(console));
    console.error = capture('error', console.error.bind(console));
  });

  const diagnostics = [];
  page.on('pageerror', (error) => {
    const text = error.stack || error.message || String(error);
    diagnostics.push(`PAGEERROR\n${text}`);
    console.error(`[HIGHFLY ${MODE_LABEL.toUpperCase()} SMOKE PAGEERROR]`, text);
  });
  page.on('console', (message) => {
    const text = message.text();
    const bootDiagnostic = text.includes('[entry-diag]') || text.includes('[entry-guard]');
    if (message.type() !== 'error' && message.type() !== 'warning' && !bootDiagnostic) return;
    diagnostics.push(`CONSOLE ${message.type()} ${text}`);
    console.error(`[HIGHFLY ${MODE_LABEL.toUpperCase()} SMOKE ${message.type().toUpperCase()}]`, text);
  });

  await page.goto(`${BASE}/?gfx=low`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('#btn-offline', { timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('woc.cameraModePrompt.shown', '1');
    document.querySelector('#btn-offline')?.click();
  });

  await page.waitForSelector('#offline-select', { timeout: 30000 });
  await page.waitForSelector('[data-hf-creator-next]', { visible: true, timeout: 30000 });
  await page.evaluate(() => {
    const name = document.querySelector('#char-name');
    if (name) {
      name.value = 'HighflySmoke';
      name.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  const appearanceGeometry = await page.evaluate(() => {
    const root = document.getElementById('offline-select');
    const left = root?.querySelector('.charselect-col-left');
    const right = root?.querySelector('.charselect-col-right');
    const preview = root?.querySelector('#offline-preview-container');
    if (!left || !right || !preview) return null;
    const lr = left.getBoundingClientRect();
    const rr = right.getBoundingClientRect();
    const pr = preview.getBoundingClientRect();
    const ps = getComputedStyle(preview);
    const rs = getComputedStyle(right);
    return {
      step: root?.dataset.hfCreatorStep ?? null,
      leftWidth: lr.width,
      rightWidth: rr.width,
      rightHeight: rr.height,
      previewHeight: pr.height,
      previewTopCoord: pr.top,
      previewBottomCoord: pr.bottom,
      rightTopCoord: rr.top,
      rightBottomCoord: rr.bottom,
      previewPosition: ps.position,
      previewTop: ps.top,
      previewRight: ps.right,
      previewBottom: ps.bottom,
      previewLeft: ps.left,
      previewCssHeight: ps.height,
      previewMinHeight: ps.minHeight,
      previewMaxHeight: ps.maxHeight,
      previewInlineStyle: preview.getAttribute('style') ?? '',
      rightPosition: rs.position,
      rightDisplay: rs.display,
      rightCssHeight: rs.height,
      rightInlineStyle: right.getAttribute('style') ?? '',
      offsetParentId: preview.offsetParent?.id ?? null,
      offsetParentClass: preview.offsetParent?.className ?? null,
    };
  });
  console.log('[HIGHFLY CREATOR APPEARANCE GEOMETRY]', appearanceGeometry);
  if (!appearanceGeometry || appearanceGeometry.step !== 'appearance') {
    throw new Error(`HIGHFLY creator did not enter Appearance correctly: ${JSON.stringify(appearanceGeometry)}`);
  }
  if (Math.abs(appearanceGeometry.leftWidth - appearanceGeometry.rightWidth) > 12) {
    throw new Error(`HIGHFLY creator Appearance columns are not true 50/50: ${JSON.stringify(appearanceGeometry)}`);
  }
  if (appearanceGeometry.previewHeight < appearanceGeometry.rightHeight * 0.98) {
    throw new Error(`HIGHFLY creator preview does not fill the right half: ${JSON.stringify(appearanceGeometry)}`);
  }

  await page.evaluate(() => document.querySelector('[data-hf-creator-next]')?.click());
  await page.waitForFunction(
    () => document.getElementById('offline-select')?.dataset.hfCreatorStep === 'class',
    { timeout: 15000 },
  );
  await page.waitForSelector('#offline-select .mini-class[data-class="warrior"]', { visible: true, timeout: 15000 });
  await page.evaluate(() => document.querySelector('#offline-select .mini-class[data-class="warrior"]')?.click());
  await page.waitForSelector('#btn-start-offline', { visible: true, timeout: 15000 });

  await page.waitForFunction(
    () => {
      const root = document.getElementById('offline-select');
      const details = root?.querySelector('#offline-class-details');
      if (!root || root.dataset.hfCreatorStep !== 'class' || !details) return false;
      const visible = getComputedStyle(details).display !== 'none';
      const text = (details.textContent ?? '').trim();
      return visible && text.length > 20 && Boolean(details.querySelector(':is(.hf-class-desc, .hf-class-desc-v062)'));
    },
    { timeout: 10000 },
  ).catch(() => {});
  await sleep(250);

  const classGeometry = await page.evaluate(() => {
    const root = document.getElementById('offline-select');
    const left = root?.querySelector('.charselect-col-left');
    const right = root?.querySelector('.charselect-col-right');
    const details = root?.querySelector('#offline-class-details');
    const desc = root?.querySelector(':is(.hf-class-desc, .hf-class-desc-v062)');
    const preview = root?.querySelector('#offline-preview-container');
    const base = {
      ready: Boolean(left && right && details && desc && preview),
      step: root?.dataset.hfCreatorStep ?? null,
      hasLeft: Boolean(left),
      hasRight: Boolean(right),
      hasDetails: Boolean(details),
      hasDescription: Boolean(desc),
      hasPreview: Boolean(preview),
      selectedClass: root?.querySelector('.mini-class.sel')?.getAttribute('data-class') ?? null,
      detailsText: (details?.textContent ?? '').trim().slice(0, 700),
      detailsHtml: (details?.innerHTML ?? '').slice(0, 1400),
    };
    if (!left || !right || !details || !desc || !preview) return base;
    const lr = left.getBoundingClientRect();
    const rr = right.getBoundingClientRect();
    const dr = details.getBoundingClientRect();
    const xr = desc.getBoundingClientRect();
    const pr = preview.getBoundingClientRect();
    const rs = getComputedStyle(right);
    const ps = getComputedStyle(preview);
    const ds = getComputedStyle(details);
    return {
      ...base,
      leftWidth: lr.width,
      rightWidth: rr.width,
      rightHeight: rr.height,
      previewHeight: pr.height,
      previewBottom: pr.bottom,
      detailsTop: dr.top,
      detailsHeight: dr.height,
      detailsClientHeight: details.clientHeight,
      detailsScrollHeight: details.scrollHeight,
      descriptionBottom: xr.bottom,
      detailsBottom: dr.bottom,
      rightDisplay: rs.display,
      rightGridTemplateRows: rs.gridTemplateRows,
      rightGap: rs.gap,
      previewPosition: ps.position,
      previewCssHeight: ps.height,
      previewMinHeight: ps.minHeight,
      detailsPosition: ds.position,
      detailsCssHeight: ds.height,
      detailsMinHeight: ds.minHeight,
      detailsOverflow: ds.overflow,
      previewInlineStyle: preview.getAttribute('style') ?? '',
      detailsInlineStyle: details.getAttribute('style') ?? '',
      rightInlineStyle: right.getAttribute('style') ?? '',
    };
  });
  console.log('[HIGHFLY CREATOR CLASS GEOMETRY]', classGeometry);
  if (!classGeometry?.ready || classGeometry.step !== 'class') {
    throw new Error(`HIGHFLY creator Class sheet did not become ready: ${JSON.stringify(classGeometry)}`);
  }
  if (Math.abs(classGeometry.leftWidth - classGeometry.rightWidth) > 12) {
    throw new Error(`HIGHFLY creator Class columns are not true 50/50: ${JSON.stringify(classGeometry)}`);
  }
  if (classGeometry.previewHeight < 115 || classGeometry.detailsHeight < 150) {
    throw new Error(`HIGHFLY creator Class preview/details split is too small: ${JSON.stringify(classGeometry)}`);
  }
  if (classGeometry.detailsTop < classGeometry.previewBottom + 3) {
    throw new Error(`HIGHFLY creator Class preview overlaps the details sheet: ${JSON.stringify(classGeometry)}`);
  }
  if (classGeometry.descriptionBottom > classGeometry.detailsBottom + 2) {
    throw new Error(`HIGHFLY creator Class description is clipped: ${JSON.stringify(classGeometry)}`);
  }
  if (classGeometry.detailsScrollHeight > classGeometry.detailsClientHeight + 4) {
    throw new Error(`HIGHFLY creator Class sheet content still overflows/cuts stats: ${JSON.stringify(classGeometry)}`);
  }

  await page.evaluate(() => document.querySelector('#btn-start-offline')?.click());

  await page
    .waitForSelector('#mobile-preflight-continue', { visible: true, timeout: 5000 })
    .then(() => page.evaluate(() => document.querySelector('#mobile-preflight-continue')?.click()))
    .catch(() => {});

  // SwiftShader on GitHub's headless runner is dramatically slower than a real S23 GPU.
  // Keep __game.sim.player as the authoritative success condition, but give the renderer
  // enough time to finish assets -> prewarm -> first paint before declaring a boot failure.
  const outcome = await page
    .waitForFunction(
      () => {
        const fatal = document.querySelector('#fatal-overlay, .fatal-overlay');
        const fatalText = fatal && getComputedStyle(fatal).display !== 'none' ? (fatal.textContent ?? '').trim() : '';
        if (fatalText) return { kind: 'fatal', fatalText };
        if (window.__game?.sim?.player) return { kind: 'game', fatalText: '' };
        return false;
      },
      { timeout: 120000 },
    )
    .then((handle) => handle.jsonValue())
    .catch(() => null);

  await sleep(1200);
  const state = await page.evaluate(() => {
    const root = document.getElementById('offline-select');
    const fatal = document.querySelector('#fatal-overlay, .fatal-overlay');
    const probeRaw = localStorage.getItem('woc_entry_probe');
    let entryProbe = null;
    try {
      entryProbe = probeRaw ? JSON.parse(probeRaw) : null;
    } catch {
      entryProbe = { malformed: true, raw: probeRaw };
    }
    const loadingNodes = [...document.querySelectorAll('[id*="loading"], [class*="loading"]')]
      .map((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          id: el.id || null,
          className: typeof el.className === 'string' ? el.className : null,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 220),
        };
      })
      .filter((item) => item.width > 0 || item.height > 0 || item.text)
      .slice(0, 24);
    return {
      outcome: Boolean(window.__game?.sim?.player) ? 'game' : 'no-game',
      fatalText: fatal?.textContent?.trim() ?? '',
      selectedClass: root?.querySelector('.mini-class.sel')?.getAttribute('data-class') ?? null,
      creatorStep: root?.dataset.hfCreatorStep ?? null,
      playerClass: window.__game?.sim?.player?.templateId ?? null,
      bodyClass: document.body.className,
      url: location.href,
      entryProbe,
      entryProbeRaw: probeRaw,
      loadingNodes,
      captured: Array.isArray(window.__highflySmokeCaught) ? window.__highflySmokeCaught.slice(-80) : [],
    };
  });

  console.log(`[HIGHFLY ${MODE_LABEL.toUpperCase()} SMOKE STATE]`, JSON.stringify(state, null, 2));
  if (!outcome || outcome.kind !== 'game' || state.fatalText) {
    const checkpoint = state.entryProbe?.checkpoint ?? 'NO_CHECKPOINT';
    throw new Error(
      `HIGHFLY ${MODE_LABEL} native offline boot failed at checkpoint=${checkpoint}. Outcome=${JSON.stringify(outcome)} State=${JSON.stringify(state, null, 2)}\n${diagnostics.join('\n\n')}`,
    );
  }
  console.log(`[HIGHFLY ${MODE_LABEL.toUpperCase()} SMOKE] 50/50 Apariencia -> Clase -> world boot OK`);
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill('SIGTERM');
  await sleep(200);
  if (!server.killed) server.kill('SIGKILL');
}

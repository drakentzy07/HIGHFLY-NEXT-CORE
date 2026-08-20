import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';

const HOST = '127.0.0.1';
const PORT = 4173;
const BASE = `http://${HOST}:${PORT}`;
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
  throw new Error('HIGHFLY runtime smoke: Vite server did not become ready');
}

const server = spawn('pnpm', ['exec', 'vite', '--host', HOST, '--port', String(PORT), '--strictPort'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    VITE_NATIVE_APP: '1',
    VITE_HIGHFLY_OFFLINE: '1',
    VITE_API_ORIGIN: 'http://127.0.0.1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`));
server.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`));

let browser;
try {
  await waitForServer();
  browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--use-gl=swiftshader',
      '--disable-dev-shm-usage',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: 915,
    height: 412,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  // ClaudeCraft catches renderer boot exceptions and turns them into a fatal overlay.
  // Capture the Error object BEFORE that catch serializes it to a short user message.
  await page.evaluateOnNewDocument(() => {
    window.__highflySmokeCaught = [];
    const capture = (level, original) => (...args) => {
      try {
        const text = args
          .map((arg) => {
            if (arg instanceof Error) return arg.stack || arg.message || String(arg);
            if (typeof arg === 'string') return arg;
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          })
          .join(' ');
        window.__highflySmokeCaught.push(`${level.toUpperCase()} ${text}`);
      } catch {}
      original(...args);
    };
    console.warn = capture('warn', console.warn.bind(console));
    console.error = capture('error', console.error.bind(console));
  });

  const diagnostics = [];
  page.on('pageerror', (error) => {
    const text = error.stack || error.message || String(error);
    diagnostics.push(`PAGEERROR\n${text}`);
    console.error('[HIGHFLY SMOKE PAGEERROR]', text);
  });
  page.on('console', (message) => {
    if (message.type() !== 'error' && message.type() !== 'warning') return;
    const text = message.text();
    diagnostics.push(`CONSOLE ${message.type()} ${text}`);
    console.error(`[HIGHFLY SMOKE ${message.type().toUpperCase()}]`, text);
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

  // Exercise the actual HIGHFLY split creator, not ClaudeCraft's legacy shortcut.
  await page.evaluate(() => document.querySelector('[data-hf-creator-next]')?.click());
  await page.waitForSelector('#offline-select .mini-class[data-class="warrior"]', {
    visible: true,
    timeout: 15000,
  });
  await page.evaluate(() => document.querySelector('#offline-select .mini-class[data-class="warrior"]')?.click());
  await page.waitForSelector('#btn-start-offline', { visible: true, timeout: 15000 });
  await page.evaluate(() => document.querySelector('#btn-start-offline')?.click());

  await page
    .waitForSelector('#mobile-preflight-continue', { visible: true, timeout: 5000 })
    .then(() => page.evaluate(() => document.querySelector('#mobile-preflight-continue')?.click()))
    .catch(() => {});

  const outcome = await page
    .waitForFunction(
      () => {
        const fatal = document.querySelector('#fatal-overlay, .fatal-overlay');
        const fatalText =
          fatal && getComputedStyle(fatal).display !== 'none' ? (fatal.textContent ?? '').trim() : '';
        if (fatalText) return { kind: 'fatal', fatalText };
        if (window.__game?.sim?.player) return { kind: 'game', fatalText: '' };
        return false;
      },
      { timeout: 45000 },
    )
    .then((handle) => handle.jsonValue())
    .catch(() => null);

  await sleep(1200);
  const state = await page.evaluate(() => {
    const root = document.getElementById('offline-select');
    const fatal = document.querySelector('#fatal-overlay, .fatal-overlay');
    return {
      outcome: Boolean(window.__game?.sim?.player) ? 'game' : 'no-game',
      fatalText: fatal?.textContent?.trim() ?? '',
      selectedClass: root?.querySelector('.mini-class.sel')?.getAttribute('data-class') ?? null,
      creatorStep: root?.dataset.hfCreatorStep ?? null,
      playerClass: window.__game?.sim?.player?.templateId ?? null,
      bodyClass: document.body.className,
      url: location.href,
      captured: Array.isArray(window.__highflySmokeCaught)
        ? window.__highflySmokeCaught.slice(-20)
        : [],
    };
  });

  console.log('[HIGHFLY SMOKE STATE]', JSON.stringify(state, null, 2));
  if (!outcome || outcome.kind !== 'game' || state.fatalText) {
    throw new Error(
      `HIGHFLY native offline boot failed. Outcome=${JSON.stringify(outcome)} State=${JSON.stringify(state, null, 2)}\n${diagnostics.join('\n\n')}`,
    );
  }
  console.log('[HIGHFLY SMOKE] Apariencia -> Clase -> world boot OK');
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill('SIGTERM');
  await sleep(200);
  if (!server.killed) server.kill('SIGKILL');
}

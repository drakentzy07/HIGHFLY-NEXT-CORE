import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'game');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, value) => fs.writeFileSync(path.join(root, rel), value, 'utf8');

const pkg = JSON.parse(read('package.json'));
if (pkg.version !== '0.40.0') throw new Error(`Canonical HIGHFLY requires ClaudeCraft 0.40.0, got ${pkg.version}`);

const indexPath = 'index.html';
let html = read(indexPath);

// This is a product-shell boundary, not gameplay patching. The upstream DOM stays
// available to the engine adapter but is never visible in native HIGHFLY.
html = html
  .replace('<html lang="en">', '<html lang="es" class="highfly-native">')
  .replace(/<title[^>]*>[^<]*<\/title>/, '<title>HIGHFLY</title>')
  .replace(/<meta name="apple-mobile-web-app-title" content="[^"]*"\s*\/?>/, '<meta name="apple-mobile-web-app-title" content="HIGHFLY" />')
  .replace(/<script src="https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js" async defer><\/script>\s*/g, '')
  .replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/g, '')
  .replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/g, '')
  .replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]+>\s*/g, '');

if (!html.includes('data-highfly-canonical-style')) {
  html = html.replace(
    '</head>',
    '  <link data-highfly-canonical-style rel="stylesheet" href="/src/highfly/native/boot.css" />\n</head>',
  );
}

const bodyAnchor = '<body data-start-panel="mode-select">';
const nativeRoot = `${bodyAnchor}\n  <div id="highfly-native-root" aria-live="polite">\n    <div class="hf-boot-shell" data-highfly-screen="loading">\n      <div class="hf-brand"><strong>HIGHFLY</strong><span>NEXUS · OFFLINE</span></div>\n      <div class="hf-loading"><div class="hf-loading-core">\n        <div class="hf-loading-title">INICIALIZANDO HIGHFLY</div>\n        <div class="hf-loading-copy">Preparando el Sistema…</div>\n        <div class="hf-loading-bar" aria-hidden="true"></div>\n      </div></div>\n    </div>\n  </div>`;
if (!html.includes('id="highfly-native-root"')) {
  if (!html.includes(bodyAnchor)) throw new Error('Canonical HIGHFLY: index body anchor missing');
  html = html.replace(bodyAnchor, nativeRoot);
}

if (!html.includes('data-highfly-canonical-entry')) {
  html = html.replace(
    '</body>',
    '  <script data-highfly-canonical-entry type="module" src="/src/highfly/native/boot.ts"></script>\n</body>',
  );
}

write(indexPath, html);

// Native identity boundary. Java namespace remains an upstream engine detail;
// application identity and displayed product name belong to HIGHFLY.
const gradlePath = 'android/app/build.gradle';
let gradle = read(gradlePath);
const upstreamId = 'applicationId "com.worldofclaudecraft"';
const highflyId = 'applicationId "com.highfly.nexus"';
if (!gradle.includes(upstreamId) && !gradle.includes(highflyId)) {
  throw new Error('Canonical HIGHFLY: Android applicationId seam missing');
}
gradle = gradle.replace(upstreamId, highflyId);
write(gradlePath, gradle);

const stringsPath = 'android/app/src/main/res/values/strings.xml';
write(
  stringsPath,
  `<?xml version='1.0' encoding='utf-8'?>\n<resources>\n  <string name="app_name">HIGHFLY</string>\n  <string name="title_activity_main">HIGHFLY</string>\n  <string name="package_name">com.highfly.nexus</string>\n  <string name="custom_url_scheme">com.highfly.nexus</string>\n</resources>\n`,
);

console.log('[HIGHFLY canonical] Phase 0/1/creator boundary installed');

import fs from 'node:fs';
import path from 'node:path';

const gameRoot = path.resolve(process.argv[2] ?? 'game');
const indexPath = path.join(gameRoot, 'index.html');
const gradlePath = path.join(gameRoot, 'android/app/build.gradle');
const stringsPath = path.join(gameRoot, 'android/app/src/main/res/values/strings.xml');

let html = fs.readFileSync(indexPath, 'utf8');

// Native HIGHFLY is offline-first. Remove the only unconditional third-party
// boot script and remote font hints from the embedded launcher page.
html = html
  .replace(/<script src="https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js" async defer><\/script>\s*/g, '')
  .replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/g, '')
  .replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/g, '')
  .replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]+>\s*/g, '');

if (!html.includes('/highfly-native.css')) {
  html = html.replace('</head>', '<link rel="stylesheet" href="/highfly-native.css" />\n</head>');
}
if (!html.includes('/highfly-native-boot.js')) {
  html = html.replace('</body>', '<script defer src="/highfly-native-boot.js"></script>\n</body>');
}
fs.writeFileSync(indexPath, html);

// Keep the upstream Java namespace intact as an engine implementation detail,
// but give the installed Android app its own package identity so it cannot
// share ClaudeCraft app data or a previously downloaded ClaudeCraft OTA bundle.
let gradle = fs.readFileSync(gradlePath, 'utf8');
const upstreamApplicationId = 'applicationId "com.worldofclaudecraft"';
if (!gradle.includes(upstreamApplicationId) && !gradle.includes('applicationId "com.highfly.nexus"')) {
  throw new Error('ClaudeCraft 0.40 Android applicationId seam not found');
}
gradle = gradle.replace(upstreamApplicationId, 'applicationId "com.highfly.nexus"');
fs.writeFileSync(gradlePath, gradle);

fs.writeFileSync(
  stringsPath,
  `<?xml version='1.0' encoding='utf-8'?>\n<resources>\n    <string name="app_name">HIGHFLY</string>\n    <string name="title_activity_main">HIGHFLY</string>\n    <string name="package_name">com.highfly.nexus</string>\n    <string name="custom_url_scheme">com.highfly.nexus</string>\n</resources>\n`,
);

console.log('[HIGHFLY native] offline shell + Android identity installed');

import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY native shell contracts', () => {
  it('owns Capacitor identity and disables ClaudeCraft OTA', () => {
    const config = fs.readFileSync('capacitor.config.ts', 'utf8');
    expect(config).toContain("appId: 'com.highfly.nexus'");
    expect(config).toContain("appName: 'HIGHFLY'");
    expect(config).toContain('autoUpdate: false');
    expect(config).not.toContain('worldofclaudecraft.com/api/ota/updates');
  });

  it('enables production offline mode only through the HIGHFLY build contract', () => {
    const gate = fs.readFileSync('src/game/offline_mode_gate.ts', 'utf8');
    expect(gate).toContain('VITE_HIGHFLY_OFFLINE');
    expect(gate).toContain("=== '1'");
  });

  it('boots the native shell into the offline creator and hides online entry', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const boot = fs.readFileSync('public/highfly-native-boot.js', 'utf8');
    expect(html).toContain('/highfly-native.css');
    expect(html).toContain('/highfly-native-boot.js');
    expect(html).not.toContain('challenges.cloudflare.com/turnstile');
    expect(boot).toContain("getElementById('btn-offline')");
    expect(boot).toContain("setAttribute('data-highfly-mode', 'offline')");
    expect(boot).toContain('HIGHFLY');
  });

  it('uses an independent Android application id and visible HIGHFLY name', () => {
    const gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
    const strings = fs.readFileSync('android/app/src/main/res/values/strings.xml', 'utf8');
    expect(gradle).toContain('applicationId "com.highfly.nexus"');
    expect(strings).toContain('<string name="app_name">HIGHFLY</string>');
    expect(strings).not.toContain('World of ClaudeCraft');
  });
});

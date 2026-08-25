import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('HIGHFLY canonical Phase 0/1/2 boundary', () => {
  it('owns the native product shell before the upstream product can paint', () => {
    const html = read('index.html');
    const css = read('src/highfly/native/boot.css');
    expect(html).toContain('class="highfly-native"');
    expect(html).toContain('id="highfly-native-root"');
    expect(html).toContain('data-highfly-canonical-entry');
    expect(html).toContain('<title>HIGHFLY</title>');
    expect(css).toContain('html.highfly-native #start-screen');
    expect(css).toContain('display: none !important');
  });

  it('uses one owned creator surface with a real engine preview', () => {
    const boot = read('src/highfly/native/boot.ts');
    expect(boot).toContain("import { CharacterPreview } from '../../render/characters';");
    expect(boot).toContain("import { charactersReady } from '../../render/characters/assets';");
    expect(boot).toContain('id="hf-preview-canvas"');
    expect(boot).toContain("'warrior'");
    expect(boot).toContain("'paladin'");
    expect(boot).toContain("'hunter'");
    expect(boot).toContain("'rogue'");
    expect(boot).toContain("'priest'");
    expect(boot).toContain("'shaman'");
    expect(boot).toContain("'mage'");
    expect(boot).toContain("'warlock'");
    expect(boot).toContain("'druid'");
  });

  it('does not reintroduce the experimental overlay/monkey-patch architecture', () => {
    const boot = read('src/highfly/native/boot.ts');
    expect(boot).not.toContain('MutationObserver');
    expect(boot).not.toContain('__HIGHFLY_');
    expect(boot).not.toContain('readMoveInput =');
    expect(boot).not.toContain("replaceAll('ClaudeCraft'");
  });

  it('owns Android identity and disables upstream OTA', () => {
    const capacitor = read('capacitor.config.ts');
    const gradle = read('android/app/build.gradle');
    expect(capacitor).toContain("appId: 'com.highfly.nexus'");
    expect(capacitor).toContain('autoUpdate: false');
    expect(capacitor).not.toContain('worldofclaudecraft.com');
    expect(gradle).toContain('applicationId "com.highfly.nexus"');
  });
});

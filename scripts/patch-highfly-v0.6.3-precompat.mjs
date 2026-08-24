import fs from 'node:fs';

const path = 'src/ui/hud.ts';
let source = fs.readFileSync(path, 'utf8');

const alreadyClearsWorldGuide = `  private highflyHideSkillStick(): void {\n    this.highflySkillStick?.classList.remove('active', 'has-target');\n    if (this.highflyDirectionalGuideState?.kind === 'skill') this.highflyDirectionalGuideState = null;\n  }`;

const baseHideMethod = `  private highflyHideSkillStick(): void {\n    this.highflySkillStick?.classList.remove('active', 'has-target');\n  }`;

if (source.includes(alreadyClearsWorldGuide)) {
  // v0.5.5 already installed the world-guide cleanup. v0.6.3 owns the final
  // version of this method, so normalize it to the anchor v0.6.3 expects and
  // let that patch add the cleanup back exactly once.
  source = source.replace(alreadyClearsWorldGuide, baseHideMethod);
  fs.writeFileSync(path, source, 'utf8');
  console.log('[HIGHFLY v0.6.3 precompat] normalized duplicate world skill telegraph cleanup');
} else if (source.includes(baseHideMethod)) {
  console.log('[HIGHFLY v0.6.3 precompat] HUD aim hide anchor already normalized');
} else {
  throw new Error('HIGHFLY v0.6.3 precompat: highflyHideSkillStick anchor not found');
}

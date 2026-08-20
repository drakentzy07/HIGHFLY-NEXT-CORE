import fs from 'node:fs';

function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.6.3 contracts] wrote ${path}`);
}

// v0.6.1's targeting test described the old screen-space DOM telegraph. v0.6.3
// deliberately moved the visible intent into the renderer/world floor, so keep
// the CI contract aligned with the final architecture instead of testing a
// superseded implementation detail.
write('tests/highfly_mobile_aim_contract.test.ts', `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY mobile targeting contract', () => {
  const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
  const visual = fs.readFileSync('src/render/highfly_directional_aim_visual.ts', 'utf8');
  const renderer = fs.readFileSync('src/render/renderer.ts', 'utf8');

  it('supports tap assist plus hold-drag-release manual targeting', () => {
    expect(hud).toContain('highflyMobileAimDef');
    expect(hud).toContain('pointermove');
    expect(hud).toContain('highflyScreenAimFacing');
    expect(hud).toContain('highflyManualCommit');
    expect(hud).toContain('this.highflyPaintSkillStick(slot, 0, -48');
  });

  it('renders line, dash, cone and circle as player-origin world telegraphs', () => {
    expect(visual).toContain("'line' | 'dash' | 'cone' | 'circle'");
    expect(visual).toContain('rangeRing');
    expect(hud).toContain('x: this.sim.player.pos.x');
    expect(hud).toContain('z: this.sim.player.pos.z');
    expect(hud).toContain('shape: profile.shape');
    expect(renderer).toContain('setHighflyDirectionalAim');
  });

  it('casts dragged ground skills at a world point and keeps manual aim authoritative', () => {
    expect(hud).toContain('this.sim.castAbilityAt(resolved.def.id, aim)');
    expect(hud).toContain('this.highflyManualCommit = true');
    expect(hud).toContain('this.highflyManualCommit = false');
  });
});
`);

write('tests/highfly_v063_mobile_polish.test.ts', `import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('HIGHFLY v0.6.3 mobile polish contracts', () => {
  it('uses the Discord HUD slot for Training and derives work from the logger', () => {
    const ui = fs.readFileSync('src/highfly/training_ui.ts', 'utf8');
    expect(ui).toContain("document.getElementById('mm-discord')");
    expect(ui).toContain("document.getElementById('mobile-discord')");
    expect(ui).toContain('1RM');
    expect(ui).toContain('SERIES');
    expect(ui).toContain('REPES');
    expect(ui).toContain('restEndsAt');
    expect(ui).toContain('compileSession');
    expect(ui).not.toContain('data-hf-score');
    expect(ui).not.toContain('data-hf-duration');
  });

  it('shows a player-origin MOBA telegraph on hold and supports all four shapes', () => {
    const visual = fs.readFileSync('src/render/highfly_directional_aim_visual.ts', 'utf8');
    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
    expect(visual).toContain("'line' | 'dash' | 'cone' | 'circle'");
    expect(visual).toContain('rangeRing');
    expect(hud).toContain('this.highflyPaintSkillStick(slot, 0, -48');
    expect(hud).toContain('x: this.sim.player.pos.x');
    expect(hud).toContain('z: this.sim.player.pos.z');
    expect(hud).toContain('shape: profile.shape');
  });

  it('targets phone-landscape creator geometry rather than desktop scaling', () => {
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    expect(css).toContain('(max-height: 520px)');
    expect(css).toContain('70%');
    expect(css).toContain('34%');
    expect(css).toContain('66%');
    expect(css).toContain('38px');
  });
});
`);

console.log('[HIGHFLY v0.6.3 contracts] final world-space targeting/workout contracts installed.');

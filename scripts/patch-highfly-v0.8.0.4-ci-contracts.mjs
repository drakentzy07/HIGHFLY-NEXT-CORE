import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.0.4] patched ${path}`);
}

function replaceItBlock(path, title, replacement) {
  let source = read(path);
  const marker = `  it('${title}', () => {`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Anchor not found in ${path}: ${title}`);
  const endMarker = '\n  });';
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Closing block not found in ${path}: ${title}`);
  source = source.slice(0, start) + replacement + source.slice(end + endMarker.length);
  write(path, source);
}

// ---------------------------------------------------------------------------
// v0.8.0.4 — CI CONTRACT ALIGNMENT ONLY
//
// v0.8.0.3 already passed the real Chromium smoke at 915x412 with all six
// class stats physically visible. Three historical tests still asserted layouts
// that v0.8.0.3 intentionally deleted. Replace only those creator assertions;
// preserve every combat, Action Sweep and Fitness Core regression around them.
// ---------------------------------------------------------------------------

replaceItBlock(
  'tests/highfly_v071_combat_matrix_creator.test.ts',
  'commits dragged facing and makes the class dossier readable in 3x2',
  `  it('commits dragged facing and validates the clean class dossier authority', () => {
    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');
    const lifecycle = fs.readFileSync('src/sim/combat/casting_lifecycle.ts', 'utf8');
    const creator = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');

    expect(hud).toContain('this.sim.player.facing = facing');
    expect(lifecycle).toContain('if (!highflyManualMiss) {');
    expect(lifecycle).toContain('highflyManualMissConsumesCombo(ability, res.effects)');
    expect(creator).toContain(
      "important(layout, 'grid-template-columns', 'minmax(0, 1fr) minmax(0, 1fr)')",
    );
    expect(creator).toContain(
      "important(refs.classRow, 'grid-template-rows', 'repeat(3, 29px)')",
    );
    expect(creator).toContain("important(refs.classDetails, 'min-height', '0')");
    expect(creator).toContain("important(refs.classDetails, 'overflow', 'hidden')");
    expect(css).toContain('HIGHFLY v0.8.0.3 — CLEAN CREATOR AUTHORITY');
    expect(css).toContain('grid-template-rows: repeat(2, 30px) !important');
  });`,
);

replaceItBlock(
  'tests/highfly_v073_class_geometry_action_sweep.test.ts',
  'uses a real 34/28/38 three-zone Class creator while Appearance stays independent',
  `  it('uses the clean 50/50 Class authority while Appearance stays independent', () => {
    const creator = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');

    expect(creator).toContain(
      "important(layout, 'grid-template-columns', 'minmax(0, 1fr) minmax(0, 1fr)')",
    );
    expect(creator).toContain("important(right, 'display', 'block')");
    expect(creator).toContain(
      "important(refs.classRow, 'grid-template-columns', 'repeat(3, minmax(0, 1fr))')",
    );
    expect(creator).toContain("important(refs.classDetails, 'overflow', 'hidden')");
    expect(css).toContain('HIGHFLY v0.8.0.3 — CLEAN CREATOR AUTHORITY');
    expect(css).toContain('grid-template-rows: repeat(3, 29px) !important');
    expect(css).toContain('grid-template-rows: repeat(2, 30px) !important');
  });`,
);

replaceItBlock(
  'tests/highfly_v0711_fx_type_fix.test.ts',
  'keeps the inherited creator contract aligned with the final phone layout',
  `  it('keeps the inherited creator contract aligned with the clean phone layout', () => {
    const creatorTest = fs.readFileSync('tests/highfly_v066_creator_combat_flow.test.ts', 'utf8');
    expect(creatorTest).toContain('HIGHFLY v0.8.0.3 — CLEAN CREATOR AUTHORITY');
    expect(creatorTest).toContain("important(refs.classDetails, 'overflow', 'hidden')");
    expect(creatorTest).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important');
    expect(creatorTest).not.toContain('minmax(128px, 0.92fr) minmax(143px, 1.08fr)');
    expect(creatorTest).not.toContain('minmax(120px, 0.88fr) minmax(158px, 1.12fr)');
    expect(creatorTest).not.toContain('34/28/38');
  });`,
);

console.log('[HIGHFLY v0.8.0.4] stale creator CI contracts aligned; runtime/combat/fitness untouched.');

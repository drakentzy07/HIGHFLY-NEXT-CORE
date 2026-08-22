import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.7.5.1] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// #123 proved the balanced architecture itself is correct at 915x412:
// 425px | 425px, dossier on the left, 425x283 preview on the right, no dossier
// overflow. The only regression was the class picker inheriting a 61px flex cap.
// Pin that one element in runtime + final CSS. Combat is intentionally untouched.
{
  const path = 'src/highfly/creator_steps.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `  classHost?.classList.add('hf-class-info-stack');\n\n  important(right, 'width', '100%');`,
    `  classHost?.classList.add('hf-class-info-stack');\n\n  // Final authority for the readable 3x3 selector. Historical creator layers\n  // still carry a ~61px flex/max-height rule; do not let flexbox shrink it.\n  important(refs.classRow, 'display', 'grid');\n  important(refs.classRow, 'flex', '0 0 94px');\n  important(refs.classRow, 'flex-grow', '0');\n  important(refs.classRow, 'flex-shrink', '0');\n  important(refs.classRow, 'flex-basis', '94px');\n  important(refs.classRow, 'height', '94px');\n  important(refs.classRow, 'min-height', '94px');\n  important(refs.classRow, 'max-height', '94px');\n  important(refs.classRow, 'grid-template-columns', 'repeat(3, minmax(0, 1fr))');\n  important(refs.classRow, 'grid-template-rows', 'repeat(3, 29px)');\n  important(refs.classRow, 'grid-auto-rows', '29px');\n  important(refs.classRow, 'gap', '4px');\n\n  important(right, 'width', '100%');`,
    'runtime class grid height lock',
  );

  write(path, source);
}

{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.7.5.1 — #123 class-grid lock only.
   Balanced 50/50 composition is already correct; prevent inherited 61px shrink. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] :is(.mini-class-row.hf-class-picker, .hf-class-picker) {
    display: grid !important;
    flex: 0 0 94px !important;
    flex-grow: 0 !important;
    flex-shrink: 0 !important;
    flex-basis: 94px !important;
    width: 100% !important;
    height: 94px !important;
    min-height: 94px !important;
    max-height: 94px !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-rows: repeat(3, 29px) !important;
    grid-auto-rows: 29px !important;
    gap: 4px !important;
    overflow: visible !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker .mini-class {
    flex: none !important;
    height: 29px !important;
    min-height: 29px !important;
    max-height: 29px !important;
  }
}
`;
  write(path, css);
}

{
  const path = 'tests/highfly_v0751_class_grid_lock.test.ts';
  const content = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HIGHFLY v0.7.5.1 class grid lock', () => {
  it('pins the 3x3 selector against historical flex shrink', () => {
    const steps = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');
    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');
    expect(steps).toContain("important(refs.classRow, 'flex-shrink', '0')");
    expect(steps).toContain("important(refs.classRow, 'height', '94px')");
    expect(steps).toContain("important(refs.classRow, 'grid-template-rows', 'repeat(3, 29px)')");
    expect(css).toContain('HIGHFLY v0.7.5.1 — #123 class-grid lock only');
  });

  it('does not alter the already-green Wicked Slash Action Sweep', () => {
    const sweep = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');
    expect(sweep).toContain("ability.id === 'sinister_strike'");
    expect(sweep).toContain('highflySweepHalfAngle');
    expect(sweep).toContain('highflyExtraHits');
  });
});
`;
  write(path, content);
}

console.log('[HIGHFLY v0.7.5.1] readable 3x3 selector locked; combat untouched.');

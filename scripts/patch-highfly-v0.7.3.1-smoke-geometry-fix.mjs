import fs from 'node:fs';

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// 1) FINAL CLASS GRID ITEM PLACEMENT
//
// The v0.7.3 parent grid correctly creates two internal columns, but historical
// creator rules still auto-place Preview and Details into column 1 on separate
// rows. Pin both children explicitly into the one full-height row.
// ---------------------------------------------------------------------------
{
  const creatorPath = 'src/highfly/creator_steps.ts';
  let creator = fs.readFileSync(creatorPath, 'utf8');

  creator = replaceRequired(
    creator,
    `  important(refs.classDetails, 'transform', 'none');
  important(refs.classDetails, 'translate', 'none');`,
    `  important(refs.classDetails, 'transform', 'none');
  important(refs.classDetails, 'translate', 'none');
  important(refs.preview, 'grid-column', '1');
  important(refs.preview, 'grid-row', '1');
  important(refs.classDetails, 'grid-column', '2');
  important(refs.classDetails, 'grid-row', '1');`,
    'class preview/dossier explicit grid placement',
  );

  fs.writeFileSync(creatorPath, creator, 'utf8');

  const cssPath = 'src/styles/highfly.native.css';
  let css = fs.readFileSync(cssPath, 'utf8');
  css += `

/* HIGHFLY v0.7.3.1 — prevent inherited class grid placement from restacking. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] #offline-preview-container {
    grid-column: 1 !important;
    grid-row: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    grid-column: 2 !important;
    grid-row: 1 !important;
  }
}
`;
  fs.writeFileSync(cssPath, css, 'utf8');
}

// ---------------------------------------------------------------------------
// 2) FIX THE RUNTIME GEOMETRY PROBE SCOPE
// ---------------------------------------------------------------------------
const path = '../scripts/highfly_runtime_smoke.mjs';
let smoke = fs.readFileSync(path, 'utf8');

// v0.7.2.1 had inserted rightBottom into the first rightHeight block, which is
// Appearance. v0.7.3 then used that marker and accidentally placed class-only
// `dr` fields there. Restore Appearance to fields that exist in that closure.
smoke = replaceRequired(
  smoke,
  `      leftBottom: lr.bottom,
      rightHeight: rr.height,
      rightTop: rr.top,
      rightBottom: rr.bottom,
      previewWidth: pr.width,
      previewHeight: pr.height,
      previewTop: pr.top,
      previewRight: pr.right,
      detailsWidth: dr.width,
      detailsLeft: dr.left,`,
  `      rightHeight: rr.height,
      rightBottom: rr.bottom,
      previewHeight: pr.height,`,
  'remove class-only rect fields from Appearance smoke',
);

// Put the geometry fields on the Class return object, where dr/details exists.
smoke = replaceRequired(
  smoke,
  `      rightWidth: rr.width,
      rightHeight: rr.height,
      previewHeight: pr.height,
      previewBottom: pr.bottom,
      detailsTop: dr.top,`,
  `      rightWidth: rr.width,
      leftBottom: lr.bottom,
      rightHeight: rr.height,
      rightTop: rr.top,
      rightBottom: rr.bottom,
      previewWidth: pr.width,
      previewHeight: pr.height,
      previewTop: pr.top,
      previewRight: pr.right,
      previewBottom: pr.bottom,
      detailsWidth: dr.width,
      detailsLeft: dr.left,
      detailsTop: dr.top,`,
  'attach three-zone rect fields to Class smoke',
);

fs.writeFileSync(path, smoke, 'utf8');
console.log('[HIGHFLY v0.7.3.1] full-height class columns + class-only geometry probe fixed.');

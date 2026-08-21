import fs from 'node:fs';

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

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
console.log('[HIGHFLY v0.7.3.1] class-only runtime geometry probe fixed.');

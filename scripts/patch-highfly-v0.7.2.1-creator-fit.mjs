import fs from 'node:fs';

const path = 'src/styles/highfly.native.css';
let css = fs.readFileSync(path, 'utf8');

css += `

/* HIGHFLY v0.7.2.1 — fit the complete class dossier in the existing 158px panel. */
@media (orientation: landscape) and (max-height: 520px) {
  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {
    padding: 4px 6px !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) h3 {
    margin: 0 !important;
    font-size: 14px !important;
    line-height: .95 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-title, .hf-class-title-v062) span {
    font-size: 8px !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-desc, .hf-class-desc-v062) {
    margin: 2px 0 !important;
    font-size: 8.5px !important;
    line-height: 1.05 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-resource, .hf-class-resource-v062) {
    margin: 1px 0 !important;
    font-size: 8px !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] .highfly-class-sheet h4,
  body.native-app #offline-select[data-hf-creator-step="class"] .highfly-class-sheet-v062 h4 {
    margin: 1px 0 2px !important;
    font-size: 8px !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) {
    grid-auto-rows: 20px !important;
    gap: 3px 5px !important;
    margin: 2px 0 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-stats, .hf-class-stats-v062) span {
    min-height: 20px !important;
    height: 20px !important;
    padding: 2px 5px !important;
    font-size: 7.5px !important;
    line-height: 1 !important;
  }

  body.native-app #offline-select[data-hf-creator-step="class"] :is(.hf-class-note, .hf-class-note-v062) {
    margin: 2px 0 0 !important;
    font-size: 7.5px !important;
    line-height: 1 !important;
  }
}
`;

fs.writeFileSync(path, css, 'utf8');
console.log('[HIGHFLY v0.7.2.1] compact class dossier fit applied without changing geometry or combat.');

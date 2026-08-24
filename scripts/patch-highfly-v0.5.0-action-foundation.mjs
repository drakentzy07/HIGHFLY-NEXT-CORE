import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.5.0] patched ${path}`);
}

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// ---------------------------------------------------------------------------
// 1) Action-facing: when the player travels south/west/etc, that becomes the
//    authoritative heading. Releasing the joystick keeps the last travel heading
//    instead of snapping the model back to the camera's forward direction.
// ---------------------------------------------------------------------------
{
  const path = 'src/main.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    '        const stepFacing = movementFacing ?? facing;',
    `        // HIGHFLY action locomotion: commit travel direction to gameplay facing.\n        // movement_visual already resolves the camera-relative 360-degree vector;\n        // using it here means releasing the stick preserves that heading instead\n        // of visually snapping back to the camera forward axis. The original\n        // authoritative player facing is the final non-null fallback for TS and\n        // for frames where neither camera nor resolver supplied a heading.\n        const highflyTravelFacing = visualFacingFor(\n          mi,\n          movementFacing ?? facing ?? offlineSim.player.facing,\n        );\n        const stepFacing = highflyTravelFacing ?? movementFacing ?? facing;`,
    'offline travel-facing persistence',
  );

  source = replaceRequired(
    source,
    '    const foreignFacing = movementFacing ?? resolved.facing;',
    `    // Mirror the same action-facing rule on the network client path.\n    const highflyTravelFacing = visualFacingFor(\n      resolved.mi,\n      movementFacing ?? resolved.facing ?? world.player.facing,\n    );\n    const foreignFacing = highflyTravelFacing ?? movementFacing ?? resolved.facing;`,
    'online travel-facing persistence',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) DASH is now a real dodge: a short direct-hit invulnerability window rides
//    the existing simulation-owned dash timer. DoTs/environmental ticking damage
//    remain unaffected; only a direct hostile hit during the dash is dodged.
// ---------------------------------------------------------------------------
{
  const path = 'src/sim/combat/damage.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    '  if (target.dead) return 0;\n  // Quest-gated destructible',
    `  if (target.dead) return 0;\n  // HIGHFLY action dodge: the directional dash owns a short i-frame window.\n  // Keep periodic/incidental damage intact; only direct hostile hits are avoided.\n  if (\n    direct &&\n    target.kind === 'player' &&\n    source !== null &&\n    source.id !== target.id &&\n    (target.highflyDashTime ?? 0) > 0.025\n  ) {\n    ctx.emit({\n      type: 'damage',\n      sourceId: source.id,\n      targetId: target.id,\n      amount: 0,\n      crit: false,\n      school,\n      ability,\n      abilityId,\n      kind: 'dodge',\n    });\n    return 0;\n  }\n  // Quest-gated destructible`,
    'dash direct-hit iframe',
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) S23 creator final containment + exact lower combat row spacing.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.5.0 — S23 final creator containment + combat-row spacing. */
@media (orientation: landscape) {
  /* Guarantee that ENTER WORLD is always visible. Rather than asking the whole
     creator to become shorter again, reserve a fixed bottom action strip and let
     only the appearance page scroll inside its own card. */
  body.native-app.mobile-touch #offline-select.highfly-native-creator .char-create {
    position: relative !important;
    padding-bottom: 28px !important;
    box-sizing: border-box !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator .auth-actions {
    position: absolute !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    z-index: 8 !important;
    width: 100% !important;
    height: 25px !important;
    min-height: 25px !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator #btn-start-offline {
    width: 100% !important;
    height: 25px !important;
    min-height: 25px !important;
    padding: 1px 6px !important;
    font-size: 9px !important;
    line-height: 18px !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator > .auth-title {
    flex-basis: 15px !important;
    height: 15px !important;
    line-height: 15px !important;
    font-size: 12px !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator .mini-class-row {
    flex-basis: 61px !important;
    grid-template-rows: repeat(3, 19px) !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator .mini-class {
    height: 19px !important;
    min-height: 19px !important;
    font-size: 8.5px !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-head {
    flex-basis: 23px !important;
    min-height: 23px !important;
  }
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-tabs,
  body.native-app.mobile-touch #offline-select.highfly-native-creator #offline-appearance .ac-tab {
    height: 21px !important;
    min-height: 21px !important;
  }

  /* Exact lower row: SALTO -- DASH -- SKILL 1. ClaudeCraft's first action slot
     stays where it is. Move Jump 44 CSS px farther left and put Dash exactly at
     the new midpoint, giving both gaps real breathing room instead of overlap. */
  body.native-app.mobile-touch #mobile-action-ring {
    --highfly-dash-size: var(--mobile-ring-secondary-size);
  }
  body.native-app.mobile-touch #mobile-action-ring #mobile-jump {
    right: calc(
      var(--mobile-ring-attack-size) / 2 +
      var(--mobile-ring-radius) * 2 -
      var(--mobile-ring-hollow) -
      var(--mobile-ring-secondary-size) / 2 +
      44px
    ) !important;
  }
  body.native-app.mobile-touch #mobile-action-ring #mobile-dash {
    right: calc(
      var(--mobile-ring-attack-size) / 2 +
      var(--mobile-ring-radius) * 1.5 -
      var(--mobile-ring-hollow) / 2 +
      22px -
      var(--highfly-dash-size) / 2
    ) !important;
    bottom: calc(
      var(--mobile-ring-attack-size) / 2 -
      var(--highfly-dash-size) / 2
    ) !important;
    width: var(--highfly-dash-size) !important;
    height: var(--highfly-dash-size) !important;
  }

  body.native-app.mobile-touch.mobile-left-handed #mobile-action-ring #mobile-jump {
    left: calc(
      var(--mobile-ring-attack-size) / 2 +
      var(--mobile-ring-radius) * 2 -
      var(--mobile-ring-hollow) -
      var(--mobile-ring-secondary-size) / 2 +
      44px
    ) !important;
    right: auto !important;
  }
  body.native-app.mobile-touch.mobile-left-handed #mobile-action-ring #mobile-dash {
    left: calc(
      var(--mobile-ring-attack-size) / 2 +
      var(--mobile-ring-radius) * 1.5 -
      var(--mobile-ring-hollow) / 2 +
      22px -
      var(--highfly-dash-size) / 2
    ) !important;
    right: auto !important;
  }
}
`;
  write(path, css);
}

console.log('[HIGHFLY] v0.5.0 action foundation complete');

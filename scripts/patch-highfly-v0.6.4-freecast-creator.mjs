import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.6.4] patched ${path}`);
}
function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

// ---------------------------------------------------------------------------
// 1) TRAINING OWNS DISCORD ENTRY FOR REAL
// Route both ClaudeCraft Discord launch paths to HIGHFLY Training in the native
// offline app. The Discord service remains untouched for upstream/web builds.
// ---------------------------------------------------------------------------
{
  const path = 'src/main.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    '    onDiscord: () => openDiscordEntry(),',
    `    onDiscord: () => {\n      if (NATIVE_APP && import.meta.env.VITE_HIGHFLY_OFFLINE === '1') {\n        window.dispatchEvent(new Event('highfly:open-training'));\n        return;\n      }\n      openDiscordEntry();\n    },`,
    'mobile Discord callback ownership',
  );
  source = replaceRequired(
    source,
    '  hud.attachDiscordHook(() => openDiscordEntry());',
    `  hud.attachDiscordHook(() => {\n    if (NATIVE_APP && import.meta.env.VITE_HIGHFLY_OFFLINE === '1') {\n      window.dispatchEvent(new Event('highfly:open-training'));\n      return;\n    }\n    openDiscordEntry();\n  });`,
    'micro-menu Discord hook ownership',
  );
  write(path, source);
}

{
  const path = 'src/highfly/training_ui.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    `  const close = (): void => {\n    shell.hidden = true;\n    if (ticker) window.clearInterval(ticker);\n    ticker = 0;\n  };`,
    `  const close = (): void => {\n    shell.hidden = true;\n    if (ticker) window.clearInterval(ticker);\n    ticker = 0;\n  };\n\n  // Native HIGHFLY routes every former Discord affordance here at source level.\n  // This event is also useful to future HUD layouts without coupling them to this DOM.\n  window.addEventListener('highfly:open-training', open);`,
    'training open event bridge',
  );
  write(path, source);
}

// ---------------------------------------------------------------------------
// 2) TRUE MANUAL MISS CAST
// A dragged offensive skill is an explicit player command. If the lane contains
// no valid target, cast toward the chosen world point anyway: spend resource,
// arm GCD/cooldown and show the miss impact. NEVER substitute a basic attack or
// silently select another monster. A valid target in the lane still uses the
// original ClaudeCraft target/projectile/effect resolution.
// ---------------------------------------------------------------------------
{
  const path = 'src/ui/hud.ts';
  let source = read(path);
  const pattern = /      const targetId = this\.highflyPickDirectionalTarget\(castSlot, facing\);[\s\S]*?      button\.blur\(\);/;
  if (!pattern.test(source)) throw new Error('Anchor not found: manual aim finish branch');
  source = source.replace(pattern, `      const targetId = this.highflyPickDirectionalTarget(castSlot, facing);\n      if (targetId !== null) {\n        this.sim.targetEntity(targetId);\n        this.highflyManualCommit = true;\n        try {\n          this.castSlot(castSlot);\n        } finally {\n          this.highflyManualCommit = false;\n        }\n      } else {\n        // HIGHFLY manual aim never falls back to auto/basic. A miss is still a\n        // deliberate cast and therefore consumes the authored resource/cooldown.\n        const profile = this.highflyAimProfile(castSlot);\n        const distancePct = Math.max(0.22, Math.min(1, dragLength / 112));\n        const distance = profile.shape === 'circle' ? profile.range * distancePct : profile.range;\n        const aim = {\n          x: this.sim.player.pos.x + Math.sin(facing) * distance,\n          z: this.sim.player.pos.z + Math.cos(facing) * distance,\n        };\n        if (this.sim.player.autoAttack) this.sim.stopAutoAttack();\n        this.sim.castAbilityAt(resolved.def.id, aim);\n      }\n      button.blur();`);
  write(path, source);
}

{
  const path = 'src/sim/sim.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    `  castAbilityAt(abilityId: string, aim: { x: number; z: number }): void {\n    castAbilityImpl(this.ctx, abilityId, undefined, aim);\n  }`,
    `  castAbilityAt(abilityId: string, aim: { x: number; z: number }): void {\n    const resolved = this.resolvedAbility(abilityId);\n    const highflyManualMiss =\n      !!resolved?.def.requiresTarget &&\n      resolved.def.targetType !== 'friendly' &&\n      !resolved.def.targetsDead &&\n      resolved.def.targetMode !== 'position';\n    castAbilityImpl(this.ctx, abilityId, undefined, aim, highflyManualMiss ? -1 : null);\n  }`,
    'Sim manual miss sentinel',
  );
  write(path, source);
}

{
  const path = 'src/sim/combat/casting_lifecycle.ts';
  let source = read(path);

  const helperAnchor = `export function castAbility(\n  ctx: SimContext,`;
  const helper = `function highflyManualAimMissAllowed(\n  ability: AbilityDef,\n  res: ResolvedAbility,\n  aim: { x: number; z: number } | undefined,\n  castTargetId: number | null,\n): boolean {\n  if (!aim || castTargetId !== -1) return false;\n  if (!ability.requiresTarget || ability.targetType === 'friendly' || ability.targetsDead) return false;\n  if (ability.targetMode === 'position' || ability.minRange) return false;\n  if (ability.executeThreshold !== undefined || ability.requiresTargetHpBelow !== undefined) return false;\n  if (ability.spendsCombo || ability.requiresDodgeProc) return false;\n  const offensive = res.effects.some((effect) =>\n    ['directDamage', 'weaponDamage', 'weaponStrike', 'chainDamage'].includes(effect.type),\n  );\n  const specialTargetContract = res.effects.some((effect) =>\n    ['polymorph', 'taunt', 'tamePet', 'charge', 'feralCharge', 'packCommand', 'unleashBeast', 'hunterBloodhook', 'dispel'].includes(effect.type),\n  );\n  return offensive && !specialTargetContract;\n}\n\n`;
  if (!source.includes(helperAnchor)) throw new Error('Anchor not found: castAbility helper');
  source = source.replace(helperAnchor, helper + helperAnchor);

  source = replaceRequired(
    source,
    `  const ability = res.def;\n  if (cancelRecedingShell(ctx, p, meta, ability.id)) return;`,
    `  const ability = res.def;\n  const highflyManualMiss = highflyManualAimMissAllowed(ability, res, aim, castTargetId);\n  if (cancelRecedingShell(ctx, p, meta, ability.id)) return;`,
    'manual miss cast-start flag',
  );

  source = replaceRequired(
    source,
    `  } else if (ability.requiresTarget) {\n    if (p.targetId !== null) {\n      target = ctx.entities.get(p.targetId) ?? null;`,
    `  } else if (ability.requiresTarget) {\n    if (highflyManualMiss) {\n      // Use self only as a harmless validation placeholder. The sentinel stored\n      // below makes applyAbility resolve this as an intentional MISS, never self-hit.\n      target = p;\n    } else if (p.targetId !== null) {\n      target = ctx.entities.get(p.targetId) ?? null;`,
    'manual miss target placeholder',
  );

  source = replaceRequired(
    source,
    `    if (!target || target.dead || !ctx.isHostileTo(p, target) || hasEscapeStealth(target)) {\n      ctx.error(p.id, 'You have no target.', target?.dead ? 'target_dead' : undefined);\n      return;\n    }`,
    `    if (!highflyManualMiss && (!target || target.dead || !ctx.isHostileTo(p, target) || hasEscapeStealth(target))) {\n      ctx.error(p.id, 'You have no target.', target?.dead ? 'target_dead' : undefined);\n      return;\n    }`,
    'manual miss target gate',
  );

  source = replaceRequired(
    source,
    `  p.castTargetId = target?.id ?? null;`,
    `  p.castTargetId = highflyManualMiss ? -1 : (target?.id ?? null);`,
    'persist manual miss sentinel',
  );

  // Build a clamped aim point for manual misses just like ground-target abilities.
  source = replaceRequired(
    source,
    `  let aimPoint: Vec3 | null = null;\n  if (ability.targetMode === 'position') {`,
    `  let aimPoint: Vec3 | null = null;\n  if (ability.targetMode === 'position' || highflyManualMiss) {`,
    'manual miss aim point',
  );

  // Finish-side: resolve sentinel misses before ordinary entity target validation.
  const finishAnchor = `  let target: Entity | null = null;\n  if (ability.id === 'unleash_weapon') {`;
  const finishBlock = `  const highflyManualMiss =\n    castTarget === -1 &&\n    p.castAim !== null &&\n    highflyManualAimMissAllowed(ability, res, { x: p.castAim.x, z: p.castAim.z }, -1);\n\n  if (highflyManualMiss && p.castAim) {\n    const missCost = billableCost();\n    if (p.resource < missCost) {\n      ctx.error(p.id, \`Not enough \${p.resourceType ?? 'resource'}!\`);\n      return;\n    }\n    spendResource(p, missCost);\n    armAbilityCooldownWithReflection(ctx, p, meta, res, togglingOff);\n    ctx.emit({\n      type: 'spellfxAt',\n      x: p.castAim.x,\n      z: p.castAim.z,\n      school: ability.school,\n      fx: ability.projectileFx ?? 'projectile',\n      ability: ability.id,\n      sourceId: p.id,\n    });\n    if (!ability.offGcd) {\n      const gcd = Math.max(MIN_GCD, ctx.playerGcdFor(meta.cls) / spellHasteMult(p));\n      p.gcdRemaining = Math.max(p.gcdRemaining, gcd);\n    }\n    if (p.kind === 'player' && ability.school !== 'physical') ctx.applySetProcs(p, null, 'spellCast');\n    if (p.kind === 'player') onCastCompleted(ctx, p, ability.id, null);\n    return;\n  }\n\n  let target: Entity | null = null;\n  if (ability.id === 'unleash_weapon') {`;
  source = replaceRequired(source, finishAnchor, finishBlock, 'manual miss finish resolution');

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) TWO-STEP PHONE CREATOR
// Stop forcing class details + full appearance editor into one 412px-high view.
// Step 1 owns appearance + large preview. Step 2 owns class grid + full class sheet.
// The selected appearance and class remain the original ClaudeCraft state.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/creator_steps.ts';
  const content = `function syncPreview(): void {\n  window.dispatchEvent(new Event('resize'));\n}\n\nexport function installHighflyCreatorSteps(): void {\n  const activate = (): void => {\n    if (!document.body.classList.contains('native-app')) return;\n    const root = document.getElementById('offline-select');\n    if (!root || root.dataset.hfCreatorSteps === '1') return;\n    const cards = Array.from(root.querySelectorAll<HTMLElement>('.mini-class'));\n    const picker = cards[0]?.parentElement;\n    const actions = root.querySelector<HTMLElement>('.auth-actions');\n    const start = root.querySelector<HTMLButtonElement>('#btn-start-offline');\n    if (!picker || !actions || !start) return;\n\n    root.dataset.hfCreatorSteps = '1';\n    picker.classList.add('hf-class-picker');\n\n    const nav = document.createElement('div');\n    nav.className = 'hf-creator-nav';\n    nav.innerHTML =\n      '<button type="button" data-hf-creator-back>← APARIENCIA</button>' +\n      '<span data-hf-creator-progress>1 / 2 · APARIENCIA</span>' +\n      '<button type="button" data-hf-creator-next>SIGUIENTE · CLASE →</button>';\n    actions.appendChild(nav);\n\n    const back = nav.querySelector<HTMLButtonElement>('[data-hf-creator-back]')!;\n    const next = nav.querySelector<HTMLButtonElement>('[data-hf-creator-next]')!;\n    const progress = nav.querySelector<HTMLElement>('[data-hf-creator-progress]')!;\n\n    const setStep = (step: 'appearance' | 'class'): void => {\n      root.dataset.hfCreatorStep = step;\n      const appearance = step === 'appearance';\n      back.hidden = appearance;\n      next.hidden = !appearance;\n      progress.textContent = appearance ? '1 / 2 · APARIENCIA' : '2 / 2 · CLASE';\n      start.style.setProperty('display', appearance ? 'none' : 'block', 'important');\n      requestAnimationFrame(syncPreview);\n      window.setTimeout(syncPreview, 80);\n    };\n\n    back.addEventListener('click', () => setStep('appearance'));\n    next.addEventListener('click', () => setStep('class'));\n    setStep('appearance');\n  };\n\n  activate();\n  const observer = new MutationObserver(activate);\n  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });\n}\n\ninstallHighflyCreatorSteps();\n`;
  write(path, content);
}

{
  const path = 'src/main.ts';
  let source = read(path);
  source = replaceRequired(
    source,
    "import { installHighflyTrainingUi } from './highfly/training_ui';",
    "import { installHighflyTrainingUi } from './highfly/training_ui';\nimport './highfly/creator_steps';",
    'creator steps import',
  );
  write(path, source);
}

{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += String.raw`\n\n/* HIGHFLY v0.6.4 — two-step creator. One job per phone-landscape screen. */\n@media (orientation: landscape) and (max-height: 520px) {\n  body.native-app #offline-select[data-hf-creator-steps="1"] .auth-actions {\n    overflow: visible !important;\n  }\n  body.native-app #offline-select[data-hf-creator-steps="1"] .hf-creator-nav {\n    position:absolute; inset:0; display:grid; grid-template-columns:1fr auto 1fr; gap:8px; align-items:center; pointer-events:none;\n  }\n  body.native-app #offline-select[data-hf-creator-steps="1"] .hf-creator-nav button {\n    pointer-events:auto; height:28px; min-width:150px; padding:0 13px; border:1px solid rgba(218,178,74,.72); border-radius:14px; background:linear-gradient(180deg,#332509,#171006); color:#ffe49a; font:800 9px/1 sans-serif; letter-spacing:.45px;\n  }\n  body.native-app #offline-select[data-hf-creator-steps="1"] .hf-creator-nav [data-hf-creator-back] { justify-self:start; }\n  body.native-app #offline-select[data-hf-creator-steps="1"] .hf-creator-nav [data-hf-creator-next] { justify-self:end; }\n  body.native-app #offline-select[data-hf-creator-steps="1"] .hf-creator-nav span { color:#d8bd69; font:800 8px/1 sans-serif; letter-spacing:.65px; }\n\n  body.native-app #offline-select[data-hf-creator-step="appearance"] .hf-class-picker,\n  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-class-details { display:none !important; }\n  body.native-app #offline-select[data-hf-creator-step="appearance"] .charselect-col-right {\n    display:block !important;\n  }\n  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-preview-container {\n    width:100% !important; height:100% !important; min-height:0 !important;\n  }\n  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-appearance {\n    display:block !important; flex:1 1 auto !important; min-height:0 !important; height:auto !important;\n  }\n  body.native-app #offline-select[data-hf-creator-step="appearance"] #offline-appearance .ac-page.active {\n    max-height:none !important; height:100% !important;\n  }\n\n  body.native-app #offline-select[data-hf-creator-step="class"] #offline-appearance { display:none !important; }\n  body.native-app #offline-select[data-hf-creator-step="class"] .hf-class-picker {\n    display:grid !important; margin-top:4px !important;\n  }\n  body.native-app #offline-select[data-hf-creator-step="class"] .charselect-col-right {\n    display:grid !important; grid-template-rows:minmax(118px,38%) minmax(0,62%) !important; gap:6px !important;\n  }\n  body.native-app #offline-select[data-hf-creator-step="class"] #offline-class-details {\n    display:block !important; overflow-y:auto !important; min-height:0 !important; padding:8px 10px !important;\n  }\n  body.native-app #offline-select[data-hf-creator-step="class"] .char-create {\n    justify-content:flex-start !important;\n  }\n  body.native-app #offline-select[data-hf-creator-step="class"] #btn-start-offline {\n    position:relative !important; z-index:2 !important; width:min(260px,38%) !important;\n  }\n}\n`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// 4) CONTRACT TESTS
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v064_control_creator.test.ts';
  const content = `import fs from 'node:fs';\nimport { describe, expect, it } from 'vitest';\n\ndescribe('HIGHFLY v0.6.4 control and creator contracts', () => {\n  it('routes former Discord entries to Training in native HIGHFLY', () => {\n    const main = fs.readFileSync('src/main.ts', 'utf8');\n    const ui = fs.readFileSync('src/highfly/training_ui.ts', 'utf8');\n    expect(main).toContain("window.dispatchEvent(new Event('highfly:open-training'))");\n    expect(ui).toContain("window.addEventListener('highfly:open-training', open)");\n  });\n\n  it('manual aim miss casts at the selected world point instead of basic fallback', () => {\n    const hud = fs.readFileSync('src/ui/hud.ts', 'utf8');\n    const sim = fs.readFileSync('src/sim/sim.ts', 'utf8');\n    const casting = fs.readFileSync('src/sim/combat/casting_lifecycle.ts', 'utf8');\n    expect(hud).toContain('this.sim.castAbilityAt(resolved.def.id, aim)');\n    expect(hud).toContain('this.sim.stopAutoAttack()');\n    expect(sim).toContain('highflyManualMiss ? -1 : null');\n    expect(casting).toContain('highflyManualAimMissAllowed');\n    expect(casting).toContain("type: 'spellfxAt'");\n  });\n\n  it('splits native creator into appearance and class steps', () => {\n    const steps = fs.readFileSync('src/highfly/creator_steps.ts', 'utf8');\n    const css = fs.readFileSync('src/styles/highfly.native.css', 'utf8');\n    expect(steps).toContain("setStep('appearance')");\n    expect(steps).toContain("setStep('class')");\n    expect(css).toContain('data-hf-creator-step="appearance"');\n    expect(css).toContain('data-hf-creator-step="class"');\n  });\n});\n`;
  write(path, content);
}

console.log('[HIGHFLY v0.6.4] training ownership + free miss cast + two-step creator applied.');

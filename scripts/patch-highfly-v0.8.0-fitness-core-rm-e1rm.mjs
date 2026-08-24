import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[HIGHFLY v0.8.0] patched ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(from, to);
}

// ---------------------------------------------------------------------------
// 1) RM MATH — pure, testable and deliberately conservative.
// e1RM is only estimated for 1..10 reps. A true single is the exact load.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/training_rm_math.ts';
  const content = `export interface HighflyRmEvidence {\n  bestE1rm: number;\n  bestKg: number;\n  bestReps: number;\n  bestSets: number;\n  updatedAt: string;\n}\n\nfunction finitePositive(value: unknown): number {\n  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;\n}\n\nexport function highflyEstimateE1rm(kgInput: number, repsInput: number): number {\n  const kg = finitePositive(kgInput);\n  const reps = Math.floor(finitePositive(repsInput));\n  if (kg <= 0 || reps < 1 || reps > 10) return 0;\n  if (reps === 1) return Math.round(kg * 10) / 10;\n  // Epley is transparent and sufficiently stable for the first HIGHFLY RM layer.\n  // It is an ESTIMATE, never silently presented as a tested 1RM.\n  return Math.round(kg * (1 + reps / 30) * 10) / 10;\n}\n\nexport function highflyTrainingMax(manualRmInput: number, e1rmInput: number): number {\n  const manual = finitePositive(manualRmInput);\n  const estimated = finitePositive(e1rmInput);\n  return Math.max(manual, estimated);\n}\n`;
  write(path, content);
}

// ---------------------------------------------------------------------------
// 2) WORKOUT LOGGER — emit evidence ONLY after the authoritative session seam
// accepts the workout. Merely editing prescribed kg/reps can never create a PR.
// Also expose the existing real Sim training view as an on-screen SYSTEM chain.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/training_ui.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `interface HighflyTrainingWorld extends IWorld {\n  readonly highflyTrainingProfile: HighflyTrainingProfile;\n  highflyApplyTrainingSession(session: HighflyTrainingSession): HighflyTrainingApplyResult;\n}`,
    `interface HighflyTrainingWorld extends IWorld {\n  readonly highflyTrainingProfile: HighflyTrainingProfile;\n  highflyApplyTrainingSession(session: HighflyTrainingSession): HighflyTrainingApplyResult;\n  highflyTrainingView?(): {\n    effective: HighflyTrainingVector;\n    combatBonus: {\n      str: number; agi: number; sta: number; int: number;\n      hitRating: number; critRating: number; trainingPowerBudget: number;\n    };\n  } | null;\n}`,
    'training world connection view',
  );

  source = replaceRequired(
    source,
    `        '<div class="hf-training-summary" data-hf-summary></div>' +\n        '<div class="hf-training-toolbar">' +`,
    `        '<div class="hf-training-summary" data-hf-summary></div>' +\n        '<div class="hf-training-system-link" data-hf-system-link></div>' +\n        '<div class="hf-training-toolbar">' +`,
    'visible SYSTEM connection row',
  );

  source = replaceRequired(
    source,
    `    submitEl.disabled = profile.lastTrainingDay === dayKeyLocal();\n  };`,
    `    const view = world.highflyTrainingView?.();\n    const link = q<HTMLElement>('[data-hf-system-link]');\n    if (view) {\n      const e = view.effective;\n      const b = view.combatBonus;\n      link.innerHTML =\n        '<b>[SISTEMA]</b>' +\n        '<span>Entreno ' + n(profile.trainingXp, 0) + ' XP</span>' +\n        '<i>→</i><span>Potencial ' + n(b.trainingPowerBudget, 2) + '</span>' +\n        '<i>→</i><span>STR +' + n(e.str, 2) + ' · AGI +' + n(e.agi, 2) + ' · VIT +' + n(e.vit, 2) + ' · PER +' + n(e.per, 2) + ' · INT +' + n(e.int, 2) + '</span>' +\n        '<i>→</i><span>HIT +' + n(b.hitRating, 2) + ' · CRIT +' + n(b.critRating, 2) + '</span>';\n    } else {\n      link.textContent = '[SISTEMA] Conexión de entrenamiento no disponible en este mundo.';\n    }\n    submitEl.disabled = profile.lastTrainingDay === dayKeyLocal();\n  };`,
    'render real training to combat chain',
  );

  source = replaceRequired(
    source,
    `    const after = hunterPower(world);\n    resultEl.dataset.kind = 'ok';\n    resultEl.textContent = '+' + Math.round(applied.gainedXp) + ' Training XP · Poder ' + before + ' → ' + after;\n    renderSummary();`,
    `    const after = hunterPower(world);\n\n    // Validated evidence only: a prescribed/edited row cannot update e1RM until\n    // the complete workout succeeds through highflyApplyTrainingSession().\n    for (const completed of draft.rows.filter((row) => row.done && row.kg > 0 && row.reps > 0)) {\n      window.dispatchEvent(new CustomEvent('highfly:validated-exercise', {\n        detail: {\n          exerciseId: completed.exerciseId,\n          kg: completed.kg,\n          reps: completed.reps,\n          sets: completed.sets,\n          manualRm: completed.rm,\n          dayKey: draft.dayKey,\n        },\n      }));\n    }\n\n    resultEl.dataset.kind = 'ok';\n    resultEl.textContent = '[SISTEMA] +' + Math.round(applied.gainedXp) + ' Training XP · Poder ' + before + ' → ' + after;\n    renderSummary();`,
    'validated exercise evidence dispatch',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// 3) RM PANEL — keep tested RM and e1RM separate, persist best validated evidence,
// and use max(tested RM, validated e1RM) only as the load-prescription base.
// ---------------------------------------------------------------------------
{
  const path = 'src/highfly/training_rms.ts';
  let source = read(path);

  source = replaceRequired(
    source,
    `const RM_STORE = 'highfly.training.rms.v1';`,
    `import { highflyEstimateE1rm, highflyTrainingMax, type HighflyRmEvidence } from './training_rm_math';\n\nconst RM_STORE = 'highfly.training.rms.v1';\nconst E1RM_STORE = 'highfly.training.e1rm.v1';`,
    'RM math import and evidence store',
  );

  source = replaceRequired(
    source,
    `type RmProfile = Record<string, number>;`,
    `type RmProfile = Record<string, number>;\ntype E1rmProfile = Record<string, HighflyRmEvidence>;`,
    'e1RM profile type',
  );

  source = replaceRequired(
    source,
    `function saveRm(profile: RmProfile): void {\n  localStorage.setItem(RM_STORE, JSON.stringify(profile));\n}\n\nfunction roundLoad`,
    `function saveRm(profile: RmProfile): void {\n  localStorage.setItem(RM_STORE, JSON.stringify(profile));\n}\n\nfunction loadE1rm(): E1rmProfile {\n  try {\n    const parsed = JSON.parse(localStorage.getItem(E1RM_STORE) ?? '{}') as E1rmProfile;\n    return parsed && typeof parsed === 'object' ? parsed : {};\n  } catch {\n    return {};\n  }\n}\n\nfunction saveE1rm(profile: E1rmProfile): void {\n  localStorage.setItem(E1RM_STORE, JSON.stringify(profile));\n}\n\nfunction roundLoad`,
    'e1RM persistence helpers',
  );

  source = replaceRequired(
    source,
    `function sourceRm(profile: RmProfile, exerciseId: string): number {\n  if (profile[exerciseId] > 0) return profile[exerciseId];\n  // Accessories may use a closely related stored base when no individual RM is\n  // available. They never invent a number from thin air.\n  if (exerciseId === 'zercher_good_morning') return profile.zercher ?? 0;\n  return 0;\n}\n\nfunction applyPrescription(panel: HTMLElement, profile: RmProfile): void {`,
    `function sourceRm(profile: RmProfile, evidence: E1rmProfile, exerciseId: string): number {\n  const direct = highflyTrainingMax(profile[exerciseId] ?? 0, evidence[exerciseId]?.bestE1rm ?? 0);\n  if (direct > 0) return direct;\n  // Accessories may use a closely related stored base when no individual RM is\n  // available. They never invent a number from thin air.\n  if (exerciseId === 'zercher_good_morning') {\n    return highflyTrainingMax(profile.zercher ?? 0, evidence.zercher?.bestE1rm ?? 0);\n  }\n  return 0;\n}\n\nfunction applyPrescription(panel: HTMLElement, profile: RmProfile, evidence: E1rmProfile): void {`,
    'training max source combines manual and validated e1RM',
  );

  source = replaceRequired(
    source,
    `    const base = sourceRm(profile, exercise.value);`,
    `    const base = sourceRm(profile, evidence, exercise.value);`,
    'prescription reads evidence',
  );

  source = replaceRequired(
    source,
    `      RM_EXERCISES.map((item) => '<label><span>' + item.label + '</span><input type="number" min="0" step="2.5" inputmode="decimal" data-hf-rm="' + item.id + '"><em>kg</em></label>').join('') +`,
    `      RM_EXERCISES.map((item) => '<label><span>' + item.label + '</span><input type="number" min="0" step="2.5" inputmode="decimal" data-hf-rm="' + item.id + '"><em>kg</em><small data-hf-e1rm="' + item.id + '">e1RM —</small></label>').join('') +`,
    'RM card e1RM readout',
  );

  source = replaceRequired(
    source,
    `  let profile = loadRm();\n  for (const input of rmPanel.querySelectorAll<HTMLInputElement>('[data-hf-rm]')) {`,
    `  let profile = loadRm();\n  let evidence = loadE1rm();\n\n  const renderEvidence = (): void => {\n    for (const node of rmPanel.querySelectorAll<HTMLElement>('[data-hf-e1rm]')) {\n      const id = node.dataset.hfE1rm ?? '';\n      const item = evidence[id];\n      if (!item?.bestE1rm) {\n        node.textContent = 'e1RM —';\n        node.removeAttribute('data-pr');\n        continue;\n      }\n      node.textContent = 'e1RM ' + item.bestE1rm.toFixed(1).replace(/\\.0$/, '') + ' kg · ' + item.bestKg + '×' + item.bestReps;\n      node.dataset.pr = '1';\n    }\n  };\n\n  for (const input of rmPanel.querySelectorAll<HTMLInputElement>('[data-hf-rm]')) {`,
    'e1RM render state',
  );

  source = replaceRequired(
    source,
    `      saveRm(profile);\n    });\n  }\n\n  const setTab`,
    `      saveRm(profile);\n      renderEvidence();\n    });\n  }\n  renderEvidence();\n\n  if (panel.dataset.hfE1rmBound !== '1') {\n    panel.dataset.hfE1rmBound = '1';\n    window.addEventListener('highfly:validated-exercise', (event) => {\n      const detail = (event as CustomEvent<{\n        exerciseId?: string; kg?: number; reps?: number; sets?: number; dayKey?: string;\n      }>).detail;\n      const id = detail?.exerciseId ?? '';\n      const kg = Number(detail?.kg) || 0;\n      const reps = Math.floor(Number(detail?.reps) || 0);\n      const sets = Math.floor(Number(detail?.sets) || 0);\n      const estimate = highflyEstimateE1rm(kg, reps);\n      if (!id || estimate <= 0) return;\n      const previous = evidence[id]?.bestE1rm ?? 0;\n      if (estimate + 0.05 < previous) return;\n      evidence[id] = {\n        bestE1rm: Math.max(previous, estimate),\n        bestKg: kg,\n        bestReps: reps,\n        bestSets: sets,\n        updatedAt: String(detail?.dayKey ?? new Date().toISOString().slice(0, 10)),\n      };\n      saveE1rm(evidence);\n      renderEvidence();\n    });\n  }\n\n  const setTab`,
    'validated e1RM listener',
  );

  source = source.replaceAll('applyPrescription(panel, profile);', 'applyPrescription(panel, profile, evidence);');
  source = source.replaceAll('applyPrescription(panel, loadRm())', 'applyPrescription(panel, loadRm(), loadE1rm())');

  write(path, source);
}

// ---------------------------------------------------------------------------
// 4) MOBILE VISIBILITY — compact but readable SYSTEM chain and e1RM evidence.
// ---------------------------------------------------------------------------
{
  const path = 'src/styles/highfly.native.css';
  let css = read(path);
  css += `

/* HIGHFLY v0.8.0 — visible Fitness Core connection. */
.hf-training-system-link {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px 7px;
  border: 1px solid rgba(80, 209, 255, 0.34);
  border-radius: 7px;
  background: rgba(5, 18, 28, 0.76);
  color: rgba(220, 246, 255, 0.92);
  font-size: 9px;
  line-height: 1.05;
  white-space: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
}
.hf-training-system-link b { color: #68ddff; letter-spacing: .08em; }
.hf-training-system-link i { color: rgba(104, 221, 255, .58); font-style: normal; }
.hf-rm-grid label small[data-hf-e1rm] {
  grid-column: 1 / -1;
  display: block;
  margin-top: 2px;
  color: rgba(160, 212, 230, .82);
  font-size: 8px;
  line-height: 1;
}
.hf-rm-grid label small[data-hf-e1rm][data-pr="1"] { color: #f3ce61; }
`;
  write(path, css);
}

// ---------------------------------------------------------------------------
// 5) CONTRACTS — RM math + validated-only evidence + preserve real stat seam.
// ---------------------------------------------------------------------------
{
  const path = 'tests/highfly_v080_fitness_core_rm.test.ts';
  const content = `import fs from 'node:fs';\nimport { describe, expect, it } from 'vitest';\nimport { highflyEstimateE1rm, highflyTrainingMax } from '../src/highfly/training_rm_math';\n\ndescribe('HIGHFLY v0.8.0 Fitness Core RM/e1RM', () => {\n  it('distinguishes a 120kg single from a 20kg single without flattening capacity', () => {\n    expect(highflyEstimateE1rm(120, 1)).toBe(120);\n    expect(highflyEstimateE1rm(20, 1)).toBe(20);\n    expect(highflyEstimateE1rm(120, 1)).toBeGreaterThan(highflyEstimateE1rm(20, 1));\n  });\n\n  it('estimates a conservative e1RM for validated working sets only up to 10 reps', () => {\n    expect(highflyEstimateE1rm(80, 5)).toBeCloseTo(93.3, 1);\n    expect(highflyEstimateE1rm(100, 10)).toBeCloseTo(133.3, 1);\n    expect(highflyEstimateE1rm(100, 11)).toBe(0);\n    expect(highflyEstimateE1rm(0, 5)).toBe(0);\n  });\n\n  it('keeps tested RM and e1RM separate while using the stronger evidence as training max', () => {\n    expect(highflyTrainingMax(120, 116)).toBe(120);\n    expect(highflyTrainingMax(120, 125.5)).toBe(125.5);\n  });\n\n  it('records e1RM evidence only after a real session succeeds', () => {\n    const ui = fs.readFileSync('src/highfly/training_ui.ts', 'utf8');\n    const appliedAt = ui.indexOf('const applied = world.highflyApplyTrainingSession(session)');\n    const evidenceAt = ui.indexOf("new CustomEvent('highfly:validated-exercise'");\n    expect(appliedAt).toBeGreaterThanOrEqual(0);\n    expect(evidenceAt).toBeGreaterThan(appliedAt);\n    expect(ui).toContain("resultEl.textContent = '[SISTEMA] +'");\n  });\n\n  it('surfaces the existing real training-to-combat connection instead of a cosmetic score', () => {\n    const ui = fs.readFileSync('src/highfly/training_ui.ts', 'utf8');\n    const sim = fs.readFileSync('src/sim/sim.ts', 'utf8');\n    const entity = fs.readFileSync('src/sim/entity.ts', 'utf8');\n    expect(ui).toContain('world.highflyTrainingView?.()');\n    expect(ui).toContain('trainingPowerBudget');\n    expect(sim).toContain('recalcPlayerStats(e, meta.cls');\n    expect(entity).toContain('highflyTrainingCombatBonus');\n  });\n\n  it('preserves the already-approved spatial Action Sweep untouched', () => {\n    const sweep = fs.readFileSync('src/sim/combat/effect_dispatch.ts', 'utf8');\n    expect(sweep).toContain("ability.id === 'sinister_strike'");\n    expect(sweep).toContain('highflyExtraHits');\n  });\n});\n`;
  write(path, content);
}

console.log('[HIGHFLY v0.8.0] validated e1RM + visible SYSTEM training connection applied; combat untouched.');

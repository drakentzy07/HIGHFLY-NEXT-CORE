# HIGHFLY v1 Canonical Implementation Plan

This plan is intentionally sequential. We do not build later systems on top of an unresolved earlier boundary.

## Phase 0 — Freeze and clean boundary

Goal: one stable upstream + one HIGHFLY product line.

1. Pin ClaudeCraft v0.40.0 stable by exact tag/commit.
2. Treat previous HIGHFLY branches as reference only.
3. Build only from `canonical/` and canonical source modules.
4. Remove permanent reliance on overlay shell, runtime text replacement, global hooks and monkey-patched methods.
5. Add BuildManifest containing upstream version, HIGHFLY commit, contracts and build time.

Exit gate:
- build starts from clean upstream every time
- no legacy patch replay
- no experimental #177/#179 integration files are consumed

## Phase 1 — Native boot and product identity

Goal: the first visible pixel belongs to HIGHFLY.

1. Own Android app id/name/package identity.
2. Disable upstream OTA.
3. Replace native/loading presentation with HIGHFLY loading screen.
4. Remove upstream external/product navigation from native route.
5. Boot directly to HIGHFLY creator when no profile exists; otherwise boot to world.

Exit gate:
- no World of ClaudeCraft logo/text during native boot
- immersive landscape works after focus changes
- clean install and relaunch both follow HIGHFLY flow

## Phase 2 — Character Creator HIGHFLY

Goal: one creator, no inherited layout collision.

1. Create new HIGHFLY creator DOM/component tree.
2. Use engine `CharacterPreview` only as a renderer service.
3. Fixed landscape composition with no horizontal scroll.
4. Appearance controls.
5. Nine classes.
6. One subclass, fixed after confirmation.
7. Name and profile persistence.
8. Enter world from one controlled flow.

Exit gate:
- preview model visible on real phone
- changing class updates preview
- all controls fit reference landscape viewport
- profile survives restart
- no inherited creator controls remain visible underneath

## Phase 3 — Input + Movement

Goal: action-RPG movement semantics before combat is layered on top.

1. Add `HighflyInputRouter` as the single mobile action/movement entrypoint.
2. Movement intent is derived from joystick vector + camera yaw.
3. Body facing follows movement intent.
4. Camera remains independent.
5. Backward joystick direction rotates and runs the character instead of backpedaling.
6. Add independent Dash/Dodge action using input vector/facing fallback.
7. Respect collision/world bounds through the adapter.

Exit gate:
- forward/back/left/right/diagonal all feel natural on phone
- no moonwalk
- camera can rotate without changing move intent unexpectedly
- dash travels in intended direction

## Phase 4 — Action Combat Runtime

Goal: HIGHFLY combat owns mobile combat semantics end-to-end.

1. Define `ActionRequest`, `ActionDefinition`, `CastTransaction`.
2. Add spatial shapes: single, cone, circle, corridor, projectile, piercing projectile.
3. Adapter queries real hostile entities.
4. Basic attack works without selected target.
5. Selected target is soft priority only when valid/in geometry.
6. Warrior Reaver = 100° frontal cone, ~5 m, multi-body.
7. Resource/cooldown/combo charged once per cast.
8. Implement equivalent Skill 1 contracts for all nine classes.
9. Keep distance/caster/healer-specific behavior explicit rather than forcing all classes into melee rules.

Exit gate on real engine entities:
- targetless basic hit
- optional target priority
- Reaver multi-body
- outside body untouched
- resource/cooldown once
- ranged first-body collision / piercing only when specified

## Phase 5 — Mobile HUD

Goal: one visible HIGHFLY HUD; upstream HUD becomes engine-internal/non-mounted for native play.

1. Own HP/MP/XP display with numbers.
2. Own joystick presentation.
3. Own camera touch region.
4. Own attack/skills/Dash/Interact cluster.
5. Own bottom/top product navigation according to final S23 landscape layout.
6. Add edit/reposition mode later only after baseline controls are stable.
7. Keep center of screen clear for world/combat.

Exit gate:
- exactly one combat control surface
- no duplicate ClaudeCraft radial ring/menu bars
- no safe-area overlap
- no controls covered by Android system bars

## Phase 6 — Training + Strength Engine

Goal: real training becomes the source of RPG progression.

1. Canonical models: plan, workout, exercise, set performance, session.
2. Register each completed set.
3. Persist after every set.
4. Restore exact unfinished session on restart.
5. Compute volume/tonnage.
6. Keep tested RM distinct from e1RM.
7. Compute e1RM with Epley where appropriate.
8. Detect PRs against persisted records.
9. Complete session exactly once.

Exit gate:
- register set on phone
- kill/reopen app
- same session/set exists
- finish session
- RM/e1RM/volume/PR values correct

## Phase 7 — System Engine + Hunter Profile

Goal: one progression source of truth.

1. `HighflyProfile` owns XP, level, rank, five stats, class/subclass, inventory/equipment/world/training progression.
2. `HighflySystemEngine` consumes idempotent events.
3. Training rewards STR/AGI/VIT/PER/INT according to HIGHFLY rules.
4. Hunter screen only reads canonical profile.
5. System screen explains/records progression and objectives.

Exit gate:
- finishing training grants XP/stats exactly once
- restart preserves result
- Hunter and System show identical canonical values

## Phase 8 — Hunt / World integration

Goal: preserve useful engine world capabilities while HIGHFLY owns progression presentation.

1. Safe city.
2. Portals/dungeons/tower.
3. Loot/equipment rewards feed canonical profile.
4. NPC interactions are surfaced through HIGHFLY world UI.
5. Tutorial becomes HIGHFLY onboarding rather than ClaudeCraft tutorial branding.

Exit gate:
- hunt completion generates canonical event/reward
- inventory/profile update once
- return to training loop works

## Phase 9 — Visual and product polish

Only after the core loop above is functional.

- HIGHFLY loading art/logo
- final creator styling
- final combat icons and skill VFX
- city/building identity
- inventory/forge/bestiary presentation
- control editor
- extra world content

## CI policy

Every canonical build runs in this order:

```text
fetch exact stable engine
→ mount canonical HIGHFLY code
→ typecheck
→ unit tests
→ real Sim integration tests
→ browser landscape layout tests
→ build web
→ Capacitor sync
→ native identity checks
→ Gradle APK
→ publish candidate
```

The workflow must fail before APK publication if creator layout, duplicate HUD, product branding or real-runtime combat contracts fail.

## First practical target

The first APK worth installing from this line is not an all-feature build. It is the smallest complete vertical slice:

```text
HIGHFLY boot
→ HIGHFLY creator with 3D preview
→ world
→ clean HIGHFLY mobile HUD
→ natural movement + camera + dash
→ targetless basic
→ Warrior Reaver multi-body
→ Training screen
→ register one set + persistence + RM/e1RM
→ System XP/stat update
→ Hunter reflects it
```

If that vertical slice is clean, later content becomes additive instead of another rewrite.

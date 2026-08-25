# HIGHFLY v1 Canonical Architecture

## Baseline

- Production engine baseline: ClaudeCraft **v0.40.0 stable**.
- `release/v0.41.0` is compatibility-lab only until it becomes a published stable release and passes the HIGHFLY gate.
- The old HIGHFLY patch branches remain historical reference only.
- This branch is the canonical product line.

## Product rule

ClaudeCraft is an engine/library below HIGHFLY. It must never remain visible as the product shell.

```text
ClaudeCraft 0.40 engine
        │
        ▼
HighflyPlatformAdapter
        │
 ┌──────┼────────┬──────────┬──────────┐
 ▼      ▼        ▼          ▼          ▼
Input  Combat  Movement   World    Persistence
        │        │          │          │
        └────────┴────┬─────┴──────────┘
                     ▼
              HIGHFLY Product
        Creator · HUD · Training
        Hunter · System · Hunt
```

## Forbidden integration patterns

The canonical line MUST NOT use these patterns:

1. No replay of legacy patch chains.
2. No DOM overlay where a HIGHFLY HUD is mounted on top of an active ClaudeCraft HUD.
3. No MutationObserver that renames ClaudeCraft text at runtime as branding strategy.
4. No global `__HIGHFLY_*__` hooks as permanent architecture.
5. No monkey-patching `input.readMoveInput` at runtime.
6. No appending HIGHFLY bootstrap code to the end of upstream `main.ts` without a deliberate entrypoint boundary.
7. No duplicated creator: one creator tree owns the screen.
8. No duplicated combat buttons: one mobile combat surface owns input.
9. No string-anchor replacement for gameplay logic.
10. No green build accepted solely because TypeScript compiles. Real-device and browser-layout contracts are mandatory.

## Ownership matrix

### KEEP FROM CLAUDECRAFT ENGINE

- Three.js/WebGL renderer and scene infrastructure.
- Character rigs, animations, KayKit assets and asset loader.
- World terrain, collision, zones, NPC/mob/entity representation.
- Core inventory/equipment data structures where useful.
- World interaction primitives.
- Simulation clock and entity lifecycle.
- Existing character 3D preview renderer as an engine capability.
- Android/Capacitor build plumbing after product identity is replaced.

### ADAPT THROUGH `HighflyPlatformAdapter`

- Query hostile bodies around player.
- Apply damage/effects to real entities.
- Read player position/facing/class/resources.
- Move/teleport/dash with collision-safe engine calls.
- Spawn/despawn and world interactions.
- Inventory and loot bridge.
- Save/load persistent profile state.
- Camera state and native/touch input source.

### REPLACE WITH HIGHFLY PRODUCT CODE

- Native boot and loading screen.
- Product branding and all visible ClaudeCraft product references.
- Character creator layout and flow.
- Mobile HUD/navigation.
- Mobile combat controls.
- Action Combat semantics.
- Movement/facing/dash semantics.
- Fitness/Training UI and persistence.
- RM/e1RM/PR/volume calculations and evidence model.
- XP/stat/rank System Engine.
- Hunter profile presentation.
- Hunt/Tower/portal progression presentation.

## Canonical runtime boundaries

### Boot

```text
Android HIGHFLY
  → HIGHFLY loading screen
  → HIGHFLY creator OR saved profile
  → engine/world initialization
  → HIGHFLY HUD
```

There is no ClaudeCraft title/loading/product screen in this route.

### Character creator

One owned HIGHFLY screen sized for landscape Android.

```text
APPEARANCE      3D PREVIEW
CLASS           class information
SUBCLASS        fixed selection
NAME            profile
ENTER HIGHFLY
```

The 3D preview uses the engine `CharacterPreview`, but HIGHFLY owns the DOM/layout and lifecycle.

### Mobile HUD

Only one mobile HUD is visible.

- Left: movement joystick.
- Right: camera area.
- Right combat cluster: Attack, Skill 1+, Dash/Dodge, Interact.
- Main product navigation: `ENTRENAMIENTO · CACERÍA · CAZADOR · SISTEMA`.
- HP/MP/XP numbers visible.
- No duplicated upstream action ring, quick action strip or desktop menu chrome.

### Combat

Contract:

> Target is optional focus/priority. Geometry decides impact.

```text
Touch / button
  → HighflyInputRouter
  → ActionRequest
  → ActionDefinition
  → Aim/facing
  → Spatial query via adapter
  → bodies hit
  → HitResolver
  → damage/effects via adapter
```

Rules:

- Basic attack works with `targetId = null`.
- Selected target gets priority only when valid and inside action geometry.
- Basic attack normally hits one natural body.
- Reaver/Skill 1 Warrior: frontal cone, 100°, ~5 m, up to 5 bodies.
- Area skills can hit multiple bodies.
- Bodies outside geometry are untouched.
- Resource/cooldown/combo are charged exactly once per cast.
- Ranged projectile hits first body unless explicitly piercing.
- No target-selection action before Attack.

### Movement

- Joystick vector is movement intent.
- Character turns naturally toward movement direction.
- Moving backward relative to camera makes the character turn and run that way; no permanent moonwalk/backpedal behavior.
- Camera yaw is independent from body facing.
- Dash uses current input vector; if no input, uses current facing.
- Dash does not consume a skill slot.

### Training / Strength

Canonical evidence flow:

```text
TrainingPlan
  → Workout
  → Exercise
  → SetPerformance(weight, reps, timestamp, completed)
  → TrainingSession
  → StrengthEngine
       - tonnage
       - tested RM
       - e1RM
       - PR
       - trend
  → HighflySystemEngine
  → HighflyProfile
```

Rules:

- Save immediately after every registered set.
- App restart restores exact active session.
- Tested RM and estimated e1RM are distinct evidence.
- Epley is used for estimated 1RM in the intended rep range; 1 rep is exact.
- Session completion grants rewards exactly once.

### System/Profile

`HighflyProfile` is the canonical source for:

- level / XP / rank
- STR / AGI / VIT / PER / INT
- class / subclass
- equipment / inventory / currency
- world progression
- training records

`HighflySystemEngine` consumes idempotent events such as:

- `SET_COMPLETED`
- `SESSION_COMPLETED`
- `PR_ACHIEVED`
- `HUNT_COMPLETED`
- `BOSS_DEFEATED`
- `RANK_UP`

No duplicate XP/reward is allowed for the same event id.

## Build and test gate

A build is NOT a valid HIGHFLY candidate unless all of these pass:

### Static / unit

- TypeScript clean.
- Strength/RM tests.
- System idempotency tests.
- Combat geometry tests.

### Real engine integration

- Basic attack with no selected target damages a real engine entity.
- Manual target remains optional priority.
- Reaver damages two real bodies in cone and not a body outside.
- Resource and cooldown are consumed once.
- Movement plan produces forward-running body facing.
- Dash uses directional input.

### Browser/mobile layout

Automated browser checks at landscape reference sizes, including 2340×1080 and a CSS-pixel S23 Ultra landscape profile:

- no horizontal overflow
- creator fully visible
- 3D preview canvas non-zero size and rendered
- no duplicate mobile HUD
- no ClaudeCraft product logo/text in native route
- HIGHFLY controls remain inside safe areas

### Native

- own application id and name
- upstream OTA disabled
- immersive landscape
- clean install
- restart persistence
- APK produced and release manifest matches commit

## Acceptance definition

A feature counts as integrated only when it works through the real mobile path, not merely when its pure function test passes.

For example, Action Combat is DONE only when:

```text
finger → HIGHFLY button → HIGHFLY input → CombatCore
→ real engine bodies → real damage
```

Training is DONE only when:

```text
screen → register set → persist → restart → restore
→ finish → RM/e1RM/PR → System → XP/stats → Hunter
```

# HIGHFLY v1 Clean Core

This directory is the canonical HIGHFLY product layer.

## Rule

HIGHFLY domain logic must live here as normal TypeScript modules. It must not depend on replaying legacy patch chains or replacing exact text fragments inside ClaudeCraft.

ClaudeCraft is treated as the upstream engine. Integration happens through explicit platform adapters and small deliberate seams.

## Modules

- `combat/` — data-driven actions, geometry and target policy. Target is optional focus; geometry decides impact.
- `training/` — set/session strength math, tested RM vs estimated 1RM.
- `system/` — idempotent progression events and canonical hunter profile.
- `platform/` — boundary between HIGHFLY domain code and the current upstream engine.

## Current contracts

- Basic combat can resolve without a selected target.
- A selected target is priority only when valid inside the action geometry.
- Reaver Strike is a 100-degree frontal multi-body action.
- Non-piercing projectiles resolve the first body in the corridor.
- Epley e1RM is used for 1-10 reps while tested 1RM remains separate evidence.
- HIGHFLY events are idempotent and cannot grant the same reward twice.

## Migration policy

Legacy branches remain reference material only. New behavior is reimplemented cleanly in this module and verified by contracts before it is wired into the adapter.

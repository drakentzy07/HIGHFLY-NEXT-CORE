# HIGHFLY — ClaudeCraft Full Donor Pipeline

Branch: highfly/claudecraft-donor-v0433  
Source donor: levy-street/world-of-claudecraft @ v0.43.3

## Rule

REUSE FIRST, as far as technically and legally possible.

The pipeline keeps ClaudeCraft in GitHub/cloud storage. The user's PC does not need a local clone.

## What the cloud job extracts

### CORE
- src/sim/**
- src/world_api.ts + src/world_api/**
- src/render/**
- src/guide/content.generated.ts
- scripts/assets/**
- LICENSE / CREDITS / THIRD_PARTY_NOTICES
- generated donor audit + manifest

### WORLD MEDIA
- public/models/**
- public/textures/**
- public/env/**
- public/vfx/**

### AUDIO
- public/audio/**

Artifacts remain separated so HIGHFLY can consume only what is useful without copying the full ClaudeCraft repository into the Unity project.

## Unity strategy

Priority order:

1. Direct import
2. Automated conversion
3. Bridge to original ClaudeCraft simulation
4. Reimplement only when the first three are not viable

The first cloud run is an inventory/audit run. Its manifest becomes the input for the next phase: HIGHFLY Unity importer / ScriptableObject generation for zones, dungeons, spawns, mobs, quests, professions, fishing, logging, mining, farming and related systems.

## Licensing

ClaudeCraft code is MIT. Media licensing is per asset and CREDITS.md is authoritative. Generated donor artifacts are for internal HIGHFLY evaluation until the media license filter is complete.

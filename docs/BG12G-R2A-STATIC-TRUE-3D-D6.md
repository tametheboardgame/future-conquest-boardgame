# BG12G-R2A — Static True-3D D6 Prototype

Status: **IMPLEMENTED, STATIC VISUAL GATE PENDING**

## Goal

Prove that the revised BG12G-R dice direction can read as a solid physical D6 before any throw, bounce or settle animation is attempted.

BG12G-R2A is deliberately isolated from authoritative combat and from the MapLibre renderer. It is a visual prototype only.

## Prototype route

Use:

`/?bg12g-r2a=1&face=1`

Change `face` from `1` through `6` to inspect each upward resting face.

The route dynamically loads a dice-only Three.js/WebGL scene instead of mounting the board application. This prevents the prototype renderer from sharing lifecycle or state with MapLibre.

## Delivered prototype

- one bevelled true-3D D6 using `RoundedBoxGeometry`;
- conventional opposite-face numbering and pip layouts;
- all six face-up resting orientations;
- real perspective projection;
- real scene lighting;
- tray floor;
- cast/contact shadow;
- static composition only, with no combat state, RNG or motion path;
- owned renderer teardown including geometry/material disposal and explicit WebGL context release.

## Automated evidence

`scripts/capture-bg12g-r2a-static.mjs` captures:

- `face-1.png`
- `face-2.png`
- `face-3.png`
- `face-4.png`
- `face-5.png`
- `face-6.png`
- `evidence.json`

The dedicated `BG12G-R2A static true-3D dice gate` workflow builds the exact PR head, verifies a live WebGL context, captures all six static orientations and uploads the evidence as an Actions artifact.

## Gate

R2A passes only when the six static screenshots unmistakably read as a solid cube-shaped physical die with visible depth and convincing grounding.

Do not start BG12G-R2B motion work merely because automation is green. Manual visual acceptance remains authoritative.

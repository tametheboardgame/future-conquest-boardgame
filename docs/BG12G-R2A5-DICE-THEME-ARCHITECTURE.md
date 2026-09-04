# BG12G-R2A.5 — Dice Theme Architecture

Status: **IMPLEMENTED — EXACT-HEAD VALIDATION RUNNING**

## Goal

Make the accepted BG12G-R2A true-3D D6 appearance deliberately configurable before motion is added, without building player-facing cosmetics or allowing presentation choices to affect authoritative combat.

## Architecture

`src/components/bg12gDiceTheme.ts` owns the typed cosmetic contract.

The renderer receives a `DiceTheme` and defaults to `DEFAULT_DICE_THEME`. The default reproduces the user-accepted R2A appearance exactly:

- ivory body `0xe9dfc9`;
- dark pips `0x171317`;
- bevel radius `0.18` with eight segments;
- body roughness `0.38` and metalness `0.02`;
- dark tray background `0x171014`;
- tray floor `0x3a2020` with the accepted material values.

`normaliseDiceTheme()` constrains future cosmetic values to safe geometry/material ranges before the renderer consumes them.

## Configurable presentation surface

R2A.5 makes these values theme-owned rather than renderer constants:

- die body colour;
- body roughness, metalness and restrained emissive treatment;
- bevel radius and segment count;
- pip colour and material treatment;
- pip radius, depth, spacing and surface offset;
- pip style identifier;
- tray scene background;
- tray floor colour, roughness and metalness.

The renderer contains a `PIP_STYLE_RENDERERS` registry. `classic-round` is the only implemented style in R2A.5; later symbol/pip renderers can register under another style identifier without changing authoritative D6 values or combat logic.

Unknown pip style identifiers safely fall back to `classic-round` until a renderer is implemented for that style.

## Scope boundary

R2A.5 does not add:

- Settings UI;
- unlock/progression rules;
- cosmetics inventory or shop;
- a player-facing theme catalogue;
- any rules, RNG, combat-state or save dependency on cosmetic selection.

Those remain later Settings/polish concerns after the physical dice interaction has passed its motion and integration gates.

## Validation

The BG12G-R2A source contract now also proves that:

- the accepted default values are retained;
- the true-3D renderer consumes theme values for die, pips, bevel and tray;
- safe-range normalisation exists for geometry/material controls;
- a pip-style extension registry exists;
- the theme module has no board-state dispatch or random-number dependency.

The existing exact-head R2A workflow continues to compile the production bundle and capture all six static upward faces, ensuring R2A.5 does not regress the already accepted static die presentation.

## Exit criterion

R2A.5 is complete when its exact-head source/build/static-capture gate is green. It does not require a new player-facing visual approval because the accepted R2A appearance is intentionally unchanged.

R2B may start only after R2A.5 is green; R2B remains subject to its own motion visual gate before combat integration.

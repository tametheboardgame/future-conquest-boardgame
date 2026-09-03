# BG11C — Dice Presentation and Combat-Result Feedback

> **Historical package note — 3 September 2026:** This document records the original BG11C D20 presentation package. BG12G-R supersedes its player-facing die model and current combat wording with the locked **2D6** combat standard. The determinism, authoritative-result, accessibility and presentation-only principles below remain valid; D20-specific values and visuals are historical rather than current requirements.

## Goal

Make the existing deterministic D20 combat system easier to read and more satisfying to operate without changing any combat rule, target calculation, random-number source or consequence.

## Pre-roll presentation

When a legal attacker and defender are selected, the combat panel now shows:

- a physical D20-style visual;
- the natural die result required to hit;
- the exact hit percentage across the 20 equally likely die faces;
- the visible roll equation (`1D20 + attack modifier vs target`);
- the existing base target, supply, terrain and fortification breakdown;
- an explicit `Roll D20 · 1 Command Action` commitment label.

The displayed chance is calculated from the authoritative `getBoardCombatPreview()` target and attack modifier. It does not recreate terrain, supply or fortification rules.

## Result presentation

Resolved combat now presents:

- the rolled D20 as a prominent die face;
- text/symbol labels for `HIT`, `MISS` and `CRITICAL HIT` so outcome is not colour-only;
- the authoritative attack total versus target;
- the exact die + supply modifier equation;
- compact consequence tags for damage, readiness loss, retreat and control change;
- polite live-region announcement for assistive technology.

The result reveal uses a short presentation animation only. Reduced-motion users receive the same information with animation disabled.

## Rules and determinism boundaries

BG11C does not change:

- `board-combat.ts`;
- seeded RNG or the D20 roll itself;
- combat target/modifier calculation;
- damage/readiness/retreat/elimination/control procedures;
- Command Action costs;
- activation progression;
- AI;
- save data;
- MapLibre/WebGL/terrain renderer code.

## Acceptance

- pre-roll odds agree with the authoritative preview;
- the player can read why a roll succeeded or failed at a glance;
- natural-20 critical results are visually distinct and explicitly labelled;
- no second or presentation-owned random path exists;
- reduced-motion and forced-colour modes retain complete combat information;
- exact-head regression, browser and performance gates remain green.

For current combat requirements after 3 September 2026, use `docs/BOARDGAME-CONVERSION-ROADMAP.md` and the BG12G-R 2D6 combat standard rather than the D20-specific acceptance wording above.

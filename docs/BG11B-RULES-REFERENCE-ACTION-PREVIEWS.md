# BG11B — Compact Rules Reference and Contextual Action Previews

> **Current-rules note — 3 September 2026:** BG11B originally shipped while combat still used D20. BG12G-R later superseded that die model. The live quick reference must describe the locked **2D6** combat standard while preserving BG11B's presentation-only architecture and authoritative-rules boundary.

## Goal

Continue BG11 onboarding and feedback polish by answering two questions without opening a long manual:

1. **What can I do right now?**
2. **What are the core rules again?**

BG11B is presentation-only. It does not own board rules, deterministic state, save format, campaign geography or the protected map renderer. When a later package changes an authoritative rule, as BG12G-R does for combat dice, the reference text follows the authoritative rule rather than preserving obsolete wording.

## Contextual action guidance

The board shell now exposes a compact `Next useful action` strip.

During a human activation it calculates, using existing authoritative legality helpers:

- how many active-seat formations have at least one legal Move;
- how many have at least one legal Attack;
- how many distinct support action types (Recover, Engineer, Logistics) are currently legal;
- how many strategic cards are in hand;
- whether Pass Activation is currently legal.

The accompanying hint changes for round start, round end, computer activations, exhausted Command Actions and resolved campaigns.

The guidance does not dispatch actions or maintain its own rules state.

## Compact rules reference

A persistent `Rules` control opens a compact reference containing:

- turn and Command Action rules;
- movement and authoritative 2D6 combat rules;
- support actions and strategic cards;
- Central Front objectives and victory conditions;
- current live objective ownership.

For current combat the quick reference states that two seeded D6s are rolled and summed, supply modifies the attack, terrain/fortification contribute to the displayed defence target, double six is critical, and fortification is binary/non-stacking. Numerical calibration remains owned by the combat engine and BG12G-R rules contract rather than duplicated as independent UI logic.

Objective names and victory thresholds come from the BG10 campaign constants and projected campaign status rather than duplicated numeric configuration.

## Accessibility and layout

- keyboard-operable Rules toggle with `aria-expanded` and `aria-controls`;
- labelled contextual preview and rules surfaces;
- no critical state communicated only through colour;
- forced-colour treatment;
- reduced-motion treatment;
- compact/mobile positioning kept clear of the bottom Guide control/navigation;
- the non-interactive action hint uses `pointer-events: none` so it cannot block map interaction.

## Protected boundaries

BG11B does **not** touch:

- MapLibre/WebGL lifecycle;
- terrain sources/layers;
- board action resolution;
- deterministic RNG;
- AI rules;
- save serialisation/deserialisation;
- campaign scoring/victory semantics.

## Acceptance

- a player can see a concise, rules-derived indication of useful actions without trial-and-error;
- the quick reference accurately describes the current board-game rules, including the locked 2D6 combat model;
- the quick reference remains available after onboarding is dismissed;
- map interaction remains unobstructed;
- existing exact-head regression, browser and performance gates remain green.

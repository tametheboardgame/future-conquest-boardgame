# BG11B — Compact Rules Reference and Contextual Action Previews

## Goal

Continue BG11 onboarding and feedback polish by answering two questions without opening a long manual:

1. **What can I do right now?**
2. **What are the core rules again?**

BG11B is presentation-only. It does not alter board rules, deterministic state, save format, campaign geography or the protected map renderer.

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
- movement and D20 combat rules;
- support actions and strategic cards;
- Central Front objectives and victory conditions;
- current live objective ownership.

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
- the quick reference accurately describes the current board-game rules;
- the quick reference remains available after onboarding is dismissed;
- map interaction remains unobstructed;
- existing exact-head regression, browser and performance gates remain green.

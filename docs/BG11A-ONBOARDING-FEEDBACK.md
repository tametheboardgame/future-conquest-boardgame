# BG11A — Board-Game Onboarding and Action Feedback

## Goal

Make the converted Central Front board game understandable from the first turn without reintroducing the retired simulation workflow or changing the protected map renderer.

## Scope

BG11A adds a compact five-step first-turn guide covering:

- the Central Front objectives at Paris, Brussels and Rhine-Ruhr;
- Command Actions and free strategic cards;
- direct map-piece movement and legal/blocked destinations;
- visible D20 combat previews and modifiers;
- Recover, Engineer, Logistics and strategic card use.

The guide appears on first use, can be skipped, and remains replayable from the persistent `Guide` control. Completion is a local player preference and is not authoritative campaign/save state.

## Retired tutorial presentation

The pre-conversion tutorial remains in the codebase for compatibility with retained simulation state, but BG11A suppresses its presentation while the board-game shell is mounted. BG11A does not mutate, migrate or advance the legacy tutorial save state.

## Disabled-action feedback

BG11A makes authoritative preview rejection reasons visible rather than leaving them only in disabled-button tooltips:

- Pass Activation shows its current rejection reason beside the activation actions;
- Recover, Engineer and Logistics list the selected formation's unavailable-action reasons;
- the selected strategic card shows the authoritative reason when it cannot currently be played.

These messages are projections of existing authoritative preview APIs. They do not create a second legality path.

## Accessibility and renderer safety

- Focused guide targets use an outline and halo, not colour alone.
- Rejection messages use text and structural borders.
- Guide controls remain semantic buttons with focus-visible treatment.
- Reduced-motion preferences are respected.
- No MapLibre, WebGL, terrain source/layer or map lifecycle code is changed.

## Acceptance

BG11A is accepted when:

- a new player receives board-game-specific first-turn guidance;
- the guide can be skipped and replayed;
- the retired simulation tutorial is not shown alongside the board-game guide;
- disabled Pass, Support and Card actions expose understandable visible reasons;
- authoritative rules and Command Action costs are unchanged;
- the protected map renderer is untouched;
- exact-head repository validation is green.

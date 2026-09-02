# BG11E — Movement Presentation Polish

## Goal

Finish the BG11 movement presentation pass without reopening the authoritative BG4 movement rules or the hardened physical-miniature renderer lifecycle.

## Scope

BG11E improves the existing map-driven Move interaction with clearer board-game affordances:

- the selected MapLibre formation marker gains an explicit `SELECTED` label rather than relying on colour/halo alone
- the retained SVG fallback selected marker gains a non-colour underline treatment
- destination controls visibly identify `LEGAL`, `PREVIEW`, and `BLOCKED` states in text as well as colour
- the move preview is presented as a stronger origin → destination route card with the existing Command Action cost retained
- movement feedback receives a distinct status treatment
- destination, Confirm and Cancel controls use at least 44px touch targets, increasing to 46px on compact layouts
- movement controls have explicit keyboard `:focus-visible` treatment

## Existing animation retained

BG4D already projects accepted authoritative movement into the physical Three.js formation miniatures. It also:

- retargets from the current presentation position
- avoids restarting travel after selection/status-only rebuilds
- honours application and operating-system reduced-motion preferences
- repaints only while a miniature is genuinely travelling
- falls back safely if the physical renderer fails

BG11E therefore does not add a second animation or alter that renderer. The presentation polish is deliberately static around the existing physical move animation.

## Rules boundary

BG11E does not change:

- `getBoardMoveDestinations`
- one-space adjacency or destination legality
- rejection reasons
- `move-piece`
- Command Action spending
- activation progression
- authoritative piece locations
- save state
- Three.js/MapLibre movement projection or lifecycle

## Acceptance

BG11E is accepted when:

- selected, legal, preview and blocked movement states remain understandable without colour alone
- destination and confirmation controls are usable by keyboard and practical touch targets
- the route preview remains explicit before commitment
- BG4 authoritative movement and BG4D physical animation contracts remain unchanged
- exact-head regression, integrated browser/campaign and terrain performance gates remain green

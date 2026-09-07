# BG12K — Secondary Drawers

BG12K converts retained supporting command surfaces into temporary board-game aides without changing their authoritative game or settings state.

## Presentation contract

- **Forces** is a temporary left-side aide.
- **Rules & Save** keeps the existing Campaign controls but presents them as a temporary right-side aide.
- **Settings** keeps the existing `StartupExperience` / `GlobalSettingsPanel` architecture and presents the gameplay panel as a temporary right-side aide.
- Forces and Rules & Save preserve the most recent command-map presentation underneath as an inert, non-interactive visual context layer.
- Only one secondary aide is available at a time. Settings cannot be opened while Forces or Rules & Save is active, and command navigation is suspended while Settings is open.
- `Escape` closes Settings first, otherwise it closes an active Forces or Rules & Save aide back to the Board.
- Long aide content scrolls internally. Compact layouts leave visible board space and respect the collapsed tabletop rail.

## Ownership boundaries

BG12K is presentation-only. It does not add or change combat, movement, logistics, save semantics, formation rules, tutorial progression, settings persistence, MapLibre camera/projection logic, or renderer data ownership.

`App` remains authoritative for Forces and Campaign state/actions. `StartupExperience` and `GlobalSettingsPanel` remain authoritative for Settings. The BG12K map underlay is `aria-hidden`, inert and pointer-inactive; it never accepts gameplay input.

## Acceptance gate

Exact-head validation must prove:

1. The normal closed state remains the existing board-first composition.
2. Forces opens on the left with the board still visibly present behind it.
3. Rules & Save opens on the right with the board still visibly present behind it.
4. Gameplay Settings opens on the right while the live board remains visible.
5. Aides are bounded and internally scrollable on wide, laptop and compact viewports.
6. No two secondary aides are simultaneously active.
7. Closing each aide returns cleanly to the board without leaving a stale map underlay.
8. Existing regression tests and production build remain green.

BG12K requires manual visual approval after exact-head browser evidence is reviewed. The pull request must remain draft and unmerged until that approval is explicit.

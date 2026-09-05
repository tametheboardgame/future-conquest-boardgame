# BG12H — Contextual Formation Interaction

Status: **ACTIVE**  
Started: 4 September 2026  
Base: `cb85e9abb622aa3792ea1cdd83fe9896e77504fb`

## Purpose

Replace the permanent Turn / Combat / Support control hierarchy with a compact board-game interaction centred on the formation the player has selected on the map.

The intended normal flow is:

1. select a friendly formation;
2. choose **Move / Attack / Support / Pass**;
3. choose a legal map destination or target where the action requires one;
4. show only the compact preview/confirm/cancel presentation needed for that action;
5. resolve through the existing authoritative board dispatcher;
6. collapse the contextual interaction after accepted resolution.

Cards remain an existing physical tabletop component. BG12H does not redesign the card system or the later BG12K secondary-drawer architecture.

## Locked authority boundaries

BG12H is presentation and interaction orchestration only.

It must reuse:

- `getBoardMoveDestinations` and `move-piece` for Move;
- `getBoardCombatTargets`, `getBoardCombatPreview`, the shared probability helper and `attack-piece` for Attack;
- `recover-piece`, `engineer-position` and `logistics-piece` for Support;
- `pass-activation` for Pass;
- the accepted BG12G-R true-3D 2D6 renderer for combat presentation.

BG12H must not:

- create another movement legality implementation;
- create another combat or probability implementation;
- create another support-action rules path;
- consume presentation RNG or change authoritative RNG sequencing;
- let dice animation determine the combat result;
- alter MapLibre camera, terrain, DEM, map lifecycle or formation geography;
- restore quarantined legacy simulation controls.

## Interaction contract

### Idle / selection

- No formation action panel should dominate the rail before a formation is selected.
- Clicking a friendly formation establishes the contextual formation.
- Enemy or invalid selections must not silently replace the active friendly formation.
- Selection remains keyboard/accessibility compatible through retained fallback controls.

### Action choice

The selected formation exposes one compact action row:

- **Move** when authoritative movement offers a legal destination;
- **Attack** when authoritative combat offers a legal adjacent target;
- **Support** when at least one existing support action is legal;
- **Pass** according to authoritative activation legality.

Unavailable actions remain understandable through concise reasons rather than disappearing without explanation.

### Move

- Entering Move activates the existing direct-map legal/blocked destination highlights.
- Clicking a legal region creates a compact move preview.
- Confirm dispatches exactly one authoritative `move-piece` action.
- Cancel returns to the selected formation action row without spending an action.
- Accepted resolution clears/collapses the formation interaction.

### Attack

- Entering Attack binds the accepted combat UI to the already-selected formation.
- Direct enemy map contact selection remains the primary target interaction.
- Accessible target fallback may remain available.
- The existing authoritative 2D6 preview and combat dispatch remain unchanged.
- The accepted true-3D dice tray runs only after the authoritative result exists.
- The interaction collapses only after the dice/result presentation has completed.

### Support

- Entering Support binds Recover / Engineer / Logistics to the selected formation.
- Existing authoritative preview reasons determine availability.
- Accepted support resolution clears/collapses the formation interaction.
- Cancel returns to the selected formation action row without mutation.

### Pass

- Pass uses the existing authoritative preview/dispatcher.
- Accepted Pass clears/collapses the interaction.

## Presentation contract

- The map remains the dominant visual surface.
- BG12H must remove the need to manually switch between permanent **Turn / Combat / Support** rail tabs for ordinary formation play.
- The contextual action surface must feel attached to the selected board piece, not like another application dashboard.
- Confirmation UI is short and local.
- After resolution, the interaction gets out of the way.
- Cards remain reachable without reintroducing the old four-surface control hierarchy.

## Accessibility

- Action buttons have visible labels and keyboard focus.
- Disabled actions expose useful reasons.
- Direct map interaction retains accessible control fallbacks.
- Critical combat state remains readable without animation, colour or sound.
- Reduced motion continues to use the accepted BG12G-R behaviour.

## Validation

Required before manual acceptance:

1. deterministic/source contracts for the contextual ownership boundary;
2. full project regression suite;
3. production build;
4. direct-map Move evidence;
5. direct-map Attack evidence using the accepted 2D6 tray;
6. Support and Pass evidence through the shared dispatcher;
7. interaction collapse after accepted actions;
8. map remains interactive after formation actions and dice lifecycle;
9. no new browser errors or renderer/context leaks.

## Manual gate

BG12H does not merge until the user confirms that ordinary formation play now reads naturally as:

**select piece → choose action → choose target/destination → confirm/resolve → back to board**.

A technically green implementation that still feels like navigating application panels fails this gate.

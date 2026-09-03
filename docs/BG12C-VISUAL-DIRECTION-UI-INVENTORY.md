# BG12C — Visual Direction Lock and UI Inventory

## Status

BG12C converts the approved tabletop concept into an engineering acceptance contract before runtime presentation is removed, moved or rewritten.

This package is deliberately **non-runtime**. It changes no gameplay rules, authoritative board state, renderer lifecycle, map projection, movement, combat, cards, support, escalation, AI or save behaviour.

The machine-readable source of truth for this package is:

- `docs/bg12c-ui-inventory.json`

The regression contract is:

- `tests/bg12c-visual-direction-inventory.test.cjs`

## Why the current Board screen piles up

The existing application is transitional rather than compositionally final.

`src/main.tsx` currently mounts four board/application surfaces as root siblings inside the authoritative board provider:

1. `TabletopStatusShell`
2. the legacy `App`
3. `TabletopCombatPanel`
4. `TabletopActivationPanel`

`TabletopStatusShell` then owns six additional tabletop surfaces:

- `TabletopContextHint`
- `TabletopCardHandPanel`
- `TabletopSupportPanel`
- `TabletopPassReason`
- `TabletopRulesReference`
- `TabletopOnboarding`

The result is several independently positioned surfaces competing for the same viewport around a map that is supposed to be the dominant game object.

BG12C does **not** solve that by immediately deleting components. It first records which surface owns each responsibility, what survives, where it moves and which later package is responsible for the change.

## Locked visual direction

Normal play is moving to a tabletop-first composition.

The persistent ordinary-play chrome is limited to:

1. a thin top status strip;
2. minimal navigation;
3. a right-hand tabletop rail containing physical game components.

In addition:

- at most **one** contextual interaction surface may accompany the board;
- at most **one** small coach mark or transient toast may be visible at once;
- the map should command roughly **80–90% of visual attention**;
- Board, Forces, Rules / Save and Settings are the intended navigation destinations;
- Cards and Combat are interactions/components rather than full-screen destinations;
- Regions, Engineer, Logistics and Intel leave normal-player navigation;
- physical cards, pieces and dice carry presentation that is currently expressed through forms and dashboards;
- the accepted 2.5D map and retained renderer lifecycle remain protected infrastructure.

## Classification policy

Every significant visible or historically required surface is assigned exactly one class.

| Classification | Meaning |
| --- | --- |
| `KEEP` | Already the correct product surface or protected infrastructure. |
| `TRANSFORM` | The authoritative purpose remains, but the current presentation is recomposed. |
| `COLLAPSE` | Useful information/action survives inline or contextually; its standalone surface does not. |
| `RETIRE` | The surface has no remaining normal board-game product purpose. |
| `DEBUG-ONLY` | Temporarily retained only for explicit diagnostics or historical validation while legacy dependencies remain. |

## Surface migration summary

The JSON inventory contains the complete owner-by-owner contract. The major product surfaces are summarised below.

| Surface | Class | Target | Owning package |
| --- | --- | --- | --- |
| 2.5D board map | KEEP | Dominant central board surface | BG12E / BG12I |
| Physical formation pieces | KEEP | Physical pieces projected from authoritative state | BG12I / BG12L |
| Tabletop status shell | TRANSFORM | Thin top status strip | BG12E |
| Command navigation | TRANSFORM | Minimal Board / Forces / Rules-Save / Settings navigation | BG12D / BG12E / BG12K |
| Cards navigation control | COLLAPSE | Cards handled directly in tabletop rail | BG12F |
| Legacy `More` gateway | RETIRE | No normal-player gateway | BG12D |
| Map context/sidebar | COLLAPSE | One contextual formation/action card | BG12H / BG12I |
| Permanent legends/mode boxes | COLLAPSE | Small utilities only when relevant | BG12I |
| Activation panel | TRANSFORM | Contextual formation action card | BG12H |
| Combat panel | TRANSFORM | Compact attack preview + physical dice tray | BG12G / BG12H |
| Strategic card hand | TRANSFORM | Physical deck, discard and hand | BG12F |
| Support panel | TRANSFORM | Contextual Support submenu | BG12H |
| Pass-reason surface | COLLAPSE | Inline active-action feedback | BG12H |
| Context hint | COLLAPSE | Small coach mark/contextual hint | BG12J |
| Rules reference | TRANSFORM | Rules / Save drawer | BG12K |
| Onboarding window | TRANSFORM | Coach marks anchored to real controls/map state | BG12J |
| Settings | TRANSFORM | Settings drawer | BG12K |
| Forces workspace | TRANSFORM | Forces drawer | BG12K |
| Campaign Rules / Save workspace | TRANSFORM | Rules / Save drawer | BG12K |
| Regions / Engineer / Logistics / Intel | DEBUG-ONLY | Temporary diagnostics route | BG12D, delete in BG12O4 |
| Legacy Operations workspace | DEBUG-ONLY | Temporary diagnostics route | BG12D, delete in BG12O4 |
| Operational infrastructure/interdiction/defence dashboards | DEBUG-ONLY | Diagnostics only where still required | BG12D, delete in BG12O4 |
| Legacy Combat Reports workspace | DEBUG-ONLY | Diagnostics only if still required | BG12D, delete in BG12O4 |
| Legacy command metrics | RETIRE | None | BG12D / BG12O4 |
| Legacy simulation tutorial | RETIRE | Replaced by board coach marks | BG12D / BG12J / BG12O4 |
| Operational day-resolution/global resolve controls | RETIRE | Board rounds and activations are authoritative | BG12D / BG12O3-4 |
| Operational notification strips | COLLAPSE | One board-relevant transient feedback surface | BG12D / BG12E / BG12L |

## Current overlay and collision stack

BG12C records the current z-index relationships because they explain several historical click interception and presentation problems.

| Surface | Current z-index |
| --- | ---: |
| Context hint | 31 |
| Card hand | 34 |
| Activation panel | 34 |
| Combat panel | 34 |
| Support panel | 34 |
| Legacy command topbar | 36 |
| Rules button | 72 |
| Guide button | 72 |
| Rules reference | 73 |
| Onboarding card | 74 |

Several unrelated surfaces therefore occupy the same stacking level and independently reserve the left, right, top and bottom edges of the map. Later packages should remove the need for this stack rather than merely assigning ever-higher z-index values.

## Desktop surface budget

For viewports wider than 900px, the target contract is:

- status strip: no more than **48px** high;
- minimal navigation: no more than **72px** wide;
- tabletop rail: no more than **320px** wide;
- idle board: at least **70% of viewport width** remains available to the map;
- no more than **three** persistent chrome surfaces;
- no more than **one** contextual interaction surface;
- no more than **one** transient coach mark/toast;
- no more than **2px** horizontal document overflow.

These are composition budgets, not permission to fill every available pixel with opaque UI. The map remains the primary visual object.

## Compact / touch surface budget

For viewports at or below 900px:

- status strip: no more than **64px** high;
- navigation thickness: no more than **56px**;
- tabletop rail is collapsed by default;
- an open drawer may occupy no more than **46% of viewport height**;
- the idle map should retain at least **60% of viewport height**;
- no more than one contextual surface and one transient coach mark/toast;
- no more than 2px horizontal document overflow.

Compact mode must preserve the same game mental model as desktop rather than becoming a second dashboard layout.

## Browser and screenshot acceptance contract

The standard presentation review viewports are:

- `1900x829`
- `1366x768`
- `640x900`

As BG12D onward implements the contract, normal-play browser assertions must increasingly prove **absence** of obsolete surfaces rather than keeping them alive for historical tests.

A normal-play screenshot passes only when:

- no `More` gateway or legacy Regions / Engineer / Logistics / Intel route is visible after BG12D;
- only the status strip, minimal navigation and tabletop rail persist around an idle board;
- at most one contextual interaction surface is open;
- at most one transient coach mark/toast is visible;
- persistent/contextual surfaces do not collide outside their reserved edge regions;
- horizontal overflow stays within the two-pixel tolerance;
- the idle map meets the relevant desktop/compact size budget;
- no legacy operational workspace is present;
- critical state remains legible without relying only on colour, sound or animation.

## Historical browser-test quarantine

Two currently active historical browser probes still depend on old specialist workspaces:

- `scripts/probe-r3-wp6-command-ui.mjs`
- `scripts/probe-r3-wp6-5-interface-polish.mjs`

`R3 WP9 visual polish and integrated validation` currently rewrites those probes at runtime so they can still reach legacy Engineer, Regions, Logistics and Intel routes from the transitional shell.

That is a compatibility seam, not a product requirement.

BG12D will replace normal-player access with an explicit temporary diagnostics contract:

- `?legacy-ui=1`

The rules for that route are:

1. it is diagnostics-only;
2. it is never the default;
3. it is never exposed as ordinary player navigation;
4. a historical probe that still genuinely protects runtime/renderer behaviour must opt into it explicitly;
5. ordinary Board screenshots/tests assert the legacy surfaces are absent;
6. BG12O removes the legacy presentation and simulation dependency once renderer equivalence has been proven.

The query contract is intentionally temporary. It exists so presentation can be simplified before old renderer-compatible simulation dependencies are safe to delete.

## Package hand-off

BG12C deliberately assigns later work instead of mixing the whole reset into one risky change.

- **BG12D** — quarantine legacy presentation and move historical specialist probes to the explicit diagnostics path.
- **BG12E** — create the final tabletop page composition and persistent chrome.
- **BG12F** — turn strategic cards into a physical deck/hand system in the tabletop rail.
- **BG12G** — create the physical dice tray and deterministic rolling presentation.
- **BG12H** — replace fixed Activation/Combat/Support panels with one contextual formation interaction surface.
- **BG12I** — reduce map UI and move more state onto physical board tokens/markers.
- **BG12J** — replace the large onboarding window with map/control coach marks.
- **BG12K** — move Forces, Rules/Save and Settings into secondary drawers.
- **BG12L–N** — effects, audio and responsive/touch refinement after the composition is accepted.
- **BG12O** — extract and delete legacy simulation presentation only after the board-only projection is proven stable.

## Acceptance checklist

BG12C is complete when the repository can answer all of the following for every significant current surface:

- Why does it exist now?
- Does its responsibility remain in the final board game?
- Is it KEEP, TRANSFORM, COLLAPSE, RETIRE or DEBUG-ONLY?
- Which component currently owns it?
- Where will the surviving responsibility move?
- Which BG12 package performs that move?
- When may the old surface be removed safely?
- Does a historical browser/runtime probe still depend on it?
- If so, will that probe use the temporary diagnostics route instead of forcing normal-player access?

The machine-readable inventory and regression contract enforce those answers.

## Rules and renderer boundary

BG12C changes no runtime behaviour.

The following remain explicitly protected:

- MapLibre/WebGL lifecycle;
- DEM/terrain setup;
- map mounting and camera behaviour;
- cities and landmarks;
- retained physical formation rendering;
- authoritative board state and dispatcher;
- movement/combat/card/support/escalation/AI rules;
- deterministic save/reload;
- deterministic RNG.

Later visual packages may project these systems differently, but presentation must never become a second rules engine.

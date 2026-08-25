# Future Conquest Boardgame Conversion Roadmap

## Mission

Convert the proven, working `future-conquest` simulation into the new digital board-game version of Future Conquest **by editing the existing application around its working 2.5D map**, not by transplanting that map into another application architecture.

**The map is the foundation. The game around it changes.**

The abandoned `future-conquest-tabletop` repository is now reference-only. It may contribute rules, tests and UI ideas, but its application/rendering architecture must not be copied wholesale.

---

# Locked Architectural Decisions

1. **Preserve the working map stack.** The current MapLibre/WebGL lifecycle, DEM/terrain setup, map mounting behaviour, camera, cities, landmarks and physical map presentation are protected infrastructure.
2. **Convert in place.** Replace simulation UI and mechanics progressively inside the known-good application.
3. **Board state is authoritative.** The renderer displays state. React presentation does not decide game outcomes.
4. **Small packages, frequent deployments.** Any change that can affect the map is deployed and checked on the real hardware before the next risky package.
5. **Real hardware wins.** Automated browser tests never overrule a freeze or regression on the accepted real PC/browser.
6. **Keep the visual identity.** The game should look like a physical strategy board game being played on the existing 2.5D campaign map, not like a spreadsheet-heavy military simulator.
7. **Simplify systems aggressively.** Logistics, engineering, escalation and support should become understandable actions, cards, tracks and tokens rather than deep operational interfaces.

---

# BG0 - Golden Baseline

**Status: ACCEPTED**

The freshly imported original application is the golden baseline for all subsequent work.

Accepted baseline:

- Repository: `tametheboardgame/future-conquest-boardgame`
- Accepted `main`: `0faa6c818af1959adcf26633c10de8e62a3d42b2`
- Production: `https://tametheboardgame.github.io/future-conquest-boardgame/`
- Real-hardware result: working and responsive, with no hard freeze

Protected baseline behaviours:

- startup/launcher lifecycle
- map mount lifecycle
- MapLibre/WebGL context behaviour
- terrain and DEM configuration
- camera movement
- city/landmark/world presentation
- physical formation rendering where retained
- production build/deployment path

**Gate:** BG0 is complete. BG1 may begin.

---

# BG1 - Convert the Interface into the Board-Game Shell

## Goal

Make the existing application *look and behave at the presentation level* like the board game we designed, while changing as little map/rendering code as possible.

## Target interface

The main play screen should become map-first and use a compact tabletop command shell:

- `FUTURE CONQUEST / THE CENTRAL FRONT`
- `Round X / 8`
- active side / active player
- Command Actions remaining
- current phase
- compact navigation such as Board / Forces / Combat / Cards / Rules
- right-side Current Activation panel
- large, obvious contextual actions such as Move, Attack and Pass Activation
- later slots for Recover, Engineer and Logistics
- unobtrusive notifications and contextual guidance

## Approach

Do **not** replace the app root and then attempt to reinsert the map.

Instead:

1. keep the existing map mounted exactly as it is
2. progressively hide/remove old simulation panels
3. overlay/replace interface chrome around the existing map
4. introduce the new shell without yet rewriting all underlying simulation systems
5. keep every step reversible until real-hardware acceptance

## Acceptance

- map looks and behaves like the accepted BG0 baseline
- interface clearly reads as a digital board game
- existing simulation screens no longer dominate normal play
- no new authoritative board-game mechanics are required yet
- real-hardware test passes before BG2

---

# BG2 - Board-Game State Foundation

## Goal

Create a clean authoritative board state behind the retained renderer.

## Initial state model

- scenario
- round and phase
- player/seat configuration
- active seat
- Command Actions remaining
- regions/spaces
- control/ownership
- physical formations/pieces
- readiness/damage
- simplified supply state
- deck/hand/discard placeholders
- deterministic random seed/state
- save version metadata

## Rules

- renderer consumes board state
- UI dispatches actions
- rules engine validates and resolves actions
- invalid actions mutate nothing and cost nothing
- no `Math.random` for authoritative results
- save/reload must reproduce the same board state

## Acceptance

- new board state initialises deterministically
- save/reload works
- existing map can render the new ownership/piece state without a renderer rewrite

---

# BG3 - Players, Seats, Rounds and Alternating Activations

## Goal

Turn the application into an actual multi-player board game.

## Player model

Minimum two seats. Each seat can be:

- Human
- Computer

Initial supported configurations:

- Human vs Computer
- Human vs Human hot-seat
- Computer vs Computer for automated testing

Architecture should allow coalition control to be split further later, for example by country, without forcing that complexity into the first release.

## Initial turn structure

- round start
- escalation/reinforcement step where applicable
- alternating activations
- a successful action consumes a Command Action
- active seat alternates according to the rules
- invalid action costs nothing
- Pass Activation is always available when appropriate
- round ends when action/activation conditions are exhausted

## Acceptance

- a complete deterministic round can be played without relying on the old simulation turn engine
- Human vs Human and Human vs basic Computer seat configuration works

---

# BG4 - Physical Board Pieces and Movement

## Goal

Keep the existing attractive physical formations, but make them behave like board-game pieces.

## Features

- pieces clearly selectable directly on the map
- obvious selected-piece state
- legal destinations highlighted
- board-game adjacency/route rules
- simple movement allowance
- move preview, confirm and cancel
- blocked/occupied/enemy-space rules
- visible movement animation where safe within the existing renderer
- movement results update authoritative board state

## Design rule

Remove the old operational movement/logistics burden. The player should think in terms of **where can this piece move this activation?**, not continuous military administration.

## Acceptance

- selection and movement are immediately understandable
- player can always see why a destination is or is not legal
- repeated movement does not destabilise the map

---

# BG5 - Dice Combat

## Goal

Replace opaque simulation combat with a visible, understandable board-game procedure.

## Core sequence

1. select attacking piece(s)
2. select legal target
3. show dice pool and modifiers before commitment
4. roll deterministic seeded dice
5. resolve hits/losses/readiness
6. retreat/eliminate where required
7. change control where applicable
8. show concise result

Possible modifiers include:

- formation strength
- terrain
- posture
- readiness
- supply/support
- cards

## UX requirement

Before confirming combat the player should understand:

- why the attack is legal
- how many dice are being rolled
- why those dice/modifiers apply
- what outcomes are possible

## Acceptance

- combat is deterministic under a saved seed
- rules engine owns outcomes
- presentation only displays them
- no hidden simulation combat path remains authoritative

---

# BG6 - Escalation and Reinforcement Deck

## Goal

Implement the campaign escalation idea: the defending coalition becomes stronger as the invasion progresses, but shuffled cards make timing, quantity and location vary between games.

## Prototype candidates

A card can determine some combination of:

- reinforcement quantity
- reinforcement type
- reinforcement location/theatre
- political mobilisation
- strategic effects
- emergency responses

Prototype both conceptual structures before locking the final one:

- one combined escalation deck
- separate reinforcement/effect and location decks

## Design objective

The defenders should build toward a dangerous late campaign without every game following the same reinforcement script.

## Acceptance

- seeded games reproduce exactly
- different seeds create materially different campaign development
- escalation pressure increases over time
- deck state saves/reloads correctly

---

# BG7 - Engineering, Logistics and Recovery as Simple Board-Game Actions

## Goal

Keep the strategic importance of the old systems without keeping their administrative complexity.

## Candidate actions/statuses

- Engineer
- Logistics
- Recover / Refit
- Fortify
- repair route/bridge
- restore supply
- strategic redeployment
- interdiction
- temporary support

Represent these through combinations of:

- action choices
- tokens/status markers
- limited tracks
- cards
- short-lived modifiers

## Hard rule

If using a system feels like managing an operational spreadsheet, simplify it again.

## Acceptance

- these systems matter strategically
- their immediate effects are visible on the map
- rules can be understood quickly from the interface

---

# BG8 - Cards and Strategic Events

## Goal

Move much of the historical flavour and strategic exception handling from simulation menus into a board-game card system.

## Candidate families

- Command
- Support
- Event
- Escalation
- National/political response
- Scenario-specific

## Principles

- cards create choices, exceptions and replayability
- core rules remain learnable without memorising a deck
- hand/deck/discard are visible and saveable
- card effects call the same authoritative rules APIs as other actions

---

# BG9 - Computer Player

## Goal

Allow either strategic side to be computer controlled.

## Development order

1. enumerate legal actions
2. deterministic baseline policy
3. movement/combat scoring
4. strategic objectives
5. card/action valuation
6. difficulty/personality parameters

## Hard rule

The AI uses the **same legal actions and rules engine as a human player**. No secret alternative game rules.

## Acceptance

- Human vs AI works through a complete campaign
- AI vs AI can run unattended for balance testing
- AI cannot issue illegal actions

---

# BG10 - Scenario, Objectives and Victory

## Goal

Turn the mechanics into a complete Central Front campaign.

## Includes

- initial setup
- round limit
- strategic objectives
- geographical victory conditions
- political/strategic victory points if useful
- sudden victory/collapse conditions where appropriate
- end-of-round scoring
- final victory calculation

## Acceptance

- the game can clearly be won and lost
- both sides have meaningful strategic choices
- automated games identify obvious dominant strategies before human testing

---

# BG11 - Onboarding, Feedback and Presentation Polish

## Goal

Make the game easy to understand and satisfying to operate without sacrificing the existing map's identity.

## Includes

- guided first turn
- contextual hints
- compact rules reference
- action previews
- explicit disabled-action reasons
- dice presentation
- card presentation
- movement animation/polish
- sound/music controls
- accessibility
- notification suppression / do-not-show-again options
- touch/mobile controls where practical

## Acceptance

- a new player can start without reading a long manual
- unavailable actions always have an understandable reason
- critical state is not communicated only through colour or animation

---

# BG12 - Structured Playtest Remediation and Release Gate

## Goal

Play the complete game repeatedly and fix what only becomes apparent when all systems interact.

## Core playtest questions

- Is it actually fun?
- Are meaningful decisions frequent enough?
- Are any systems too fiddly?
- Are activations/rounds too long?
- Is the map readable under real play conditions?
- Can players understand why actions are unavailable?
- Do cards and dice create useful uncertainty rather than arbitrary outcomes?
- Does escalation create a satisfying campaign arc?
- Are there runaway strategies or unwinnable openings?

## Final gate

Release candidate requires:

- stable real-hardware map/runtime
- complete campaign
- reliable save/reload
- Human vs Human
- Human vs AI
- clear victory conditions
- acceptable balance
- accepted gameplay direction
- accepted visual presentation

---

# Delivery Protocol

Every package follows the same sequence:

1. branch from current green `main`
2. inspect the existing implementation before coding
3. make the smallest coherent change
4. add/update deterministic tests
5. run relevant/full validation
6. open PR
7. require exact-head CI green
8. merge
9. deploy
10. verify live deployment
11. perform real-hardware acceptance whenever map lifecycle/rendering or another historically risky path was touched

## Failure policy

If a package causes the accepted machine/browser to freeze or materially destabilises the map:

- stop progression
- isolate or revert that package
- do not compensate with a replacement renderer
- return to the last accepted golden point

---

# What May Be Salvaged from `future-conquest-tabletop`

Reference/copy selectively:

- alternating activation concepts
- deterministic dice combat concepts/tests
- Command Action semantics
- board-game UI ideas
- rule contracts
- naming/presentation work

Do **not** copy wholesale:

- its application shell architecture
- its recreated map lifecycle
- its renderer integration strategy
- hardware fallback architecture developed during the freeze investigation

---

# Current Position

**BG0 accepted.**

The next implementation package is **BG1 - Convert the Interface into the Board-Game Shell**, working directly around the proven map rather than rebuilding it.

# Future Conquest Boardgame Conversion Roadmap

## Purpose

Convert the proven, working `future-conquest` simulation codebase into the new digital board-game version of Future Conquest **without replacing or re-architecting the existing 2.5D map/rendering foundation**.

The map is the foundation. The game around it changes.

This roadmap supersedes the attempted `future-conquest-tabletop` architecture for forward development. That repository remains reference material only for mechanics, UI concepts and implementation ideas that can be selectively transplanted.

## Core Architectural Rule

**Do not rebuild the working map inside a new application. Convert the existing working application into the board game.**

The following are treated as protected infrastructure unless a later package explicitly proves a safe reason to change them:

- current MapLibre/WebGL lifecycle
- terrain and DEM configuration
- current map mount/startup behaviour
- existing camera behaviour
- existing world/city/landmark presentation
- existing physical unit/miniature rendering where useful
- current deployment/runtime path that has been proven on real hardware

Board-game state and rules should feed the existing renderer. The renderer should not own authoritative game outcomes.

## BG0 - Golden Baseline Freeze

### Goal

Record the freshly imported repository as the known-good hardware baseline before board-game conversion begins.

### Acceptance

- GitHub Pages deployment is green.
- Production page loads successfully on the affected real PC/browser.
- No hard freeze.
- Existing map can pan/zoom and remains responsive.
- Existing terrain, cities, landmarks and physical formations render correctly.
- Current baseline commit and deployment URL are recorded.

### Rule

No gameplay conversion work starts until this baseline is accepted.

---

## BG1 - Board-Game Presentation Shell

### Goal

Replace the simulation-oriented interface around the map with the board-game interface while leaving the proven map lifecycle intact.

### Target presentation

- `FUTURE CONQUEST / THE CENTRAL FRONT`
- round counter, initially `Round 1 / 8`
- active command / active player display
- remaining Command Actions
- current phase
- compact left navigation for Board / Forces / Combat / Cards / Rules as appropriate
- right-side current activation panel
- clear primary actions such as Move, Attack, Recover, Engineer, Logistics and Pass
- alerts and contextual guidance that do not obstruct the map

### Constraints

- map component remains mounted and behaves exactly as the golden baseline unless a small, separately tested integration change is required
- no gameplay logic should be embedded in UI components
- old simulation panels are removed or hidden incrementally, not by replacing the application root wholesale

### Acceptance

- visual shell reads as a board game rather than a simulation control console
- baseline map remains fully responsive on real hardware
- no authoritative simulation systems have yet been required to change

---

## BG2 - Board State Foundation

### Goal

Introduce a clean authoritative board-game state model behind the existing map.

### State model

- scenario
- round and phase
- active seat/player
- Command Actions remaining
- regions / spaces
- political ownership and control
- formations / pieces
- readiness / damage state
- supply state at board-game abstraction level
- card/deck state placeholders
- deterministic random state
- save/version metadata

### Principles

- renderer consumes board state
- UI dispatches actions
- rules engine determines outcomes
- state changes are deterministic and testable
- no `Math.random` for authoritative results

### Acceptance

- new board state can initialise, save, reload and reproduce deterministically
- existing map can visualise ownership/pieces from the new state without changing rendering architecture

---

## BG3 - Players, Seats and Turn Structure

### Goal

Make Future Conquest a proper multi-seat digital board game.

### Required model

- minimum two seats
- each seat can be Human or Computer
- hot-seat local multiplayer supported
- either strategic side may be human or computer controlled
- architecture permits coalition seats to be split further later, for example national European commands, without forcing that complexity into the first release

### Initial turn structure

- round start
- escalation/reinforcement step where appropriate
- alternating activations
- each successful action consumes a Command Action
- active seat alternates according to rules
- invalid actions consume nothing
- Pass is always available when appropriate
- round ends when command/action conditions are exhausted

### Acceptance

- complete deterministic turn cycle can be played without old simulation turn machinery
- human-vs-human and human-vs-basic-AI seat configuration works

---

## BG4 - Physical Pieces, Selection and Movement

### Goal

Turn the existing physical formations on the working map into board-game pieces rather than simulation entities.

### Features

- obvious selectable pieces
- clear selected-piece state
- legal destination highlighting
- movement allowance expressed as board-game rules, not continuous operational logistics
- adjacency / route / space rules
- movement confirmation and cancellation
- visible movement animation using the existing renderer where practical
- occupied / blocked / enemy-controlled constraints

### Design direction

The visual effect should resemble moving physical board-game miniatures across the existing 2.5D campaign map.

### Acceptance

- player can select a piece and understand where it may legally move
- movement is governed solely by board-game rules
- physical map remains stable throughout repeated movement

---

## BG5 - Dice Combat System

### Goal

Replace opaque simulation combat with a legible board-game combat procedure.

### Core system

- attacker selects legal target
- game builds an explicit dice pool
- modifiers are visible before commitment
- terrain, readiness, support, supply and posture can alter dice or thresholds
- deterministic seeded rolls
- visible dice result presentation
- hits / losses / readiness changes
- retreat where required
- elimination where required
- control change after valid outcome
- concise combat log/result card

### UX requirement

The player should be able to answer:

- why can I attack?
- how many dice am I rolling?
- why did I get those dice?
- what did each result do?

### Acceptance

- all authoritative combat is rules-engine driven and reproducible in tests
- presentation does not calculate outcomes

---

## BG6 - Escalation and Reinforcement Decks

### Goal

Create the variable, replayable escalation system discussed for the defending coalition.

### Core concept

As the campaign progresses, defending forces gain increasing resources, but the exact timing, quantity and location vary between games.

### Initial design to prototype

Use shuffled escalation cards to determine some combination of:

- reinforcement quantity
- reinforcement type
- reinforcement location / theatre
- political mobilisation
- strategic effects
- emergency responses

The implementation should remain open to either:

1. one combined escalation deck; or
2. separate quantity/effect and location decks

The final choice should be made after a small playable prototype rather than assumed up front.

### Acceptance

- same scenario can develop differently across seeded games
- escalation creates increasing pressure without requiring old simulation resource systems
- deck state is visible and saveable

---

## BG7 - Engineering, Logistics and Support as Board-Game Actions

### Goal

Keep the strategic flavour of the original game while removing interface-heavy simulation administration.

### Replace deep simulation with

- action choices
- cards
- tokens/status markers
- limited tracks
- temporary modifiers
- simple local effects

### Candidate actions

- Engineer
- Logistics
- Recover / Refit
- Strategic redeployment
- Interdiction
- Fortification
- Bridge / route repair
- supply restoration

### Rule

If a system requires the player to manage a spreadsheet-like operational interface to use it, simplify it again.

### Acceptance

- logistics and engineering matter strategically
- they are understandable in seconds, not minutes
- map gives clear visual feedback for relevant statuses

---

## BG8 - Cards, Events and Strategic Decisions

### Goal

Use cards to carry much of the historical/strategic flavour that the old simulation exposed through systems and menus.

### Card families

- command cards
- event cards
- escalation cards
- support cards
- national/political response cards
- scenario-specific cards

### Card design principle

Cards should create interesting choices, exceptions and replayability without making the core rules difficult to learn.

### Acceptance

- cards have deterministic, testable effects
- hand/deck/discard state saves correctly
- card UI does not obscure the map unnecessarily

---

## BG9 - Computer Player

### Goal

Allow any major seat to be computer controlled.

### Development order

1. legal-action enumerator
2. deterministic baseline policy
3. tactical scoring for movement/combat
4. strategic priorities
5. card/action valuation
6. difficulty personalities/parameters

### Constraint

AI must use the same legal action APIs as human players. No hidden alternate rules engine.

### Acceptance

- a complete scenario can be played human-vs-AI or AI-vs-AI
- AI completes turns reliably and cannot issue illegal actions

---

## BG10 - Scenario, Victory and Balance

### Goal

Turn the board-game system into a complete campaign rather than a mechanics sandbox.

### Includes

- initial setup
- scenario length
- objectives
- geographical victory conditions
- political/strategic victory points where useful
- sudden victory / collapse conditions where appropriate
- end-of-round scoring
- final victory calculation
- automated balance simulations

### Acceptance

- game can be won and lost clearly
- both sides have viable strategic choices
- repeated automated games expose obvious dominant strategies before human playtest

---

## BG11 - Onboarding and Presentation Polish

### Goal

Make the board game understandable and satisfying without losing the existing map's visual identity.

### Includes

- guided first turn
- contextual hints
- concise rules reference
- action previews
- clear disabled-action reasons
- dice/card animation
- piece movement polish
- sound and music controls
- accessibility options
- mobile/touch consideration where practical
- alert suppression / do-not-show-again controls

### Acceptance

- a new player can begin without reading a long manual
- no critical rule state is communicated only by colour or animation

---

## BG12 - Final Playtest Remediation and Release Gate

### Goal

Run structured human playtests and repair the issues that only appear when the complete game is played as a game.

### Playtest questions

- Is it fun?
- Is the player making meaningful choices frequently enough?
- Is anything too fiddly?
- Are turns too long?
- Is the map readable?
- Can players understand why an action is unavailable?
- Do cards/dice create useful uncertainty rather than arbitrary outcomes?
- Does escalation produce a satisfying campaign arc?
- Are there runaway strategies or unwinnable positions?

### Final gate

No later major revision begins until:

- gameplay is stable on real hardware
- map remains stable on the original affected hardware/browser
- save/reload works
- complete campaign works
- human-vs-human works
- human-vs-AI works
- victory conditions work
- user accepts both gameplay direction and visual presentation

---

# Delivery Protocol

## One package at a time

Every work package should follow this pattern:

1. branch from current green `main`
2. inspect existing implementation before coding
3. make the smallest coherent change
4. add/update deterministic tests
5. run full relevant validation
6. open PR
7. require exact-head CI green
8. merge
9. deploy
10. verify deployment
11. perform real-hardware acceptance whenever the change touches map lifecycle/rendering or other historically risky areas

## Real-hardware rule

Automated Chromium success does **not** overrule a real-hardware failure.

If a change causes the known-good machine/browser to freeze, revert or isolate that package before continuing.

## Renderer protection rule

Do not transplant the renderer into a new shell again.

Prefer:

`existing working app + progressively replaced gameplay/UI`

not:

`new app + recreated old renderer`.

## Salvage from `future-conquest-tabletop`

The superseded tabletop repository may be used as reference for:

- alternating activation concepts
- deterministic combat rules
- command-action semantics
- UI layout concepts
- tests and rule contracts
- naming and presentation ideas

Do **not** wholesale copy its application/rendering architecture.

# Immediate Next Step

**BG0 is the gate currently in progress.**

Once the freshly imported baseline deployment has been explicitly accepted on the real PC/browser as stable, record the exact accepted commit and begin **BG1 - Board-Game Presentation Shell**.

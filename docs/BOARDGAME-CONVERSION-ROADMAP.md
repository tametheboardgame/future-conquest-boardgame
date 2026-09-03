# Future Conquest Board-Game Roadmap

> **Roadmap reset: 3 September 2026**
>
> This document supersedes the old forward-looking BG0-BG12 conversion plan. The old plan successfully got the project from the original simulation to a functioning authoritative board game, but many of its transitional UI assumptions are now obsolete. Historical package documents remain useful records of what was built; this file is now the authority for what happens next.

---

# Mission

Finish **Future Conquest: The Central Front** as a premium digital tabletop strategy game built around the proven 2.5D campaign map.

The player should feel that they are manipulating a physical strategy board game on a digital table:

- physical formations on the map;
- clear territory and objective control;
- real-looking cards and card decks;
- actual animated dice rolls;
- short, contextual actions rather than operational-management screens;
- a campaign that is understandable from the board itself.

The game must **not** drift back toward the spreadsheet-heavy operational simulator interface that the conversion was intended to replace.

**The map is the foundation. The board game is now the application. The old simulation UI is compatibility residue, not the product.**

---

# Current Position

## Accepted `main`

Current green `main` at this roadmap reset:

`0d4c863198bbfe88ba6e0b03f84305bdde39b1b7`

This includes:

- BG0-BG11 board-game conversion work;
- the authoritative board state and deterministic dispatcher;
- alternating activations and Command Actions;
- direct map-piece movement;
- deterministic D20 combat;
- escalation/reinforcement systems;
- simplified Recover / Engineer / Logistics board actions;
- strategic cards;
- computer players;
- Central Front objectives and victory conditions;
- onboarding, rules reference, disabled-action feedback and presentation work;
- BG12A deterministic multi-seed board-game playtest tooling.

## BG12B remains separate

PR #43, **BG12B: Calibrate Central Front opening force balance**, is still an independent balance package.

Its accepted automated experiment is currently eight Expedition task groups, with the canonical 24-campaign sample moving from the original Defender-dominant early-collapse pattern to a mixed result. BG12B must be completed or rejected on its own exact-head evidence. It must not be mixed into the tabletop presentation reset.

## Visual acceptance failure identified

The current game is mechanically much closer to complete than its presentation suggests. The problem is composition:

- the new board-game shell was layered around the retained original `App`;
- legacy simulation state and workspaces still exist alongside authoritative board state;
- `TabletopStatusShell` mounts status, cards, support controls, pass feedback, rules and onboarding together;
- combat and activation panels are mounted as additional root-level surfaces;
- BG1 deliberately kept old Regions / Engineer / Logistics / Intel screens accessible behind `More` as a safe migration bridge.

That bridge has served its purpose. Keeping all of those surfaces visible or reachable as normal gameplay now works against the final game.

The approved September 2026 concept direction therefore becomes a **design contract**, not an optional polish target.

---

# Locked Architectural Decisions

These remain non-negotiable throughout the rest of the project.

1. **Protect the working map stack.** MapLibre/WebGL lifecycle, DEM/terrain setup, map mounting, camera, cities, landmarks and retained physical formation rendering are protected infrastructure.
2. **Board state is authoritative.** UI, cards, dice animation and renderer presentation never decide game outcomes.
3. **No duplicate rules or RNG paths.** Movement, combat, cards, support, escalation and AI use the same authoritative APIs.
4. **Physical presentation is a projection.** A die animation lands on the already-determined authoritative roll. A card animation displays the already-authoritative card state. Physics or animation never creates rules state.
5. **One active interaction surface.** During ordinary play the map may be accompanied by the persistent tabletop chrome and **one** contextual action surface. Features do not get to create additional permanent floating panels.
6. **Legacy simulation UI is no longer a product requirement.** It may remain temporarily behind an explicit diagnostics/developer path where renderer compatibility still depends on it, but it is removed from normal navigation and play.
7. **Simplify systems aggressively.** Old operational logistics, engineering, intelligence, armour-detail and political-management interfaces are replaced by board state, tokens, cards, short actions and dice where their strategic meaning still matters.
8. **Do not delete compatibility code before it is safe.** First quarantine old presentation, then prove the board-only presentation, then extract old simulation dependencies from the renderer.
9. **Accessibility remains first-class.** Critical state cannot rely only on colour, sound or animation. Reduced-motion and keyboard/touch alternatives remain supported.
10. **Real hardware wins.** Automated tests do not overrule a freeze, severe performance regression or obvious presentation failure on the accepted real PC/browser.
11. **Small packages, exact-head gates.** Risky work remains divided into coherent PRs with deterministic tests and exact-head CI.
12. **Combat dice standard is locked to 2D6.** Future balance work may tune documented target/modifier values, but normal combat uses exactly two six-sided dice. D20, 3D6 or 4D6 must not be reintroduced as the base combat roll without a new explicit rules decision, migration package and full deterministic/balance evidence.

---

# Approved Tabletop Visual Direction

## Normal desktop composition

The default Board view should read approximately as:

```text
┌────────────────────────────────────────────────────────────┐
│ FUTURE CONQUEST | R1/8 | EXPEDITION | ●●●● | 1/3 OBJ      │
├────┬─────────────────────────────────────────┬─────────────┤
│    │                                         │ ▰ DECK      │
│ B  │                                         │ ▰ DECK      │
│    │                                         │ ▰ DECK      │
│ F  │               2.5D MAP                  │             │
│    │                                         │  🂠 🂠 🂠   │
│ R  │           physical formations           │             │
│    │                                         │ ┌─────────┐ │
│ ⚙  │                                         │ │ 🎲 DICE │ │
│    │                     ┌───────────────┐   │ │  TRAY   │ │
│    │                     │ MOVE ATTACK   │   │ └─────────┘ │
│    │                     │ SUPPORT PASS  │   │             │
└────┴─────────────────────────────────────────┴─────────────┘
```

The exact art can evolve; the composition cannot drift back into a collection of overlapping dashboards.

## Surface budget

During ordinary play the persistent UI budget is:

1. **thin top status strip**;
2. **minimal navigation rail**;
3. **right-hand tabletop rail** containing physical game components;
4. **one contextual interaction surface** when required;
5. **one small transient coach mark / toast** where needed.

No other permanent opaque surface should occupy map space.

Target presentation:

- map receives roughly **80-90% of visual attention**;
- left navigation is narrow and quiet;
- tabletop rail is visually part of the board/table rather than an application sidebar;
- map overlays are transient and directly related to the current action;
- normal play never produces a stack of overlapping panels.

## Thin top strip

The top strip should convey only high-value campaign state, for example:

- Future Conquest / The Central Front;
- Round X / 8;
- active side/player;
- Command Actions remaining;
- current phase;
- objective / breakthrough / victory progress.

Do not put every value inside a large independent box.

## Minimal navigation

Target permanent navigation:

- **Board**;
- **Forces**;
- **Rules / Save**;
- **Settings**.

Combat and Cards are game objects/interactions, not destinations that need full-screen workspaces.

Legacy Regions / Engineer / Logistics / Intel routes are removed from normal navigation. Simplified Engineer / Logistics gameplay remains available contextually through authoritative board actions.

## Right-hand tabletop rail

The right side replaces the old Command Map / Current Activation hierarchy.

It may contain:

- authoritative card deck stacks;
- discard piles where useful;
- the player's physical-looking hand;
- escalation/event deck presentation;
- physical dice tray;
- compact contextual action card.

The rail should be collapsible so a player can maximise the map.

### Important deck rule

Visual deck stacks must reflect **real authoritative piles**. Do not split one authoritative deck into several fake rules decks merely to copy the concept art.

If future rules explicitly create separate Command / Support / Event decks, they may be presented separately. Until then the tabletop may visually distinguish families inside the existing authoritative deck/hand while showing the actual escalation pile separately.

## Physical cards

Cards should look and behave like playing cards, not rectangular form buttons.

Target behaviour:

- consistent playing-card proportions;
- card backs for hidden piles;
- clear family/title/effect hierarchy;
- artwork/iconography;
- short rule text;
- hover/focus lift;
- selected-card raise/zoom;
- hand fan/overlap;
- draw and discard motion;
- direct map target selection where practical.

The existing authoritative `play-action-card` preview/dispatch path remains unchanged.

Dropdowns/selects may remain as accessibility or fallback controls, but should not be the primary visual interaction when a target can be selected directly on the board.

## Physical dice

The approved final combat direction is **two classic six-sided dice**, not a simulated polyhedral D20.

**This is now a locked product and rules decision.** Balance evidence may tune the documented target/modifier calibration, but Future Conquest base combat remains 2D6.

The first BG12G physical-D20 implementation was mechanically correct but failed the manual visual gate: the faceted silhouette did not read cleanly as a real D20 and its rotation read more like a flat coin flip than two objects tumbling across a tray. That implementation is historical and is superseded by BG12G-R below.

Target behaviour:

- two unmistakably cubic D6s with conventional pip faces;
- each die has visible depth and independent three-axis tumble/bounce motion;
- the final two faces and their total equal the authoritative 2D6 combat result;
- concise attack equation plus HIT / MISS / CRITICAL result;
- dice-clatter sound hook;
- reduced-motion fallback that quickly reveals the two final faces;
- no second WebGL/Three renderer beside MapLibre.

This is deliberately a **combat-rules change as well as a presentation change**. The 2D6 probability curve is not equivalent to a D20, so the authoritative combat targets/modifiers are recalibrated in BG12G-R rather than disguising the old D20 result behind two cosmetic dice.

## Contextual formation interaction

Selecting a formation should expose a small interaction card such as:

```text
1ST ARMOURED       READY

MOVE   ATTACK   SUPPORT   PASS
```

Only critical piece state belongs here. Detailed roster/stat information belongs in the optional Forces drawer.

The same contextual surface changes state through the action flow rather than creating new panels:

- Move -> choose highlighted destination -> confirm/cancel;
- Attack -> choose legal enemy -> dice tray activates;
- Support -> Recover / Engineer / Logistics choices relevant to that formation;
- Pass -> concise confirmation/result.

## Coach-mark onboarding

The current first-turn guide logic remains useful; the giant explanatory card does not.

Target:

- highlight the relevant board object/control;
- small copy such as `1/5 - Select one of your formations`;
- optional `More info` into the rules reference;
- Skip / Next where needed.

The map must remain visible and usable during onboarding.

---

# Current Implementation Audit

## KEEP

These systems are fundamentally aligned with the target and should be preserved:

- MapLibre 2.5D terrain renderer and lifecycle;
- physical formation renderer/projection;
- authoritative board state/provider;
- board action dispatcher and legality APIs;
- deterministic save/reload;
- alternating activations and Command Actions;
- direct map selection and destination highlighting;
- BG4 physical movement animation;
- BG5 deterministic combat foundation, with the D20 die model superseded by BG12G-R's authoritative 2D6 conversion;
- BG6 escalation/reinforcement state;
- BG7 simplified Recover / Engineer / Logistics actions;
- BG8 strategic card state and authoritative card-play path;
- BG9 computer-player legal-action path;
- BG10 objectives/victory;
- BG12A deterministic playtest matrix;
- global settings/audio/accessibility preference infrastructure.

## TRANSFORM / RECOMPOSE

These are useful implementations with the wrong final composition:

- `TabletopStatusShell` -> slim status strip plus separately owned tabletop components;
- `TabletopCardHandPanel` -> physical decks/hand in tabletop rail;
- `TabletopCombatPanel` -> compact preview + physical dice tray;
- `TabletopActivationPanel` -> small contextual formation action card;
- `TabletopSupportPanel` -> contextual Support submenu/actions;
- `TabletopPassReason` -> inline contextual reason, not another permanent surface;
- `TabletopRulesReference` -> deliberate drawer/modal from Rules / Save;
- `TabletopOnboarding` -> coach marks;
- `CommandNavigation` -> Board / Forces / Rules & Save / Settings only;
- map legends/layers/modes -> collapsed utilities unless immediately relevant.

## RETIRE FROM NORMAL PLAY

The following old presentation is no longer part of the intended game:

- legacy `More` menu and its normal-player routes;
- Regions operational workspace;
- old Engineer workspace;
- old Logistics workspace;
- old Intelligence workspace;
- old operational Combat/Operations workspace where superseded by board combat;
- Political Control strategic-view panel;
- armour-degradation/operational-readiness dashboards from the simulation;
- old operational logistics allocation/priorities UI;
- Infrastructure management UI;
- Interdiction-management UI where not represented by board cards/actions;
- Defence management dashboards;
- old Combat Reports workspace;
- operational order queue/day-resolution controls;
- giant supply diagnostics/adviser panels;
- legacy simulation tutorial presentation;
- duplicate Current Activation / selected-formation sidebars;
- permanent large legends and map-mode boxes.

### State vs presentation distinction

Retiring a dashboard does **not** automatically mean deleting the strategic concept.

Examples:

- territory control remains core, but the old Political Control panel goes;
- simplified supply remains a board-game status/modifier, but the old logistics-management dashboard goes;
- damage/readiness remain board-piece state, but detailed armour-degradation simulation UI goes;
- fortification remains a board status, but it does not require an Engineer management screen.

Underlying legacy state may temporarily remain if renderer compatibility still needs it. It is removed only in BG12O after a board-only renderer projection is proven.

---

# Completed Conversion History

The detailed old forward plan is removed from this roadmap because these packages are no longer future work. Their dedicated docs and merged PRs remain the historical record.

| Package | Status | Result now carried forward |
| --- | --- | --- |
| BG0 | ACCEPTED | Golden working map/runtime baseline |
| BG1 | COMPLETE / TRANSITIONAL UI NOW SUPERSEDED | Board-game identity and migration shell |
| BG2 | COMPLETE | Authoritative deterministic board state |
| BG3 | COMPLETE | Seats, rounds, Command Actions, alternating activations |
| BG4 | COMPLETE | Physical pieces, direct map movement, movement animation |
| BG5 | COMPLETE | Deterministic visible D20 combat; die model later superseded by BG12G-R |
| BG6 | COMPLETE | Escalation and reinforcement deck system |
| BG7 | COMPLETE | Simplified Recover / Engineer / Logistics board actions |
| BG8 | COMPLETE | Strategic cards and authoritative card-play path |
| BG9 | COMPLETE | Human/AI and AI/AI board-game play |
| BG10 | COMPLETE | Central Front objectives, scoring and victory |
| BG11 | MECHANICALLY COMPLETE; COMPOSITION SUPERSEDED | Onboarding, feedback, rules, card/dice/movement presentation and accessibility foundations |
| BG12A | COMPLETE | Deterministic multi-seed board-game playtest matrix |
| BG12B | IN PROGRESS | Opening-force balance calibration; PR #43 |

BG11 is not being “undone”. Its useful logic is retained and recomposed into the new tabletop layout.

---

# Active Roadmap

## BG12B - Finish Opening Balance Calibration

**Status: IN PROGRESS — PR #43**

### Goal

Finish the already-started single-variable opening-force calibration without mixing presentation changes into it.

### Rules

- preserve the accepted experiment unless exact-head evidence identifies a real regression;
- finish/fix only the BG12B regression contracts required by the balance change;
- merge only a green exact head;
- if the calibration is rejected, close/revert it cleanly rather than carrying half of it into the visual reset.

### Gate

BG12C implementation begins from green `main` after BG12B is resolved.

---

## BG12C - Visual Direction Lock and UI Inventory

### Goal

Turn the approved concept into an engineering acceptance contract before deleting or moving runtime UI.

### Deliverables

- inventory every normal-play surface and its owner/component;
- classify each as KEEP / TRANSFORM / COLLAPSE / RETIRE / DEBUG-ONLY;
- record current z-index/overlay relationships that can cause collisions;
- define desktop and compact surface budgets;
- define screenshot/browser assertions for “no box pile-up”;
- identify legacy browser tests that currently depend on normal-player access to old workspaces;
- specify the debug/compatibility route those tests will use after quarantine.

### Acceptance

For every visible box in the current cluttered Board screenshot, the project can state exactly:

- why it exists;
- whether it remains;
- where it moves;
- what replaces it;
- when it is removed.

No gameplay rules change in BG12C.

---

## BG12D - Legacy Presentation Quarantine

### Goal

Make the **board game**, not the old simulation shell, the only normal play experience.

### Work

- remove legacy Regions / Engineer / Logistics / Intel from normal navigation;
- remove `More` as a normal-player gateway to simulation screens;
- suppress old operational Command Map/selected-formation/workspace chrome when the board game is active;
- suppress Political Control, old operational status panels and redundant simulation warnings in normal Board view;
- retain an explicit diagnostics/developer access path only where historical validation still needs a legacy workspace;
- adapt historical probes to use that diagnostics path deliberately instead of requiring legacy UI in the product.

A likely temporary diagnostic mechanism is a clearly named query flag such as `?legacy-ui=1`; the exact implementation should be chosen after the UI inventory.

### Rules boundary

No board mechanics, renderer lifecycle, RNG, save or AI changes.

### Acceptance

Fresh normal gameplay starts with essentially:

- map;
- board-game status/navigation;
- no old simulation workspace competing for attention.

This is the first major visual simplification milestone.

---

## BG12E - Tabletop Layout Foundation

### Goal

Create the final page composition around the unchanged map.

### Work

- introduce a clear tabletop layout owner instead of unrelated root overlays;
- compress the top status into a thin strip;
- reduce permanent navigation to Board / Forces / Rules & Save / Settings;
- create the right tabletop rail;
- provide collapsed and expanded rail states;
- assign stable component zones and z-index rules;
- enforce “one contextual interaction surface” structurally;
- ensure map controls remain reachable and unobscured.

### Desktop target

The map should dominate. The right rail should read as physical table space, not a generic data sidebar.

### Compact target

The same composition may become a bottom tabletop drawer; do not solve full touch/mobile behaviour yet beyond avoiding layout breakage.

### Manual visual gate

**Required.** User checks the live desktop build before proceeding to the physical card/dice packages.

Pass only if the empty/idle Board screen already resembles the approved concept in composition and no longer resembles the current box-heavy screenshot.

---

## BG12F - Physical Deck and Hand System

### Goal

Make cards a primary tactile game component.

### Work

- preserve authoritative deck/hand/discard state;
- present real authoritative piles as physical deck stacks;
- create card backs;
- use playing-card proportions;
- create reusable visual family/icon/art regions;
- fan/overlap the hand naturally;
- hover/focus lift and selected-card raise;
- show playable/unplayable state without colour alone;
- prefer direct formation/map target selection;
- animate draw, selection, play and discard safely;
- keep an accessibility fallback for controls that cannot be comfortably selected from the map.

### Art pipeline

Initial cards may use coherent iconographic/placeholder illustration, but the component structure must support final card artwork without another layout rewrite.

### Rules boundary

Do not invent extra authoritative decks purely to match the concept. If deck rules change, that is a separate mechanics decision with its own tests.

### Acceptance

A screenshot should make it immediately obvious that the player is holding **cards**, not operating a card-management form.

---

## BG12G-R - Physical 2D6 Dice Tray and Combat Recalibration

**Status: IN PROGRESS — 2D6 DICE MODEL LOCKED; balance evidence and manual visual/gameplay validation pending.**

### Why BG12G is being redone

The original BG12G implementation proved the correct architecture: combat remained deterministic, the engine resolved first, animation could follow authoritative state, reduced motion worked, and no second WebGL renderer was introduced. It nevertheless failed the real-hardware visual test.

The displayed die did not read as a convincing physical D20. Its silhouette looked closer to a rounded D12/polyhedral token, and the motion read as a two-dimensional flip rather than a solid die tumbling through space.

The approved replacement is **two classic pip D6s**. Because 2D6 has a bell-shaped probability distribution rather than a flat D20 distribution, this revision changes the real combat rule instead of cosmetically mapping an old D20 number onto fake D6s.

### Player-facing rules contract

Combat now uses **2D6**.

**The 2D6 dice count/type is locked.** Automated and human balance evidence may change documented target or modifier values, but BG12G-R does not reconsider D20, 3D6 or 4D6 as the base combat roll.

Locked dice model and current calibration:

- roll two six-sided dice and add them;
- base hit target: **7+**;
- supply attack modifier remains intuitive and visible:
  - supplied: `+0`;
  - strained: `-1`;
  - isolated: `-2`;
- terrain is compressed for the 2D6 curve:
  - open: `+0` defence;
  - mixed lowland: `+1` defence;
  - mixed upland: `+1` defence;
  - mountainous: `+1` defence;
- fortification becomes a **binary board-game state** rather than a three-level D20-era stack:
  - unfortified: `+0` defence;
  - fortified: `+1` defence;
  - Engineer may fortify an eligible formation once; additional stacking to levels 2/3 is retired;
  - legacy saves containing fortification 2/3 remain loadable and are treated as fortified for combat rather than becoming invalid;
- hit when `2D6 total + supply modifier >= 7 + terrain defence + fortification defence`;
- natural **double six** is the critical result;
- critical consequence rules remain the existing authoritative critical consequence unless a separate balance finding requires change.

The dice model itself is final. The numerical values above remain **calibration knobs** until the exact-head campaign evidence is accepted. That evidence may adjust only documented 2D6 target/terrain/supply/fortification values in this package if it demonstrates a material strategic regression. Opening-force counts, victory thresholds, cards and unrelated systems are not silently retuned to compensate.

### Why the modifier scale changes

A D20 is flat: every +1/-1 changes hit probability by exactly five percentage points until the ends of the range.

2D6 is curved around seven. The 36 equally likely ordered outcomes give these chances of rolling at least a target before modifiers:

| Need on 2D6 | Hit chance |
| ---: | ---: |
| 6+ | 72.2% |
| 7+ | 58.3% |
| 8+ | 41.7% |
| 9+ | 27.8% |
| 10+ | 16.7% |
| 11+ | 8.3% |
| 12 | 2.8% |

Keeping the old D20 terrain `0/+1/+2/+3` and fortification `0..3` values would therefore make combined defensive modifiers dramatically stronger and would create near-automatic campaign stalls. Terrain is compressed and fortification becomes binary so the game can use the character of 2D6 without accidentally importing D20-sized modifiers onto a much steeper probability curve.

### Expected gameplay change

The conversion is intentionally not probability-neutral.

Compared with the old D20 model:

- **neutral supplied attacks become a little more decisive**: open-ground baseline moves from 50% to 58.3%;
- **ordinary defensive terrain remains meaningful**: supplied attacks into non-open terrain are 41.7%;
- **supply matters much more** around the centre of the curve: strained open attacks are 41.7% and isolated open attacks are 27.8%;
- **fortifying a position becomes a clear one-action board-game decision** rather than a three-step numerical stack;
- **combined advantages matter strongly**: a supplied attack into fortified non-open terrain is 27.8%, strained is 16.7%, and isolated is 8.3%;
- players should therefore be encouraged to restore supply, choose open approaches, use cards/support, manoeuvre around strongpoints or attack before a position is fortified rather than repeatedly throwing low-odds attacks at it;
- results cluster around the middle, so combat should feel less swingy and less arbitrary than a D20 while still allowing dramatic doubles;
- criticals become rarer and more recognisable: double six is 1/36, or 2.8%, instead of natural 20 at 5%;
- AI attack desirability changes because the probability curve is different; AI must consume the same shared authoritative probability helper as the human preview;
- campaign pacing may become faster in open manoeuvre and slower around supplied fortified terrain. This is a required playtest/automation observation, not an assumed success.

The design aim is **more board-game texture, not simply the closest numerical imitation of a D20**. If the exact-head campaign matrix becomes materially defender-dominant or produces objective deadlock, recalibrate the 2D6 target/terrain/supply/fortification knobs inside BG12G-R and rerun the evidence before merge. The dice model remains 2D6 throughout that calibration.

### Deterministic RNG contract

The rules engine remains authoritative and seeded.

- one authoritative PRNG sample is consumed per combat, preserving the existing one-step combat RNG cursor footprint;
- that sample selects one of the **36 equally likely ordered D6 pairs**;
- the selected pair is stored in authoritative combat state as two individual faces plus their total;
- presentation code never calls `Math.random`, `crypto`, a second board RNG path or animation physics to choose a result;
- animation starts only after dispatch and must land on the stored pair;
- reload/continue must reproduce the stored pair and total without rolling again.

Using one seed sample for one of 36 ordered outcomes is mathematically equivalent to selecting the joint result of two fair D6s while avoiding an unnecessary change to the number of PRNG cursor advances per attack.

### Authoritative state and save compatibility

The combat roll state should expose both dice while retaining a migration-safe total:

```ts
dice: [number, number];
die: number; // compatibility field containing dice[0] + dice[1]
attackTotal: number;
target: number;
outcome: 'hit' | 'miss';
```

Rules:

- every newly resolved combat writes the two faces and total;
- `die` remains temporarily as the total so existing consumers do not all break in one package;
- persistence validates both faces as integers 1-6 and validates that the total equals their sum;
- legacy saves with a resolved D20 `die` but no `dice` remain loadable;
- the UI must never invent fake D6 faces for a legacy D20 result. It may show a clear legacy resolved-roll fallback until a new combat occurs;
- save/reload/continue and deterministic replay tests are mandatory.

### Shared probability contract

The 2D6 hit-chance calculation belongs in the authoritative combat module, not separately in UI and AI.

Create/reuse one helper that enumerates the 36 ordered outcomes for the current target/modifier and returns the success count/percentage. Both:

- `TabletopCombatPanel`; and
- computer-player attack evaluation

must use that same helper.

This prevents the human preview saying one probability while the AI reasons from another.

### Physical D6 presentation brief

Replace `PhysicalD20` and its faceted/clip-path construction with two real CSS-3D cube components.

Each D6 must:

- have six actual square faces using 3D transforms, not a flat sprite rotating in 2D;
- use conventional pip layouts for 1-6 rather than printed numerals on the cube;
- keep opposite faces conventionally paired where practical (`1↔6`, `2↔5`, `3↔4`);
- retain visible side/top depth throughout the roll so it continues to read as a cube;
- tumble around X, Y and Z axes;
- translate across the tray and visibly bounce before settling;
- have a slightly different trajectory/timing from the other die so the pair does not move as one rigid object;
- land with the authoritative face visibly uppermost/front-readable;
- avoid clipping through the tray rim or each other in the accepted desktop size.

The pair should feel like two small physical objects thrown into the recessed tray. It must **not** look like two cards, two rotating squares or two coins flipping.

### Roll/result presentation

Before roll:

- show `2D6` and the exact target equation;
- show an authoritative hit percentage based on 36 outcomes;
- show both physical dice resting in the tray without implying a future result.

During roll:

- lock attacker/target controls against a duplicate dispatch;
- hide the authoritative faces/total from visual and screen-reader output until settle;
- fire the dice-clatter start hook;
- animate the two cubes independently.

On settle:

- reveal the two stored faces;
- show the arithmetic explicitly, for example **`3 + 5 = 8`**;
- then show supply modifier and final comparison, for example **`8 - 1 = 7 vs 8`**;
- reveal HIT / MISS / CRITICAL and consequences;
- fire the settled sound hook with `{ dice: [a, b], total }` detail.

### Accessibility and reduced motion

- critical state cannot rely on colour, motion or sound;
- keyboard/fallback target controls remain usable;
- `prefers-reduced-motion` skips the long tumble and quickly reveals the final two cube faces;
- forced-colour treatment must preserve die boundaries/pips/result semantics;
- screen readers announce “Rolling two D6” during motion, then announce the two faces, total and outcome only after settle.

### Renderer/performance boundary

- use DOM/CSS 3D for the dice;
- do not create another canvas/WebGL/Three renderer;
- do not touch MapLibre lifecycle, terrain setup, camera or formation projection;
- keep the existing tabletop rail surface budget;
- exact-head WP2E performance budgets remain unchanged.

### Required deterministic contracts

Add/update tests for:

- all authoritative rolls producing two faces in `1..6` and a total in `2..12`;
- the 36-outcome mapping and one-RNG-cursor-advance contract;
- total equalling `dice[0] + dice[1]`;
- critical only on double six;
- the recalibrated target/terrain/supply/fortification rules;
- binary Engineer fortification behaviour and legacy fortification compatibility;
- shared 2D6 probability helper used by UI and AI;
- save/reload of current 2D6 combat;
- loading a legacy D20 resolved combat without fabricating D6 faces;
- two CSS-3D cube dice with six pip faces each;
- independent tumble/bounce/settle motion;
- delayed result reveal and reduced-motion fallback;
- sound-hook payload;
- absence of presentation RNG and second WebGL renderer;
- full historical regression suite.

### Balance and campaign gate

Because this package changes the combat distribution, source/unit tests are not enough.

Before merge:

1. run the canonical deterministic multi-seed campaign matrix on the exact head;
2. compare win mix, campaign length, objective capture timing, attack frequency, hit rate and stalled-campaign traces with the accepted pre-2D6 baseline;
3. inspect AI attack selection under the new probabilities;
4. reject any obvious permanent strongpoint/deadlock pattern caused by the new curve;
5. if tuning is required, change only documented 2D6 calibration values and repeat the entire exact-head evidence cycle;
6. do not quietly change opening force counts or unrelated victory/card systems to make the 2D6 package pass;
7. treat the matrix as a trigger for numerical 2D6 tuning only, not as a reason to reopen D20/3D6/4D6 selection.

### Automated acceptance

- full regression suite green;
- exact-head integrated browser validation green;
- save/reload continuity green;
- campaign traces/multi-seed balance evidence acceptable;
- exact-head terrain performance gate green with unchanged budgets;
- production build/deployment verifier green.

### Manual visual/gameplay gate

**Required before BG12H.**

The live build passes only if the user can immediately say:

- “those are two real D6s”;
- both dice visibly tumble/bounce as solid cubes rather than flip like coins;
- the two visible faces add to the displayed authoritative total;
- the resulting attack is understandable immediately;
- the dice tray feels like a physical board-game component while the map still dominates the screen.

If the cubes or motion still fail that real-hardware test, BG12G-R remains open even if every automated gate is green.

---

## BG12H - Contextual Formation Interaction

### Goal

Replace the permanent right-side activation/control hierarchy with a single short board-game interaction flow.

### Idle selected-formation state

Show only critical identity/status and:

- Move;
- Attack;
- Support;
- Pass.

### Move flow

1. select formation;
2. choose Move;
3. legal/blocked map destinations highlight;
4. choose destination directly on map;
5. compact confirm/cancel state;
6. formation physically travels;
7. contextual surface collapses.

### Attack flow

1. select formation;
2. choose Attack;
3. legal targets highlight;
4. choose target;
5. the locked 2D6 dice tray becomes the active interaction;
6. roll/resolution;
7. result feeds map markers/pieces.

### Support flow

Only relevant Recover / Engineer / Logistics choices appear for the selected formation. There is no permanent Support dashboard.

### Acceptance

A complete human activation can be played without opening a traditional application workspace.

### Manual visual/gameplay gate

**Required.** This is the first target build expected to feel substantially like the approved tabletop concept.

---

## BG12I - Map Information Reduction and Board Tokens

### Goal

Make the board itself carry more information so the interface carries less.

### Work

- remove the permanent Political Control strategic-view box;
- collapse layers/modes into one deliberate utility control where practical;
- collapse large permanent legends/map keys;
- add clear strategic objective tokens/markers for Paris, Brussels and Rhine-Ruhr;
- represent relevant damage/readiness/supply/fortification state with compact piece/space markers where useful;
- ensure territory ownership/control is readable directly from the map;
- remove redundant textual status already obvious from board components.

### Acceptance

Most ordinary strategic state can be understood from:

**map + pieces + markers + cards + dice**.

---

## BG12J - Coach-Mark Onboarding

### Goal

Keep the useful BG11 onboarding logic but make the map remain the centre of attention.

### Work

- replace the large first-turn guide card with compact anchored coach marks;
- highlight the actual objective/piece/action being taught;
- keep detailed rule explanation behind Rules / More info;
- maintain skip/replay preference;
- verify pointer safety and keyboard/reduced-motion behaviour.

### Acceptance

A new player can learn the first turn without a tutorial window covering a large section of the board.

---

## BG12K - Secondary Drawers: Forces, Rules/Save and Settings

### Goal

Keep useful depth without leaving it on the board during ordinary play.

### Forces

A deliberate roster/detail drawer for formation information that is too detailed for the contextual action card.

### Rules / Save

- compact rules reference;
- save/load slots;
- campaign restart/utility actions where appropriate.

### Settings

- music and sound;
- reduced motion;
- accessibility/colour assistance;
- gameplay assistance;
- warning preferences.

### Acceptance

Closing the drawer returns to an uncluttered board. None of these surfaces is permanently visible during normal play.

### Manual visual gate

**Required.** Desktop presentation should now be accepted before effects/audio refinement.

---

## BG12L - Board-Game Effects and Motion Pass

### Goal

Make the already-clear interaction feel satisfying.

### Candidate effects

- selected-piece lift/halo;
- movement easing and arrival beat;
- damage marker application;
- elimination/removal;
- objective capture;
- card draw/play/discard;
- escalation draw;
- reinforcement arrival;
- round/phase transition;
- subtle campaign victory sequence.

### Rules

- do not hide important state exclusively inside animation;
- respect reduced motion;
- animation must not create authoritative state;
- no renderer-lifecycle regression.

---

## BG12M - Sound and Music Integration

### Goal

Give physical tabletop actions appropriate audio feedback and integrate final music without turning the game into a noisy arcade UI.

### Sound targets

- piece select/place/move;
- card draw/shuffle/play/discard;
- dice clatter;
- attack hit/miss;
- damage/elimination;
- objective capture;
- escalation/reinforcement;
- restrained UI confirmation.

### Music

Use the existing settings/audio architecture. Final soundtrack assets can be integrated when approved; the roadmap does not block layout work on final music production.

### Acceptance

Sound reinforces physical actions but never carries essential state alone. Mute/volume controls work reliably.

---

## BG12N - Responsive and Touch Tabletop

### Goal

Make the approved tabletop experience practical on smaller/touch screens without turning the desktop design back into generic panels.

### Likely compact pattern

- map remains primary;
- tabletop rail becomes bottom drawer;
- card hand becomes horizontal/fanned strip;
- contextual actions become bottom action bar/card;
- dice tray temporarily expands during combat;
- minimum practical touch targets approximately 44px;
- no horizontal overflow;
- map gestures remain reliable.

### Acceptance

Desktop and compact modes share the same game mental model rather than two different applications.

---

## BG12O - Legacy Simulation Extraction

### Goal

Remove the old simulation engine/application dependency **after** the board-game presentation has proved itself stable.

This is intentionally late because it is architecturally riskier than hiding obsolete UI.

### Desired final data path

```text
BoardState
   ↓
RendererProjection
   ↓
2.5D Map / physical pieces
```

rather than the current transitional pattern where old simulation `GameState` still exists and board projection is applied into renderer-compatible state.

### Recommended subpackages

#### BG12O1 - Dependency audit

Identify every renderer or retained presentation read from legacy simulation state.

#### BG12O2 - Board-only renderer projection

Provide the renderer everything it needs directly from authoritative board state/projection without changing renderer lifecycle.

#### BG12O3 - Remove normal legacy state initialisation

Stop constructing/advancing old simulation state in the normal board-game application path.

#### BG12O4 - Delete dead simulation modules/UI

Only after equivalence tests prove they are unused:

- old operational engines/actions;
- obsolete workspaces/components;
- obsolete CSS;
- historical compatibility adapters no longer needed;
- tests whose only purpose was deleted simulation UI.

### Hard gate

Any map freeze/performance regression stops this package and returns to the last accepted board-only projection state.

---

## BG12P - Structured Human Playtest Remediation

### Goal

Return to the original purpose of BG12 once the game actually looks and operates like the intended product.

### Required playtest modes

- Human vs AI;
- Human vs Human hot-seat;
- save, close/reload and continue;
- multiple seeds/openings;
- complete campaigns.

### Questions

- Is it fun?
- Are decisions frequent and clear?
- Do turns flow quickly enough?
- Are cards useful and understandable?
- Is rolling satisfying rather than slow?
- Are objectives obvious?
- Does escalation produce a good campaign arc?
- Are support actions meaningful without becoming fiddly?
- Is eight Expedition task groups manageable in human play if BG12B is accepted?
- Are there dominant strategies or unwinnable openings?
- Does anything still feel like operating software rather than playing a board game?

### Evidence

Automated BG12 matrix remains a regression/balance instrument, not a substitute for human judgement.

Human feedback may create narrowly scoped remediation packages for balance, pacing, rules wording, card effects or presentation.

---

## BG12Q - Release Candidate and Final Presentation Gate

### Release candidate requires

- stable real-hardware map/runtime;
- complete campaign;
- reliable save/reload;
- Human vs Human;
- Human vs AI;
- clear victory conditions;
- acceptable automated and human-tested balance;
- accepted gameplay direction;
- accepted card/deck presentation;
- accepted physical 2D6 presentation;
- accepted desktop and compact layout;
- accessibility/reduced-motion coverage;
- no legacy simulation interface in normal play;
- no known box-pile-up/overlap regression.

### Screenshot acceptance

A normal desktop screenshot should clearly show:

- map as the dominant visual object;
- physical-looking pieces;
- physical cards/decks;
- physical dice tray;
- restrained campaign/status chrome;
- no giant operational right-hand menu;
- no Political Control dashboard;
- no duplicate activation panels;
- no permanent logistics/adviser warning box;
- no giant tutorial card;
- no unnecessary legacy workspaces.

If the game again becomes a stack of boxes over the map, release is blocked even if every automated test is green.

---

# Explicitly Obsolete Requirements from the Old Roadmap

The following previous transitional assumptions are deleted as forward requirements:

- keeping legacy simulation screens reachable through normal `More` navigation;
- treating a permanent right-side Current Activation panel as the final interaction model;
- treating Combat as a primary navigation destination;
- treating Cards as a normal navigation destination instead of physical tabletop objects;
- retaining old Regions / Engineer / Logistics / Intel workspaces for ordinary board-game play;
- retaining Political Control and operational armour/logistics dashboards as player-facing strategy tools;
- retaining the old simulation tutorial presentation;
- allowing each new board-game feature to add another independently positioned root overlay;
- considering the current BG11 card/dice boxes the final physical presentation merely because their mechanics are complete.

These were useful migration steps. They are no longer the target.

---

# Delivery Protocol

Every implementation package continues to follow this sequence:

1. begin from current green `main`;
2. inspect actual implementation before editing;
3. make the smallest coherent change;
4. add/update deterministic contracts;
5. run relevant/full validation;
6. open PR;
7. require exact-head CI green;
8. merge only the verified exact head;
9. verify actual `main` SHA;
10. deploy;
11. perform manual real-hardware acceptance at the roadmap checkpoints.

## Visual regression rule

Browser tests must increasingly assert the **absence** of obsolete surfaces, not keep them alive because historical probes once expected them.

When an old test represents a deleted product requirement:

- update or retire the test deliberately;
- preserve a diagnostics-only probe only if it still protects renderer/runtime behaviour;
- do not reintroduce obsolete UI just to satisfy historical automation.

## Failure policy

If a package causes the accepted machine/browser to freeze or materially destabilises the map:

- stop progression;
- isolate/revert the package;
- do not compensate with a replacement map renderer;
- return to the last accepted green point.

If a package makes the UI materially more cluttered than the approved tabletop contract:

- stop progression;
- simplify/recompose before adding further features.

---

# Immediate Sequence

1. **Resolve BG12B PR #43** on its own evidence.
2. **BG12C** - inventory and visual acceptance contract.
3. **BG12D** - quarantine legacy simulation presentation.
4. **BG12E** - build the clean tabletop composition.
5. **MANUAL VISUAL CHECK.**
6. **BG12F** - physical decks/cards.
7. **BG12G-R** - replace rejected D20 presentation and authoritative D20 combat with the locked physical 2D6 combat model and calibrated 2D6 rules.
8. **MANUAL DICE/GAMEPLAY CHECK.**
9. **BG12H** - compact contextual piece/action flow using the locked 2D6 combat interaction.
10. **MANUAL GAMEPLAY/VISUAL CHECK.**
11. **BG12I-K** - reduce map clutter, coach marks, secondary drawers.
12. **MANUAL VISUAL ACCEPTANCE.**
13. **BG12L-N** - effects, sound/music, responsive/touch.
14. **BG12O** - safely remove old simulation architecture from the normal runtime.
15. **BG12P** - structured human playtest/remediation.
16. **BG12Q** - final release candidate and presentation gate.

The goal from this point onward is not to add more interface. It is to make the existing game systems feel like **one coherent physical board game**.
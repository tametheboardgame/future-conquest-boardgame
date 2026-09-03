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

The current deterministic D20 combat remains authoritative, but the player should see an **actual die roll**.

Initial target:

- a physical-looking D20 in a dice tray;
- tumble, bounce and roll animation;
- final visible face equals the authoritative seeded result;
- concise attack equation and HIT / MISS / CRITICAL result;
- dice-clatter sound hook;
- reduced-motion fallback that quickly reveals the final face.

To protect the map renderer, the first implementation should prefer DOM/CSS 3D or another non-WebGL presentation rather than introducing a second WebGL/Three renderer beside MapLibre.

If later card/rules design introduces additional dice, the same tray can support them; BG12G does not invent new combat dice merely for visual effect.

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
- BG5 deterministic D20 combat rules;
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
| BG5 | COMPLETE | Deterministic visible D20 combat |
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

## BG12G - Physical Dice Tray and Rolling Dice

### Goal

Make combat resolution tactile and satisfying while preserving deterministic combat.

### Work

- replace the floating dice-information box with a physical dice tray in the tabletop rail;
- implement a real-looking animated D20;
- engine resolves seeded roll first;
- animation lands on exactly that result;
- show concise target/modifier equation before roll;
- show final die/result/consequences after roll;
- support reduced-motion;
- add sound hooks for dice roll/clatter;
- do not create a second WebGL renderer unless a later measured need justifies it.

### Acceptance

The player presses **ROLL**, sees an actual die tumble/land, and can immediately understand the resulting attack.

No animation result may disagree with saved/reloaded authoritative combat state.

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
5. dice tray becomes the active interaction;
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
- accepted physical dice presentation;
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
7. **BG12G** - real animated dice tray.
8. **BG12H** - compact contextual piece/action flow.
9. **MANUAL GAMEPLAY/VISUAL CHECK.**
10. **BG12I-K** - reduce map clutter, coach marks, secondary drawers.
11. **MANUAL VISUAL ACCEPTANCE.**
12. **BG12L-N** - effects, sound/music, responsive/touch.
13. **BG12O** - safely remove old simulation architecture from the normal runtime.
14. **BG12P** - structured human playtest/remediation.
15. **BG12Q** - final release candidate and presentation gate.

The goal from this point onward is not to add more interface. It is to make the existing game systems feel like **one coherent physical board game**.
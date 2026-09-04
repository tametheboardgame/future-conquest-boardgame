# Future Conquest Board-Game Roadmap

> **Roadmap reset: 4 September 2026**
>
> This file is the current authority for the Future Conquest board-game conversion. Historical package documents and earlier versions of this roadmap remain useful implementation records, but where they conflict with this reset, this document wins.

---

# Mission

Finish **Future Conquest: The Central Front** as a premium digital tabletop strategy game built around the proven 2.5D campaign map.

The player should feel that they are manipulating a physical strategy board game on a digital table:

- physical formations on the map;
- clear territory and objective control;
- real-looking cards and card decks;
- convincing physical dice rolls;
- short contextual actions rather than operational-management screens;
- a campaign understandable primarily from the board itself.

The game must **not** drift back toward the spreadsheet-heavy operational simulator interface that the conversion was intended to replace.

**The map is the foundation. The board game is the application. The old simulation UI is compatibility residue, not the product.**

---

# Current Position — 4 September 2026

## Accepted `main`

The current BG12G-R branch is based on accepted `main`:

`9819754a4254ac315cd0bcca85865188c0474ee4`

The board-game conversion through the tabletop/card foundation is mechanically established. The original BG12G D20 package was merged, then rejected manually as a final physical-dice presentation and superseded by the current 2D6 rework.

## Active branch / PR

- branch: `feat/bg12g-2d6-rework`
- PR: **#50 — BG12G-R: Replace D20 combat with physical 2D6**
- last accepted exact head before this roadmap reset: `bd8ac10bbf754f0dfb4d6a6ca032fa58f1f598a4`
- PR remains **draft and unmerged**.

## What is accepted in BG12G-R

The following are now accepted unless new evidence identifies a genuine defect:

- normal combat uses exactly **2D6**;
- base hit target is currently **7+**;
- supply attack modifiers are `0 / -1 / -2` for supplied / strained / isolated;
- terrain defence is compressed to `0 / +1` for the 2D6 curve;
- fortification is binary `0 / +1` and does not stack in normal board-game combat;
- natural double six is the critical roll;
- one authoritative seeded RNG sample maps to one of 36 ordered D6 outcomes;
- the engine stores both authoritative D6 faces plus their total;
- presentation never decides the combat result;
- save/reload, AI probability reasoning and human probability preview use the authoritative 2D6 model;
- the canonical 24-campaign matrix currently resolves all campaigns at **9 Expedition wins / 15 Defender wins (37.5% / 62.5%)** and is classified as mixed;
- the full regression/build/browser/balance/performance gate has been green on the accepted exact head.

**The dice model is locked.** D20, 3D6 and 4D6 are not balance alternatives. Future balance work may tune documented 2D6 numerical calibration only when evidence justifies it.

## What failed

The **BG12G-R dice presentation failed the manual visual gate on 4 September 2026**.

The automated capture proved that the UI was displaying the correct authoritative dice values, but the visual result was not acceptable. The dice read as **two flat 2D squares flopping around the tray**, not as solid physical cubes.

Specific failure characteristics:

- insufficient visible volume/depth;
- motion read as transformed flat planes rather than objects with mass;
- excessive/flailing movement instead of a contained throw and settle;
- weak contact/grounding cues;
- unstable/edge-on resting poses;
- final result could visually resemble a thin tile/sliver rather than a D6;
- overall interaction looked like CSS animation rather than a physical board-game component.

This is a **presentation rejection only**. It does not reopen the accepted 2D6 rules, deterministic RNG, combat consequences or current balance calibration.

---

# Locked Architectural Decisions

These remain non-negotiable unless explicitly replaced by a later roadmap decision.

1. **Protect the working map stack.** MapLibre/WebGL lifecycle, terrain/DEM setup, camera, cities, landmarks and formation projection are protected infrastructure.
2. **Board state is authoritative.** UI, cards, dice animation and rendering never decide game outcomes.
3. **No duplicate rules or RNG paths.** Movement, combat, cards, support, escalation and AI use the same authoritative APIs.
4. **Physical presentation is a projection.** Dice motion must land on the already-determined authoritative result. Animation/physics never creates rules state.
5. **One active interaction surface.** Normal play does not accumulate permanent floating dashboards.
6. **Legacy simulation UI is not a product requirement.** Retain compatibility only where technically required until safe extraction.
7. **Accessibility remains first-class.** Critical state cannot rely only on colour, sound or animation.
8. **Real hardware/manual acceptance wins.** Green automation cannot overrule an obvious visual failure.
9. **Small coherent packages and exact-head gates.** Do not merge a package whose exact head has not passed its required validation.
10. **Combat dice standard is locked to 2D6.** Any future change away from 2D6 requires a new explicit rules decision plus migration and full deterministic/balance evidence.

---

# Approved Tabletop Visual Direction

Normal desktop composition remains:

- thin campaign/status strip;
- minimal navigation;
- dominant 2.5D map;
- right-hand tabletop rail containing real game components;
- physical cards/decks;
- a physical dice tray;
- one short contextual interaction surface when needed.

The map should receive roughly **80–90% of visual attention**. The tabletop rail should feel like part of a physical table, not a generic application sidebar.

## Physical dice visual contract

The final combat presentation is **two classic pip D6s**.

The player must immediately perceive:

- two solid cubes, not squares/cards/tiles;
- visible top and side surfaces giving clear depth;
- conventional pip faces;
- weight, contact and grounding;
- two independent but restrained trajectories;
- a short throw/bounce/settle rather than random flailing;
- stable final resting poses;
- both final values readable at a glance;
- a recessed/contained dice-tray interaction;
- the displayed arithmetic and combat outcome matching the authoritative result.

The current CSS/DOM pseudo-3D implementation is **rejected and must not be iterated as the primary solution**.

---

# BG12G-R2 — True 3D Physical Dice Revision

**Status: ACTIVE — manual presentation rejection requires replacement before PR #50 may merge.**

BG12G-R2 is a visual/rendering revision inside the existing BG12G-R programme. It preserves the accepted 2D6 rules and replaces only the failed dice presentation layer.

## Goal

Create a dice roll that looks like **two actual board-game dice thrown into a tray** while preserving the deterministic authoritative combat system underneath.

The target is not merely technically three-dimensional. The visual must convince a human observer immediately.

## Explicitly rejected approach

Do **not** continue trying to rescue the current flat-element solution by adding more CSS rotations, more exaggerated keyframes or more random-looking translation.

The following are no longer accepted as the primary implementation:

- flat square elements masquerading as cubes;
- perspective tricks whose silhouette becomes a thin tile;
- independent CSS planes without convincing solid geometry;
- frantic motion used to hide weak depth;
- final orientations that can settle edge-on;
- animation that looks like two cards/squares flipping across the panel.

Historical CSS dice code may remain temporarily during replacement but must be removed/quarantined once the new implementation passes.

---

## Rendering strategy

### Preferred implementation: small isolated true-3D dice scene

BG12G-R2 may use a **small dice-only Three.js/WebGL renderer** inside the dice tray.

This explicitly supersedes the previous blanket rule forbidding a second WebGL renderer. The visual rejection demonstrated that the restriction was preventing the required physical quality.

Permission is narrow and conditional:

- the renderer belongs only to the dice tray;
- it must not replace, wrap, share or modify the MapLibre renderer/context;
- it must not touch map camera, terrain, DEM, markers or formation projection;
- it is lazy-created only when the dice interaction needs it;
- it must stop its animation loop when idle;
- it must dispose meshes/materials/renderer/context correctly when unmounted;
- pixel ratio/render size must be capped to the minimum needed for a crisp tray;
- context creation/loss must fail safely without damaging the map;
- exact-head map/browser/performance gates remain mandatory.

If a second WebGL context proves unstable on the accepted hardware/browser, the fallback is a **pre-rendered true-3D dice animation/sprite approach**, not a return to flat CSS pseudo-cubes.

### Scene design

Use a deliberately small physical scene:

- two bevelled cube meshes;
- conventional pip indentation/marking or convincing pip material treatment;
- matte/ivory or otherwise board-game-appropriate material;
- soft directional/key light plus restrained fill;
- contact shadows beneath both dice;
- shallow recessed tray/floor and visible boundary/rim cues;
- fixed slightly elevated camera angle so top and side faces remain readable;
- no decorative scene complexity that competes with the map.

Rounded/bevelled cube edges are strongly preferred because perfectly sharp computer cubes tend to read as generic boxes rather than manufactured dice.

---

## Motion strategy

The animation must be **controlled physical theatre**, not authoritative physics.

Rules state is already resolved before animation begins.

### Required motion character

- short launch into the tray;
- modest upward/forward arc;
- real three-axis rotation;
- one or two readable bounces/contact beats;
- noticeable deceleration/friction;
- independent timing/trajectory for each die;
- contained travel within the tray;
- stable final rest;
- total visual duration roughly in the range of a satisfying tabletop roll, not a long cinematic sequence.

### Authoritative landing

For each stored authoritative face `1..6`, define a known final quaternion/orientation that presents that face clearly upward with useful side-face visibility.

The roll animation may use decorative deterministic variation, but:

- presentation variation cannot change the stored result;
- no presentation RNG may write to rules state;
- final orientation is explicitly driven to the authoritative face;
- the final 100–200 ms may smoothly converge to the known resting quaternion if necessary;
- there must be no visible snap or edge-on final pose.

A lightweight physics library may be used only if it materially improves motion quality and remains a presentation system. It must not be allowed to decide the final face. A controlled scripted/quaternion trajectory is preferred if it produces a more consistent visual result with less runtime complexity.

---

# BG12G-R2 Implementation Stages

## R2A — Solid Dice Prototype

Build the smallest possible isolated prototype before full integration.

Deliverables:

- one bevelled true-3D D6;
- conventional pips on all six faces;
- six verified readable resting orientations;
- visible depth from the accepted camera angle;
- tray floor plus contact shadow;
- static screenshots for all six upward faces.

### R2A gate

Do not proceed to motion unless static screenshots unmistakably look like **a real cube-shaped die**.

---

## R2B — Two-Dice Throw, Bounce and Settle

Add the second die and physical-looking motion.

Deliverables:

- two independently moving dice;
- restrained 3D throw paths;
- bounce/contact beats;
- deceleration;
- no clipping through tray rim;
- no obvious interpenetration between dice;
- stable readable final orientations for all authoritative result pairs;
- no edge-on final pose.

### R2B gate

Capture video before integrating combat controls. Reject the motion if it still reads as flailing, floating or flipping tiles.

---

## R2C — Authoritative Combat Integration

Replace the current dice visual layer inside `TabletopCombatPanel` without changing the accepted combat engine.

Preserve:

- existing attacker/target legality;
- one-Command-Action combat dispatch;
- stored authoritative dice faces/total;
- current target/modifier equation;
- double-six critical rule;
- hit/miss/consequence resolution;
- save/reload contract;
- `future-conquest:dice-clatter` start/settled events;
- shared probability helper;
- AI use of the same probability model.

The renderer receives the already-authoritative pair and only animates toward it.

---

## R2D — Accessibility and Failure Fallback

Required behaviour:

- `prefers-reduced-motion` uses a very short settle/reveal rather than a full throw;
- keyboard combat flow remains fully usable;
- screen-reader output announces roll/result independently of the 3D canvas;
- forced-colour/high-contrast mode retains semantic text outside the canvas;
- if 3D renderer creation fails, show a clear static/isometric two-D6 fallback displaying the authoritative values;
- a dice-renderer failure must never block combat resolution or damage the map renderer.

---

## R2E — Automated Review Evidence

The exact-head browser workflow must capture a **real legal production attack** and produce:

- pre-roll screenshot;
- roll-start screenshot;
- mid-roll screenshot;
- settled screenshot;
- MP4/WebM video of the complete roll;
- JSON evidence containing attacker, target, authoritative dice pair, total and dice-clatter events.

Automated assertions must verify:

- exactly two visible D6 objects;
- final visible values equal authoritative stored faces;
- total equals the two faces;
- start and settled events fire correctly;
- no duplicate dispatch;
- no unexpected browser errors;
- renderer/context is not leaking across repeated rolls/unmounts;
- map continues rendering and remains interactive after dice use.

Automation **does not** decide whether the animation looks good. It only proves correctness and supplies review evidence.

---

# BG12G-R2 Performance / Lifecycle Gate

Because the preferred solution introduces a dice-only 3D renderer, the package must explicitly prove it does not destabilise the protected map.

Before manual acceptance:

- full regression suite green;
- production build green;
- exact-head terrain performance gate green;
- browser runtime/map smoke green;
- repeated dice-open/roll/close cycle without context leak;
- map pan/zoom/selection works after repeated combat rolls;
- no additional persistent animation frame loop while dice are idle/hidden;
- renderer resources are disposed on unmount;
- current-engine balance simulation still green;
- canonical BG12 multi-seed matrix remains acceptable.

If the second renderer causes a map freeze, severe frame regression, WebGL-context exhaustion or instability on accepted hardware, stop and use the pre-rendered true-3D fallback strategy.

Do **not** compromise the proven map to save the dice implementation.

---

# BG12G-R2 Manual Visual/Gameplay Gate

**This gate is mandatory and cannot be automated away. PR #50 must not merge before the user explicitly passes it.**

The delivered review video/live build must pass all of these human checks:

1. **Immediate cube recognition** — first glance says “two dice”, not squares/cards/tiles.
2. **Real depth** — top and side faces remain visibly three-dimensional during the roll.
3. **Weight** — motion has gravity/contact/deceleration rather than floating/flopping.
4. **Contained throw** — dice stay within a believable tray region instead of flying all over the panel.
5. **Independent motion** — the dice do not move as one paired animation.
6. **Readable bounce** — contact beats are believable rather than frantic.
7. **Clean settle** — both dice finish flat/stable with no edge-on sliver.
8. **Readable result** — both pip values and total can be understood immediately.
9. **Authoritative match** — visible faces equal the stored combat result.
10. **Board-game feel** — interaction feels like rolling real game components, not watching application chrome animate.

If the user says the dice still look fake, flat, weightless, chaotic or visually poor, BG12G-R2 remains open regardless of CI status.

---

# Merge Rule for PR #50

PR #50 may merge only when **all** of the following are true on one exact head:

- locked 2D6 deterministic contracts pass;
- full regression suite passes;
- build passes;
- balance/campaign evidence remains acceptable;
- map/browser/performance gates pass;
- BG12G-R2 review capture passes correctness assertions;
- user explicitly accepts the dice presentation/gameplay.

Only after merge:

1. verify the real `main` merge SHA;
2. verify deployment/live build;
3. update development status if needed;
4. begin BG12H.

---

# Downstream Roadmap

## BG12H — Contextual Formation Interaction

**Blocked by BG12G-R2 manual acceptance and PR #50 merge.**

Replace the permanent activation/control hierarchy with a compact board-game flow:

- select formation;
- Move / Attack / Support / Pass;
- direct map destination/target selection;
- compact confirm/cancel;
- Attack activates the accepted 2D6 tray;
- interaction collapses after resolution.

Manual gameplay/visual gate required.

## BG12I — Map Information Reduction and Board Tokens

Reduce permanent map UI and move important state onto pieces/markers/objective tokens. Remove redundant simulation-style status surfaces.

## BG12J — Coach-Mark Onboarding

Replace large tutorial presentation with compact anchored coach marks while keeping the map visible and usable.

## BG12K — Secondary Drawers

Provide deliberate Forces, Rules/Save and Settings drawers. Closing them returns to an uncluttered board.

Manual desktop visual acceptance required after BG12I-K.

## BG12L — Board-Game Effects and Motion Pass

Refine piece movement, damage/elimination, objective capture, card motion, escalation/reinforcement and round/victory effects without changing authoritative rules.

## BG12M — Sound and Music

Integrate physical-action sound cues and final music using the existing settings/audio architecture. Dice clatter must support but never carry essential state.

## BG12N — Responsive and Touch Tabletop

Adapt the accepted desktop mental model to compact/touch screens, likely using a bottom tabletop drawer and touch-safe contextual controls.

## BG12O — Legacy Simulation Extraction

Only after the board-game presentation is stable, remove normal-runtime dependence on the old simulation state through a proven board-only renderer projection. Any map regression blocks this work.

## BG12P — Structured Human Playtest / Remediation

Run complete Human-vs-AI, Human-vs-Human, save/reload and multi-seed campaigns. Use human findings to drive narrowly scoped balance/pacing/rules/presentation remediation.

## BG12Q — Release Candidate

Release candidate requires:

- stable map/runtime;
- complete campaign;
- reliable save/reload;
- Human-vs-Human and Human-vs-AI;
- acceptable automated and human-tested balance;
- accepted card/deck presentation;
- **accepted true-3D physical 2D6 presentation**;
- accepted desktop and compact layout;
- accessibility/reduced-motion coverage;
- no legacy simulation interface in normal play;
- no known box-pile-up/overlap regression.

---

# Delivery Protocol

Every implementation package follows this sequence:

1. start from the correct accepted head;
2. inspect actual implementation before editing;
3. make the smallest coherent change;
4. preserve authoritative rules boundaries;
5. add/update deterministic contracts;
6. run relevant/full validation;
7. require exact-head evidence;
8. perform mandatory manual acceptance where specified;
9. merge only the accepted exact head;
10. verify `main` SHA and deployed result.

## Visual failure policy

When a manual visual gate fails:

- record the rejection in this roadmap;
- preserve accepted mechanics unless the rejection identifies a mechanics problem;
- identify the failed rendering/interaction technique explicitly;
- do not keep polishing the same failed technique indefinitely;
- replace the technique with one capable of meeting the visual contract;
- generate new review evidence;
- keep downstream packages blocked until acceptance.

## Map safety policy

If any package causes the accepted machine/browser to freeze or materially destabilise the map:

- stop progression;
- isolate/revert the package;
- do not replace the proven map renderer to accommodate a secondary feature;
- return to the last accepted green map state.

---

# Immediate Sequence

1. **BG12G-R2A** — build and capture a convincing static true-3D D6 prototype.
2. **BG12G-R2B** — add two-dice throw/bounce/settle and capture motion evidence.
3. **BG12G-R2C/D** — integrate with authoritative combat plus accessibility/fallback.
4. **BG12G-R2E** — exact-head automated video/screenshots and lifecycle/performance evidence.
5. **MANUAL DICE/GAMEPLAY CHECK — USER MUST PASS.**
6. **Merge PR #50** only after exact-head automation and manual acceptance.
7. **BG12H** — compact contextual piece/action flow using the accepted 2D6 interaction.
8. **MANUAL GAMEPLAY/VISUAL CHECK.**
9. **BG12I-K** — map information reduction, coach marks and secondary drawers.
10. **MANUAL VISUAL ACCEPTANCE.**
11. **BG12L-N** — effects, sound/music and responsive/touch.
12. **BG12O** — safely remove obsolete simulation architecture.
13. **BG12P** — structured human playtest/remediation.
14. **BG12Q** — final release candidate and presentation gate.

The next objective is therefore very narrow: **make the two locked authoritative D6s look and move like real physical dice without compromising the proven map.**

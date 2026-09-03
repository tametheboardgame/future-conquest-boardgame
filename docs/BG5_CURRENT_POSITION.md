# BG5 Current Position

> **Historical status note — 3 September 2026:** BG5 established the deterministic D20 combat architecture. BG12G-R later superseded the D20 die model with the locked **2D6** combat standard. The dispatcher, authoritative-state, saved-RNG and unified human/AI architecture documented below remains applicable; D20-specific rolls, targets and critical values are historical.

Last updated: 2026-08-29

BG0 is accepted. BG1A-E, BG2A-E, BG3A-E, BG4A-D and BG5A-D are merged into `main`.

The active conversion package is **BG5E - Legacy combat adapter extraction and final acceptance**, PR #31.

BG5A established legal adjacent-enemy targeting, explicit pre-commit previews, seeded 1D20 resolution, a base target of 11, terrain/fortification defence modifiers, supply attack penalties and deterministic combat logging.

BG5B completed the first rules-owned combat consequence procedure. Ordinary hits inflict one damage and 25 readiness loss; a natural 20 inflicts two damage and 50 readiness loss. A defender at 50 readiness or lower retreats through a deterministic legal-retreat rule. A defender unable to retreat suffers an additional damage/readiness loss. Three damage or zero readiness eliminates the piece. When the last hostile piece leaves a target space, the attacker advances into it and control changes to the attacking seat. BG5B merged through PR #26 as `a980ae087581402deff33bb974e7e84a3f60d18a` after exact-head engine tests and the production build passed.

BG5C removed another layer of translation between the retained map and authoritative combat. After selecting an attacking board piece, clicking a retained enemy-contact marker resolves that contact's territory against the authoritative legal combat-target list and selects the first legal defender in stable piece-ID order. Computer command seats choose the first legal adjacent board-game attack in stable attacker/defender ID order before considering BG3's safe zero-cost Pass fallback. Both human and computer attacks cross the unified `attack-piece` dispatcher and seeded combat engine. BG5C merged through PR #28 as `7e35f72c233d51cfc513640b20d2fb8746fd8df6` after exact-head engine tests and the production build passed.

BG5D hardened the v3 browser-save boundary. Existing v3 saves without combat remain compatible, valid resolved combat round-trips with its RNG state intact, and malformed combat payloads are rejected as corrupt instead of being trusted as authoritative state. BG5D merged through PR #29 as `1e4c0ecdbb8131ce3a53f179e7234c7e4fc66202`.

BG5E physically removes the obsolete retained-simulation Attack adapter from `TabletopActivationPanel`. That panel no longer discovers, enables or clicks `[data-tutorial="attack-action"]`, exposes a duplicate Attack button, or derives activation state from legacy combat availability. Movement and Pass remain on the authoritative board dispatcher, while combat is owned separately by `TabletopCombatPanel`, `game/board-combat.ts` and the unified `attack-piece` dispatcher action.

The retained simulation attack controls remain quarantined as defence in depth: the board-game combat shell disables them on mount and re-applies the quarantine if legacy UI rerenders. `tests/bg5e-legacy-combat-adapter-extraction.test.cjs` protects the authority boundary so the removed adapter cannot silently return. The older BG1 source contract has also been advanced from its temporary-adapter expectation to the final BG5 architecture.

## BG5 final acceptance

BG5 is accepted when PR #31's exact head passes the repository pull-request gates and merges to `main`. The phase-level requirements in `docs/BOARDGAME-CONVERSION-ROADMAP.md` are satisfied by the implemented architecture:

- combat is deterministic under the saved RNG seed/state;
- combat legality and outcomes are owned by the board rules engine;
- React/map presentation dispatches and displays authoritative results rather than deciding them;
- human and computer combat use the same `attack-piece` action path;
- no retained simulation combat path remains authoritative;
- legacy simulation Attack controls remain disabled only as a compatibility quarantine, not as an input to board-game combat.

After BG5E merges, **BG5 - Dice Combat is complete** and the next roadmap phase is **BG6 - Escalation and Reinforcement Deck**.

For current combat dice and calibration after 3 September 2026, use `docs/BOARDGAME-CONVERSION-ROADMAP.md` and the BG12G-R 2D6 combat standard.

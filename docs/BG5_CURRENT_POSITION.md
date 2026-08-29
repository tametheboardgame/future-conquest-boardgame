# BG5 Current Position

Last updated: 2026-08-29

BG0 is accepted. BG1A-E, BG2A-E, BG3A-E, BG4A-D, BG5A, BG5B and BG5C are merged into `main`.

The active conversion programme is **BG5 - Dice Combat**.

Current package: **BG5D - Combat save-state hardening** on branch `bg5d-final-combat-hardening`, PR #29.

BG5A established legal adjacent-enemy targeting, explicit pre-commit previews, seeded 1D20 resolution, a base target of 11, terrain/fortification defence modifiers, supply attack penalties and deterministic combat logging.

BG5B completed the first rules-owned combat consequence procedure. Ordinary hits inflict one damage and 25 readiness loss; a natural 20 inflicts two damage and 50 readiness loss. A defender at 50 readiness or lower retreats through a deterministic legal-retreat rule. A defender unable to retreat suffers an additional damage/readiness loss. Three damage or zero readiness eliminates the piece. When the last hostile piece leaves a target space, the attacker advances into it and control changes to the attacking seat. BG5B merged through PR #26 as `a980ae087581402deff33bb974e7e84a3f60d18a` after exact-head engine tests and the production build passed.

BG5C removed another layer of translation between the retained map and authoritative combat. After selecting an attacking board piece, clicking a retained enemy-contact marker resolves that contact's territory against the authoritative legal combat-target list and selects the first legal defender in stable piece-ID order. Computer command seats choose the first legal adjacent board-game attack in stable attacker/defender ID order before considering BG3's safe zero-cost Pass fallback. Both human and computer attacks cross the unified `attack-piece` dispatcher and seeded combat engine. BG5C merged through PR #28 as `7e35f72c233d51cfc513640b20d2fb8746fd8df6` after exact-head engine tests and the production build passed.

The retained simulation attack controls remain actively quarantined: the board-game combat shell disables them on mount and re-applies the quarantine if legacy UI rerenders. No retained simulation value decides board-game combat legality or outcome.

BG5D hardens the v3 browser-save boundary. Existing v3 saves without combat remain compatible, valid resolved combat round-trips with its RNG state intact, and malformed combat payloads are rejected as corrupt instead of being trusted as authoritative state.

After BG5D is green and merged, **BG5E - Legacy combat adapter extraction and final acceptance** should physically remove the obsolete Attack adapter from `TabletopActivationPanel`, tighten combat feedback/presentation, and run a final source-contract review proving that no retained simulation combat path can act as board-game authority. Keeping that extraction separate avoids a risky whole-file rewrite of the already accepted BG4 movement panel inside a persistence change.

The phase-level requirements remain authoritative in `docs/BOARDGAME-CONVERSION-ROADMAP.md` under **BG5 - Dice Combat**.

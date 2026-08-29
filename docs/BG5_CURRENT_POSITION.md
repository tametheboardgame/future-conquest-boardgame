# BG5 Current Position

Last updated: 2026-08-28

BG0 is accepted. BG1A-E, BG2A-E, BG3A-E, BG4A-D, BG5A and BG5B are merged into `main`.

The active conversion programme is **BG5 - Dice Combat**.

Current package: **BG5C - Direct targeting, computer combat and legacy quarantine** on branch `bg5c-direct-targeting-computer-combat-quarantine`.

BG5A established legal adjacent-enemy targeting, explicit pre-commit previews, seeded 1D20 resolution, a base target of 11, terrain/fortification defence modifiers, supply attack penalties and deterministic combat logging.

BG5B completed the first rules-owned combat consequence procedure. Ordinary hits inflict one damage and 25 readiness loss; a natural 20 inflicts two damage and 50 readiness loss. A defender at 50 readiness or lower retreats through a deterministic legal-retreat rule. A defender unable to retreat suffers an additional damage/readiness loss. Three damage or zero readiness eliminates the piece. When the last hostile piece leaves a target space, the attacker advances into it and control changes to the attacking seat. BG5B merged through PR #26 as `a980ae087581402deff33bb974e7e84a3f60d18a` after exact-head engine tests and the production build passed.

BG5C removes another layer of translation between the retained map and authoritative combat. After selecting an attacking board piece, clicking a retained enemy-contact marker resolves that contact's territory against the authoritative legal combat-target list and selects the first legal defender in stable piece-ID order. No map or legacy simulation value decides legality or outcome.

Computer command seats now choose the first legal adjacent board-game attack in stable attacker/defender ID order before considering BG3's safe zero-cost Pass fallback. The automatic policy consumes no randomness itself; the selected `attack-piece` action still crosses the unified dispatcher and seeded combat engine used by humans.

The retained simulation attack controls are now actively quarantined as well as hidden: the board-game combat shell disables them on mount and re-applies the quarantine if legacy UI rerenders. This prevents the old player-facing attack action from executing while BG5 remains in conversion.

BG5C remains open until exact-head engine tests and the full production build are green. After merge, the final BG5 hardening slice should physically remove the obsolete Attack adapter code from `TabletopActivationPanel`, tighten combat presentation/feedback and verify that no retained simulation combat path can act as board-game authority.

The phase-level requirements remain authoritative in `docs/BOARDGAME-CONVERSION-ROADMAP.md` under **BG5 - Dice Combat**.
# BG5 Current Position

Last updated: 2026-08-28

BG0 is accepted. BG1A-E, BG2A-E, BG3A-E, BG4A-D and BG5A are merged into `main`.

The active conversion programme is **BG5 - Dice Combat**.

Current package: **BG5B - Combat consequences and authoritative shell** on branch `bg5b-combat-consequences-and-shell`, PR #25.

BG5A established legal adjacent-enemy targeting, explicit pre-commit previews, seeded 1D20 resolution, a base target of 11, terrain/fortification defence modifiers, supply attack penalties and deterministic combat logging.

BG5B turns that roll into the first complete board-game combat procedure. Ordinary hits inflict one damage and 25 readiness loss; a natural 20 inflicts two damage and 50 readiness loss. A defender at 50 readiness or lower retreats through a deterministic legal-retreat rule. A defender unable to retreat suffers an additional damage/readiness loss. Three damage or zero readiness eliminates the piece. When the last hostile piece leaves a target space, the attacker advances into it and control changes to the attacking seat.

Runtime combat now crosses a unified board action dispatcher through the `attack-piece` action. The board-game combat panel exposes the attacking piece, legal adjacent enemy targets, exact D20 target, supply/terrain/fortification modifiers and possible outcomes before commitment. The retained simulation attack controls are hidden from player use so the board-game rules engine owns the visible combat result.

BG5B remains open until exact-head engine tests and the full production build are green. After merge, the remaining BG5 work should focus on presentation hardening, direct enemy-piece/map targeting, combat feedback/animation, renderer projection of retreat/elimination/control changes and final removal or quarantine of any legacy simulation combat authority that can still execute indirectly.

The phase-level requirements remain authoritative in `docs/BOARDGAME-CONVERSION-ROADMAP.md` under **BG5 - Dice Combat**.
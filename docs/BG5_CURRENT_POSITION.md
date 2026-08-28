# BG5 Current Position

Last updated: 2026-08-28

BG0 is accepted. BG1A-E, BG2A-E, BG3A-E and BG4A-D are merged into `main`.

The active conversion programme is **BG5 - Dice Combat**.

Current package: **BG5A - Deterministic dice combat foundation** on branch `bg5a-deterministic-dice-combat-foundation`.

BG5A establishes the rules-owned combat contract before presentation work begins. It adds legal adjacent-enemy targeting, an explicit pre-commit combat preview, one seeded D20, a base target of 11, terrain and fortification defence modifiers, supply attack penalties, a declared/resolved combat state machine, concise combat logging and exact Command Action/activation progression.

BG5A deliberately records hit/miss without applying casualties, retreat, elimination or control changes. The current board wrapper has no agreed casualty threshold, and this package must not invent one implicitly. Those consequences belong in the next BG5 package and will consume the deterministic result established here.

The next package should integrate combat declaration/resolution into the authoritative board action dispatcher and board shell, then add explicit hit/loss/readiness, retreat/elimination and control rules with tests before presentation is allowed to expose them.

The phase-level requirements remain authoritative in `docs/BOARDGAME-CONVERSION-ROADMAP.md` under **BG5 - Dice Combat**.
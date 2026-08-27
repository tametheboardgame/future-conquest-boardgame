# BG3 Current Position

Last updated: 2026-08-27

BG0 is accepted. BG1A-E, BG2A-E, BG3A, BG3B and BG3C are merged.

The active conversion programme is now **BG3 - Players, Seats, Rounds and Alternating Activations**.

Current package: **BG3D - Round exhaustion and advancement** on branch `bg3/round-exhaustion-advancement`.

BG3A established deterministic participating-seat/controller configuration and moved the authoritative board save to schema v2.

BG3B introduced the authoritative `start-round` transition. In the current one-seat-per-side Central Front prototype, each participating seat receives the locked four Command Actions for the round; non-participating permanent seats remain at zero. Coalition-side budget sharing remains deferred until multiple defending seats are enabled as a playable configuration.

BG3C added deterministic active-seat progression and `pass-activation`. Pass yields only the current activation, costs no Command Actions and preserves the passing seat's remaining allowance. Progression skips non-participating and exhausted seats. The exact-head terrain gate was also hardened to compare repeated timing samples by median while retaining its existing regression budgets.

BG3D adds authoritative round exhaustion, `end-round` and `advance-round` transitions. A round can end only when every participating seat has zero Command Actions. Completed rounds return to canonical `round-start` state for the next round. Round 8 can end but cannot advance to round 9; BG10 remains responsible for campaign outcome and victory rules.

The detailed BG3 implementation sequence is in `docs/roadmap/BG3-PLAYERS-SEATS-ROUNDS-ACTIVATIONS.md`.

The `Current Position` footer in `docs/BOARDGAME-CONVERSION-ROADMAP.md` is historical text from the initial roadmap commit and must not be used to select the active package. The body of that roadmap remains the governing conversion plan.

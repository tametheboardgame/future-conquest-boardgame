# BG3 Current Position

Last updated: 2026-08-26

BG0 is accepted. BG1A-E, BG2A-E, BG3A and BG3B are merged.

The active conversion programme is now **BG3 - Players, Seats, Rounds and Alternating Activations**.

Current package: **BG3C - Alternating activations and Pass** on branch `bg3/alternating-activations-pass`.

BG3A established deterministic participating-seat/controller configuration and moved the authoritative board save to schema v2.

BG3B introduced the authoritative `start-round` transition. In the current one-seat-per-side Central Front prototype, each participating seat receives the locked four Command Actions for the round; non-participating permanent seats remain at zero. Coalition-side budget sharing remains deferred until multiple defending seats are enabled as a playable configuration.

BG3C adds deterministic active-seat progression and `pass-activation`. Pass yields only the current activation, costs no Command Actions and preserves the passing seat's remaining allowance. Progression skips non-participating and exhausted seats. If no other seat can activate, Pass is rejected without mutation; BG3D owns round exhaustion and round-end transition.

The detailed BG3 implementation sequence is in `docs/roadmap/BG3-PLAYERS-SEATS-ROUNDS-ACTIVATIONS.md`.

The `Current Position` footer in `docs/BOARDGAME-CONVERSION-ROADMAP.md` is historical text from the initial roadmap commit and must not be used to select the active package. The body of that roadmap remains the governing conversion plan.

# BG3 Current Position

Last updated: 2026-08-26

BG0 is accepted. BG1A-E, BG2A-E and BG3A are merged.

The active conversion programme is now **BG3 - Players, Seats, Rounds and Alternating Activations**.

Current package: **BG3B - Round start and Command Action grants** on branch `bg3/round-start-command-actions`.

BG3A established deterministic participating-seat/controller configuration and moved the authoritative board save to schema v2.

BG3B introduces the authoritative `start-round` transition. In the current one-seat-per-side Central Front prototype, each participating seat receives the locked four Command Actions for the round; non-participating permanent seats remain at zero. Coalition-side budget sharing is deliberately deferred until multiple defending seats are enabled as a playable configuration.

The detailed BG3 implementation sequence is in `docs/roadmap/BG3-PLAYERS-SEATS-ROUNDS-ACTIVATIONS.md`.

The `Current Position` footer in `docs/BOARDGAME-CONVERSION-ROADMAP.md` is historical text from the initial roadmap commit and must not be used to select the active package. The body of that roadmap remains the governing conversion plan.

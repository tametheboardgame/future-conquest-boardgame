# BG3 Current Position

Last updated: 2026-08-27

BG0 is accepted. BG1A-E, BG2A-E and BG3A-D are merged.

The active conversion programme is now **BG3 - Players, Seats, Rounds and Alternating Activations**.

Current package: **BG3E - Provider, UI and basic computer integration** on branch `bg3/provider-ui-basic-computer`.

BG3A established deterministic participating-seat/controller configuration and moved the authoritative board save to schema v2.

BG3B introduced the authoritative `start-round` transition. In the current one-seat-per-side Central Front prototype, each participating seat receives the locked four Command Actions for the round; non-participating permanent seats remain at zero. Coalition-side budget sharing remains deferred until multiple defending seats are enabled as a playable configuration.

BG3C added deterministic active-seat progression and `pass-activation`. Pass yields only the current activation, costs no Command Actions and preserves the passing seat's remaining allowance. Progression skips non-participating and exhausted seats. The exact-head terrain gate was also hardened to compare repeated timing samples by median while retaining its existing regression budgets.

BG3D added authoritative round exhaustion, `end-round` and `advance-round` transitions. A round can end only when every participating seat has zero Command Actions. Completed rounds return to canonical `round-start` state for the next round. Round 8 can end but cannot advance to round 9; BG10 remains responsible for campaign outcome and victory rules.

BG3E integrates those rules with the mounted application. The provider exposes the authoritative dispatcher, persists accepted actions immediately, starts/advances rounds through that same dispatcher, and lets the existing Current Activation panel issue a real Pass action. The basic computer policy may legally Pass back to a human opponent, but deliberately does not create a computer-v-computer zero-cost Pass loop. Real paid computer actions begin with the movement/action plumbing in BG4.

The detailed BG3 implementation sequence is in `docs/roadmap/BG3-PLAYERS-SEATS-ROUNDS-ACTIVATIONS.md`.

The `Current Position` footer in `docs/BOARDGAME-CONVERSION-ROADMAP.md` is historical text from the initial roadmap commit and must not be used to select the active package. The body of that roadmap remains the governing conversion plan.

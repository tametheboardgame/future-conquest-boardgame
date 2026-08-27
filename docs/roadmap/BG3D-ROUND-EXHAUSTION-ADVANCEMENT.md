# BG3D - Round Exhaustion and Advancement

## Status

IMPLEMENTED ON PR

## Goal

Complete the authoritative round state machine without relying on the legacy simulation resolver and without introducing campaign victory rules before BG10.

## Locked behaviour

- a round is exhausted only when every participating command seat has zero Command Actions remaining
- non-participating permanent seats do not affect exhaustion
- `end-round` is an authoritative board action
- `end-round` is legal only during activation phase and only after full participating-seat exhaustion
- successful `end-round` changes the phase to `round-end` and costs zero Command Actions
- `advance-round` is an authoritative board action
- `advance-round` is legal only during `round-end`
- advancing increments the round exactly once, returns to `round-start`, resets every permanent seat's Command Action allowance to zero and selects the first participating permanent seat as the canonical active seat
- the next `start-round` action remains responsible for granting the normal round allowance
- invalid transitions mutate nothing and cost nothing
- save/reload preserves `round-end` and advanced `round-start` states exactly
- round 8 may end normally but cannot advance to round 9
- BG10 owns victory, defeat and campaign-resolution logic at the round-8 boundary

## Why the terminal state remains round-end

BG3 owns turn sequencing, not campaign outcome. Keeping an exhausted round-8 game at `round-end` records a deterministic terminal board position without prematurely inventing a winner, score or ending state that belongs to BG10.

## Integration boundary

Future paid actions can use `isBoardRoundExhausted` after spending their authoritative Command Action cost. BG3E can drive the same `end-round` and `advance-round` dispatcher actions for human and computer-controlled seats. Movement, combat and other paid actions remain outside BG3D.

## Acceptance

- two-seat and multi-seat exhaustion detection is deterministic
- a round cannot end while any participating seat can still act
- exhausted activation transitions to `round-end`
- round-end advances to the next canonical `round-start`
- a restarted round grants the normal four Command Actions
- round-end and next-round state survive save/reload
- seven advances reach round 8 exactly
- a ninth round is rejected without mutation or victory invention
- protected renderer and legacy simulation files remain untouched

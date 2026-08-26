# BG3C - Alternating Activations and Pass

## Status

IMPLEMENTED ON PR

## Goal

Add deterministic alternating activation order to the authoritative board-state engine without introducing movement, combat, round-end or UI behaviour early.

## Locked behaviour

- activation order follows permanent command-seat order
- only participating seats with Command Actions remaining are eligible for an activation
- non-participating seats are skipped
- exhausted participating seats are skipped
- search wraps deterministically through the six permanent seat identities
- if every other eligible seat is exhausted, generic next-seat selection may resolve back to the current seat after a full circuit
- Pass Activation is an authoritative board action
- Pass costs zero Command Actions
- Pass does not discard or forfeit the passing seat's remaining Command Actions
- Pass changes only the active seat
- Pass requires another seat to have a legal activation
- invalid Pass attempts mutate nothing and cost nothing
- BG3D owns detection of round exhaustion and transition to round end

## Why Pass does not end a seat's round

Pass is a tempo choice: a player can decline the current activation and retain Command Actions for a later activation. This preserves meaningful alternating play instead of turning Pass into an implicit 'forfeit all remaining actions' control.

## Integration boundary

Future paid actions should use the same deterministic next-seat search after applying their authoritative Command Action cost. This allows the engine to alternate normally while also letting the final non-exhausted seat continue once all opponents are out of actions.

## Acceptance

- default two-seat play alternates seat 1 -> seat 2 -> seat 1 through Pass
- Pass never changes either seat's Command Action allowance
- multi-seat play skips inactive and exhausted seats
- no-other-seat Pass attempts are rejected without mutation
- active-seat state survives save/reload exactly
- all existing renderer/runtime regression gates remain green

# BG3A - Player and Seat Configuration

## Status

IMPLEMENTED ON BRANCH, VALIDATION PENDING

## Scope

BG3A introduces authoritative participation state for the six permanent command seats without changing the protected map renderer or legacy simulation mechanics.

## Behaviour

- all six command-seat identities remain in board state
- Central Front defaults to two participating seats, seat 1 and seat 2
- each seat retains Human or Computer controller assignment
- the live provider's existing seat 1 Human configuration therefore becomes Human vs Computer by default
- Human vs Human and Computer vs Computer are supported through the same state constructor
- additional permanent seats can be activated later for split coalition control
- at least two unique participating seats are required
- participating seats are canonicalised to permanent seat order for deterministic progression
- the active seat must be participating
- invalid saved seat metadata is rejected

## Save compatibility

The board-state schema advances from v1 to v2 because participation is authoritative saved state. The board-state storage key is versioned, so the previous BG2 v1 board save remains untouched while the application creates/uses the v2 slot. The separate legacy simulation save is also unaffected.

## Explicit non-scope

BG3A does not yet grant or spend Command Actions, rotate active seats, implement Pass Activation, advance rounds, drive computer actions or change movement/combat rules. Those remain in BG3B-E and later roadmap packages.

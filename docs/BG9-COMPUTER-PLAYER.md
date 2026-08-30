# BG9 — Computer Player

## Intent

BG9 turns the existing basic computer turn hook into a complete deterministic board-game policy. The computer is not allowed to use a second rules engine: it chooses from ordinary board actions and every selected action is still resolved by the same authoritative dispatcher used by human play.

## Legal-action enumeration

`board-computer-player.ts` enumerates the active computer seat's legal choices from the current saved board state.

It considers:

- attack
- movement
- Recover
- Logistics
- Engineer
- strategic action cards
- Pass Activation
- End Actions

Combat enumeration uses the authoritative combat preview/target API and does **not** resolve speculative dice. Support, card, Pass and End Actions candidates are admitted only when the shared dispatcher accepts them. The policy therefore cannot consume RNG or mutate state while deciding what to do.

## Deterministic baseline policy

Each legal candidate receives a deterministic score. Stable action identity breaks exact ties; there is no random AI tie-breaker.

The standard policy values:

- combat probability and defender vulnerability
- movement toward hostile-controlled or hostile-occupied spaces
- recovery when damage/readiness makes it useful
- restoration of strained or isolated supply
- fortifying positions close to hostile territory
- card tempo, because a card reuses the same effect without spending a Command Action and retains activation

The computer therefore makes visible board-game choices rather than consulting hidden simulation data.

## Difficulty and personality parameters

The policy exposes two difficulty levels:

- `basic` — simple stable action priorities
- `standard` — board-position and tactical scoring

It also exposes three deterministic personalities:

- `balanced`
- `aggressive`
- `methodical`

The runtime currently uses the standard balanced profile. The parameters are deliberately policy inputs rather than new authoritative state, so later setup/presentation work can expose them without changing the underlying rules.

## End Actions

BG3 Pass Activation deliberately costs nothing. That is correct for a human yielding one activation, but it means an AI-vs-AI game can loop forever if neither side has a useful paid action.

BG9 therefore adds one ordinary shared action: `end-seat-actions`.

It:

- is legal only during an active Command Action window
- is blocked by unresolved declared combat
- forfeits the active seat's remaining Command Actions
- advances to the next seat that can still act
- costs zero individual Command Actions because it explicitly gives up the whole remaining pool
- is available through the same dispatcher to human and computer controllers

This is not an AI-only escape rule. It is the board-game equivalent of declaring that a side is finished for the round.

## Acceptance evidence

Focused BG9 tests cover:

- every enumerated candidate is legal through the shared dispatcher
- enumeration consumes no RNG and mutates no state
- identical state/policy chooses the same action
- movement advances toward hostile territory when combat is unavailable
- a free card effect is valued above its equivalent paid action
- End Actions prevents zero-cost Pass loops
- a deterministic computer-v-computer game runs unattended through the complete eight-round campaign boundary
- no `Math.random` or alternative AI dispatcher is introduced

Full exact-head repository CI remains the merge gate.

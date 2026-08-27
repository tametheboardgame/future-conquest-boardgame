# BG3E - Provider, UI and Basic Computer Integration

## Status

IMPLEMENTED ON PR

## Goal

Connect the authoritative BG3 turn engine to the mounted application without replacing the retained map, simulation renderer bridge or existing shell.

## Locked behaviour

- the mounted board-state provider exposes the authoritative state and one dispatch function
- every accepted board action is persisted to the dedicated v2 board save immediately
- rejected actions do not replace or persist board state
- round-start, exhausted-round closure and non-terminal round advancement are selected automatically but still execute through the same authoritative dispatcher
- round 8 remains at round-end for BG10 campaign resolution
- the existing Current Activation panel issues `pass-activation` through the provider dispatcher
- Pass legality is previewed by the authoritative game layer rather than recalculated in presentation code
- Move and Attack remain retained simulation adapters until BG4 replaces their action plumbing
- a computer-controlled seat uses the same dispatcher and may legally Pass back to a human opponent
- computer-v-computer does not enter an infinite zero-cost Pass loop while BG3 contains no paid computer action
- BG4 supplies the first real paid movement action that can reduce Command Actions in normal play

## Controller configurations

### Human vs Human

Both seats wait for explicit player board actions. Pass alternates through the authoritative dispatcher and save state.

### Human vs Computer

A human may Pass to the computer. The basic BG3 computer policy legally Passes back through the same dispatcher. This proves controller ownership and shared action boundaries without inventing strategy before movement exists.

### Computer vs Computer

The configuration remains valid and deterministic, but BG3E deliberately waits in activation rather than bouncing forever between free Pass actions. Automated paid play becomes meaningful once BG4 adds movement/action spending.

## Persistence

Accepted automatic and human board actions write the same `future-conquest-board-state-v2` save used since BG3A. The legacy simulation save remains separate.

## Protected boundaries

BG3E does not replace or reinitialise:

- MapLibre/WebGL lifecycle
- terrain/DEM state
- map mount or camera
- board-state renderer projection
- cities, landmarks or physical map presentation

## Acceptance

- provider preserves the existing `useBoardGameState` read hook
- provider exposes `useBoardGameDispatch`
- accepted actions persist and update authoritative state
- new/round-start state enters activation through the dispatcher
- exhausted fixture states close and advance through the dispatcher
- Pass is live in Current Activation for human turns
- computer Pass uses the same dispatcher
- C/C cannot form a free infinite Pass loop
- round 8 does not auto-advance
- full engine/build/renderer/browser regression gates remain green

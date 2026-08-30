# BG7 — Engineering, Logistics and Recovery as Simple Board-Game Actions

## Intent

BG7 keeps the strategic consequences of the legacy engineering, logistics and recovery systems while removing their project-management and allocation interfaces from the board-game loop.

The board conversion therefore uses three paid support actions against state that already exists in the v3 board save schema. No additional operational sub-system or save migration is required.

## Locked actions

### Recover

Target: one active-seat formation on the board.

Cost: 1 Command Action.

Effect:

- remove 1 damage, to a minimum of 0
- restore 25 readiness, to a maximum of 100

A formation already at 0 damage and 100 readiness cannot spend an action on Recover.

### Logistics

Target: one active-seat formation on the board.

Cost: 1 Command Action.

Effect:

- isolated → strained
- strained → supplied
- supplied → no legal Logistics action

The existing BG5 combat preview/resolution consumes the same supply state, so this immediately improves the formation's attack modifier from -2 to -1 or from -1 to 0.

### Engineer

Target: the friendly-controlled board space occupied by one active-seat formation.

Cost: 1 Command Action.

Effect:

- add +1 fortification
- maximum fortification: 3

The existing BG5 combat preview/resolution consumes that fortification value directly as a defensive target modifier.

## Shared action contract

All three support actions:

- are legal only during the activation phase
- require a participating active seat with at least one Command Action
- require a valid on-board formation owned by the active seat
- cannot interrupt a declared unresolved combat
- cost exactly one Command Action when accepted
- advance activation through the existing BG3 seat-order engine
- consume no RNG
- reject no-op or illegal attempts without cost or mutation

## Interface

`TabletopSupportPanel` is mounted in the authoritative board-status shell. It deliberately exposes only:

- formation selector
- readiness
- damage
- supply
- current-space fortification
- Recover / Engineer / Logistics buttons
- one-line rules feedback

Buttons are enabled from authoritative action previews rather than UI-side rule duplication.

This keeps the support loop visible and understandable without reopening the retained legacy Engineering or Logistics command screens.

## Legacy-system extraction boundary

BG7 does **not** port:

- engineering project queues
- percentage allocations
- personnel/material delivery calculations
- logistics priority tables
- route throughput simulation
- repair ETAs
- operational status administration

Those systems remain useful reference material for strategic intent, but the board-game conversion represents their immediate value through the four already-visible tracks: readiness, damage, supply and fortification.

## Acceptance evidence

Focused tests cover:

- exact Command Action cost and activation progression
- Recover repair/readiness effects and caps
- Logistics supply stepping and BG5 attack-modifier improvement
- Engineer fortification and BG5 defence-target improvement
- ownership/phase/action guardrails
- no-cost/no-mutation rejection
- unchanged RNG
- persistence through the existing v3 board save state

Full repository CI remains the final merge gate.

# BG8 — Cards and Strategic Events

## Intent

BG8 moves strategic flavour, temporary exceptions and historical texture into a compact board-game card layer rather than reopening simulation-era command menus.

The implementation reuses the `action` deck already reserved in the v3 board state. Draw pile, hands and discard pile are therefore ordinary saved authoritative state.

## Deck structure

The first action deck contains twelve cards: two from each roadmap family.

- Command
- Support
- Event
- Escalation
- National / political response
- Scenario-specific

The families provide flavour and future expansion boundaries. The first playable effects deliberately stay small and legible: Move, Recover, Engineer and Logistics.

## Round preparation

BG8 runs at round start after BG6 escalation and before Command Actions are granted.

- a new or pre-BG8 migrated v3 save receives a two-card opening hand for each participating seat in its current round
- later rounds draw one card per participating seat
- hand limit is three cards
- draw order is deterministic from the authoritative board RNG
- when the draw pile empties, the saved discard pile is deterministically reshuffled
- `actionCardsPreparedRound` prevents duplicate draws in the same round

No historical draws are replayed when an older save is first opened in a later round.

## Playing a card

A card is a one-shot exception around an existing ordinary paid action.

1. the active seat chooses a card from its saved hand
2. the card builds the corresponding ordinary Move / Recover / Engineer / Logistics action
3. the normal authoritative rules API decides whether that action is legal and applies its effect
4. if the wrapped action succeeds, BG8 refunds its one Command Action cost and restores the current activation
5. the card moves from hand to discard

This means cards can create tactical tempo without duplicating movement, ownership, supply, fortification or recovery rules.

Rejected/no-op effects:

- spend no Command Action
- do not consume the card
- do not mutate board state

A declared unresolved combat blocks card play until combat is resolved.

## Initial card set

### Command

- Rapid Redeployment — free legal Move
- Local Initiative — free legal Move

### Support

- Field Repair Teams — free Recover
- Emergency Supply Column — free Logistics

### Event

- Railway Priority — free Logistics
- Road Repair Detachment — free Engineer

### Escalation

- Emergency Mobilisation — free Recover
- Frontline Priority — free legal Move

### National / political response

- National Reserve Priority — free Logistics
- Civil Engineering Corps — free Engineer

### Scenario-specific

- Rhine Crossing Preparations — free Engineer
- Central Front Shuttle — free legal Move

## Interface

`TabletopCardHandPanel` is a fixed map overlay rather than normal document flow.

It exposes only:

- current active-seat hand
- deck count
- discard count
- selected card family/title/summary
- formation target
- legal destination selector when the card wraps movement
- authoritative play legality and feedback

The existing map-first layout therefore keeps the same viewport geometry.

## Extraction boundary

BG8 does not restore historical strategic administration screens, operational event tables or menu-driven exception systems.

The card layer is the board-game replacement for those temporary strategic exceptions. Future cards should continue to prefer small effects that reuse authoritative board actions or short-lived explicit board modifiers rather than create new simulation sub-systems.

## Acceptance evidence

Focused tests cover:

- all six roadmap card families
- deterministic deck order and seed variation
- opening deal, later-round draw and hand cap
- deterministic discard reshuffle
- round-start orchestration order
- free wrapped Recover / Logistics / Engineer / Move effects
- ordinary legality retained under card play
- no-cost/no-mutation rejection
- save/load continuity
- later-round pre-BG8 v3 migration
- fixed-overlay UI and authoritative preview/dispatch contracts

Full exact-head repository CI remains the merge gate.

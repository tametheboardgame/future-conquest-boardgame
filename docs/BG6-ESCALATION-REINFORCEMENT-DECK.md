# BG6 — Escalation and Reinforcement Deck

## Goal

Turn the reserved board-game escalation deck into a deterministic, saveable pressure system that increases opposition strength as the eight-round campaign progresses.

## Prototype A — Combined deck

- One persisted draw pile.
- One automatic draw at the start of each round.
- Each card carries both the escalation level and any reinforcement or fortification effect.
- Cards are grouped into four two-card pressure bands: rounds 1–2, 3–4, 5–6 and 7–8.
- Card order is shuffled only within its pressure band using the authoritative persisted RNG.
- Existing `decks.escalation` state is sufficient, so no board-state schema change is required.

## Prototype B — Split decks

- One escalation deck plus one reinforcement deck.
- Two persisted draw piles.
- Two resolution steps per round with an ordering rule between them.
- More independent content variation, but also more save-state, orchestration and presentation complexity.
- The extra state does not materially improve the first board-game conversion while the campaign is only eight rounds long.

## Decision

Use the combined deck for BG6.

It meets the pressure, determinism and persistence requirements with one authoritative state slot and one round-start resolution. The content remains data-driven, so a later rules pass can split escalation and reinforcement if playtesting shows a meaningful benefit.

## Runtime contract

1. While the game is in `round-start`, automatic orchestration requests `resolve-escalation` before `start-round`.
2. The unified board action dispatcher resolves the escalation card.
3. Resolution costs zero Command Actions.
4. All card ordering and target selection randomness comes from `BoardGameState.rng`.
5. Reinforcements are added directly to authoritative `pieces`; fortification is written directly to authoritative `spaces`.
6. The resolved card moves to `decks.escalation.discard`, which also records whether the current round has already resolved escalation.
7. Save/load therefore preserves card order, resolution history, reinforcement pieces, fortification and RNG continuation.

## Pressure curve

- Rounds 1–2: pressure 1, one reinforcement.
- Rounds 3–4: pressure 2, one reinforcement and +1 fortification.
- Rounds 5–6: pressure 3, two reinforcements and +1 fortification.
- Rounds 7–8: pressure 4, two reinforcements and +2 fortification.

The two cards within each band vary by seed, but a later band cannot produce lower numeric pressure than an earlier band.

## Legacy v3 save behaviour

BG2 reserved the escalation deck state before BG6, so the save schema remains version 3. If an older save first encounters BG6 in a later round with an empty escalation deck, previous-round cards are moved into discard without applying retroactive effects. The current round then resolves at its correct pressure band. This avoids corrupting or suddenly rewriting an in-progress pre-BG6 campaign.

## Acceptance evidence

Automated BG6 tests cover:

- both conceptual deck prototypes and the combined-deck selection;
- same-seed deterministic order and RNG state;
- different-seed variation while retaining the staged pressure curve;
- round-start orchestration and zero Command Action cost;
- authoritative reinforcement placement;
- increasing pressure across all eight rounds;
- browser save/load persistence of deck, pieces and RNG;
- later-round legacy-save migration;
- duplicate and wrong-phase resolution rejection.

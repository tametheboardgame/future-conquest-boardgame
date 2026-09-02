# BG12A — Board Playtest Matrix

## Status

IN VALIDATION

## Goal

Start BG12 with repeatable evidence from the converted board game before changing balance or mechanics.

BG12A runs deterministic computer-v-computer Central Front campaigns through the same automatic turn orchestration and unified board dispatcher used by the live application. It does not use the legacy operational `balance-simulation.ts` model and it does not introduce AI-only legality or outcomes.

## Runtime path

Each campaign:

1. creates the ordinary Central Front board state with both participating seats set to `computer`
2. asks `chooseAutomaticBoardAction(state)` for one next action
3. resolves that action through `applyBoardAction(state, action)`
4. repeats until BG10 resolves the campaign or an integrity guard fires

This intentionally exercises escalation, action-card preparation/play, round starts/ends, BG9 computer decisions, movement, support, combat, round scoring and BG10 victory resolution as one integrated rules path.

## Evidence captured

Per campaign:

- seed and starting Expedition space
- final outcome and resolution round
- sudden vs round-8 resolution
- final BG10 reason
- breakthrough points and objectives held
- surviving pieces for both sides
- accumulated visible damage
- authoritative RNG calls
- automatic-action count
- action-family counts, including cards, combat, support and round lifecycle actions

Across the matrix:

- Expedition / Defender win split
- unresolved, rejected-action and safety-limit counts
- median resolution round
- average automatic actions
- aggregate action mix
- an initial 85% dominance signal once at least 12 campaigns exist

## Gate semantics

`integrityGate` is deliberately separate from `balanceSignal`.

The integrity gate fails if a campaign stalls, an automatically chosen action is rejected, or the safety limit is reached. A lopsided win split does **not** fail the mechanical integrity gate; it is evidence for the next BG12 remediation decision.

This prevents the harness from changing rules merely to make a statistic look balanced.

## Commands

Run the normal regression suite:

```bash
npm test
```

Generate a 24-campaign board playtest report:

```bash
npm run simulate:board-playtest
```

Useful overrides:

```bash
npm run simulate:board-playtest -- --runs=48 --seed-offset=1000 --max-steps=1000
```

Outputs are written to `board-playtest-output/board-playtest-matrix.json` and `.md` unless `--output-dir` is supplied.

## Acceptance for BG12A

- repeated identical seeds produce identical reports
- the multi-seed regression sample resolves without rejected actions, stalls or safety-limit failures
- the runner uses the converted board-game orchestration/dispatcher, not the legacy operational simulation
- JSON and Markdown evidence expose enough information to identify dominant strategies, unwinnable openings and unexpectedly short/long campaigns
- no gameplay balance change is made in this package

## Next BG12 decision

Use the resulting matrix plus human playtest observations to choose the smallest evidence-backed remediation. Automated win-rate signals are diagnostic, not a substitute for whether the complete game is enjoyable and understandable in real play.

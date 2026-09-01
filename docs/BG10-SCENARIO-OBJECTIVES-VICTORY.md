# BG10 — Scenario Objectives, Victory and Defeat

## Goal

Turn the eight-round Central Front board game into a campaign with a visible strategic purpose and an authoritative ending.

BG10 deliberately avoids importing the legacy simulation's broad KPI or political-collapse scoring. The board game ends through geography, accumulated breakthrough pressure, or elimination.

## Strategic roles

The first participating command seat is the **Expedition** (attacker). The second is the **Defenders**.

The Expedition is trying to force a strategic breakthrough. The Defenders are trying to deny it through the eight-round escalation arc.

## Strategic objectives

Three existing board spaces are the campaign objectives:

- **Paris** — `FR-02`
- **Brussels** — `BE-01`
- **Rhine-Ruhr** — `DE-02`

No parallel campaign map or hidden objective state is introduced. Control is read directly from the authoritative board spaces already used by movement and combat.

## Breakthrough points

At each round end, before the next round advances, the Expedition gains **1 breakthrough point for each strategic objective it controls**.

Round scoring is an authoritative free action and may happen only once per round. The campaign state stores the cumulative total and the last scored round.

## Victory and defeat

### Immediate Expedition victory

The Expedition wins immediately if it controls all three strategic objectives at the same time.

### Immediate Defender victory

The Defenders win immediately if no Expedition formation remains on the board.

### End of round 8

After round 8 is scored:

- the Expedition wins if it holds at least **2 of the 3 objectives**; or
- the Expedition wins if it has at least **10 breakthrough points** and still holds at least one strategic objective;
- otherwise the Defenders win.

This makes current map position decisive while still rewarding sustained earlier pressure.

## Runtime and save contract

- `score-campaign-round` and `resolve-campaign` cross the same unified board dispatcher as every other authoritative rule.
- Automatic orchestration scores each round end, resolves sudden outcomes before further play, and produces a terminal campaign result after round 8.
- Once resolved, all further board actions are rejected without state mutation or Command Action cost.
- BG10 keeps board save version 3. Existing pre-BG10 v3 saves migrate lazily: no historical breakthrough points are invented for already-completed rounds.
- Current BG10 campaign state serializes normally and survives save/load.

## Computer player

BG9 legality remains unchanged. BG10 only adds deterministic strategic valuation:

- movement toward uncontrolled campaign objectives gains value;
- attacks on objective defenders gain value;
- recovery, logistics and engineering on objective positions gain modest defensive value.

The computer still chooses only ordinary legal actions and never receives an AI-only campaign rule.

## Presentation

The existing tabletop status shell now shows:

- current objectives held by the Expedition;
- cumulative breakthrough points;
- objective/rules detail via the campaign status tooltip;
- a clear terminal victory/defeat banner once the campaign resolves.

The presentation is derived from the authoritative campaign projection and does not modify the MapLibre renderer.

## Acceptance

BG10 is accepted when:

- the three scenario objectives are real retained Central Front spaces;
- round-end scoring is deterministic and exactly-once;
- immediate and round-8 victory/defeat conditions resolve automatically;
- terminal state prevents further play;
- save/load and pre-BG10 migration are deterministic;
- computer-v-computer play reaches a terminal outcome without intervention;
- campaign status and result are visible in normal play;
- full exact-head repository CI is green.

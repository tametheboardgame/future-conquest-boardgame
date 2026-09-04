# Future Conquest Development Status

Last updated: 2026-09-04

## Current programme

The active product programme is the board-game conversion and tabletop-completion plan in `docs/BOARDGAME-CONVERSION-ROADMAP.md`.

Historical R3 package documents and earlier board-game package documents remain implementation records only. The September 2026 board-game roadmap is the forward authority.

## Last accepted package

**BG12G-R — Physical 2D6 Dice Tray and Combat Recalibration**

Status: **COMPLETE, MERGED AND DEPLOYED**

Accepted PR head: `35060925165cba94706e95b73718b408db072f58`  
Merged PR: #50  
Main merge SHA: `cb85e9abb622aa3792ea1cdd83fe9896e77504fb`

The product owner explicitly passed the final integrated dice/gameplay gate on 4 September 2026. The accepted implementation uses exactly two authoritative seeded D6s, with the stored result projected through the isolated true-3D dice renderer. The post-merge production deployment and post-merge R2E browser gate both passed on `main`.

The 2D6 dice model remains locked. D20, 3D6 and 4D6 are not ordinary balance alternatives.

## Current active package

**BG12H — Contextual Formation Interaction**

Branch: `feat/bg12h-contextual-formation-interaction`

Base: accepted deployed `main` at `cb85e9abb622aa3792ea1cdd83fe9896e77504fb`.

BG12H replaces the permanent Turn / Combat / Support control hierarchy with one compact board-game formation interaction:

1. select a friendly formation on the board;
2. choose **Move / Attack / Support / Pass**;
3. choose destinations or targets directly on the map where applicable;
4. use compact confirm/cancel presentation;
5. Attack uses the accepted BG12G-R true-3D 2D6 tray and authoritative combat result;
6. collapse the contextual interaction after accepted resolution.

BG12H is presentation/orchestration work around existing authoritative APIs. It must not create new movement, combat, support, turn-progression or RNG rules.

## Current gate

BG12H requires:

- the existing direct map formation selection to remain functional;
- Move to keep using authoritative `getBoardMoveDestinations` / `move-piece` dispatch;
- Attack to keep using authoritative combat preview/target helpers and `attack-piece` dispatch;
- Support to keep using the existing Recover / Engineer / Logistics dispatcher actions;
- Pass to keep using authoritative `pass-activation` legality and dispatch;
- the accepted true-3D 2D6 renderer and dice-clatter lifecycle to remain unchanged in authority;
- protected MapLibre map interaction/lifecycle to remain green;
- exact-head regression/build/browser evidence;
- a final manual gameplay/visual gate before merge.

## Next packages

After BG12H manual acceptance and merge:

- **BG12I — Map Information Reduction and Board Tokens**
- **BG12J — Coach-Mark Onboarding**
- **BG12K — Secondary Drawers**, including player-facing dice appearance settings using the accepted theme architecture.

## Source-of-truth order

For current board-game work, use this order:

1. current `main` plus the exact active PR head where work is in progress;
2. `docs/BOARDGAME-CONVERSION-ROADMAP.md`;
3. this status file;
4. active package-specific rules/docs/tests;
5. historical package documents for implementation history only.

Any automated worker or supervisor must inspect the current roadmap and this file before selecting work.

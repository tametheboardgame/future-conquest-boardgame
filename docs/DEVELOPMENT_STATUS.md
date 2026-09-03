# Future Conquest Development Status

Last updated: 2026-09-03

## Current programme

The active product programme is the board-game conversion and tabletop-completion plan in `docs/BOARDGAME-CONVERSION-ROADMAP.md`.

The previous R3-WP6.6 status text in this file is historical and no longer selects work. Historical R3 package documents remain useful records, but the September 2026 board-game roadmap is the forward authority.

## Current active package

**BG12G-R — Physical 2D6 Dice Tray and Combat Recalibration**

Branch: `feat/bg12g-2d6-rework`  
PR: #50

The product owner has explicitly locked **2D6** as the permanent base combat dice model.

Current contract:

- combat rolls exactly two authoritative seeded D6s;
- the two faces are stored with their total;
- the UI animates the stored result and never owns combat RNG;
- double six is the current critical result;
- current target, terrain, supply and fortification numbers remain evidence-driven calibration knobs until the exact-head campaign evidence is accepted;
- fortification is currently binary/non-stacking for combat;
- D20, 3D6 and 4D6 are not current alternatives and must not be reintroduced as the base combat roll without a new explicit rules decision and migration package;
- legacy D20 saves/results remain a compatibility concern, not a reason to keep D20 as an active rule.

## Current gate

BG12G-R must not merge or unblock BG12H until all of the following are satisfied:

1. deterministic engine/regression tests pass on the exact head;
2. exact-head campaign balance evidence is acceptable under the 2D6 probability curve;
3. AI and human previews use the same authoritative 2D6 probability calculation;
4. exact-head integrated browser, terrain-performance and production build/deployment checks pass;
5. the live two-D6 presentation passes the user's manual visual/gameplay check.

If balance evidence requires tuning, change documented numerical 2D6 calibration values and repeat the evidence cycle. Do not reopen the dice-count/type decision as part of ordinary balance tuning.

## Next package

After BG12G-R passes its automated and manual gate:

**BG12H — Contextual Formation Interaction**

BG12H must build its Attack flow around the locked 2D6 tray and authoritative combat result. It does not get to create a separate combat/RNG path.

## Source-of-truth order

For current board-game work, use this order:

1. current `main` plus the exact active PR head where work is in progress;
2. `docs/BOARDGAME-CONVERSION-ROADMAP.md`;
3. this status file;
4. active package-specific rules/docs/tests;
5. historical package documents for implementation history only.

Any automated worker or supervisor must inspect the current roadmap and this file before selecting work. Pre-BG12G D20 documents and older R3 programme status files do not override the locked 2D6 decision or the active BG12 sequence.

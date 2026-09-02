# BG12B — Central Front opening balance calibration

## Baseline evidence

BG12A established a deterministic production-rules board-game playtest matrix. Its first 24-campaign sample resolved cleanly but showed a severe Defender advantage:

- 24/24 campaigns resolved without rejected actions or safety-limit failures.
- Expedition: 1 win (4.2%).
- Defenders: 23 wins (95.8%).
- 20 of the 23 Defender wins resolved before round 8.
- Because the only early Defender campaign condition is elimination of every Expedition formation, those 20 campaigns are sudden elimination losses rather than final-round scoring losses.
- The baseline opening is four Expedition task groups in one entry space against one Defender formation in every other Central Front space.

The high attack count in BG12A is not sufficient evidence of an AI bug. Paid movement cannot enter hostile-controlled spaces, so combat is required to open the map, and the Defender is rationally rewarded for eliminating the Expedition.

## Calibration

BG12B changes one opening variable only:

- Expedition task groups increase from four to six: `TG-1` through `TG-6`.

The following stay unchanged:

- four Command Actions per participating seat per round;
- one initial Defender EF formation in every non-entry space;
- combat base target, damage, readiness, retreat and elimination rules;
- escalation reinforcement schedule and card deck;
- movement/control rules;
- action-card rules;
- campaign objectives, breakthrough scoring and victory thresholds;
- renderer and presentation systems.

The additional formations increase the Expedition survival pool without increasing its per-round action economy. This directly targets the observed early-elimination failure mode while avoiding a simultaneous offensive-power buff.

## Evaluation

The exact-head BG12 board playtest workflow remains the authority for the experiment. Compare its 24-seed result with the BG12A baseline, especially:

- Defender victories before round 8;
- Expedition/Defender win split;
- median resolution round;
- campaign integrity failures;
- action mix and progression to strategic objectives.

Do not lock a win-rate acceptance threshold until the six-task-group sample exists. If early elimination remains dominant, adjust only the opening formation count in the next iteration before considering a second balance lever.

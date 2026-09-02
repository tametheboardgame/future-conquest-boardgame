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

BG12B changes one opening variable only: Expedition formation count.

The first experiment increased the Expedition from four to six task groups. Across the same 24-seed matrix it produced:

- Expedition: 2 wins (8.3%).
- Defenders: 22 wins (91.7%).
- Defender victories before round 8 fell from 20 to 8.
- Median resolution moved from round 5 to round 8.
- 24/24 campaigns remained mechanically resolved with the integrity gate passing.

That result confirmed opening force size is a useful survivability lever, but six task groups remained clearly Defender-dominant. The current experiment therefore changes the same single variable again:

- Expedition task groups increase from four to eight: `TG-1` through `TG-8`.

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

The exact-head BG12 board playtest workflow remains the authority for the experiment. Compare the eight-task-group 24-seed result with both prior samples, especially:

- Defender victories before round 8;
- Expedition/Defender win split;
- median resolution round;
- campaign integrity failures;
- action mix and progression to strategic objectives.

Do not merge merely because survivability improves. The eight-task-group experiment should materially reduce the severe Defender bias without flipping the same deterministic sample into obvious Expedition dominance. If games regularly reach round 8 but the Defender still wins overwhelmingly on objectives/breakthrough scoring, opening formation count has reached the limit of what it should solve and the next calibration should use a separate, explicitly measured strategic-balance lever.

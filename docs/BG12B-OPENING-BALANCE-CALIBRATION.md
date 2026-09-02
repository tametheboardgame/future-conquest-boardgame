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

## Calibration path

BG12B changes one opening variable only: Expedition formation count.

### Four task groups — baseline

- Expedition: 1/24 wins (4.2%).
- Defenders: 23/24 wins (95.8%).
- Defender victories before round 8: 20/24.
- Balance signal: Defender-dominant.

### Six task groups — intermediate experiment

- Expedition: 2/24 wins (8.3%).
- Defenders: 22/24 wins (91.7%).
- Defender victories before round 8: 8/24.
- Median resolution moved from round 5 to round 8.
- 24/24 campaigns remained mechanically resolved.
- Balance signal: Defender-dominant.

This confirmed that formation count is a useful opening-survivability lever, but six formations remained clearly insufficient.

### Eight task groups — accepted automated calibration

The current scenario uses eight Expedition task groups: `TG-1` through `TG-8`.

Across the canonical 24-seed BG12 matrix:

- Expedition: 6/24 wins (25.0%).
- Defenders: 18/24 wins (75.0%).
- Defender victories before round 8: 1/24.
- Median resolution round: 8.
- 24/24 campaigns resolved cleanly.
- Rejected campaigns: 0.
- Safety-limit campaigns: 0.
- Balance signal: mixed; neither side crosses the matrix's 85% dominance threshold.

The game remains intentionally asymmetric and Defender-favoured in this automated sample, but the original unwinnable-opening signal has been removed: almost every campaign now survives to the final round and the Expedition wins a material minority of deterministic games.

## Rule boundaries kept unchanged

The accepted eight-task-group calibration does **not** change:

- four Command Actions per participating seat per round;
- one initial Defender EF formation in every non-entry space;
- combat base target, damage, readiness, retreat and elimination rules;
- escalation reinforcement schedule and card deck;
- movement/control rules;
- action-card rules;
- campaign objectives, breakthrough scoring and victory thresholds;
- renderer and presentation systems.

The additional formations increase the Expedition survival pool without increasing its per-round action economy. This directly addresses the early-elimination failure mode without applying a simultaneous offensive-power buff.

## Acceptance envelope

BG12B locks the canonical automated sample to these release-oriented properties rather than an exact win percentage:

- mechanical integrity passes;
- all 24 canonical campaigns resolve;
- neither side is classified as dominant by the existing 85% signal;
- the Expedition wins at least one campaign;
- widespread early Defender elimination does not return (no more than four early Defender victories in the canonical sample).

This is an automated balance guard, not a claim that human play is fully tuned. Human playtesting remains authoritative for whether the 75/25 automated split feels appropriately difficult, whether meaningful strategic choices are frequent enough, and whether later scoring needs further adjustment.

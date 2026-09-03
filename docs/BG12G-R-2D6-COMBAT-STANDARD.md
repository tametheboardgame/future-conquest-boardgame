# BG12G-R — Locked 2D6 Combat Standard

Decision date: 2026-09-03  
Status: **LOCKED DICE MODEL / CALIBRATION IN PROGRESS**

## Product decision

Future Conquest base combat uses **exactly two six-sided dice (2D6)**.

This supersedes the previous D20 combat model. 3D6 and 4D6 were considered and rejected for the base combat roll because their distributions cluster more tightly around the mean, reducing the useful tactical variance and simple physical board-game feel provided by 2D6.

The dice count/type is **not** a BG12G-R balance knob. Changing away from 2D6 requires a new explicit rules decision, migration plan, save/replay consideration and full deterministic/balance evidence.

## Current authoritative combat rule

Current BG12G-R calibration:

- roll 2D6 and sum the two faces;
- base hit target: `7`;
- supply attack modifier:
  - supplied: `+0`;
  - strained: `-1`;
  - isolated: `-2`;
- terrain defence:
  - open lowland: `+0`;
  - mixed lowland: `+1`;
  - mixed upland: `+1`;
  - mountainous: `+1`;
- fortification defence:
  - unfortified: `+0`;
  - fortified: `+1`;
  - fortification is binary/non-stacking for current combat;
- hit when `2D6 total + supply modifier >= base target + terrain defence + fortification defence`;
- natural double six is a critical result;
- the existing authoritative critical consequence remains in force unless a separate evidence-backed rules change alters it.

## What may still be calibrated

Exact-head automated and human balance evidence may justify changing documented numerical 2D6 calibration, including:

- base hit target;
- terrain defence values;
- supply modifier values;
- fortification defence value or eligibility;
- critical consequence severity, if separately justified.

Balance work must not silently change:

- 2D6 into D20, 3D6, 4D6 or another base dice model;
- opening force count;
- victory thresholds;
- card/deck rules;
- unrelated campaign systems.

Those require separately scoped decisions and evidence.

## Probability reference

The 36 ordered 2D6 outcomes produce this unmodified chance of meeting or beating common targets:

| Need on 2D6 | Chance |
| ---: | ---: |
| 6+ | 72.2% |
| 7+ | 58.3% |
| 8+ | 41.7% |
| 9+ | 27.8% |
| 10+ | 16.7% |
| 11+ | 8.3% |
| 12 | 2.8% |

This curved distribution is why D20-era modifier scales cannot simply be copied across. A single modifier near the centre of the 2D6 curve has a much larger effect than a single point on a flat D20.

## Deterministic RNG contract

Combat remains deterministic and authoritative:

- one seeded PRNG sample is consumed per combat;
- that sample selects one of 36 equally likely ordered D6 pairs;
- both individual faces and their total are stored in authoritative combat state;
- `die` remains temporarily available as the summed compatibility value where required;
- UI animation never generates, rerolls or changes the result;
- save/reload must preserve the resolved pair and total without another RNG call.

This keeps the combat RNG cursor footprint at one sample per attack while producing the correct joint distribution for two fair D6s.

## Legacy compatibility

D20 is retained only where necessary to read or explain historical state:

- old resolved saves with a D20 result may remain loadable;
- the UI must not fabricate two D6 faces for a historical D20 result;
- historical BG5/BG11 documents may describe D20 behaviour when recording what those packages originally implemented;
- current player-facing rules, AI evaluation, previews and new combat resolutions use 2D6.

## Downstream contract

All current/future board-game work from BG12G-R onward assumes the locked 2D6 model, including:

- BG12H contextual Attack flow;
- combat previews and displayed probabilities;
- AI attack evaluation;
- Rules / Save reference material;
- physical dice animation and sound hooks;
- deterministic regression tests;
- campaign balance evidence;
- save/reload compatibility;
- BG12P structured human playtesting;
- BG12Q release acceptance.

If a later package encounters a balance problem, it must first investigate the documented 2D6 calibration and broader game state. It must not silently substitute a different number or type of dice.

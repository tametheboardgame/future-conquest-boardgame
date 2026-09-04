# BG12G-R2B — Two-D6 Throw, Bounce and Settle

Status: **IMPLEMENTED — MOTION GATE RUNNING**

## Goal

Add convincing two-die movement around the accepted R2A true-3D physical form before any combat integration occurs.

R2B is still presentation-only. The selected landing faces are supplied to the prototype in advance and the animation converges to those known results.

## Prototype route

Use:

`/?bg12g-r2b=1&left=2&right=5&autoplay=1`

- `left` and `right` accept D6 values and are clamped to `1..6`.
- `autoplay=1` starts the review throw automatically.
- without `autoplay=1`, use the **THROW AGAIN** control.

## Motion model

The prototype uses controlled scripted physical theatre rather than authoritative physics.

Each die has:

- an independent start position;
- an independent launch delay/duration;
- three-axis rotational keyframes;
- a primary floor contact;
- a smaller rebound;
- a secondary contact/rebound;
- progressive travel reduction;
- an exact final position;
- an exact known face-up quaternion.

The left and right dice use different trajectories and twist values so they do not read as duplicated synchronized objects.

The current target duration is approximately 1.6 seconds per die, with the second die starting slightly later.

## Authoritative boundary

R2B does not contain result RNG and does not touch board/combat state.

- no `Math.random`;
- no `crypto.getRandomValues`;
- no combat dispatch;
- no BoardGameState dependency;
- no MapLibre dependency.

The final face quaternion is derived from the already supplied face value. On completion the die is explicitly copied to that exact quaternion, preventing edge-on or wrong-face rest states.

R2B emits a prototype-only `future-conquest:bg12g-r2b-motion` start/settled event for automated review evidence. This is not the final combat dice event contract.

## Renderer lifecycle

The prototype remains a dice-only Three.js renderer.

- requestAnimationFrame runs while the throw is active;
- the loop stops when both dice settle;
- resize rendering remains event-driven;
- scene geometry/materials are disposed on unmount;
- the renderer is disposed and its WebGL context explicitly released.

The shared accepted R2A mesh/theme implementation now lives behind reusable dice geometry helpers so R2A and R2B cannot silently diverge in cube/pip construction.

## Automated evidence

The dedicated **BG12G-R2B two-D6 motion gate**:

1. checks out the exact PR head;
2. runs R2A and R2B source contracts;
3. builds the production bundle;
4. opens the isolated R2B route in Chromium;
5. records the complete throw as WebM;
6. captures launch, flight, bounce and settled screenshots;
7. verifies the final requested pair and total;
8. verifies start/settled evidence events;
9. fails on relevant browser errors;
10. uploads all review evidence as an Actions artifact.

## Manual gate

Automation only proves correctness and supplies evidence.

R2B does not pass until the captured/live motion is manually judged to read as two physical dice rather than floating, flailing or flipping tiles.

Required human checks:

- two independent dice are immediately readable;
- launch is restrained rather than explosive;
- bounce beats feel like contact with the tray;
- rotation has weight and decelerates;
- travel remains contained inside the tray;
- dice do not visibly interpenetrate;
- final poses are stable and readable;
- no obvious snap occurs during final convergence.

Do not begin authoritative combat integration solely because the workflow is green.

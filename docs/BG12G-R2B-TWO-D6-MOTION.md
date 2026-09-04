# BG12G-R2B — Two-D6 Throw, Bounce and Settle

Status: **USER VISUAL GATE PASSED — 4 September 2026**

## Goal

Add convincing two-die movement around the accepted R2A true-3D physical form before any combat integration occurs.

R2B is presentation-only. The selected landing faces are supplied to the prototype in advance and the animation converges to those known results.

## Prototype route

Use:

`/?bg12g-r2b=1&left=2&right=5&autoplay=1`

- `left` and `right` accept D6 values and are clamped to `1..6`.
- `autoplay=1` starts the review throw automatically.
- without `autoplay=1`, use the **THROW AGAIN** control.

## Motion model

The prototype uses controlled scripted physical theatre rather than authoritative physics.

Each die has an independent start position, launch delay/duration, three-axis rotational keyframes, floor contact/rebound beats, progressive deceleration and an exact known final face-up quaternion.

The left and right dice use different trajectories and twist values so they do not read as duplicated synchronised objects. The target duration is approximately 1.6 seconds per die, with the second die starting slightly later.

## Authoritative boundary

R2B contains no result RNG and does not touch board/combat state. The final face quaternion is derived from the already supplied face value. On completion the die is explicitly copied to that exact quaternion, preventing edge-on or wrong-face rest states.

R2B emits a prototype-only `future-conquest:bg12g-r2b-motion` start/settled event for automated review evidence. This is not the final combat dice event contract.

## Renderer lifecycle

The prototype remains a dice-only Three.js renderer.

- requestAnimationFrame runs only while the throw is active;
- the loop stops when both dice settle;
- resize rendering is event-driven;
- scene geometry/materials are disposed on unmount;
- the renderer is disposed and its WebGL context explicitly released.

The shared accepted R2A mesh/theme implementation lives behind reusable dice geometry helpers so R2A and R2B cannot silently diverge in cube/pip construction.

## Automated evidence

The dedicated **BG12G-R2B two-D6 motion gate** passed on exact head `ea19c68dae1a0968cc8f146a1ccb4e122612f3d8`.

It proved source contracts, production build, production-preview browser execution, the requested `2 + 5 = 7` landing, start/settled evidence events and motion artifact capture.

## Manual gate

**PASSED by the user on 4 September 2026.**

The captured exact-head motion was accepted as two physical dice with satisfactory launch, bounce, rotation, containment and stable final poses.

R2C authoritative combat integration may proceed from this point.

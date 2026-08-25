# BG0 Golden Baseline

## Purpose

Establish `future-conquest-boardgame` as a verified, deployed, real-hardware working clone of the original `future-conquest` game before any board-game conversion work begins.

## Golden source

Original repository: `tametheboardgame/future-conquest`

Golden source commit:

`e6440635e7d85924fe2920979a6facb14e6993ef`

The imported `future-conquest-boardgame` repository began from the same commit and tree. No runtime/gameplay/rendering code changes are permitted in BG0.

## BG0 rule

The existing renderer, map lifecycle, WebGL/MapLibre configuration, terrain, world objects, formation renderer, startup flow and browser behaviour are treated as known-good infrastructure.

BG0 may add documentation only. It must not alter runtime code, dependencies, build behaviour, map configuration, startup sequencing, renderer ownership, terrain sources, WebGL settings, gameplay logic or UI behaviour.

## Acceptance gate

BG0 is complete only when all of the following are true:

1. The untouched clone builds successfully using its existing workflow.
2. The clone deploys successfully to GitHub Pages using the existing production deployment workflow.
3. The live deployment corresponds to the post-import documentation-only commit whose runtime tree remains inherited from the golden source commit above.
4. The product owner tests the deployed clone on the same real desktop/browser where the previous tabletop fork froze.
5. The original rich map loads and remains responsive there, including normal map interaction and the existing 2.5D terrain/world/formation presentation.

## Hard stop

Do not begin BG1 or modify runtime code until the product owner explicitly accepts the deployed BG0 baseline on real hardware.

## Architectural principle for the board-game rebuild

The board-game project will be created by transforming this known-good application around its working renderer. The working map is the foundation, not a component to be transplanted into a new application architecture.

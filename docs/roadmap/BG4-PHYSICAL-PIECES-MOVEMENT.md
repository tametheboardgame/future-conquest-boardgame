# BG4 - Physical Board Pieces and Movement

## Status

IN PROGRESS - BG4A-C MERGED; BG4D IN VALIDATION

BG3A-E and BG4A-C are merged. BG4D is the active final package for BG4.

## Goal

Make the retained physical formations behave as board-game pieces on the existing 2.5D Central Front map without replacing the renderer or restoring continuous operational movement administration.

## Locked movement direction

- the authoritative board state owns space adjacency, control and piece location
- movement is map-driven and constrained by established geography, occupation/control and enemy presence
- a normal board move is one adjacent space per paid Move action
- successful paid movement consumes one Command Action and then follows BG3 activation progression
- invalid movement mutates nothing and costs nothing
- movement into hostile/contested space is not a normal Move; BG5 Attack/combat owns hostile entry
- renderer animation may display an accepted move but cannot decide whether the move is legal
- reduced-motion/fallback presentation must remain supported
- the existing physical miniature identities are reused rather than replaced with a second piece system

## Package sequence

### BG4A - Authoritative spaces and physical-piece population - MERGED

- advance the board save to schema v3 so existing BG3 v2 saves remain untouched
- populate all 15 retained Central Front spaces
- store deterministic symmetric adjacency from the accepted territory graph
- mirror the retained seed-modulo entry-space rule
- place `TG-1` through `TG-4` at the entry space for the first participating seat
- create `EF-*` authoritative identities across the remaining spaces for the opposing participating seat
- validate adjacency, piece ownership and piece locations during save load
- preserve deterministic save/reload

### BG4B - Paid movement legality and activation progression - MERGED

- add authoritative `move-piece`
- require activation phase and ownership by the active seat
- require remaining Command Actions
- require one-space adjacency
- reject hostile/blocked destinations for normal movement
- enumerate legal Move destinations with explicit rejection reasons
- spend exactly one Command Action only on accepted movement
- progress to the next legal activating seat using the BG3 turn engine
- preserve deterministic save/reload after movement

### BG4C - Direct map selection, destination highlights and confirmation - MERGED

- select retained physical pieces directly on the map where renderer hooks safely permit it
- show an obvious selected-piece state
- highlight legal adjacent Move destinations from authoritative rules
- expose why non-legal destinations are unavailable
- add move preview, confirm and cancel
- route confirmed movement through the same board dispatcher
- remove the temporary legacy Move delegation once authoritative map movement is usable

### BG4D - Physical movement presentation and hardening - IN VALIDATION

- project accepted authoritative piece movement into retained physical miniatures
- add visible movement animation only through the existing renderer lifecycle
- preserve reduced-motion and renderer fallback behaviour
- preserve in-flight timing across selection/status-only miniature rebuilds and retarget accepted moves from the current presentation position
- repaint only while a miniature is genuinely travelling
- stress repeated moves, selection changes, save/reload and map navigation
- validate on exact-head browser/terrain gates
- perform real-hardware acceptance because this package touches historically sensitive map interaction/presentation paths

## BG4 exit

BG4 is complete when a player can select a physical formation, understand its legal destinations, preview/cancel/confirm a board move, spend exactly one Command Action on success, see the miniature move on the retained 2.5D map, save/reload that position exactly, and repeat movement without destabilising the renderer.

After BG4 acceptance, proceed to **BG5 - Dice Combat**.

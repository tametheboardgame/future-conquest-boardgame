# BG3 - Players, Seats, Rounds and Alternating Activations

## Status

IN PROGRESS

BG2A-E are merged. BG3 now owns the authoritative multiplayer turn model while the retained 2.5D map/rendering stack remains protected infrastructure.

## Goal

Make the board-state engine independently capable of running deterministic multiplayer rounds without relying on the legacy simulation turn engine.

## Locked rules from the conversion roadmap

- minimum two participating command seats
- each participating seat is controlled by a Human or Computer controller
- initial supported configurations are Human vs Computer, Human vs Human hot-seat and Computer vs Computer
- six permanent command-seat identities remain available so coalition control can be split further later
- successful board actions consume Command Actions
- invalid actions mutate nothing and cost nothing
- active play alternates between participating seats
- Pass Activation is available whenever an activation can legally be passed
- a round ends when its activation/action conditions are exhausted
- authoritative results remain deterministic and save/reload reproducible
- the AI must eventually use the same legal-action boundary as human players

## Package sequence

### BG3A - Player and seat configuration

- mark which of the six permanent command seats participate in the current game
- default the initial Central Front game to seat 1 vs seat 2
- retain Human/Computer controller assignment per seat
- support H/C, H/H and C/C configurations at the authoritative state boundary
- reject invalid configurations with fewer than two unique participating seats
- persist the configuration in the board-game save

### BG3B - Round start and Command Action grants

- introduce authoritative round-start transition
- grant the agreed Command Action allowance to participating seats
- enter activation phase deterministically
- preserve no-cost rejection for invalid transitions

### BG3C - Alternating activations and Pass

- implement Pass Activation through the board-action dispatcher
- advance active seat deterministically across participating seats
- consume/spend actions only where the action contract requires it
- skip non-participating or exhausted seats correctly

### BG3D - Round exhaustion and advancement

- detect when no participating seat can continue
- transition to round end
- advance to the next round without the legacy day resolver
- respect the eight-round campaign limit boundary without inventing BG10 victory rules

### BG3E - UI/provider integration and basic computer seat

- make the provider dispatch and persist authoritative board actions
- connect Pass Activation and turn progression to the tabletop shell
- provide deterministic baseline Computer behaviour using the same action dispatcher
- validate H/H hot-seat, H/C and C/C full-round operation
- retain the protected map mount/render lifecycle

## BG3 exit gate

BG3 is complete when a full deterministic round can be played using the board-state engine, H/H and H/basic-C configurations work, C/C can run for automated validation, and the legacy simulation turn engine is no longer authoritative for board-game round progression.

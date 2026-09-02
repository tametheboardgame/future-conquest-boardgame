# BG11D — Card Presentation

BG11D is a presentation-only pass over the authoritative BG8 strategic card hand.

## Scope

- Preserve the existing fixed map overlay and BG8 navigation target.
- Preserve the authoritative saved hand, deck and discard piles.
- Preserve `play-action-card` preview and dispatch semantics.
- Give every card a compact physical-card hierarchy with:
  - a textual family code and family name;
  - an explicit effect badge;
  - a visible `Free` marker;
  - selected-card detail and ordinary-legality explanation.
- Show the current hand count against the authoritative `BOARD_ACTION_HAND_LIMIT`.
- Improve keyboard focus visibility and expose selected cards with `aria-pressed`.
- Keep family identity non-colour-only. Accent bands are supplemental to the textual family code/name.

## Rules boundary

BG11D does not change deck order, draw timing, hand size rules, card legality, card consumption, Command Action accounting, save state, AI behavior, movement/support rules, or renderer lifecycle.

The selected-card panel continues to construct one ordinary `play-action-card` action and sends that exact action through both the authoritative preview dispatcher and the live dispatcher. The UI explains that a successful card play follows ordinary effect legality and refunds its Command Action cost.

## Presentation vocabulary

| Family | Code |
| --- | --- |
| Command | CMD |
| Support | SPT |
| Event | EVT |
| Escalation | ESC |
| National response | NAT |
| Scenario | SCN |

Card effects are displayed using the existing BG8 effect types: Move, Recover, Engineer, and Logistics.

## Acceptance

BG11D is acceptable when:

1. Existing BG8 mechanics, navigation and fixed-overlay contracts remain green.
2. Focused BG11D source contracts pass.
3. Full engine/regression and production build gates pass.
4. Integrated browser checks remain green at desktop and compact/reduced-motion viewports.
5. The exact-head terrain performance gate remains within its existing budgets.

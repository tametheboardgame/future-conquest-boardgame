import { applyBoardAction, isBoardRoundExhausted } from './board-state';
import type { BoardAction, BoardGameState } from './board-state-types';

/**
 * Chooses at most one automatic board action. The provider still executes the
 * returned action through applyBoardAction, so humans and computers share the
 * same authoritative rules boundary.
 */
export function chooseAutomaticBoardAction(state: BoardGameState): BoardAction | null {
  if (state.phase === 'round-start') return { type: 'start-round' };

  if (state.phase === 'activation' && isBoardRoundExhausted(state)) {
    return { type: 'end-round' };
  }

  if (state.phase === 'round-end') {
    return state.round < state.roundLimit ? { type: 'advance-round' } : null;
  }

  const activeSeat = state.seats[state.activeSeat];
  if (state.phase !== 'activation' || activeSeat.controller !== 'computer') return null;

  // BG3 has no paid computer action yet. Computer seats may legally yield
  // through a mixed seat chain while at least one human can still activate.
  // An all-computer (or humans-exhausted) position deliberately waits instead
  // of creating an infinite zero-cost Pass loop. BG4 supplies paid actions.
  const humanCanActivate = Object.values(state.seats).some(seat =>
    seat.participating && seat.controller === 'human' && seat.commandActionsRemaining > 0
  );
  if (!humanCanActivate) return null;

  const pass = applyBoardAction(state, { type: 'pass-activation' });
  return pass.accepted ? { type: 'pass-activation' } : null;
}

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

  // BG3 has no paid computer action yet. A basic computer may legally yield
  // tempo back to a human opponent, but computer-v-computer must not create an
  // infinite zero-cost Pass loop. BG4 supplies the first real paid action.
  const pass = applyBoardAction(state, { type: 'pass-activation' });
  if (!pass.accepted) return null;
  const nextSeat = pass.state.seats[pass.state.activeSeat];
  return nextSeat.controller === 'human' ? { type: 'pass-activation' } : null;
}

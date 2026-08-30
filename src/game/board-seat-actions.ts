import { getNextActivatingSeatId } from './board-state';
import type { BoardActionResult, BoardGameState } from './board-state-types';

function reject(state: BoardGameState, reason: string): BoardActionResult {
  return {
    state,
    accepted: false,
    commandActionsSpent: 0,
    reason
  };
}

/**
 * Gives up every unused Command Action for the active seat and moves activation
 * to the next participating seat that can still act. This is an ordinary
 * board-game action available to every controller; BG9 uses it to ensure a
 * computer with no useful paid action can still finish its round without an
 * AI-only rule or an infinite zero-cost Pass loop.
 */
export function endBoardSeatActions(state: BoardGameState): BoardActionResult {
  if (state.phase !== 'activation') {
    return reject(state, `Cannot end a seat's actions during ${state.phase} phase.`);
  }

  if (state.combat?.status === 'declared') {
    return reject(state, 'Resolve the declared combat before ending this seat\'s actions.');
  }

  const activeSeatId = state.activeSeat;
  const activeSeat = state.seats[activeSeatId];
  if (!activeSeat.participating || activeSeat.commandActionsRemaining <= 0) {
    return reject(state, `${activeSeatId} has no remaining Command Actions to end.`);
  }

  const forfeited = activeSeat.commandActionsRemaining;
  const endedState: BoardGameState = {
    ...state,
    seats: {
      ...state.seats,
      [activeSeatId]: {
        ...activeSeat,
        commandActionsRemaining: 0
      }
    }
  };
  const nextSeat = getNextActivatingSeatId(endedState);
  const nextState: BoardGameState = nextSeat
    ? { ...endedState, activeSeat: nextSeat }
    : endedState;

  return {
    state: nextState,
    accepted: true,
    commandActionsSpent: 0,
    reason: nextSeat
      ? `${activeSeatId} ended ${forfeited} remaining Command Action${forfeited === 1 ? '' : 's'}; activation progressed to ${nextSeat}.`
      : `${activeSeatId} ended ${forfeited} remaining Command Action${forfeited === 1 ? '' : 's'}; all participating seats are exhausted.`
  };
}

import type { BoardGameState, BoardPhase } from './board-state-types';

export interface BoardStatusPresentation {
  round: string;
  activeSeat: string;
  activePlayer: string;
  commandActions: string;
  phase: string;
  activation: string;
}

const PHASE_LABELS: Record<BoardPhase, string> = {
  'round-start': 'Round Start',
  activation: 'Activation',
  'round-end': 'Round End'
};

function seatNumber(seatId: string): string {
  const match = /^seat-(\d+)$/.exec(seatId);
  return match?.[1] ?? seatId;
}

/** Pure BG2 presentation derived only from authoritative board state. */
export function projectBoardStatus(state: BoardGameState): BoardStatusPresentation {
  const activeSeat = state.seats[state.activeSeat];
  return {
    round: `${state.round} / ${state.roundLimit}`,
    activeSeat: `Command Seat ${seatNumber(state.activeSeat)}`,
    activePlayer: activeSeat.controller === 'human' ? 'Human' : 'Computer',
    commandActions: String(activeSeat.commandActionsRemaining),
    phase: PHASE_LABELS[state.phase],
    activation: state.phase === 'activation' ? 'Select a formation' : PHASE_LABELS[state.phase]
  };
}

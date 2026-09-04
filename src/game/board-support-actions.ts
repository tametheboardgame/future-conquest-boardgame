import { getNextActivatingSeatId } from './board-state';
import type {
  BoardActionResult,
  BoardGameState,
  BoardPiece,
  SupplyState
} from './board-state-types';

export const BOARD_RECOVERY_READINESS_GAIN = 25 as const;
export const BOARD_RECOVERY_DAMAGE_REPAIRED = 1 as const;
export const BOARD_FORTIFICATION_LIMIT = 1 as const;

const SUPPLY_IMPROVEMENT: Record<SupplyState, SupplyState> = {
  isolated: 'strained',
  strained: 'supplied',
  supplied: 'supplied'
};

type SupportActionKind = 'Recover' | 'Logistics' | 'Engineer';

function reject(state: BoardGameState, reason: string): BoardActionResult {
  return {
    state,
    accepted: false,
    commandActionsSpent: 0,
    reason
  };
}

function getSupportPiece(
  state: BoardGameState,
  pieceId: string,
  action: SupportActionKind
): { piece: BoardPiece; spaceId: string } | BoardActionResult {
  if (state.phase !== 'activation') {
    return reject(state, `${action} is unavailable during ${state.phase} phase.`);
  }

  if (state.combat?.status === 'declared') {
    return reject(state, `Resolve the declared combat before using ${action}.`);
  }

  const activeSeat = state.seats[state.activeSeat];
  if (!activeSeat.participating || activeSeat.commandActionsRemaining <= 0) {
    return reject(state, `${state.activeSeat} has no Command Actions remaining.`);
  }

  const piece = state.pieces[pieceId];
  if (!piece) return reject(state, `Unknown board piece: ${pieceId}.`);
  if (piece.seatId !== state.activeSeat) {
    return reject(state, `${pieceId} is owned by ${piece.seatId}, not active seat ${state.activeSeat}.`);
  }
  if (!piece.spaceId || !state.spaces[piece.spaceId]) {
    return reject(state, `${pieceId} is not currently on a valid board space.`);
  }

  return { piece, spaceId: piece.spaceId };
}

function spendSupportAction(
  state: BoardGameState,
  nextState: BoardGameState,
  summary: string
): BoardActionResult {
  const activeSeatId = state.activeSeat;
  const seats = {
    ...nextState.seats,
    [activeSeatId]: {
      ...nextState.seats[activeSeatId],
      commandActionsRemaining: nextState.seats[activeSeatId].commandActionsRemaining - 1
    }
  };
  const paidState: BoardGameState = { ...nextState, seats };
  const nextSeat = getNextActivatingSeatId(paidState);
  const progressedState: BoardGameState = nextSeat
    ? { ...paidState, activeSeat: nextSeat }
    : paidState;

  return {
    state: progressedState,
    accepted: true,
    commandActionsSpent: 1,
    reason: nextSeat
      ? `${summary}; activation progressed to ${nextSeat}.`
      : `${summary}; all participating seats are exhausted.`
  };
}

/**
 * Recover / Refit is deliberately a single visible board-game action rather
 * than a multi-turn maintenance subsystem. One action removes one damage and
 * restores 25 readiness, capped at the healthy board-piece values.
 */
export function recoverBoardPiece(state: BoardGameState, pieceId: string): BoardActionResult {
  const eligibility = getSupportPiece(state, pieceId, 'Recover');
  if ('accepted' in eligibility) return eligibility;

  const { piece } = eligibility;
  if (piece.damage <= 0 && piece.readiness >= 100) {
    return reject(state, `${pieceId} is already at full readiness with no damage to repair.`);
  }

  const nextPiece: BoardPiece = {
    ...piece,
    damage: Math.max(0, piece.damage - BOARD_RECOVERY_DAMAGE_REPAIRED),
    readiness: Math.min(100, piece.readiness + BOARD_RECOVERY_READINESS_GAIN)
  };
  const nextState: BoardGameState = {
    ...state,
    pieces: { ...state.pieces, [pieceId]: nextPiece }
  };

  return spendSupportAction(
    state,
    nextState,
    `${pieceId} recovered to ${nextPiece.readiness} readiness and ${nextPiece.damage} damage`
  );
}

/**
 * Logistics improves the selected formation by exactly one supply step. This
 * feeds the authoritative combat modifier directly: isolated -2, strained -1,
 * supplied 0.
 */
export function improveBoardPieceSupply(state: BoardGameState, pieceId: string): BoardActionResult {
  const eligibility = getSupportPiece(state, pieceId, 'Logistics');
  if ('accepted' in eligibility) return eligibility;

  const { piece } = eligibility;
  const supply = SUPPLY_IMPROVEMENT[piece.supply];
  if (supply === piece.supply) {
    return reject(state, `${pieceId} is already supplied.`);
  }

  const nextState: BoardGameState = {
    ...state,
    pieces: {
      ...state.pieces,
      [pieceId]: { ...piece, supply }
    }
  };

  return spendSupportAction(state, nextState, `${pieceId} logistics improved to ${supply}`);
}

/**
 * Engineer fortifies the selected formation's current friendly-controlled
 * position. BG12G-R makes fortification a binary +1 defensive state because a
 * single modifier step is already substantial on the 2D6 bell curve.
 */
export function engineerBoardPosition(state: BoardGameState, pieceId: string): BoardActionResult {
  const eligibility = getSupportPiece(state, pieceId, 'Engineer');
  if ('accepted' in eligibility) return eligibility;

  const { spaceId } = eligibility;
  const space = state.spaces[spaceId];
  if (space.control !== state.activeSeat) {
    return reject(state, `${pieceId} can only Engineer a position controlled by ${state.activeSeat}.`);
  }

  const fortification = Math.max(0, Math.trunc(space.fortification ?? 0));
  if (fortification >= BOARD_FORTIFICATION_LIMIT) {
    return reject(state, `${spaceId} is already fortified.`);
  }

  const nextState: BoardGameState = {
    ...state,
    spaces: {
      ...state.spaces,
      [spaceId]: { ...space, fortification: BOARD_FORTIFICATION_LIMIT }
    }
  };

  return spendSupportAction(
    state,
    nextState,
    `${pieceId} fortified ${spaceId}`
  );
}

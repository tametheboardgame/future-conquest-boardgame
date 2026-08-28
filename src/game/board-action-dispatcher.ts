import { attackBoardPiece } from './board-combat';
import { applyBoardAction as applyCoreBoardAction } from './board-state';
import type { BoardAction, BoardActionResult, BoardGameState } from './board-state-types';

/**
 * Unified runtime dispatch boundary for the board-game conversion.
 *
 * BG1-BG4 core actions remain implemented in board-state.ts. BG5 combat lives
 * in board-combat.ts, but callers use this dispatcher so presentation never
 * decides outcomes or invokes the retained simulation combat path.
 */
export function applyBoardAction(state: BoardGameState, action: BoardAction): BoardActionResult {
  if (action.type === 'attack-piece') {
    if (typeof action.attackerPieceId !== 'string' || typeof action.defenderPieceId !== 'string') {
      return {
        state,
        accepted: false,
        commandActionsSpent: 0,
        reason: 'attack-piece requires string attackerPieceId and defenderPieceId values.'
      };
    }
    return attackBoardPiece(state, action.attackerPieceId, action.defenderPieceId);
  }

  return applyCoreBoardAction(state, action);
}
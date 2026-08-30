import { attackBoardPiece } from './board-combat';
import { resolveBoardEscalation } from './board-escalation';
import { applyBoardAction as applyCoreBoardAction } from './board-state';
import {
  engineerBoardPosition,
  improveBoardPieceSupply,
  recoverBoardPiece
} from './board-support-actions';
import type { BoardAction, BoardActionResult, BoardGameState } from './board-state-types';

/**
 * Unified runtime dispatch boundary for the board-game conversion.
 *
 * BG1-BG4 core actions remain implemented in board-state.ts. BG5 combat lives
 * in board-combat.ts, BG6 escalation lives in board-escalation.ts, and BG7
 * support actions live in board-support-actions.ts. Callers still cross this
 * single dispatcher so presentation never decides authoritative outcomes.
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

  if (action.type === 'resolve-escalation') {
    return resolveBoardEscalation(state);
  }

  if (action.type === 'recover-piece' || action.type === 'logistics-piece' || action.type === 'engineer-position') {
    if (typeof action.pieceId !== 'string') {
      return {
        state,
        accepted: false,
        commandActionsSpent: 0,
        reason: `${action.type} requires a string pieceId value.`
      };
    }

    if (action.type === 'recover-piece') return recoverBoardPiece(state, action.pieceId);
    if (action.type === 'logistics-piece') return improveBoardPieceSupply(state, action.pieceId);
    return engineerBoardPosition(state, action.pieceId);
  }

  return applyCoreBoardAction(state, action);
}

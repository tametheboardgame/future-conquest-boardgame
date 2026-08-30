import { attackBoardPiece } from './board-combat';
import { resolveBoardEscalation } from './board-escalation';
import { applyBoardAction as applyCoreBoardAction } from './board-state';
import type { BoardAction, BoardActionResult, BoardGameState } from './board-state-types';

/**
 * Unified runtime dispatch boundary for the board-game conversion.
 *
 * BG1-BG4 core actions remain implemented in board-state.ts. BG5 combat lives
 * in board-combat.ts and BG6 escalation lives in board-escalation.ts, but
 * callers use this dispatcher so presentation never decides authoritative
 * outcomes.
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

  return applyCoreBoardAction(state, action);
}

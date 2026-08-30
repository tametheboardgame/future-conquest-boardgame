import {
  playBoardActionCard,
  prepareBoardActionCardsForRound
} from './board-action-cards';
import { attackBoardPiece } from './board-combat';
import { resolveBoardEscalation } from './board-escalation';
import { endBoardSeatActions } from './board-seat-actions';
import { applyBoardAction as applyCoreBoardAction } from './board-state';
import {
  engineerBoardPosition,
  improveBoardPieceSupply,
  recoverBoardPiece
} from './board-support-actions';
import type { BoardAction, BoardActionResult, BoardGameState } from './board-state-types';

/**
 * Non-card runtime boundary. BG8 card play calls back through this path so the
 * wrapped movement/support action uses exactly the same authoritative legality
 * and effect implementation as ordinary play without recursively dispatching
 * another card action.
 */
function applyUnderlyingBoardAction(state: BoardGameState, action: BoardAction): BoardActionResult {
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

  if (action.type === 'end-seat-actions') {
    return endBoardSeatActions(state);
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

/**
 * Unified runtime dispatch boundary for the board-game conversion.
 *
 * BG1-BG4 core actions remain implemented in board-state.ts. BG5 combat lives
 * in board-combat.ts, BG6 escalation in board-escalation.ts, BG7 support in
 * board-support-actions.ts, BG8 strategic cards in board-action-cards.ts and
 * BG9's shared End Actions rule in board-seat-actions.ts. Humans and computers
 * still cross this same dispatcher for every authoritative outcome.
 */
export function applyBoardAction(state: BoardGameState, action: BoardAction): BoardActionResult {
  if (action.type === 'prepare-action-cards') {
    return prepareBoardActionCardsForRound(state);
  }

  if (action.type === 'play-action-card') {
    return playBoardActionCard(state, action, applyUnderlyingBoardAction);
  }

  return applyUnderlyingBoardAction(state, action);
}

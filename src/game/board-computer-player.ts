import { getBoardActionCard, type BoardActionCardDefinition } from './board-action-cards';
import { applyBoardAction } from './board-action-dispatcher';
import { getBoardCombatPreview, getBoardCombatTargets } from './board-combat';
import { getBoardMoveDestinations } from './board-state';
import type { BoardAction, BoardGameState, BoardPiece, SeatId } from './board-state-types';

export type BoardComputerDifficulty = 'basic' | 'standard';
export type BoardComputerPersonality = 'balanced' | 'aggressive' | 'methodical';

export interface BoardComputerPolicy {
  difficulty: BoardComputerDifficulty;
  personality: BoardComputerPersonality;
}

export interface BoardComputerActionCandidate {
  action: BoardAction;
  score: number;
  rationale: string;
}

export const DEFAULT_BOARD_COMPUTER_POLICY: BoardComputerPolicy = {
  difficulty: 'standard',
  personality: 'balanced'
};

function actionKey(action: BoardAction): string {
  return [
    action.type,
    action.cardId,
    action.attackerPieceId,
    action.defenderPieceId,
    action.pieceId,
    action.destinationSpaceId
  ].map(value => typeof value === 'string' ? value : '').join('|');
}

function activePieces(state: BoardGameState): BoardPiece[] {
  return Object.values(state.pieces)
    .filter(piece => piece.seatId === state.activeSeat && piece.spaceId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function isHostileSpace(state: BoardGameState, spaceId: string, seatId: SeatId): boolean {
  const space = state.spaces[spaceId];
  if (!space) return false;
  if (space.control !== null && space.control !== seatId) return true;
  return Object.values(state.pieces).some(piece =>
    piece.spaceId === spaceId && piece.seatId !== seatId
  );
}

function distanceToNearestHostileSpace(state: BoardGameState, fromSpaceId: string, seatId: SeatId): number {
  if (isHostileSpace(state, fromSpaceId, seatId)) return 0;

  const visited = new Set<string>([fromSpaceId]);
  let frontier = [fromSpaceId];
  let distance = 0;

  while (frontier.length > 0) {
    distance += 1;
    const next: string[] = [];
    for (const spaceId of frontier) {
      const adjacent = [...(state.spaces[spaceId]?.adjacentSpaceIds ?? [])].sort((a, b) => a.localeCompare(b));
      for (const candidate of adjacent) {
        if (visited.has(candidate)) continue;
        if (isHostileSpace(state, candidate, seatId)) return distance;
        visited.add(candidate);
        next.push(candidate);
      }
    }
    frontier = next;
  }

  return Number.POSITIVE_INFINITY;
}

function hostileAdjacencyCount(state: BoardGameState, spaceId: string, seatId: SeatId): number {
  return (state.spaces[spaceId]?.adjacentSpaceIds ?? [])
    .filter(candidate => isHostileSpace(state, candidate, seatId)).length;
}

function personalityAdjustment(action: BoardAction, personality: BoardComputerPersonality): number {
  if (personality === 'balanced') return 0;
  if (personality === 'aggressive') {
    if (action.type === 'attack-piece') return 14;
    if (action.type === 'move-piece') return 6;
    if (action.type === 'recover-piece') return -4;
    if (action.type === 'engineer-position') return -3;
    return 0;
  }

  if (action.type === 'recover-piece') return 10;
  if (action.type === 'logistics-piece') return 8;
  if (action.type === 'engineer-position') return 8;
  if (action.type === 'attack-piece') return -5;
  return 0;
}

function scoreBasicAction(action: BoardAction): number {
  if (action.type === 'attack-piece') return 70;
  if (action.type === 'recover-piece') return 58;
  if (action.type === 'logistics-piece') return 54;
  if (action.type === 'move-piece') return 50;
  if (action.type === 'engineer-position') return 44;
  if (action.type === 'end-seat-actions') return -500;
  if (action.type === 'pass-activation') return -600;
  return 0;
}

function scoreStandardAction(
  state: BoardGameState,
  action: BoardAction,
  personality: BoardComputerPersonality
): number {
  let score = 0;

  if (action.type === 'attack-piece'
    && typeof action.attackerPieceId === 'string'
    && typeof action.defenderPieceId === 'string') {
    const preview = getBoardCombatPreview(state, action.attackerPieceId, action.defenderPieceId);
    if (!preview.legal) return Number.NEGATIVE_INFINITY;
    const defender = state.pieces[action.defenderPieceId];
    const requiredDie = preview.target - preview.attackModifier;
    const successfulFaces = Math.max(0, Math.min(20, 21 - requiredDie));
    const hitChance = successfulFaces / 20;
    score = 70
      + hitChance * 36
      + (defender?.damage ?? 0) * 12
      + (100 - (defender?.readiness ?? 100)) * 0.22
      - preview.defenceModifier * 2.5;
  } else if (action.type === 'move-piece'
    && typeof action.pieceId === 'string'
    && typeof action.destinationSpaceId === 'string') {
    const piece = state.pieces[action.pieceId];
    if (!piece?.spaceId) return Number.NEGATIVE_INFINITY;
    const before = distanceToNearestHostileSpace(state, piece.spaceId, piece.seatId);
    const after = distanceToNearestHostileSpace(state, action.destinationSpaceId, piece.seatId);
    const beforeValue = Number.isFinite(before) ? before : 8;
    const afterValue = Number.isFinite(after) ? after : 8;
    const progress = beforeValue - afterValue;
    score = 38 + progress * 12 + hostileAdjacencyCount(state, action.destinationSpaceId, piece.seatId) * 8;
  } else if (action.type === 'recover-piece' && typeof action.pieceId === 'string') {
    const piece = state.pieces[action.pieceId];
    if (!piece) return Number.NEGATIVE_INFINITY;
    score = 38 + piece.damage * 18 + (100 - piece.readiness) * 0.28;
  } else if (action.type === 'logistics-piece' && typeof action.pieceId === 'string') {
    const piece = state.pieces[action.pieceId];
    if (!piece) return Number.NEGATIVE_INFINITY;
    score = 38 + (piece.supply === 'isolated' ? 28 : piece.supply === 'strained' ? 14 : 0);
  } else if (action.type === 'engineer-position' && typeof action.pieceId === 'string') {
    const piece = state.pieces[action.pieceId];
    if (!piece?.spaceId) return Number.NEGATIVE_INFINITY;
    const fortification = Math.max(0, Math.trunc(state.spaces[piece.spaceId]?.fortification ?? 0));
    score = 28 + (3 - Math.min(3, fortification)) * 4
      + hostileAdjacencyCount(state, piece.spaceId, piece.seatId) * 7;
  } else if (action.type === 'end-seat-actions') {
    score = -500;
  } else if (action.type === 'pass-activation') {
    score = -600;
  }

  return score + personalityAdjustment(action, personality);
}

function cardUnderlyingAction(card: BoardActionCardDefinition, action: BoardAction): BoardAction | null {
  if (typeof action.pieceId !== 'string') return null;
  if (card.effect === 'move-piece') {
    if (typeof action.destinationSpaceId !== 'string') return null;
    return {
      type: 'move-piece',
      pieceId: action.pieceId,
      destinationSpaceId: action.destinationSpaceId
    };
  }
  return { type: card.effect, pieceId: action.pieceId };
}

function scoreAction(state: BoardGameState, action: BoardAction, policy: BoardComputerPolicy): number {
  if (action.type === 'play-action-card' && typeof action.cardId === 'string') {
    try {
      const card = getBoardActionCard(action.cardId);
      const underlying = cardUnderlyingAction(card, action);
      if (!underlying) return Number.NEGATIVE_INFINITY;
      const underlyingScore = policy.difficulty === 'basic'
        ? scoreBasicAction(underlying) + personalityAdjustment(underlying, policy.personality)
        : scoreStandardAction(state, underlying, policy.personality);
      // A card performs the same useful effect without spending a Command Action
      // and keeps the activation, so it receives a deterministic tempo premium.
      return underlyingScore + 24;
    } catch {
      return Number.NEGATIVE_INFINITY;
    }
  }

  return policy.difficulty === 'basic'
    ? scoreBasicAction(action) + personalityAdjustment(action, policy.personality)
    : scoreStandardAction(state, action, policy.personality);
}

function addValidatedCandidate(
  state: BoardGameState,
  actions: BoardAction[],
  action: BoardAction
): void {
  if (applyBoardAction(state, action).accepted) actions.push(action);
}

/**
 * Enumerates the active computer seat's legal choices without consuming RNG.
 * Combat uses the authoritative preview/target API rather than resolving a
 * speculative attack, while movement, support, cards, Pass and End Actions are
 * accepted only when the shared dispatcher says they are legal.
 */
export function enumerateComputerBoardActions(
  state: BoardGameState,
  policy: BoardComputerPolicy = DEFAULT_BOARD_COMPUTER_POLICY
): BoardComputerActionCandidate[] {
  const activeSeat = state.seats[state.activeSeat];
  if (state.phase !== 'activation'
    || activeSeat.controller !== 'computer'
    || !activeSeat.participating
    || activeSeat.commandActionsRemaining <= 0
    || state.combat?.status === 'declared') return [];

  const pieces = activePieces(state);
  const actions: BoardAction[] = [];

  for (const attacker of pieces) {
    for (const target of getBoardCombatTargets(state, attacker.id)) {
      actions.push({
        type: 'attack-piece',
        attackerPieceId: attacker.id,
        defenderPieceId: target.defenderPieceId
      });
    }
  }

  for (const piece of pieces) {
    for (const type of ['recover-piece', 'logistics-piece', 'engineer-position'] as const) {
      addValidatedCandidate(state, actions, { type, pieceId: piece.id });
    }

    for (const destination of getBoardMoveDestinations(state, piece.id)
      .filter(candidate => candidate.legal)
      .sort((a, b) => a.spaceId.localeCompare(b.spaceId))) {
      actions.push({
        type: 'move-piece',
        pieceId: piece.id,
        destinationSpaceId: destination.spaceId
      });
    }
  }

  const hand = [...state.decks.action.handBySeat[state.activeSeat]].sort((a, b) => a.localeCompare(b));
  for (const cardId of hand) {
    let card: BoardActionCardDefinition;
    try {
      card = getBoardActionCard(cardId);
    } catch {
      continue;
    }

    for (const piece of pieces) {
      if (card.effect === 'move-piece') {
        for (const destination of getBoardMoveDestinations(state, piece.id)
          .filter(candidate => candidate.legal)
          .sort((a, b) => a.spaceId.localeCompare(b.spaceId))) {
          addValidatedCandidate(state, actions, {
            type: 'play-action-card',
            cardId,
            pieceId: piece.id,
            destinationSpaceId: destination.spaceId
          });
        }
      } else {
        addValidatedCandidate(state, actions, {
          type: 'play-action-card',
          cardId,
          pieceId: piece.id
        });
      }
    }
  }

  addValidatedCandidate(state, actions, { type: 'end-seat-actions' });
  addValidatedCandidate(state, actions, { type: 'pass-activation' });

  return actions
    .map(action => ({
      action,
      score: scoreAction(state, action, policy),
      rationale: action.type === 'play-action-card'
        ? 'Card tempo plus its underlying authoritative board action.'
        : 'Deterministic board position, readiness, supply and combat valuation.'
    }))
    .filter(candidate => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score || actionKey(a.action).localeCompare(actionKey(b.action)));
}

/** Selects one deterministic legal action; no random tie-breaker or AI-only rule. */
export function chooseComputerBoardAction(
  state: BoardGameState,
  policy: BoardComputerPolicy = DEFAULT_BOARD_COMPUTER_POLICY
): BoardAction | null {
  return enumerateComputerBoardActions(state, policy)[0]?.action ?? null;
}

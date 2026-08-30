import { isBoardEscalationResolvedForRound } from './board-escalation';
import {
  SEAT_IDS,
  type BoardAction,
  type BoardActionResult,
  type BoardGameState,
  type DeckState,
  type SeatId
} from './board-state-types';

export const BOARD_ACTION_HAND_LIMIT = 3 as const;
export const BOARD_ACTION_OPENING_HAND_SIZE = 2 as const;
export const BOARD_ACTION_ROUND_DRAW_COUNT = 1 as const;

export type BoardActionCardFamily =
  | 'command'
  | 'support'
  | 'event'
  | 'escalation'
  | 'national-response'
  | 'scenario';

export type BoardActionCardEffect =
  | 'move-piece'
  | 'recover-piece'
  | 'engineer-position'
  | 'logistics-piece';

export interface BoardActionCardDefinition {
  id: string;
  title: string;
  family: BoardActionCardFamily;
  effect: BoardActionCardEffect;
  summary: string;
}

/**
 * BG8 starts with a compact twelve-card strategic deck: two cards from each
 * roadmap family. Cards are one-shot exceptions around existing paid actions,
 * not a second rules engine. Their effect is resolved by the same movement and
 * BG7 support APIs used by ordinary board actions.
 */
export const BOARD_ACTION_CARDS: readonly BoardActionCardDefinition[] = [
  {
    id: 'action-01-rapid-redeployment',
    title: 'Rapid Redeployment',
    family: 'command',
    effect: 'move-piece',
    summary: 'Move one formation to a legal adjacent position without spending a Command Action.'
  },
  {
    id: 'action-02-local-initiative',
    title: 'Local Initiative',
    family: 'command',
    effect: 'move-piece',
    summary: 'Exploit local initiative for one free legal movement action.'
  },
  {
    id: 'action-03-field-repair-teams',
    title: 'Field Repair Teams',
    family: 'support',
    effect: 'recover-piece',
    summary: 'Take one free Recover action with an eligible formation.'
  },
  {
    id: 'action-04-emergency-supply-column',
    title: 'Emergency Supply Column',
    family: 'support',
    effect: 'logistics-piece',
    summary: 'Take one free Logistics action with an eligible formation.'
  },
  {
    id: 'action-05-railway-priority',
    title: 'Railway Priority',
    family: 'event',
    effect: 'logistics-piece',
    summary: 'A temporary transport priority grants one free Logistics action.'
  },
  {
    id: 'action-06-road-repair-detachment',
    title: 'Road Repair Detachment',
    family: 'event',
    effect: 'engineer-position',
    summary: 'A temporary engineering detachment grants one free Engineer action.'
  },
  {
    id: 'action-07-emergency-mobilisation',
    title: 'Emergency Mobilisation',
    family: 'escalation',
    effect: 'recover-piece',
    summary: 'Escalation releases reserves for one free Recover action.'
  },
  {
    id: 'action-08-frontline-priority',
    title: 'Frontline Priority',
    family: 'escalation',
    effect: 'move-piece',
    summary: 'Escalation priorities grant one free legal movement action.'
  },
  {
    id: 'action-09-national-reserve-priority',
    title: 'National Reserve Priority',
    family: 'national-response',
    effect: 'logistics-piece',
    summary: 'National intervention grants one free Logistics action.'
  },
  {
    id: 'action-10-civil-engineering-corps',
    title: 'Civil Engineering Corps',
    family: 'national-response',
    effect: 'engineer-position',
    summary: 'National engineering support grants one free Engineer action.'
  },
  {
    id: 'action-11-rhine-crossing-preparations',
    title: 'Rhine Crossing Preparations',
    family: 'scenario',
    effect: 'engineer-position',
    summary: 'Central Front preparations grant one free Engineer action.'
  },
  {
    id: 'action-12-central-front-shuttle',
    title: 'Central Front Shuttle',
    family: 'scenario',
    effect: 'move-piece',
    summary: 'Scenario transport capacity grants one free legal movement action.'
  }
] as const;

const CARD_BY_ID = new Map(BOARD_ACTION_CARDS.map(card => [card.id, card]));

export function getBoardActionCard(cardId: string): BoardActionCardDefinition {
  const card = CARD_BY_ID.get(cardId);
  if (!card) throw new Error(`Unknown board action card: ${cardId}.`);
  return card;
}

function reject(state: BoardGameState, reason: string): BoardActionResult {
  return {
    state,
    accepted: false,
    commandActionsSpent: 0,
    reason
  };
}

function actionDeckIsEmpty(deck: DeckState): boolean {
  return deck.draw.length === 0
    && deck.discard.length === 0
    && SEAT_IDS.every(id => deck.handBySeat[id].length === 0);
}

/**
 * Only a pre-BG8 save already inside an activation needs the migration path.
 * Fresh direct-start states used by the authoritative engine have not resolved
 * the round's escalation, so they must not be mistaken for legacy saves.
 */
export function needsBoardActionCardMigration(state: BoardGameState): boolean {
  return state.phase === 'activation'
    && state.actionCardsPreparedRound === undefined
    && actionDeckIsEmpty(state.decks.action)
    && isBoardEscalationResolvedForRound(state);
}

function deriveCardShuffleSeed(
  state: BoardGameState,
  cardIds: readonly string[],
  salt: string
): number {
  let hash = (state.rng.seed ^ 0x8b8c2d51) >>> 0;
  const material = `${salt}|${cardIds.join('|')}`;

  for (let index = 0; index < material.length; index += 1) {
    hash ^= material.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash || 0x6d2b79f5;
}

/**
 * Action-card order is deterministic but deliberately isolated from the global
 * board RNG. Preparing or reshuffling cards must never alter a later combat
 * roll or any other seeded authoritative outcome.
 */
function shuffleCardIds(
  cardIds: readonly string[],
  seed: number
): string[] {
  const shuffled = [...cardIds];
  let randomState = seed >>> 0 || 0x6d2b79f5;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    randomState >>>= 0;
    const value = randomState / 0x100000000;
    const swapIndex = Math.floor(value * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

/** Lazily initialises the saved action deck so pre-BG8 v3 saves stay loadable. */
export function initialiseBoardActionDeck(state: BoardGameState): BoardGameState {
  if (!actionDeckIsEmpty(state.decks.action)) return state;

  const cardIds = BOARD_ACTION_CARDS.map(card => card.id);
  const shuffled = shuffleCardIds(cardIds, deriveCardShuffleSeed(state, cardIds, 'initial'));
  return {
    ...state,
    decks: {
      ...state.decks,
      action: {
        ...state.decks.action,
        draw: shuffled
      }
    }
  };
}

function reshuffleActionDiscard(state: BoardGameState): BoardGameState {
  const deck = state.decks.action;
  if (deck.draw.length > 0 || deck.discard.length === 0) return state;

  const salt = `reshuffle-round-${state.round}`;
  const shuffled = shuffleCardIds(deck.discard, deriveCardShuffleSeed(state, deck.discard, salt));
  return {
    ...state,
    decks: {
      ...state.decks,
      action: {
        ...deck,
        draw: shuffled,
        discard: []
      }
    }
  };
}

function drawActionCard(state: BoardGameState, seatId: SeatId): BoardGameState {
  if (state.decks.action.handBySeat[seatId].length >= BOARD_ACTION_HAND_LIMIT) return state;

  const ready = reshuffleActionDiscard(state);
  const [cardId, ...remainingDraw] = ready.decks.action.draw;
  if (!cardId) return ready;

  return {
    ...ready,
    decks: {
      ...ready.decks,
      action: {
        ...ready.decks.action,
        draw: remainingDraw,
        handBySeat: {
          ...ready.decks.action.handBySeat,
          [seatId]: [...ready.decks.action.handBySeat[seatId], cardId]
        }
      }
    }
  };
}

export function isBoardActionCardsPreparedForRound(state: BoardGameState): boolean {
  return state.actionCardsPreparedRound === state.round;
}

/**
 * Runs once at round-start after BG6 escalation. New and migrated pre-BG8
 * saves receive a two-card opening hand in their current round; later rounds
 * draw one card per participating seat up to the three-card hand limit.
 *
 * A pre-BG8 v3 save loaded during activation is the one deliberate phase
 * exception: it receives the same opening hand immediately, without changing
 * phase, activation, Command Actions or replaying historical round draws.
 */
export function prepareBoardActionCardsForRound(state: BoardGameState): BoardActionResult {
  const migratingDuringActivation = needsBoardActionCardMigration(state);
  if (state.phase !== 'round-start' && !migratingDuringActivation) {
    return reject(state, `Cannot prepare action cards during ${state.phase} phase.`);
  }
  if (state.phase === 'round-start' && !isBoardEscalationResolvedForRound(state)) {
    return reject(state, 'Resolve escalation before preparing action cards.');
  }
  if (isBoardActionCardsPreparedForRound(state)) {
    return reject(state, `Action cards are already prepared for round ${state.round}.`);
  }

  const freshDeck = state.actionCardsPreparedRound === undefined && actionDeckIsEmpty(state.decks.action);
  let nextState = initialiseBoardActionDeck(state);
  const drawsPerSeat = freshDeck ? BOARD_ACTION_OPENING_HAND_SIZE : BOARD_ACTION_ROUND_DRAW_COUNT;
  let drawn = 0;

  for (const seatId of SEAT_IDS) {
    if (!nextState.seats[seatId].participating) continue;
    for (let index = 0; index < drawsPerSeat; index += 1) {
      const before = nextState.decks.action.handBySeat[seatId].length;
      nextState = drawActionCard(nextState, seatId);
      if (nextState.decks.action.handBySeat[seatId].length > before) drawn += 1;
    }
  }

  nextState = {
    ...nextState,
    actionCardsPreparedRound: state.round
  };

  return {
    state: nextState,
    accepted: true,
    commandActionsSpent: 0,
    reason: `${migratingDuringActivation ? 'Migrated' : 'Prepared'} round ${state.round} action cards; drew ${drawn} card${drawn === 1 ? '' : 's'}.`
  };
}

type UnderlyingBoardActionApplier = (state: BoardGameState, action: BoardAction) => BoardActionResult;

function buildCardEffectAction(card: BoardActionCardDefinition, action: BoardAction): BoardAction | string {
  if (typeof action.pieceId !== 'string') return `${card.title} requires a string pieceId value.`;

  if (card.effect === 'move-piece') {
    if (typeof action.destinationSpaceId !== 'string') {
      return `${card.title} requires a string destinationSpaceId value.`;
    }
    return {
      type: 'move-piece',
      pieceId: action.pieceId,
      destinationSpaceId: action.destinationSpaceId
    };
  }

  return {
    type: card.effect,
    pieceId: action.pieceId
  };
}

/**
 * Plays one card from the active seat's saved hand. The underlying ordinary
 * board action decides legality and effect. On success BG8 refunds that one
 * Command Action and restores the current activation, then consumes the card.
 */
export function playBoardActionCard(
  state: BoardGameState,
  action: BoardAction,
  applyUnderlyingBoardAction: UnderlyingBoardActionApplier
): BoardActionResult {
  if (state.phase !== 'activation') {
    return reject(state, `Cannot play an action card during ${state.phase} phase.`);
  }
  if (state.combat?.status === 'declared') {
    return reject(state, 'Resolve the declared combat before playing an action card.');
  }
  if (typeof action.cardId !== 'string') {
    return reject(state, 'play-action-card requires a string cardId value.');
  }

  const activeSeatId = state.activeSeat;
  const activeSeat = state.seats[activeSeatId];
  if (!activeSeat.participating || activeSeat.commandActionsRemaining <= 0) {
    return reject(state, `${activeSeatId} has no active Command Action window for card play.`);
  }

  const hand = state.decks.action.handBySeat[activeSeatId];
  const cardIndex = hand.indexOf(action.cardId);
  if (cardIndex < 0) {
    return reject(state, `${action.cardId} is not in ${activeSeatId}'s hand.`);
  }

  let card: BoardActionCardDefinition;
  try {
    card = getBoardActionCard(action.cardId);
  } catch (error) {
    return reject(state, error instanceof Error ? error.message : 'Unknown board action card.');
  }

  const effectAction = buildCardEffectAction(card, action);
  if (typeof effectAction === 'string') return reject(state, effectAction);

  const effect = applyUnderlyingBoardAction(state, effectAction);
  if (!effect.accepted) return reject(state, `${card.title}: ${effect.reason}`);
  if (effect.commandActionsSpent !== 1) {
    return reject(state, `${card.title} must wrap an action that costs exactly one Command Action.`);
  }

  const nextHand = [...hand];
  nextHand.splice(cardIndex, 1);
  const effectState = effect.state;
  const nextState: BoardGameState = {
    ...effectState,
    activeSeat: activeSeatId,
    seats: {
      ...effectState.seats,
      [activeSeatId]: {
        ...effectState.seats[activeSeatId],
        commandActionsRemaining: activeSeat.commandActionsRemaining
      }
    },
    decks: {
      ...effectState.decks,
      action: {
        ...effectState.decks.action,
        handBySeat: {
          ...effectState.decks.action.handBySeat,
          [activeSeatId]: nextHand
        },
        discard: [...effectState.decks.action.discard, card.id]
      }
    }
  };

  return {
    state: nextState,
    accepted: true,
    commandActionsSpent: 0,
    reason: `${card.title}: ${effect.reason} Card consumed; Command Action refunded and activation retained.`
  };
}

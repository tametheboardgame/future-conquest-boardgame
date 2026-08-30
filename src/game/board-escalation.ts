import { nextBoardRandom } from './board-state';
import {
  SEAT_IDS,
  type BoardActionResult,
  type BoardGameState,
  type DeterministicRandomState,
  type SeatId
} from './board-state-types';

export type BoardEscalationPressureBand = 1 | 2 | 3 | 4;
export type BoardEscalationDeckStructure = 'combined' | 'split';

export interface BoardEscalationCardDefinition {
  id: string;
  title: string;
  pressureBand: BoardEscalationPressureBand;
  reinforcementCount: number;
  fortificationGain: number;
}

export interface BoardEscalationDeckPrototype {
  structure: BoardEscalationDeckStructure;
  deckCount: number;
  drawsPerRound: number;
  persistedDrawPiles: number;
  resolutionStepsPerRound: number;
  pressureCurve: readonly BoardEscalationPressureBand[];
  summary: string;
}

/**
 * BG6 prototyped both structures before selecting the combined deck. The split
 * version requires two persisted draw piles and two resolution steps each
 * round, while the combined version can use the deck slot already reserved in
 * the authoritative BG2 board state.
 */
export const BOARD_ESCALATION_DECK_PROTOTYPES: readonly BoardEscalationDeckPrototype[] = [
  {
    structure: 'combined',
    deckCount: 1,
    drawsPerRound: 1,
    persistedDrawPiles: 1,
    resolutionStepsPerRound: 1,
    pressureCurve: [1, 1, 2, 2, 3, 3, 4, 4],
    summary: 'One staged card combines escalation pressure with reinforcement effects.'
  },
  {
    structure: 'split',
    deckCount: 2,
    drawsPerRound: 2,
    persistedDrawPiles: 2,
    resolutionStepsPerRound: 2,
    pressureCurve: [1, 1, 2, 2, 3, 3, 4, 4],
    summary: 'Separate escalation and reinforcement draws add state and resolution overhead.'
  }
] as const;

export const SELECTED_BOARD_ESCALATION_DECK_STRUCTURE: BoardEscalationDeckStructure = 'combined';

/**
 * Two cards per pressure band allow deterministic seed variation without ever
 * allowing a later campaign band to become easier than an earlier one.
 */
export const BOARD_ESCALATION_CARDS: readonly BoardEscalationCardDefinition[] = [
  {
    id: 'escalation-01-forward-reserves',
    title: 'Forward Reserves',
    pressureBand: 1,
    reinforcementCount: 1,
    fortificationGain: 0
  },
  {
    id: 'escalation-02-mobile-reserve',
    title: 'Mobile Reserve',
    pressureBand: 1,
    reinforcementCount: 1,
    fortificationGain: 0
  },
  {
    id: 'escalation-03-hardened-line',
    title: 'Hardened Line',
    pressureBand: 2,
    reinforcementCount: 1,
    fortificationGain: 1
  },
  {
    id: 'escalation-04-regional-mobilisation',
    title: 'Regional Mobilisation',
    pressureBand: 2,
    reinforcementCount: 1,
    fortificationGain: 1
  },
  {
    id: 'escalation-05-operational-reserves',
    title: 'Operational Reserves',
    pressureBand: 3,
    reinforcementCount: 2,
    fortificationGain: 1
  },
  {
    id: 'escalation-06-emergency-deployment',
    title: 'Emergency Deployment',
    pressureBand: 3,
    reinforcementCount: 2,
    fortificationGain: 1
  },
  {
    id: 'escalation-07-total-mobilisation',
    title: 'Total Mobilisation',
    pressureBand: 4,
    reinforcementCount: 2,
    fortificationGain: 2
  },
  {
    id: 'escalation-08-last-reserves',
    title: 'Last Reserves',
    pressureBand: 4,
    reinforcementCount: 2,
    fortificationGain: 2
  }
] as const;

const CARD_BY_ID = new Map(BOARD_ESCALATION_CARDS.map(card => [card.id, card]));

function getParticipatingSeatIds(state: BoardGameState): SeatId[] {
  return SEAT_IDS.filter(id => state.seats[id].participating);
}

function shuffleCardIds(
  cardIds: readonly string[],
  rng: DeterministicRandomState
): { cardIds: string[]; rng: DeterministicRandomState } {
  const shuffled = [...cardIds];
  let nextRng = rng;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const random = nextBoardRandom(nextRng);
    nextRng = random.rng;
    const swapIndex = Math.floor(random.value * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return { cardIds: shuffled, rng: nextRng };
}

/**
 * Lazily prepares the combined deck so old v3 saves remain loadable. If a
 * pre-BG6 save is already in a later round, earlier cards are archived without
 * applying retroactive effects and the current round begins at the correct
 * pressure band.
 */
export function initialiseBoardEscalationDeck(state: BoardGameState): BoardGameState {
  const deck = state.decks.escalation;
  if (deck.draw.length > 0 || deck.discard.length > 0) return state;

  const orderedCardIds: string[] = [];
  let rng = state.rng;

  for (const pressureBand of [1, 2, 3, 4] as const) {
    const bandIds = BOARD_ESCALATION_CARDS
      .filter(card => card.pressureBand === pressureBand)
      .map(card => card.id);
    const shuffled = shuffleCardIds(bandIds, rng);
    orderedCardIds.push(...shuffled.cardIds);
    rng = shuffled.rng;
  }

  const historicalCardCount = Math.min(Math.max(state.round - 1, 0), orderedCardIds.length);

  return {
    ...state,
    decks: {
      ...state.decks,
      escalation: {
        ...deck,
        draw: orderedCardIds.slice(historicalCardCount),
        discard: orderedCardIds.slice(0, historicalCardCount)
      }
    },
    rng
  };
}

export function isBoardEscalationResolvedForRound(state: BoardGameState): boolean {
  return state.decks.escalation.discard.length >= state.round;
}

export function getBoardEscalationCard(cardId: string): BoardEscalationCardDefinition | null {
  return CARD_BY_ID.get(cardId) ?? null;
}

function getDefenderSeatId(state: BoardGameState): SeatId | null {
  const participating = getParticipatingSeatIds(state);
  return participating.length >= 2 ? participating[1] : null;
}

function getEscalationSpaceCandidates(state: BoardGameState, defenderSeatId: SeatId): string[] {
  const controlled = Object.values(state.spaces)
    .filter(space => space.control === defenderSeatId)
    .map(space => space.id)
    .sort((a, b) => a.localeCompare(b));
  if (controlled.length > 0) return controlled;

  const occupied = [...new Set(Object.values(state.pieces)
    .filter(piece => piece.seatId === defenderSeatId && piece.spaceId)
    .map(piece => piece.spaceId as string))]
    .sort((a, b) => a.localeCompare(b));
  if (occupied.length > 0) return occupied;

  return Object.keys(state.spaces).sort((a, b) => a.localeCompare(b));
}

function chooseSpaceId(
  candidates: readonly string[],
  rng: DeterministicRandomState
): { spaceId: string | null; rng: DeterministicRandomState } {
  if (candidates.length === 0) return { spaceId: null, rng };
  if (candidates.length === 1) return { spaceId: candidates[0], rng };

  const random = nextBoardRandom(rng);
  return {
    spaceId: candidates[Math.floor(random.value * candidates.length)],
    rng: random.rng
  };
}

/**
 * Resolves exactly one escalation card at round start. It costs no Command
 * Action; all randomness comes from the persisted board RNG and all effects
 * are written back into authoritative board state.
 */
export function resolveBoardEscalation(state: BoardGameState): BoardActionResult {
  if (state.phase !== 'round-start') {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: `Cannot resolve escalation during ${state.phase} phase.`
    };
  }

  if (isBoardEscalationResolvedForRound(state)) {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: `Escalation for round ${state.round} has already resolved.`
    };
  }

  const defenderSeatId = getDefenderSeatId(state);
  if (!defenderSeatId) {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: 'Cannot resolve escalation without at least two participating command seats.'
    };
  }

  const prepared = initialiseBoardEscalationDeck(state);
  const deck = prepared.decks.escalation;
  const cardId = deck.draw[0];
  const card = cardId ? getBoardEscalationCard(cardId) : null;

  if (!card) {
    return {
      state: prepared,
      accepted: false,
      commandActionsSpent: 0,
      reason: cardId ? `Unknown escalation card: ${cardId}.` : 'The escalation deck is exhausted.'
    };
  }

  let rng = prepared.rng;
  const pieces = { ...prepared.pieces };
  const spaces = { ...prepared.spaces };
  const candidates = getEscalationSpaceCandidates(prepared, defenderSeatId);
  const resolutionNumber = deck.discard.length + 1;

  for (let reinforcementIndex = 0; reinforcementIndex < card.reinforcementCount; reinforcementIndex += 1) {
    const placement = chooseSpaceId(candidates, rng);
    rng = placement.rng;
    if (!placement.spaceId) continue;

    const pieceId = `RF-${String(resolutionNumber).padStart(2, '0')}-${String(reinforcementIndex + 1).padStart(2, '0')}`;
    pieces[pieceId] = {
      id: pieceId,
      seatId: defenderSeatId,
      spaceId: placement.spaceId,
      readiness: 100,
      damage: 0,
      supply: 'supplied'
    };
  }

  if (card.fortificationGain > 0) {
    const fortificationTarget = chooseSpaceId(candidates, rng);
    rng = fortificationTarget.rng;
    if (fortificationTarget.spaceId) {
      const target = spaces[fortificationTarget.spaceId];
      spaces[fortificationTarget.spaceId] = {
        ...target,
        fortification: (target.fortification ?? 0) + card.fortificationGain
      };
    }
  }

  return {
    state: {
      ...prepared,
      pieces,
      spaces,
      decks: {
        ...prepared.decks,
        escalation: {
          ...deck,
          draw: deck.draw.slice(1),
          discard: [...deck.discard, card.id]
        }
      },
      rng
    },
    accepted: true,
    commandActionsSpent: 0,
    reason: `${card.title} resolved at pressure ${card.pressureBand}: ${card.reinforcementCount} reinforcement${card.reinforcementCount === 1 ? '' : 's'} and +${card.fortificationGain} fortification.`
  };
}

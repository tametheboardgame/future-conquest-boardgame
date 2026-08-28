import { createCentralFrontBoardSetup } from './board-scenario';
import {
  BOARD_COMMAND_ACTIONS_PER_ROUND,
  BOARD_ROUND_LIMIT,
  BOARD_STATE_SCHEMA,
  BOARD_STATE_VERSION,
  DEFAULT_PARTICIPATING_SEAT_IDS,
  SEAT_IDS,
  type BoardAction,
  type BoardActionResult,
  type BoardGameState,
  type BoardPhase,
  type BoardPiece,
  type BoardSpace,
  type CommandSeat,
  type ControllerType,
  type CreateBoardStateOptions,
  type DeckState,
  type DeterministicRandomState,
  type SeatId,
  type SupplyState
} from './board-state-types';

export interface BoardMoveDestinationEvaluation {
  spaceId: string;
  legal: boolean;
  reason: string | null;
}

function normaliseSeed(seed: number): number {
  if (!Number.isFinite(seed)) throw new Error('Board state seed must be a finite number.');
  const normalised = Math.trunc(seed) >>> 0;
  return normalised === 0 ? 0x6d2b79f5 : normalised;
}

function normaliseParticipatingSeatIds(requested?: readonly SeatId[]): SeatId[] {
  const source = requested ?? DEFAULT_PARTICIPATING_SEAT_IDS;
  const requestedSeats = new Set<SeatId>();

  for (const id of source) {
    if (!SEAT_IDS.includes(id)) throw new Error(`Unknown command seat: ${id}`);
    requestedSeats.add(id);
  }

  const participatingSeatIds = SEAT_IDS.filter(id => requestedSeats.has(id));
  if (participatingSeatIds.length < 2) {
    throw new Error('A board game requires at least two participating command seats.');
  }

  return participatingSeatIds;
}

function createSeat(id: SeatId, controller: ControllerType, participating: boolean): CommandSeat {
  return {
    id,
    controller,
    participating,
    commandActionsRemaining: 0
  };
}

function createEmptyHands(): Record<SeatId, string[]> {
  const hands = {} as Record<SeatId, string[]>;
  for (const id of SEAT_IDS) hands[id] = [];
  return hands;
}

function createEmptyDeck(): DeckState {
  return {
    draw: [],
    handBySeat: createEmptyHands(),
    discard: []
  };
}

export function getParticipatingSeatIds(state: BoardGameState): SeatId[] {
  return SEAT_IDS.filter(id => state.seats[id].participating);
}

export function createInitialBoardState(options: CreateBoardStateOptions): BoardGameState {
  const seed = normaliseSeed(options.seed);
  const participatingSeatIds = normaliseParticipatingSeatIds(options.participatingSeatIds);
  const participatingSeats = new Set<SeatId>(participatingSeatIds);
  const seats = Object.fromEntries(SEAT_IDS.map(id => [
    id,
    createSeat(id, options.controllers?.[id] ?? 'computer', participatingSeats.has(id))
  ])) as Record<SeatId, CommandSeat>;
  const boardSetup = createCentralFrontBoardSetup(seed, participatingSeatIds[0], participatingSeatIds[1]);

  return {
    save: {
      schema: BOARD_STATE_SCHEMA,
      version: BOARD_STATE_VERSION
    },
    scenario: { id: options.scenarioId ?? 'central-front' },
    round: 1,
    roundLimit: BOARD_ROUND_LIMIT,
    phase: 'round-start',
    activeSeat: participatingSeatIds[0],
    seats,
    spaces: boardSetup.spaces,
    pieces: boardSetup.pieces,
    decks: {
      escalation: createEmptyDeck(),
      action: createEmptyDeck()
    },
    rng: {
      seed,
      state: seed,
      calls: 0
    }
  };
}

/** Pure xorshift32 step. Authoritative randomness must flow through this state. */
export function nextBoardRandom(rng: DeterministicRandomState): {
  value: number;
  rng: DeterministicRandomState;
} {
  let state = rng.state >>> 0;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  state >>>= 0;

  return {
    value: state / 0x100000000,
    rng: {
      seed: rng.seed,
      state,
      calls: rng.calls + 1
    }
  };
}

export function serializeBoardState(state: BoardGameState): string {
  return JSON.stringify(state);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSeatId(value: unknown): value is SeatId {
  return typeof value === 'string' && SEAT_IDS.includes(value as SeatId);
}

function isControllerType(value: unknown): value is ControllerType {
  return value === 'human' || value === 'computer';
}

function isBoardPhase(value: unknown): value is BoardPhase {
  return value === 'round-start' || value === 'activation' || value === 'round-end';
}

function isSupplyState(value: unknown): value is SupplyState {
  return value === 'supplied' || value === 'strained' || value === 'isolated';
}

function hasValidSeatConfiguration(value: unknown, activeSeat: SeatId): boolean {
  if (!isRecord(value)) return false;
  let participating = 0;

  for (const id of SEAT_IDS) {
    const seat = value[id];
    if (!isRecord(seat)) return false;
    if (seat.id !== id || !isControllerType(seat.controller) || typeof seat.participating !== 'boolean') return false;
    if (
      typeof seat.commandActionsRemaining !== 'number'
      || !Number.isInteger(seat.commandActionsRemaining)
      || seat.commandActionsRemaining < 0
    ) return false;
    if (seat.participating) participating += 1;
  }

  return participating >= 2 && (value[activeSeat] as Record<string, unknown>).participating === true;
}

function hasValidBoardSpaces(value: unknown): value is Record<string, BoardSpace> {
  if (!isRecord(value) || Object.keys(value).length === 0) return false;
  const spaceIds = new Set(Object.keys(value));

  for (const [id, rawSpace] of Object.entries(value)) {
    if (!isRecord(rawSpace) || rawSpace.id !== id) return false;
    if (rawSpace.control !== null && !isSeatId(rawSpace.control)) return false;
    if (!Array.isArray(rawSpace.adjacentSpaceIds)) return false;
    const adjacent = rawSpace.adjacentSpaceIds;
    if (new Set(adjacent).size !== adjacent.length) return false;
    if (adjacent.some(otherId => typeof otherId !== 'string' || otherId === id || !spaceIds.has(otherId))) return false;
  }

  for (const [id, rawSpace] of Object.entries(value)) {
    const adjacent = (rawSpace as Record<string, unknown>).adjacentSpaceIds as string[];
    for (const otherId of adjacent) {
      const otherSpace = value[otherId];
      if (
        !isRecord(otherSpace)
        || !Array.isArray(otherSpace.adjacentSpaceIds)
        || !otherSpace.adjacentSpaceIds.includes(id)
      ) return false;
    }
  }

  return true;
}

function hasValidBoardPieces(value: unknown, spaces: Record<string, BoardSpace>): value is Record<string, BoardPiece> {
  if (!isRecord(value)) return false;

  for (const [id, rawPiece] of Object.entries(value)) {
    if (!isRecord(rawPiece) || rawPiece.id !== id || !isSeatId(rawPiece.seatId)) return false;
    if (rawPiece.spaceId !== null && (typeof rawPiece.spaceId !== 'string' || !spaces[rawPiece.spaceId])) return false;
    if (
      typeof rawPiece.readiness !== 'number'
      || !Number.isFinite(rawPiece.readiness)
      || rawPiece.readiness < 0
      || typeof rawPiece.damage !== 'number'
      || !Number.isFinite(rawPiece.damage)
      || rawPiece.damage < 0
      || !isSupplyState(rawPiece.supply)
    ) return false;
  }

  return true;
}

export function deserializeBoardState(serialized: string): BoardGameState {
  const parsed: unknown = JSON.parse(serialized);
  if (!isRecord(parsed) || !isRecord(parsed.save)) {
    throw new Error('Invalid Future Conquest board state.');
  }
  if (parsed.save.schema !== BOARD_STATE_SCHEMA || parsed.save.version !== BOARD_STATE_VERSION) {
    throw new Error('Unsupported Future Conquest board state version.');
  }
  if (
    parsed.roundLimit !== BOARD_ROUND_LIMIT
    || !SEAT_IDS.includes(parsed.activeSeat as SeatId)
    || !isBoardPhase(parsed.phase)
    || typeof parsed.round !== 'number'
    || !Number.isInteger(parsed.round)
    || parsed.round < 1
    || parsed.round > BOARD_ROUND_LIMIT
    || !hasValidSeatConfiguration(parsed.seats, parsed.activeSeat as SeatId)
    || !hasValidBoardSpaces(parsed.spaces)
    || !hasValidBoardPieces(parsed.pieces, parsed.spaces)
  ) {
    throw new Error('Invalid Future Conquest board state metadata.');
  }
  return parsed as unknown as BoardGameState;
}

/**
 * Starts the current round from the authoritative round-start phase.
 * The current two-seat Central Front prototype grants four Command Actions to
 * each participating command seat. Non-participating seats are always kept at
 * zero so they cannot become accidentally actionable.
 */
export function startBoardRound(state: BoardGameState): BoardActionResult {
  if (state.phase !== 'round-start') {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: `Cannot start round during ${state.phase} phase.`
    };
  }

  const participatingSeatIds = getParticipatingSeatIds(state);
  if (participatingSeatIds.length < 2) {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: 'Cannot start round without at least two participating command seats.'
    };
  }

  const seats = Object.fromEntries(SEAT_IDS.map(id => {
    const seat = state.seats[id];
    return [id, {
      ...seat,
      commandActionsRemaining: seat.participating ? BOARD_COMMAND_ACTIONS_PER_ROUND : 0
    }];
  })) as Record<SeatId, CommandSeat>;

  return {
    state: {
      ...state,
      phase: 'activation',
      activeSeat: participatingSeatIds[0],
      seats
    },
    accepted: true,
    commandActionsSpent: 0,
    reason: `Round ${state.round} started.`
  };
}

/** True only when every participating seat has exhausted its Command Actions. */
export function isBoardRoundExhausted(state: BoardGameState): boolean {
  const participatingSeatIds = getParticipatingSeatIds(state);
  return participatingSeatIds.length >= 2
    && participatingSeatIds.every(id => state.seats[id].commandActionsRemaining === 0);
}

/**
 * Closes the current activation phase once no participating seat can continue.
 * Round-end is deliberately separate from campaign resolution: BG10 owns any
 * victory or defeat decision at the eight-round boundary.
 */
export function endBoardRound(state: BoardGameState): BoardActionResult {
  if (state.phase !== 'activation') {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: `Cannot end round during ${state.phase} phase.`
    };
  }

  if (!isBoardRoundExhausted(state)) {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: 'Cannot end round while a participating seat still has Command Actions.'
    };
  }

  return {
    state: {
      ...state,
      phase: 'round-end'
    },
    accepted: true,
    commandActionsSpent: 0,
    reason: `Round ${state.round} ended.`
  };
}

/**
 * Advances a completed round to the next deterministic round-start state.
 * The campaign cannot advance beyond the locked eight-round boundary; BG10
 * will later decide the campaign outcome from that terminal board position.
 */
export function advanceBoardRound(state: BoardGameState): BoardActionResult {
  if (state.phase !== 'round-end') {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: `Cannot advance round during ${state.phase} phase.`
    };
  }

  if (state.round >= state.roundLimit) {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: `Round ${state.roundLimit} is the campaign limit; BG10 owns campaign resolution.`
    };
  }

  const participatingSeatIds = getParticipatingSeatIds(state);
  if (participatingSeatIds.length < 2) {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: 'Cannot advance round without at least two participating command seats.'
    };
  }

  const seats = Object.fromEntries(SEAT_IDS.map(id => [id, {
    ...state.seats[id],
    commandActionsRemaining: 0
  }])) as Record<SeatId, CommandSeat>;

  return {
    state: {
      ...state,
      round: state.round + 1,
      phase: 'round-start',
      activeSeat: participatingSeatIds[0],
      seats
    },
    accepted: true,
    commandActionsSpent: 0,
    reason: `Advanced to round ${state.round + 1}.`
  };
}

/**
 * Returns the next participating seat that still has Command Actions. Search
 * wraps in permanent seat order and may return the current seat only after a
 * full circuit, which lets future paid actions continue when every opponent is
 * exhausted while still preserving deterministic alternating order whenever
 * another seat can act.
 */
export function getNextActivatingSeatId(state: BoardGameState): SeatId | null {
  const activeIndex = SEAT_IDS.indexOf(state.activeSeat);
  if (activeIndex < 0) return null;

  for (let offset = 1; offset <= SEAT_IDS.length; offset += 1) {
    const id = SEAT_IDS[(activeIndex + offset) % SEAT_IDS.length];
    const seat = state.seats[id];
    if (seat.participating && seat.commandActionsRemaining > 0) return id;
  }

  return null;
}

function getBoardMoveRejectionReason(
  state: BoardGameState,
  pieceId: string,
  destinationSpaceId: string
): string | null {
  if (state.phase !== 'activation') {
    return `Cannot move a piece during ${state.phase} phase.`;
  }

  const activeSeat = state.seats[state.activeSeat];
  if (!activeSeat.participating || activeSeat.commandActionsRemaining <= 0) {
    return `${state.activeSeat} has no Command Actions remaining.`;
  }

  const piece = state.pieces[pieceId];
  if (!piece) return `Unknown board piece: ${pieceId}.`;
  if (piece.seatId !== state.activeSeat) {
    return `${pieceId} is owned by ${piece.seatId}, not active seat ${state.activeSeat}.`;
  }
  if (!piece.spaceId) return `${pieceId} is not currently on a board space.`;

  const origin = state.spaces[piece.spaceId];
  if (!origin) return `${pieceId} has an invalid current board space.`;

  const destination = state.spaces[destinationSpaceId];
  if (!destination) return `Unknown destination space: ${destinationSpaceId}.`;
  if (destinationSpaceId === piece.spaceId) return `${pieceId} already occupies ${destinationSpaceId}.`;
  if (!origin.adjacentSpaceIds.includes(destinationSpaceId)) {
    return `${destinationSpaceId} is not adjacent to ${piece.spaceId}.`;
  }
  if (destination.control !== null && destination.control !== piece.seatId) {
    return `${destinationSpaceId} is controlled by hostile seat ${destination.control}.`;
  }

  const hostileOccupant = Object.values(state.pieces).find(candidate =>
    candidate.spaceId === destinationSpaceId && candidate.seatId !== piece.seatId
  );
  if (hostileOccupant) {
    return `${destinationSpaceId} is blocked by hostile piece ${hostileOccupant.id}.`;
  }

  return null;
}

/**
 * Enumerates every board space through the same authoritative legality check
 * used by paid movement. BG4C can therefore highlight legal destinations and
 * explain unavailable destinations without reproducing movement rules in UI.
 */
export function getBoardMoveDestinations(
  state: BoardGameState,
  pieceId: string
): BoardMoveDestinationEvaluation[] {
  return Object.keys(state.spaces).map(spaceId => {
    const reason = getBoardMoveRejectionReason(state, pieceId, spaceId);
    return {
      spaceId,
      legal: reason === null,
      reason
    };
  });
}

/**
 * Moves one active-seat piece exactly one adjacent friendly/non-hostile space.
 * Rejected movement is strictly no-cost/no-mutation. Accepted movement spends
 * one Command Action and hands activation to the next seat returned by BG3's
 * deterministic activation-order engine.
 */
export function moveBoardPiece(
  state: BoardGameState,
  pieceId: string,
  destinationSpaceId: string
): BoardActionResult {
  const rejectionReason = getBoardMoveRejectionReason(state, pieceId, destinationSpaceId);
  if (rejectionReason) {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: rejectionReason
    };
  }

  const piece = state.pieces[pieceId];
  const originSpaceId = piece.spaceId as string;
  const activeSeatId = state.activeSeat;
  const seats = {
    ...state.seats,
    [activeSeatId]: {
      ...state.seats[activeSeatId],
      commandActionsRemaining: state.seats[activeSeatId].commandActionsRemaining - 1
    }
  };
  const pieces = {
    ...state.pieces,
    [pieceId]: {
      ...piece,
      spaceId: destinationSpaceId
    }
  };
  const paidState: BoardGameState = {
    ...state,
    seats,
    pieces
  };
  const nextSeat = getNextActivatingSeatId(paidState);
  const nextState = nextSeat
    ? { ...paidState, activeSeat: nextSeat }
    : paidState;

  return {
    state: nextState,
    accepted: true,
    commandActionsSpent: 1,
    reason: nextSeat
      ? `${pieceId} moved from ${originSpaceId} to ${destinationSpaceId}; activation progressed to ${nextSeat}.`
      : `${pieceId} moved from ${originSpaceId} to ${destinationSpaceId}; all participating seats are exhausted.`
  };
}

/**
 * Pass yields only the current activation. It never spends or discards Command
 * Actions, so a seat can act when activation returns later in the round.
 */
export function passBoardActivation(state: BoardGameState): BoardActionResult {
  if (state.phase !== 'activation') {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: `Cannot pass activation during ${state.phase} phase.`
    };
  }

  const activeSeat = state.seats[state.activeSeat];
  if (!activeSeat.participating || activeSeat.commandActionsRemaining <= 0) {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: `${state.activeSeat} has no legal activation to pass.`
    };
  }

  const nextSeat = getNextActivatingSeatId(state);
  if (!nextSeat || nextSeat === state.activeSeat) {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: 'No other participating seat has a legal activation.'
    };
  }

  return {
    state: {
      ...state,
      activeSeat: nextSeat
    },
    accepted: true,
    commandActionsSpent: 0,
    reason: `${state.activeSeat} passed activation to ${nextSeat}.`
  };
}

/**
 * Board actions cross this single authoritative dispatch boundary. Unsupported
 * actions remain no-cost/no-mutation.
 */
export function applyBoardAction(state: BoardGameState, action: BoardAction): BoardActionResult {
  if (action.type === 'start-round') return startBoardRound(state);
  if (action.type === 'pass-activation') return passBoardActivation(state);
  if (action.type === 'end-round') return endBoardRound(state);
  if (action.type === 'advance-round') return advanceBoardRound(state);
  if (action.type === 'move-piece') {
    if (typeof action.pieceId !== 'string' || typeof action.destinationSpaceId !== 'string') {
      return {
        state,
        accepted: false,
        commandActionsSpent: 0,
        reason: 'move-piece requires string pieceId and destinationSpaceId values.'
      };
    }
    return moveBoardPiece(state, action.pieceId, action.destinationSpaceId);
  }

  return {
    state,
    accepted: false,
    commandActionsSpent: 0,
    reason: `Unsupported board action: ${action.type}`
  };
}

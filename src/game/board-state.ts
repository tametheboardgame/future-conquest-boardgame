import {
  BOARD_ROUND_LIMIT,
  BOARD_STATE_SCHEMA,
  BOARD_STATE_VERSION,
  DEFAULT_PARTICIPATING_SEAT_IDS,
  SEAT_IDS,
  type BoardAction,
  type BoardActionResult,
  type BoardGameState,
  type BoardPhase,
  type CommandSeat,
  type ControllerType,
  type CreateBoardStateOptions,
  type DeckState,
  type DeterministicRandomState,
  type SeatId
} from './board-state-types';

function normaliseSeed(seed: number): number {
  if (!Number.isFinite(seed)) throw new Error('Board state seed must be a finite number.');
  const normalised = Math.trunc(seed) >>> 0;
  return normalised === 0 ? 0x6d2b79f5 : normalised;
}

function normaliseParticipatingSeatIds(requested?: readonly SeatId[]): SeatId[] {
  const source = requested ?? DEFAULT_PARTICIPATING_SEAT_IDS;
  const unique: SeatId[] = [];

  for (const id of source) {
    if (!SEAT_IDS.includes(id)) throw new Error(`Unknown command seat: ${id}`);
    if (!unique.includes(id)) unique.push(id);
  }

  if (unique.length < 2) {
    throw new Error('A board game requires at least two participating command seats.');
  }

  return unique;
}

function createSeat(id: SeatId, controller: ControllerType, participating: boolean): CommandSeat {
  return {
    id,
    controller,
    participating,
    // Later BG3 packages own the rules that grant/spend Command Actions.
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
    spaces: {},
    pieces: {},
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

function isControllerType(value: unknown): value is ControllerType {
  return value === 'human' || value === 'computer';
}

function isBoardPhase(value: unknown): value is BoardPhase {
  return value === 'round-start' || value === 'activation' || value === 'round-end';
}

function hasValidSeatConfiguration(value: unknown, activeSeat: SeatId): boolean {
  if (!isRecord(value)) return false;
  let participating = 0;

  for (const id of SEAT_IDS) {
    const seat = value[id];
    if (!isRecord(seat)) return false;
    if (seat.id !== id || !isControllerType(seat.controller) || typeof seat.participating !== 'boolean') return false;
    if (!Number.isInteger(seat.commandActionsRemaining) || Number(seat.commandActionsRemaining) < 0) return false;
    if (seat.participating) participating += 1;
  }

  return participating >= 2 && (value[activeSeat] as Record<string, unknown>).participating === true;
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
    || !Number.isInteger(parsed.round)
    || Number(parsed.round) < 1
    || Number(parsed.round) > BOARD_ROUND_LIMIT
    || !hasValidSeatConfiguration(parsed.seats, parsed.activeSeat as SeatId)
  ) {
    throw new Error('Invalid Future Conquest board state metadata.');
  }
  return parsed as unknown as BoardGameState;
}

/**
 * BG2 established the dispatch boundary without inventing later rules early.
 * Until a board action has an authoritative BG3+ handler, rejecting it remains
 * required: no mutation and no Command Action cost.
 */
export function applyBoardAction(state: BoardGameState, action: BoardAction): BoardActionResult {
  return {
    state,
    accepted: false,
    commandActionsSpent: 0,
    reason: `Unsupported board action: ${action.type}`
  };
}

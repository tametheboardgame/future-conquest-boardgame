import {
  BOARD_ROUND_LIMIT,
  BOARD_STATE_SCHEMA,
  BOARD_STATE_VERSION,
  SEAT_IDS,
  type BoardAction,
  type BoardActionResult,
  type BoardGameState,
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

function createSeat(id: SeatId, controller: ControllerType): CommandSeat {
  return {
    id,
    controller,
    // BG3 owns the rules that grant/spend Command Actions. BG2 only stores them.
    commandActionsRemaining: 0
  };
}

function createEmptyHands(): Record<SeatId, string[]> {
  return Object.fromEntries(SEAT_IDS.map(id => [id, []])) as Record<SeatId, string[]>;
}

function createEmptyDeck(): DeckState {
  return {
    draw: [],
    handBySeat: createEmptyHands(),
    discard: []
  };
}

export function createInitialBoardState(options: CreateBoardStateOptions): BoardGameState {
  const seed = normaliseSeed(options.seed);
  const seats = Object.fromEntries(SEAT_IDS.map(id => [
    id,
    createSeat(id, options.controllers?.[id] ?? 'computer')
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
    activeSeat: 'seat-1',
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

export function deserializeBoardState(serialized: string): BoardGameState {
  const parsed: unknown = JSON.parse(serialized);
  if (!isRecord(parsed) || !isRecord(parsed.save)) {
    throw new Error('Invalid Future Conquest board state.');
  }
  if (parsed.save.schema !== BOARD_STATE_SCHEMA || parsed.save.version !== BOARD_STATE_VERSION) {
    throw new Error('Unsupported Future Conquest board state version.');
  }
  if (parsed.roundLimit !== BOARD_ROUND_LIMIT || !SEAT_IDS.includes(parsed.activeSeat as SeatId)) {
    throw new Error('Invalid Future Conquest board state metadata.');
  }
  return parsed as unknown as BoardGameState;
}

/**
 * BG2 establishes the dispatch boundary without inventing BG3+ rules early.
 * Until a board action has an authoritative handler, rejecting it is required:
 * no mutation and no Command Action cost.
 */
export function applyBoardAction(state: BoardGameState, action: BoardAction): BoardActionResult {
  return {
    state,
    accepted: false,
    commandActionsSpent: 0,
    reason: `Unsupported board action: ${action.type}`
  };
}

export const BOARD_STATE_SCHEMA = 'future-conquest-board-state' as const;
export const BOARD_STATE_VERSION = 3 as const;
export const BOARD_ROUND_LIMIT = 8 as const;
export const BOARD_COMMAND_ACTIONS_PER_ROUND = 4 as const;

export const SEAT_IDS = ['seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5', 'seat-6'] as const;
export const DEFAULT_PARTICIPATING_SEAT_IDS = ['seat-1', 'seat-2'] as const;

export type SeatId = typeof SEAT_IDS[number];
export type ControllerType = 'human' | 'computer';
export type BoardPhase = 'round-start' | 'activation' | 'round-end';
export type SupplyState = 'supplied' | 'strained' | 'isolated';
export type BoardCombatStatus = 'declared' | 'resolved';

export interface BoardSaveMetadata {
  schema: typeof BOARD_STATE_SCHEMA;
  version: typeof BOARD_STATE_VERSION;
}

export interface CommandSeat {
  id: SeatId;
  controller: ControllerType;
  participating: boolean;
  commandActionsRemaining: number;
}

export interface BoardSpace {
  id: string;
  control: SeatId | null;
  adjacentSpaceIds: string[];
  /** Reserved for board-game defensive works. BG5 treats omitted values as zero. */
  fortification?: number;
}

export interface BoardPiece {
  id: string;
  seatId: SeatId;
  spaceId: string | null;
  readiness: number;
  damage: number;
  supply: SupplyState;
}

export interface BoardCombatModifiers {
  supply: number;
  terrain: number;
  fortification: number;
}

export interface BoardCombatRoll {
  die: number;
  attackTotal: number;
  target: number;
  outcome: 'hit' | 'miss';
}

export interface BoardCombatState {
  status: BoardCombatStatus;
  attackerPieceId: string;
  defenderPieceId: string;
  originSpaceId: string;
  targetSpaceId: string;
  dieCount: 1;
  dieSides: 20;
  baseTarget: number;
  modifiers: BoardCombatModifiers;
  roll: BoardCombatRoll | null;
  log: string[];
}

export interface DeckState {
  draw: string[];
  handBySeat: Record<SeatId, string[]>;
  discard: string[];
}

export interface DeterministicRandomState {
  seed: number;
  state: number;
  calls: number;
}

export interface BoardGameState {
  save: BoardSaveMetadata;
  scenario: { id: string };
  round: number;
  roundLimit: typeof BOARD_ROUND_LIMIT;
  phase: BoardPhase;
  activeSeat: SeatId;
  seats: Record<SeatId, CommandSeat>;
  spaces: Record<string, BoardSpace>;
  pieces: Record<string, BoardPiece>;
  decks: {
    escalation: DeckState;
    action: DeckState;
  };
  rng: DeterministicRandomState;
  /** BG5 combat record. Undefined means no combat has yet been declared. */
  combat?: BoardCombatState;
}

export interface CreateBoardStateOptions {
  seed: number;
  scenarioId?: string;
  controllers?: Partial<Record<SeatId, ControllerType>>;
  participatingSeatIds?: readonly SeatId[];
}

export interface BoardAction {
  type: string;
  [key: string]: unknown;
}

export interface BoardActionResult {
  state: BoardGameState;
  accepted: boolean;
  commandActionsSpent: number;
  reason: string;
}
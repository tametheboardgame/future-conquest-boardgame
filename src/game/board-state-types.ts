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
export type BoardCombatDefenderStatus = 'held' | 'retreated' | 'eliminated';
export type BoardCampaignOutcome = 'in-progress' | 'attacker-victory' | 'defender-victory';

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
  /** Board-game defensive works. Omitted values are unfortified; legacy values above one remain loadable. */
  fortification?: number;
}

export interface BoardPiece {
  id: string;
  seatId: SeatId;
  spaceId: string | null;
  /** Visible 0-100 cohesion/readiness track. */
  readiness: number;
  /** Visible accumulated hit track. Three damage eliminates a piece. */
  damage: number;
  supply: SupplyState;
}

export interface BoardCombatModifiers {
  supply: number;
  terrain: number;
  fortification: number;
}

export interface BoardCombatRoll {
  /** BG12G-R authoritative pair. Optional only so pre-2D6 v3 saves remain loadable. */
  dice?: [number, number];
  /** Compatibility total. For current 2D6 combat this always equals dice[0] + dice[1]. */
  die: number;
  attackTotal: number;
  target: number;
  outcome: 'hit' | 'miss';
}

export interface BoardCombatConsequence {
  critical: boolean;
  readinessLoss: number;
  damageInflicted: number;
  defenderStatus: BoardCombatDefenderStatus;
  retreatSpaceId: string | null;
  attackerAdvanced: boolean;
  controlChanged: boolean;
}

export interface BoardCombatState {
  status: BoardCombatStatus;
  attackerPieceId: string;
  defenderPieceId: string;
  originSpaceId: string;
  targetSpaceId: string;
  /** Current combat is 2D6; 1D20 is retained only for loading a legacy resolved v3 save. */
  dieCount: 1 | 2;
  dieSides: 6 | 20;
  baseTarget: number;
  modifiers: BoardCombatModifiers;
  roll: BoardCombatRoll | null;
  /** Optional for compatibility with BG5A saves created before consequence rules existed. */
  consequence?: BoardCombatConsequence;
  log: string[];
}

export interface BoardCampaignState {
  attackerSeatId: SeatId;
  defenderSeatId: SeatId;
  /** Cumulative BG10 score: one point per strategic objective held at each round end. */
  breakthroughPoints: number;
  /** Last round whose objective control has been added to breakthroughPoints. */
  scoredThroughRound: number;
  outcome: BoardCampaignOutcome;
  resolvedRound: number | null;
  reason: string | null;
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
  /** BG8 marker. Optional so pre-BG8 v3 saves migrate lazily in their current round. */
  actionCardsPreparedRound?: number;
  /** BG5 combat record. Undefined means no combat has yet been declared. */
  combat?: BoardCombatState;
  /** BG10 campaign score/outcome. Optional so existing v3 saves migrate lazily without a version reset. */
  campaign?: BoardCampaignState;
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
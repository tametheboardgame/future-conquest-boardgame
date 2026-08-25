import type {
  BoardGameState,
  BoardPiece,
  SeatId
} from './board-state-types';

export type BoardPresentationController = 'player' | 'enemy' | 'neutral';

export interface BoardPiecePresentation {
  id: string;
  seatId: SeatId;
  spaceId: string | null;
  controller: Exclude<BoardPresentationController, 'neutral'>;
  readiness: number;
  damage: number;
  supply: BoardPiece['supply'];
}

export interface BoardRenderProjection {
  scenarioId: string;
  round: number;
  phase: BoardGameState['phase'];
  activeSeat: SeatId;
  commandActionsRemaining: number;
  spaceControllers: Record<string, BoardPresentationController>;
  pieces: BoardPiecePresentation[];
}

export interface BoardRenderProjectionOptions {
  playerSeatIds?: readonly SeatId[];
}

function presentationController(
  seatId: SeatId | null,
  playerSeatIds: ReadonlySet<SeatId>
): BoardPresentationController {
  if (seatId === null) return 'neutral';
  return playerSeatIds.has(seatId) ? 'player' : 'enemy';
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Pure presentation seam between authoritative BG2 board state and the retained
 * renderer. It deliberately returns renderer-friendly values without mutating
 * board state or the legacy simulation state.
 *
 * The first conversion pass treats seat-1 as the local/player presentation side.
 * BG3 owns player/seat configuration and can supply a different playerSeatIds set
 * without changing the renderer or this projection contract.
 */
export function projectBoardStateForRenderer(
  state: BoardGameState,
  options: BoardRenderProjectionOptions = {}
): BoardRenderProjection {
  const playerSeatIds = new Set<SeatId>(options.playerSeatIds ?? ['seat-1']);
  const activeSeat = state.seats[state.activeSeat];

  const spaceControllers = Object.fromEntries(
    Object.values(state.spaces)
      .sort((a, b) => compareIds(a.id, b.id))
      .map(space => [space.id, presentationController(space.control, playerSeatIds)])
  );

  const pieces = Object.values(state.pieces)
    .sort((a, b) => compareIds(a.id, b.id))
    .map(piece => ({
      id: piece.id,
      seatId: piece.seatId,
      spaceId: piece.spaceId,
      controller: presentationController(piece.seatId, playerSeatIds) as 'player' | 'enemy',
      readiness: piece.readiness,
      damage: piece.damage,
      supply: piece.supply
    }));

  return {
    scenarioId: state.scenario.id,
    round: state.round,
    phase: state.phase,
    activeSeat: state.activeSeat,
    commandActionsRemaining: activeSeat.commandActionsRemaining,
    spaceControllers,
    pieces
  };
}

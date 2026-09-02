import { SLICE_IDS, TERRITORIES } from './data';
import type { BoardPiece, BoardSpace, SeatId } from './board-state-types';

export const CENTRAL_FRONT_SPACE_IDS = [...SLICE_IDS] as const;
export const CENTRAL_FRONT_TASK_GROUP_IDS = ['TG-1', 'TG-2', 'TG-3', 'TG-4', 'TG-5', 'TG-6', 'TG-7', 'TG-8'] as const;

export interface CentralFrontBoardSetup {
  entrySpaceId: string;
  spaces: Record<string, BoardSpace>;
  pieces: Record<string, BoardPiece>;
}

function createPiece(id: string, seatId: SeatId, spaceId: string): BoardPiece {
  return {
    id,
    seatId,
    spaceId,
    readiness: 100,
    damage: 0,
    supply: 'supplied'
  };
}

/**
 * Deterministic BG4 board setup based on the retained Central Front slice.
 * The entry-space rule mirrors the existing simulation's seed modulo region
 * ordering so the board game reuses proven geography instead of inventing a
 * parallel scenario map.
 */
export function createCentralFrontBoardSetup(
  seed: number,
  firstSeatId: SeatId,
  opposingSeatId: SeatId
): CentralFrontBoardSetup {
  const entrySpaceId = SLICE_IDS[(seed >>> 0) % SLICE_IDS.length];

  const spaces = Object.fromEntries(SLICE_IDS.map(id => [id, {
    id,
    control: id === entrySpaceId ? firstSeatId : opposingSeatId,
    adjacentSpaceIds: [...TERRITORIES[id].neighbours]
  }])) as Record<string, BoardSpace>;

  const pieces: Record<string, BoardPiece> = {};
  for (const id of CENTRAL_FRONT_TASK_GROUP_IDS) {
    pieces[id] = createPiece(id, firstSeatId, entrySpaceId);
  }

  let enemyIndex = 1;
  for (const spaceId of SLICE_IDS) {
    if (spaceId === entrySpaceId) continue;
    const id = `EF-${String(enemyIndex).padStart(2, '0')}`;
    pieces[id] = createPiece(id, opposingSeatId, spaceId);
    enemyIndex += 1;
  }

  return { entrySpaceId, spaces, pieces };
}

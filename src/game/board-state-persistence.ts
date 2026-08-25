import {
  BOARD_STATE_VERSION,
  type BoardGameState
} from './board-state-types';
import {
  deserializeBoardState,
  serializeBoardState
} from './board-state';

export const BOARD_STATE_SAVE_KEY = `future-conquest-board-state-v${BOARD_STATE_VERSION}`;

type BoardStateStorageReader = Pick<Storage, 'getItem'>;
type BoardStateStorageWriter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type BoardStateInspection =
  | { ok: true; state: BoardGameState }
  | { ok: false; code: 'missing' | 'corrupt' | 'unsupported' | 'storage-unavailable'; message: string };

export type BoardStateWriteResult =
  | { ok: true; state: BoardGameState }
  | { ok: false; code: 'storage-unavailable'; message: string };

export function inspectStoredBoardState(storage: BoardStateStorageReader): BoardStateInspection {
  let raw: string | null;
  try {
    raw = storage.getItem(BOARD_STATE_SAVE_KEY);
  } catch {
    return {
      ok: false,
      code: 'storage-unavailable',
      message: 'The board-game save could not be read from browser storage.'
    };
  }

  if (raw === null) {
    return {
      ok: false,
      code: 'missing',
      message: 'No board-game state has been saved in this browser.'
    };
  }

  try {
    return { ok: true, state: deserializeBoardState(raw) };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Unsupported Future Conquest board state version')) {
      return {
        ok: false,
        code: 'unsupported',
        message: 'The board-game save uses an unsupported version.'
      };
    }
    return {
      ok: false,
      code: 'corrupt',
      message: 'The board-game save is corrupted and could not be loaded.'
    };
  }
}

export function writeBoardState(
  storage: BoardStateStorageWriter,
  state: BoardGameState
): BoardStateWriteResult {
  try {
    storage.setItem(BOARD_STATE_SAVE_KEY, serializeBoardState(state));
    return { ok: true, state };
  } catch {
    return {
      ok: false,
      code: 'storage-unavailable',
      message: 'The board-game state could not be saved to browser storage.'
    };
  }
}

export function clearBoardState(storage: BoardStateStorageWriter): boolean {
  try {
    storage.removeItem(BOARD_STATE_SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

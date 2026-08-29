import {
  BOARD_STATE_VERSION,
  type BoardCombatConsequence,
  type BoardCombatRoll,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasValidCombatRoll(value: unknown): value is BoardCombatRoll {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.die)
    && (value.die as number) >= 1
    && (value.die as number) <= 20
    && isFiniteNumber(value.attackTotal)
    && isFiniteNumber(value.target)
    && (value.outcome === 'hit' || value.outcome === 'miss');
}

function hasValidCombatConsequence(value: unknown, state: BoardGameState): value is BoardCombatConsequence {
  if (!isRecord(value)) return false;
  return typeof value.critical === 'boolean'
    && isFiniteNumber(value.readinessLoss)
    && value.readinessLoss >= 0
    && isFiniteNumber(value.damageInflicted)
    && value.damageInflicted >= 0
    && (value.defenderStatus === 'held' || value.defenderStatus === 'retreated' || value.defenderStatus === 'eliminated')
    && (value.retreatSpaceId === null || (typeof value.retreatSpaceId === 'string' && Boolean(state.spaces[value.retreatSpaceId])))
    && typeof value.attackerAdvanced === 'boolean'
    && typeof value.controlChanged === 'boolean';
}

/**
 * BG5 combat was added without changing the v3 save envelope so older v3 saves
 * remain loadable. Validate the optional combat payload at the browser-storage
 * boundary instead of silently trusting malformed combat state.
 */
function hasValidPersistedCombat(state: BoardGameState): boolean {
  const combat = state.combat;
  if (combat === undefined) return true;
  if (!isRecord(combat)) return false;
  if (combat.status !== 'declared' && combat.status !== 'resolved') return false;
  if (typeof combat.attackerPieceId !== 'string' || !state.pieces[combat.attackerPieceId]) return false;
  if (typeof combat.defenderPieceId !== 'string' || !state.pieces[combat.defenderPieceId]) return false;
  if (typeof combat.originSpaceId !== 'string' || !state.spaces[combat.originSpaceId]) return false;
  if (typeof combat.targetSpaceId !== 'string' || !state.spaces[combat.targetSpaceId]) return false;
  if (combat.dieCount !== 1 || combat.dieSides !== 20 || !isFiniteNumber(combat.baseTarget)) return false;
  if (!isRecord(combat.modifiers)
    || !isFiniteNumber(combat.modifiers.supply)
    || !isFiniteNumber(combat.modifiers.terrain)
    || !isFiniteNumber(combat.modifiers.fortification)) return false;
  if (!Array.isArray(combat.log) || combat.log.some(entry => typeof entry !== 'string')) return false;

  if (combat.status === 'declared') {
    return combat.roll === null && combat.consequence === undefined;
  }

  if (!hasValidCombatRoll(combat.roll)) return false;
  return combat.consequence === undefined || hasValidCombatConsequence(combat.consequence, state);
}

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
    const state = deserializeBoardState(raw);
    if (!hasValidPersistedCombat(state)) {
      throw new Error('Invalid Future Conquest board combat state.');
    }
    return { ok: true, state };
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

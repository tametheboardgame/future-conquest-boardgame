import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyBoardAction, createInitialBoardState } from '../game/board-state';
import { inspectStoredBoardState, writeBoardState } from '../game/board-state-persistence';
import { chooseAutomaticBoardAction } from '../game/board-turn-orchestration';
import type { BoardAction, BoardActionResult, BoardGameState } from '../game/board-state-types';

type BoardGameStateContextValue = {
  state: BoardGameState;
  dispatch: (action: BoardAction) => BoardActionResult;
};

const BoardGameStateContext = createContext<BoardGameStateContextValue | null>(null);

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function inspectBrowserBoardState() {
  const storage = browserStorage();
  return storage ? inspectStoredBoardState(storage) : null;
}

function initialiseBoardState(): BoardGameState {
  const stored = inspectBrowserBoardState();
  if (stored?.ok) return stored.state;

  return createInitialBoardState({
    seed: 0x4655434f,
    controllers: { 'seat-1': 'human' }
  });
}

function shouldPreserveExistingBoardSave(): boolean {
  const stored = inspectBrowserBoardState();
  return Boolean(stored && !stored.ok && (stored.code === 'corrupt' || stored.code === 'unsupported'));
}

/**
 * BG3 state host. The provider stays mounted around the existing application so
 * authoritative board actions never recreate or replace the protected map.
 */
export function BoardGameStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BoardGameState>(initialiseBoardState);
  const [preserveExistingBoardSave] = useState(shouldPreserveExistingBoardSave);

  const dispatch = useCallback((action: BoardAction): BoardActionResult => {
    const result = applyBoardAction(state, action);
    if (!result.accepted) return result;

    const storage = browserStorage();
    if (storage && !preserveExistingBoardSave) writeBoardState(storage, result.state);
    setState(result.state);
    return result;
  }, [state, preserveExistingBoardSave]);

  useEffect(() => {
    const storage = browserStorage();
    if (!storage || preserveExistingBoardSave) return;
    const stored = inspectStoredBoardState(storage);
    // Create the dedicated board save only when genuinely absent. Corrupt or
    // unsupported data is preserved for explicit recovery rather than silently
    // overwritten during application bootstrap or automatic turn progression.
    if (!stored.ok && stored.code === 'missing') writeBoardState(storage, state);
  }, [preserveExistingBoardSave]); // Bootstrap-only: accepted actions persist synchronously in dispatch.

  useEffect(() => {
    const automaticAction = chooseAutomaticBoardAction(state);
    if (!automaticAction) return;
    dispatch(automaticAction);
  }, [state, dispatch]);

  const value = useMemo<BoardGameStateContextValue>(() => ({ state, dispatch }), [state, dispatch]);
  return <BoardGameStateContext.Provider value={value}>{children}</BoardGameStateContext.Provider>;
}

function useBoardGameContext(): BoardGameStateContextValue {
  const value = useContext(BoardGameStateContext);
  if (!value) throw new Error('Board game hooks must be used within BoardGameStateProvider');
  return value;
}

export function useBoardGameState(): BoardGameState {
  return useBoardGameContext().state;
}

export function useBoardGameDispatch(): (action: BoardAction) => BoardActionResult {
  return useBoardGameContext().dispatch;
}

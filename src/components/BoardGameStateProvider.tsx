import { createContext, useContext, useState, type ReactNode } from 'react';
import { createInitialBoardState } from '../game/board-state';
import { inspectStoredBoardState, writeBoardState } from '../game/board-state-persistence';
import type { BoardGameState } from '../game/board-state-types';

const BoardGameStateContext = createContext<BoardGameState | null>(null);

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function initialiseBoardState(): BoardGameState {
  const storage = browserStorage();
  if (storage) {
    const stored = inspectStoredBoardState(storage);
    if (stored.ok) return stored.state;
  }

  const initial = createInitialBoardState({
    seed: 0x4655434f,
    controllers: { 'seat-1': 'human' }
  });

  if (storage) writeBoardState(storage, initial);
  return initial;
}

/**
 * BG2 state host. It is deliberately unconditional so wrapping the existing
 * application cannot unmount or recreate the protected map during play.
 */
export function BoardGameStateProvider({ children }: { children: ReactNode }) {
  const [state] = useState<BoardGameState>(initialiseBoardState);
  return <BoardGameStateContext.Provider value={state}>{children}</BoardGameStateContext.Provider>;
}

export function useBoardGameState(): BoardGameState {
  const state = useContext(BoardGameStateContext);
  if (!state) throw new Error('useBoardGameState must be used within BoardGameStateProvider');
  return state;
}

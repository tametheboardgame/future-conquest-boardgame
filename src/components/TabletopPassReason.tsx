import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { applyBoardAction } from '../game/board-action-dispatcher';
import { useBoardGameState } from './BoardGameStateProvider';

/** BG11A keeps the authoritative Pass preview visible beside the existing disabled control. */
export function TabletopPassReason() {
  const state = useBoardGameState();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const preview = applyBoardAction(state, { type: 'pass-activation' });
  const activeSeat = state.seats[state.activeSeat];
  const unavailable = activeSeat.controller !== 'human' || !preview.accepted;

  useEffect(() => {
    const resolveHost = () => setHost(document.querySelector<HTMLElement>('.tabletop-activation-actions'));
    resolveHost();
    const observer = new MutationObserver(resolveHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!host || !unavailable) return null;
  const reason = activeSeat.controller !== 'human'
    ? 'Pass Activation is unavailable while the computer controls the active seat.'
    : preview.reason;

  return createPortal(
    <small className="tabletop-action-unavailable" role="status" data-bg-feedback="BG11A">
      Pass unavailable: {reason}
    </small>,
    host
  );
}

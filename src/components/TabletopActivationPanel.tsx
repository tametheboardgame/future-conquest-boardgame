import { useEffect, useState } from 'react';
import { applyBoardAction } from '../game/board-state';
import { useBoardGameDispatch, useBoardGameState } from './BoardGameStateProvider';

type ActivationSnapshot = {
  visible: boolean;
  formation: string;
  target: string;
  canMove: boolean;
  canAttack: boolean;
};

const EMPTY: ActivationSnapshot = {
  visible: false,
  formation: 'Select a formation',
  target: 'Select a highlighted region',
  canMove: false,
  canAttack: false
};

function firstEnabledAction(selector: string): HTMLButtonElement | null {
  return [...document.querySelectorAll<HTMLButtonElement>(selector)]
    .find(button => !button.disabled) ?? null;
}

function readActivationSnapshot(): ActivationSnapshot {
  const contextPanel = document.querySelector<HTMLElement>('.map-context-panel');
  if (!contextPanel) return EMPTY;

  const formationSelect = contextPanel.querySelector<HTMLSelectElement>('.quick-command select');
  const formation = formationSelect?.selectedOptions[0]?.textContent?.trim() || 'Select a formation';
  const territoryHeading = contextPanel.querySelector<HTMLElement>('.territory-card h3')?.textContent?.trim();
  const move = firstEnabledAction('.map-context-panel [data-tutorial="move-action"]');
  const attack = firstEnabledAction('.map-context-panel [data-tutorial="attack-action"]');

  return {
    visible: true,
    formation,
    target: territoryHeading && territoryHeading !== 'No territory selected'
      ? territoryHeading
      : 'Select a highlighted region',
    canMove: Boolean(move),
    canAttack: Boolean(attack)
  };
}

function invokeLegacyAction(selector: string) {
  firstEnabledAction(selector)?.click();
}

/**
 * BG3E keeps the existing Move/Attack adapters while routing Pass through the
 * authoritative board dispatcher. Presentation asks the game layer whether a
 * Pass is legal; it does not calculate the turn result itself or touch the
 * protected map/render lifecycle.
 */
export function TabletopActivationPanel() {
  const [snapshot, setSnapshot] = useState<ActivationSnapshot>(EMPTY);
  const boardState = useBoardGameState();
  const dispatchBoardAction = useBoardGameDispatch();
  const activeSeat = boardState.seats[boardState.activeSeat];
  const passPreview = applyBoardAction(boardState, { type: 'pass-activation' });
  const canPass = activeSeat.controller === 'human' && passPreview.accepted;

  useEffect(() => {
    let frame: number | null = null;
    const sync = () => {
      frame = null;
      setSnapshot(readActivationSnapshot());
    };
    const scheduleSync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    document.addEventListener('click', scheduleSync, true);
    document.addEventListener('change', scheduleSync, true);
    document.addEventListener('keyup', scheduleSync, true);
    return () => {
      document.removeEventListener('click', scheduleSync, true);
      document.removeEventListener('change', scheduleSync, true);
      document.removeEventListener('keyup', scheduleSync, true);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!snapshot.visible) return null;

  return <aside className="tabletop-activation-panel" aria-label="Current activation" data-bg-package="BG3E">
    <header>
      <span>Current Activation</span>
      <strong>{activeSeat.controller === 'computer' ? 'Computer turn' : snapshot.canAttack ? 'Attack available' : snapshot.canMove ? 'Move available' : 'Choose action'}</strong>
    </header>

    <div className="tabletop-activation-piece">
      <small>Formation</small>
      <b>{snapshot.formation}</b>
      <small>Target</small>
      <b>{snapshot.target}</b>
    </div>

    <div className="tabletop-activation-actions" aria-label="Activation actions">
      <button type="button" className="move" disabled={!snapshot.canMove || activeSeat.controller !== 'human'} onClick={() => invokeLegacyAction('.map-context-panel [data-tutorial="move-action"]')}>Move</button>
      <button type="button" className="attack" disabled={!snapshot.canAttack || activeSeat.controller !== 'human'} onClick={() => invokeLegacyAction('.map-context-panel [data-tutorial="attack-action"]')}>Attack</button>
      <button type="button" disabled={!canPass} title={canPass ? 'Yield this activation without spending a Command Action' : passPreview.reason} onClick={() => dispatchBoardAction({ type: 'pass-activation' })}>Pass Activation</button>
    </div>

    <div className="tabletop-later-actions" aria-label="Later board game actions">
      <span>Recover</span><span>Engineer</span><span>Logistics</span>
    </div>
    <p>Pass is now an authoritative board action. Move and Attack remain connected to the retained simulation controls until BG4 replaces their action plumbing.</p>
  </aside>;
}

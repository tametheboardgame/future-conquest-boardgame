import { useEffect, useState } from 'react';

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
 * BG1C is a presentation adapter over the existing simulation controls.
 * It mirrors legal Move/Attack availability and delegates clicks to the same
 * authoritative handlers already owned by App. It does not calculate outcomes,
 * mutate campaign state directly, or touch the protected map/render lifecycle.
 */
export function TabletopActivationPanel() {
  const [snapshot, setSnapshot] = useState<ActivationSnapshot>(EMPTY);

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

  return <aside className="tabletop-activation-panel" aria-label="Current activation" data-bg-package="BG1C">
    <header>
      <span>Current Activation</span>
      <strong>{snapshot.canAttack ? 'Attack available' : snapshot.canMove ? 'Move available' : 'Choose action'}</strong>
    </header>

    <div className="tabletop-activation-piece">
      <small>Formation</small>
      <b>{snapshot.formation}</b>
      <small>Target</small>
      <b>{snapshot.target}</b>
    </div>

    <div className="tabletop-activation-actions" aria-label="Activation actions">
      <button type="button" className="move" disabled={!snapshot.canMove} onClick={() => invokeLegacyAction('.map-context-panel [data-tutorial="move-action"]')}>Move</button>
      <button type="button" className="attack" disabled={!snapshot.canAttack} onClick={() => invokeLegacyAction('.map-context-panel [data-tutorial="attack-action"]')}>Attack</button>
      <button type="button" disabled title="Alternating-activation passing becomes authoritative in BG3">Pass Activation</button>
    </div>

    <div className="tabletop-later-actions" aria-label="Later board game actions">
      <span>Recover</span><span>Engineer</span><span>Logistics</span>
    </div>
    <p>Move and Attack use the existing legal simulation actions during BG1. Pass, Recover, Engineer and Logistics become board actions in later packages.</p>
  </aside>;
}

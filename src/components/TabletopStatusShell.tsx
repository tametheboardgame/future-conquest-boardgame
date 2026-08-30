import { projectBoardStatus } from '../game/board-state-status';
import { useBoardGameState } from './BoardGameStateProvider';
import { TabletopCardHandPanel } from './TabletopCardHandPanel';
import { TabletopSupportPanel } from './TabletopSupportPanel';

/** Board-game chrome now reads its status directly from authoritative BG2 state. */
export function TabletopStatusShell() {
  const state = useBoardGameState();
  const status = projectBoardStatus(state);

  return <section
    className="tabletop-status-shell"
    aria-label="Board game status"
    data-bg-package="BG2D"
    data-bg-support="BG7"
    data-bg-cards="BG8"
  >
    <div className="tabletop-title-block">
      <span>FUTURE CONQUEST</span>
      <strong>THE CENTRAL FRONT</strong>
    </div>

    <dl className="tabletop-status-grid">
      <div><dt>Round</dt><dd>{status.round}</dd></div>
      <div><dt>Active seat</dt><dd>{status.activeSeat}</dd></div>
      <div><dt>Player</dt><dd>{status.activePlayer}</dd></div>
      <div><dt>Command actions</dt><dd>{status.commandActions}</dd></div>
      <div><dt>Phase</dt><dd>{status.phase}</dd></div>
      <div className="tabletop-activation-status"><dt>Activation</dt><dd>{status.activation}</dd></div>
    </dl>

    <TabletopCardHandPanel />
    <TabletopSupportPanel />
  </section>;
}

const BOARDGAME_SHELL_STATUS = {
  round: '1 / 8',
  activeSeat: 'Command Seat 1',
  activePlayer: 'Human',
  commandActions: '—',
  phase: 'Activation',
  activation: 'Select a formation'
} as const;

/**
 * BG1B is presentation-only. These labels establish the tabletop information
 * hierarchy without deriving new game rules from the legacy simulation state.
 * BG2/BG3 will replace these preview values with authoritative board state.
 */
export function TabletopStatusShell() {
  return <section className="tabletop-status-shell" aria-label="Board game status" data-bg-package="BG1B">
    <div className="tabletop-title-block">
      <span>FUTURE CONQUEST</span>
      <strong>THE CENTRAL FRONT</strong>
    </div>

    <dl className="tabletop-status-grid">
      <div><dt>Round</dt><dd>{BOARDGAME_SHELL_STATUS.round}</dd></div>
      <div><dt>Active seat</dt><dd>{BOARDGAME_SHELL_STATUS.activeSeat}</dd></div>
      <div><dt>Player</dt><dd>{BOARDGAME_SHELL_STATUS.activePlayer}</dd></div>
      <div><dt>Command actions</dt><dd title="Authoritative Command Actions arrive with the board-state packages">{BOARDGAME_SHELL_STATUS.commandActions}</dd></div>
      <div><dt>Phase</dt><dd>{BOARDGAME_SHELL_STATUS.phase}</dd></div>
      <div className="tabletop-activation-status"><dt>Activation</dt><dd>{BOARDGAME_SHELL_STATUS.activation}</dd></div>
    </dl>
  </section>;
}

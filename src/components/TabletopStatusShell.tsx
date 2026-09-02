import { projectBoardCampaignStatus } from '../game/board-campaign';
import { projectBoardStatus } from '../game/board-state-status';
import { useBoardGameState } from './BoardGameStateProvider';
import { TabletopCardHandPanel } from './TabletopCardHandPanel';
import { TabletopOnboarding } from './TabletopOnboarding';
import { TabletopPassReason } from './TabletopPassReason';
import { TabletopSupportPanel } from './TabletopSupportPanel';
import '../bg10-campaign-status.css';

/** Board-game chrome now reads its status directly from authoritative board state. */
export function TabletopStatusShell() {
  const state = useBoardGameState();
  const status = projectBoardStatus(state);
  const campaign = projectBoardCampaignStatus(state);

  return <section
    className="tabletop-status-shell"
    aria-label="Board game status"
    data-bg-package="BG2D"
    data-bg-support="BG7"
    data-bg-cards="BG8"
    data-bg-campaign="BG10"
    data-bg-onboarding="BG11A"
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
      <div
        className="tabletop-campaign-status"
        title={`${campaign.objectiveSummary}\n${campaign.rulesSummary}`}
      >
        <dt>Campaign</dt>
        <dd>{campaign.shortLabel}</dd>
      </div>
    </dl>

    {campaign.outcome !== 'in-progress' && <aside
      className={`tabletop-campaign-result ${campaign.outcome}`}
      role="status"
      aria-live="polite"
      data-campaign-outcome={campaign.outcome}
    >
      <span>CAMPAIGN COMPLETE</span>
      <strong>{campaign.outcomeLabel}</strong>
      <p>{campaign.reason}</p>
    </aside>}

    <TabletopCardHandPanel />
    <TabletopSupportPanel />
    <TabletopPassReason />
    <TabletopOnboarding />
  </section>;
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StartupExperience } from './components/StartupExperience';
import { TabletopStatusShell } from './components/TabletopStatusShell';
import { TabletopActivationPanel } from './components/TabletopActivationPanel';
import './styles.css';
import './command-panel-layout.css';
import './formation-organisation.css';
import './save-load.css';
import './europe-map.css';
import './command-interface.css';
import './map-interface-refinements.css';
import './mobile-map-corrections.css';
import './map-label-hierarchy.css';
import './strategic-network.css';
import './strategic-response.css';
import './enemy-strategy.css';
import './operational-clarity.css';
import './desktop-command-fit.css';
import './supply-network.css';
import './persistence-feedback';
import './engineering.css';
import './interdiction.css';
import './infrastructure-command.css';
import './logistics-priorities.css';
import './defence.css';
import './combat-reports.css';
import './map-readability.css';
import './r2-tactical-map.css';
import './r3-strategic-map.css';
import './r3-map-hierarchy.css';
import './r3-terrain-prototype.css';
import './responsive-command-fit.css';
import './r3-wp6-command-ui.css';
import './r3-wp6-pictorial-details.css';
import './r3-wp6-command-ui-refinements.css';
import './r3-wp6-secondary-ui.css';
import './r3-wp6-notification-disclosure.css';
import './r3-wp6-accessibility.css';
import './r3-wp6-5-interface-polish.css';
import './r3-wp6-6-command-shell-follow-up.css';
import './r4-usability-hotfix.css';
import './bg1-boardgame-shell.css';
import './bg1-current-activation.css';
import { installMapTrackpadGuard } from './map-trackpad-guard';
import { installR3MapVisualGrading } from './presentation/r3-map-visual-grading';
import { installWp6NotificationDisclosure } from './wp6-notification-disclosure';
import { installWp66WarningPreferences } from './wp66-warning-preferences';
import { installR4UsabilityHotfix } from './r4-usability-hotfix';

installMapTrackpadGuard();
installR3MapVisualGrading();
installWp6NotificationDisclosure();
installWp66WarningPreferences();
installR4UsabilityHotfix();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StartupExperience>
      <TabletopStatusShell />
      <App />
      <TabletopActivationPanel />
    </StartupExperience>
  </StrictMode>
);

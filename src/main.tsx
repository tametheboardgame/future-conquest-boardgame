import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StartupExperience } from './components/StartupExperience';
import { BoardGameStateProvider } from './components/BoardGameStateProvider';
import { TabletopLayout } from './components/TabletopLayout';
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
import './bg1-compact-navigation.css';
import './bg1-compact-guidance.css';
import './bg12d-legacy-presentation-quarantine.css';
import './bg12e-tabletop-layout.css';
import './bg12e-settings-access.css';
import { installMapTrackpadGuard } from './map-trackpad-guard';
import { installR3MapVisualGrading } from './presentation/r3-map-visual-grading';
import { installWp6NotificationDisclosure } from './wp6-notification-disclosure';
import { installWp66WarningPreferences } from './wp66-warning-preferences';
import { installR4UsabilityHotfix } from './r4-usability-hotfix';
import { installBg12dLegacyPresentationQuarantine } from './bg12d-legacy-presentation-quarantine';

installBg12dLegacyPresentationQuarantine();
installMapTrackpadGuard();
installR3MapVisualGrading();
installWp6NotificationDisclosure();
installWp66WarningPreferences();
installR4UsabilityHotfix();

const root = createRoot(document.getElementById('root')!);
const query = new URLSearchParams(window.location.search);
const bg12gR2bPrototype = query.get('bg12g-r2b') === '1';
const bg12gR2aPrototype = query.get('bg12g-r2a') === '1';

if (bg12gR2bPrototype) {
  const requestedLeft = Number(query.get('left') ?? '3');
  const requestedRight = Number(query.get('right') ?? '5');
  const leftFace = Number.isFinite(requestedLeft) ? requestedLeft : 3;
  const rightFace = Number.isFinite(requestedRight) ? requestedRight : 5;
  const autoPlay = query.get('autoplay') === '1';

  void import('./components/Bg12gR2bDiceMotionPrototype').then(({ Bg12gR2bDiceMotionPrototype }) => {
    root.render(
      <StrictMode>
        <Bg12gR2bDiceMotionPrototype
          leftFace={leftFace}
          rightFace={rightFace}
          autoPlay={autoPlay}
        />
      </StrictMode>
    );
  });
} else if (bg12gR2aPrototype) {
  const requestedFace = Number(query.get('face') ?? '1');
  const face = Number.isFinite(requestedFace)
    ? Math.max(1, Math.min(6, Math.round(requestedFace)))
    : 1;

  void import('./components/Bg12gR2aDicePrototype').then(({ Bg12gR2aDicePrototype }) => {
    root.render(
      <StrictMode>
        <Bg12gR2aDicePrototype face={face} />
      </StrictMode>
    );
  });
} else {
  root.render(
    <StrictMode>
      <StartupExperience>
        <BoardGameStateProvider>
          <TabletopLayout>
            <App />
          </TabletopLayout>
        </BoardGameStateProvider>
      </StartupExperience>
    </StrictMode>
  );
}

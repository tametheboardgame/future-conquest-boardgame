import { useEffect, useState, type ReactNode } from 'react';
import { TabletopActivationPanel } from './TabletopActivationPanel';
import { TabletopCardHandPanel } from './TabletopCardHandPanel';
import { TabletopCombatPanel } from './TabletopCombatPanel';
import { TabletopContextHint } from './TabletopContextHint';
import { TabletopFormationInteraction } from './TabletopFormationInteraction';
import { TabletopOnboarding } from './TabletopOnboarding';
import { TabletopPassReason } from './TabletopPassReason';
import { TabletopRulesReference } from './TabletopRulesReference';
import { TabletopStatusShell } from './TabletopStatusShell';
import { TabletopSupportPanel } from './TabletopSupportPanel';

type RailSurface = 'formation' | 'cards';

type Props = {
  children: ReactNode;
};

const RAIL_SURFACES: Array<{ id: RailSurface; label: string }> = [
  { id: 'formation', label: 'Actions' },
  { id: 'cards', label: 'Cards' }
];

function startsExpanded() {
  if (typeof window === 'undefined') return true;
  return !window.matchMedia('(max-width: 900px)').matches;
}

function isLegacyDiagnostics() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('legacy-ui') === '1';
}

/**
 * BG12E owns normal board-game composition around the preserved map.
 * BG12H replaces the old Turn / Combat / Support surface switcher with one
 * contextual formation action surface while retaining Cards as a physical
 * tabletop component. Legacy diagnostics keep the historical components.
 */
export function TabletopLayout({ children }: Props) {
  const legacyDiagnostics = isLegacyDiagnostics();
  const [railExpanded, setRailExpanded] = useState(startsExpanded);
  const [activeSurface, setActiveSurface] = useState<RailSurface>('formation');

  useEffect(() => {
    if (legacyDiagnostics) return;
    const compact = window.matchMedia('(max-width: 900px)');
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) setRailExpanded(false);
    };
    compact.addEventListener('change', handleViewportChange);
    return () => compact.removeEventListener('change', handleViewportChange);
  }, [legacyDiagnostics]);

  useEffect(() => {
    if (legacyDiagnostics) return;
    const interaction = document.querySelector<HTMLElement>('.bg12h-formation-interaction');
    if (!interaction) return;

    const revealAcceptedCompactSelection = () => {
      if (!window.matchMedia('(max-width: 900px)').matches) return;
      if (!interaction.dataset.selectedPiece) return;
      setActiveSurface('formation');
      setRailExpanded(true);
    };

    const observer = new MutationObserver(revealAcceptedCompactSelection);
    observer.observe(interaction, {
      attributes: true,
      attributeFilter: ['data-selected-piece']
    });
    revealAcceptedCompactSelection();

    return () => observer.disconnect();
  }, [legacyDiagnostics]);

  if (legacyDiagnostics) {
    return <>
      <TabletopStatusShell />
      {children}
      <TabletopContextHint />
      <TabletopCardHandPanel />
      <TabletopSupportPanel />
      <TabletopPassReason />
      <TabletopRulesReference />
      <TabletopOnboarding />
      <TabletopCombatPanel />
      <TabletopActivationPanel />
    </>;
  }

  return <div
    className="bg12e-tabletop-layout"
    data-bg-package="BG12E"
    data-bg-formation-interaction="BG12H"
    data-rail-state={railExpanded ? 'expanded' : 'collapsed'}
  >
    <div className="bg12e-status-zone">
      <TabletopStatusShell />
    </div>

    <div className="bg12e-board-zone" data-tabletop-zone="board">
      {children}
    </div>

    <aside className="bg12e-tabletop-rail" aria-label="Tabletop rail" data-tabletop-zone="rail">
      <button
        type="button"
        className="bg12e-rail-toggle"
        aria-expanded={railExpanded}
        aria-controls="bg12e-rail-content"
        onClick={() => setRailExpanded(current => !current)}
      >
        <span aria-hidden="true">{railExpanded ? '›' : '‹'}</span>
        <b>{railExpanded ? 'Close rail' : 'Open rail'}</b>
      </button>

      <div
        id="bg12e-rail-content"
        className="bg12e-rail-content"
        hidden={!railExpanded}
        aria-hidden={!railExpanded}
      >
        <nav className="bg12e-rail-switcher" aria-label="Tabletop components">
          {RAIL_SURFACES.map(surface => <button
            key={surface.id}
            type="button"
            className={activeSurface === surface.id ? 'active' : ''}
            aria-pressed={activeSurface === surface.id}
            onClick={() => setActiveSurface(surface.id)}
          >
            {surface.label}
          </button>)}
        </nav>

        <div className="bg12e-context-zone" data-active-surface={activeSurface}>
          <div
            className="bg12e-context-surface"
            data-surface="formation"
            hidden={activeSurface !== 'formation'}
            aria-hidden={activeSurface !== 'formation'}
          >
            <TabletopFormationInteraction />
          </div>
          {activeSurface === 'cards' && <div className="bg12e-context-surface" data-surface="cards">
            <TabletopCardHandPanel />
          </div>}
        </div>
      </div>
    </aside>

    <div className="bg12e-secondary-utilities" data-tabletop-zone="utilities">
      <TabletopContextHint />
      <TabletopRulesReference />
      <TabletopOnboarding />
    </div>
  </div>;
}

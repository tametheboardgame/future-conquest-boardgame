import { useEffect, useState, type ReactNode } from 'react';
import { TabletopActivationPanel } from './TabletopActivationPanel';
import { TabletopCardHandPanel } from './TabletopCardHandPanel';
import { TabletopCombatPanel } from './TabletopCombatPanel';
import { TabletopContextHint } from './TabletopContextHint';
import { TabletopOnboarding } from './TabletopOnboarding';
import { TabletopPassReason } from './TabletopPassReason';
import { TabletopRulesReference } from './TabletopRulesReference';
import { TabletopStatusShell } from './TabletopStatusShell';
import { TabletopSupportPanel } from './TabletopSupportPanel';

type RailSurface = 'activation' | 'combat' | 'cards' | 'support';

type Props = {
  children: ReactNode;
};

const RAIL_SURFACES: Array<{ id: RailSurface; label: string }> = [
  { id: 'activation', label: 'Turn' },
  { id: 'combat', label: 'Combat' },
  { id: 'cards', label: 'Cards' },
  { id: 'support', label: 'Support' }
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
 * Existing authoritative interaction components are deliberately retained,
 * but only one rail interaction surface is mounted at a time.
 *
 * BG12D's explicit legacy diagnostics route bypasses BG12E composition so the
 * quarantined historical workspaces and their browser probes keep the geometry
 * they had before the tabletop rebuild.
 */
export function TabletopLayout({ children }: Props) {
  const legacyDiagnostics = isLegacyDiagnostics();
  const [railExpanded, setRailExpanded] = useState(startsExpanded);
  const [activeSurface, setActiveSurface] = useState<RailSurface>('activation');

  useEffect(() => {
    if (legacyDiagnostics) return;
    const compact = window.matchMedia('(max-width: 900px)');
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) setRailExpanded(false);
    };
    compact.addEventListener('change', handleViewportChange);
    return () => compact.removeEventListener('change', handleViewportChange);
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

      {railExpanded && <div id="bg12e-rail-content" className="bg12e-rail-content">
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
          {activeSurface === 'activation' && <div className="bg12e-context-surface" data-surface="activation">
            <TabletopActivationPanel />
            <TabletopPassReason />
          </div>}
          {activeSurface === 'combat' && <div className="bg12e-context-surface" data-surface="combat">
            <TabletopCombatPanel />
          </div>}
          {activeSurface === 'cards' && <div className="bg12e-context-surface" data-surface="cards">
            <TabletopCardHandPanel />
          </div>}
          {activeSurface === 'support' && <div className="bg12e-context-surface" data-surface="support">
            <TabletopSupportPanel />
          </div>}
        </div>
      </div>}
    </aside>

    <div className="bg12e-secondary-utilities" data-tabletop-zone="utilities">
      <TabletopContextHint />
      <TabletopRulesReference />
      <TabletopOnboarding />
    </div>
  </div>;
}
export type CommandView = 'map' | 'forces' | 'operations' | 'territories' | 'engineering' | 'logistics' | 'intelligence' | 'campaign';

interface Props {
  active: CommandView;
  onChange: (view: CommandView) => void;
  badges: Partial<Record<CommandView, string | number>>;
}

type NavigationItem = { id: CommandView; code: string; label: string };

const PRIMARY_ITEMS: NavigationItem[] = [
  { id: 'map', code: 'BRD', label: 'Board' },
  { id: 'forces', code: 'FRC', label: 'Forces' },
  { id: 'operations', code: 'CBT', label: 'Combat' },
  { id: 'campaign', code: 'SYS', label: 'Rules & Save' }
];

const LEGACY_ITEMS: NavigationItem[] = [
  { id: 'territories', code: 'REG', label: 'Regions' },
  { id: 'engineering', code: 'ENG', label: 'Engineer' },
  { id: 'logistics', code: 'LOG', label: 'Logistics' },
  { id: 'intelligence', code: 'INT', label: 'Intel' }
];

function CommandIcon({ view }: { view: CommandView }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (view === 'map') return <svg {...common}><path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2Z"/><path d="M8 4v13M16 7v13"/><circle cx="13" cy="11" r="1.7"/></svg>;
  if (view === 'forces') return <svg {...common}><path d="M12 3 7.5 5v5.2c0 4.1 1.9 7.7 4.5 9.8 2.6-2.1 4.5-5.7 4.5-9.8V5Z"/><path d="M9.3 10.5h5.4M12 7.8v5.4"/></svg>;
  if (view === 'operations') return <svg {...common}><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>;
  if (view === 'territories') return <svg {...common}><path d="M4 18V7l5-3 4 3 7-2v11l-7 3-4-3Z"/><path d="m9 4v12M13 7v12"/></svg>;
  if (view === 'engineering') return <svg {...common}><path d="M4 18h16M6 18V9h12v9M8 9l4-4 4 4"/><path d="M9 18v-4h6v4M3 12h3M18 12h3"/></svg>;
  if (view === 'logistics') return <svg {...common}><path d="M3 7h11v9H3zM14 10h3l3 3v3h-6z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M5 4h7"/></svg>;
  if (view === 'intelligence') return <svg {...common}><path d="M3.5 12s3.2-5 8.5-5 8.5 5 8.5 5-3.2 5-8.5 5-8.5-5-8.5-5Z"/><circle cx="12" cy="12" r="2.4"/><path d="M18.2 5.8 20 4M5.8 5.8 4 4"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>;
}

function CardsIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3" width="12" height="16" rx="1.5"/><path d="m8 7 6 0M8 11h6M8 15h4"/><path d="m17 6 2 1v13H8l-1-1"/></svg>;
}

export function CommandNavigation({ active, onChange, badges }: Props) {
  const renderItem = (item: NavigationItem) => {
    const badge = badges[item.id];
    return <button type="button" key={item.id} className={active === item.id ? 'active' : ''} aria-current={active === item.id ? 'page' : undefined} title={item.label} onClick={() => onChange(active === item.id && item.id !== 'map' ? 'map' : item.id)} data-command-view={item.id}>
      <span className="command-nav-icon"><CommandIcon view={item.id} /></span><span className="command-nav-code" aria-hidden="true">{item.code}</span><span className="command-nav-label">{item.label}</span>{badge !== undefined && <span className="command-nav-badge" aria-label={`${badge} items`}>{badge}</span>}
    </button>;
  };
  const legacyActive = LEGACY_ITEMS.some(item => item.id === active);

  return <nav className="command-navigation" aria-label="Board game views" data-bg-package="BG1D">
    <div className="command-brand" aria-hidden="true"><strong>FC</strong><span>CENTRAL FRONT</span></div>
    <div className="command-nav-items command-nav-primary">
      {PRIMARY_ITEMS.slice(0, 3).map(renderItem)}
      <button type="button" className="command-nav-cards" disabled title="Cards become playable in BG8" aria-label="Cards, coming later">
        <span className="command-nav-icon"><CardsIcon /></span><span className="command-nav-code" aria-hidden="true">CRD</span><span className="command-nav-label">Cards</span>
      </button>
      {PRIMARY_ITEMS.slice(3).map(renderItem)}
    </div>
    <details className="command-nav-legacy" open={legacyActive || undefined}>
      <summary title="Legacy simulation views"><span aria-hidden="true">•••</span><b>More</b></summary>
      <div className="command-nav-items command-nav-legacy-items">{LEGACY_ITEMS.map(renderItem)}</div>
    </details>
    <div className="command-nav-footer"><i /> TABLE LINK</div>
  </nav>;
}

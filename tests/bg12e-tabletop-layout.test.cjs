const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG12E gives normal board play one page-composition owner', () => {
  const main = read('src/main.tsx');
  const layout = read('src/components/TabletopLayout.tsx');

  assert.match(main, /<TabletopLayout>[\s\S]*?<App \/>[\s\S]*?<\/TabletopLayout>/);
  assert.doesNotMatch(main, /<TabletopStatusShell \/>/);
  assert.doesNotMatch(main, /<TabletopCombatPanel \/>/);
  assert.doesNotMatch(main, /<TabletopActivationPanel \/>/);

  assert.match(layout, /data-bg-package="BG12E"/);
  assert.match(layout, /data-tabletop-zone="board"/);
  assert.match(layout, /data-tabletop-zone="rail"/);
  assert.match(layout, /data-tabletop-zone="utilities"/);
  assert.doesNotMatch(layout, /\.\.\/game\//, 'layout owner must not absorb authoritative game rules');
});

test('BG12E keeps exactly one retained rail interaction surface mounted', () => {
  const layout = read('src/components/TabletopLayout.tsx');

  for (const [surface, component] of [
    ['activation', 'TabletopActivationPanel'],
    ['combat', 'TabletopCombatPanel'],
    ['cards', 'TabletopCardHandPanel'],
    ['support', 'TabletopSupportPanel']
  ]) {
    assert.match(
      layout,
      new RegExp(`activeSurface === '${surface}'[\\s\\S]*?<${component} \\/>`),
      `${surface} must be gated by the single active rail surface`
    );
  }

  assert.match(layout, /type RailSurface = 'activation' \| 'combat' \| 'cards' \| 'support'/);
  assert.match(layout, /data-active-surface=\{activeSurface\}/);
});

test('BG12E enforces desktop surface budgets and keeps the map outside the rail', () => {
  const css = read('src/bg12e-tabletop-layout.css');

  assert.match(css, /--bg12e-status-height:\s*48px;/);
  assert.match(css, /--bg12e-rail-width:\s*min\(320px, 24vw\);/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) var\(--bg12e-rail-width\);/);
  assert.match(css, /\.bg12e-board-zone\s*\{[\s\S]*?grid-column:\s*1;/);
  assert.match(css, /\.bg12e-tabletop-rail\s*\{[\s\S]*?grid-column:\s*2;/);
  assert.match(css, /\.bg12e-board-zone > \.command-app-shell\s*\{[\s\S]*?height:\s*100% !important;/);
  assert.match(css, /data-rail-state="collapsed"[\s\S]*?--bg12e-rail-width:\s*44px;/);
});

test('BG12E compact mode becomes a collapsed-by-default bottom tabletop drawer', () => {
  const layout = read('src/components/TabletopLayout.tsx');
  const css = read('src/bg12e-tabletop-layout.css');

  assert.match(layout, /matchMedia\('\(max-width: 900px\)'\)/);
  assert.match(layout, /return !window\.matchMedia\('\(max-width: 900px\)'\)\.matches;/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?--bg12e-status-height:\s*64px;/);
  assert.match(css, /--bg12e-rail-height:\s*min\(46dvh, 390px\);/);
  assert.match(css, /grid-template-rows:\s*var\(--bg12e-status-height\) minmax\(0, 1fr\) var\(--bg12e-rail-height\);/);
  assert.match(css, /data-rail-state="collapsed"[\s\S]*?--bg12e-rail-height:\s*48px;/);
});

test('BG12E turns retained fixed overlays into reserved rail content', () => {
  const css = read('src/bg12e-tabletop-layout.css');

  for (const selector of [
    '.tabletop-activation-panel',
    '.tabletop-combat-panel',
    '.tabletop-card-hand',
    '.tabletop-support-panel'
  ]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(css, new RegExp(`\\.bg12e-tabletop-rail ${escaped}`));
  }

  assert.match(css, /position:\s*relative !important;/);
  assert.match(css, /z-index:\s*auto !important;/);
  assert.match(css, /width:\s*100% !important;/);
});

test('BG12E keeps only core board navigation persistent and retains direct Settings access', () => {
  const layoutCss = read('src/bg12e-tabletop-layout.css');
  const quarantineCss = read('src/bg12d-legacy-presentation-quarantine.css');
  const navigation = read('src/components/CommandNavigation.tsx');
  const startup = read('src/components/StartupExperience.tsx');

  assert.match(navigation, /id: 'map'[\s\S]*?label: 'Board'/);
  assert.match(navigation, /id: 'forces'[\s\S]*?label: 'Forces'/);
  assert.match(navigation, /id: 'campaign'[\s\S]*?label: 'Rules & Save'/);
  assert.match(layoutCss, /html\.bg12d-board-ui \.command-nav-cards\s*\{[\s\S]*?display:\s*none !important;/);
  assert.match(quarantineCss, /\.command-nav-primary \[data-command-view="operations"\]/);
  assert.match(startup, /className="global-settings-toggle"/);
  assert.match(startup, /aria-label="Open game settings"/);
});
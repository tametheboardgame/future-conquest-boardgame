const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => fs.readFileSync(path, 'utf8');

const installer = read('src/bg12d-legacy-presentation-quarantine.ts');
const css = read('src/bg12d-legacy-presentation-quarantine.css');
const main = read('src/main.tsx');
const browserProbe = read('scripts/probe-bg12d-legacy-quarantine.mjs');
const wp6 = read('.github/workflows/r3-wp6-command-ui.yml');
const wp65 = read('.github/workflows/r3-wp6-5-interface-polish.yml');
const wp9 = read('.github/workflows/r3-wp9-integrated-validation.yml');

test('BG12D diagnostics access is explicit and normal board mode is the default', () => {
  assert.match(installer, /BG12D_LEGACY_UI_QUERY = 'legacy-ui'/);
  assert.match(installer, /\.get\(BG12D_LEGACY_UI_QUERY\) === '1'/);
  assert.match(installer, /classList\.toggle\('bg12d-board-ui', !legacyUi\)/);
  assert.match(installer, /classList\.toggle\('bg12d-legacy-ui', legacyUi\)/);
  assert.match(installer, /legacyUi \? 'legacy-diagnostics' : 'board-game'/);

  assert.match(main, /import '\.\/bg12d-legacy-presentation-quarantine\.css';/);
  assert.match(main, /installBg12dLegacyPresentationQuarantine/);
  assert.ok(main.indexOf('installBg12dLegacyPresentationQuarantine();') < main.indexOf('createRoot('), 'presentation mode must install before React renders');
});

test('BG12D hides legacy navigation and operational map chrome only in normal play', () => {
  for (const selector of [
    '.command-nav-legacy',
    '[data-command-view="operations"]',
    '.command-app-shell > .command-topbar',
    '.command-map-workspace .map-heading',
    '.command-map-workspace .map-context-panel',
    '.operational-alert-strip',
    '.enemy-action-alert',
    '.adviser-alert-strip',
    '.combat-report-alert',
    '.command-outcome'
  ]) {
    assert.ok(css.includes(`html.bg12d-board-ui ${selector}`), `normal-play quarantine missing ${selector}`);
  }

  assert.match(css, /html\.bg12d-board-ui \.command-map-workspace \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;/);
  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\) !important;/);
  assert.doesNotMatch(css, /html\.bg12d-legacy-ui[\s\S]*display:\s*none/);
});

test('BG12D browser acceptance proves normal absence and diagnostics availability', () => {
  assert.match(browserProbe, /startCampaign\(normal, '\?terrain=1'\)/);
  assert.match(browserProbe, /startCampaign\(diagnostics, '\?terrain=1&legacy-ui=1'\)/);
  assert.match(browserProbe, /legacy More gateway is visible in normal play/);
  assert.match(browserProbe, /legacy operational topbar is visible in normal play/);
  assert.match(browserProbe, /map did not reclaim the quarantined sidebar width/);
  assert.match(browserProbe, /diagnostics route lost the legacy workspace gateway/);
  assert.match(browserProbe, /\[data-command-view=\\"engineering\\"\]/);
});

test('historical browser validation opts into the explicit diagnostics route', () => {
  for (const [name, workflow] of [['WP6', wp6], ['WP6.5', wp65], ['WP9', wp9]]) {
    assert.match(workflow, /legacy-ui=1/, `${name} does not opt historical probes into diagnostics mode`);
  }
  assert.match(wp9, /probe-bg12d-legacy-quarantine\.mjs/);
});

test('BG12D remains presentation-only', () => {
  const protectedTerms = [
    'dispatchBoardAction',
    'previewBoardAction',
    'resolveBoardCombat',
    'getBoardMoveDestinations',
    'projectBoardStateForRenderer'
  ];
  for (const term of protectedTerms) {
    assert.ok(!installer.includes(term) && !css.includes(term), `presentation quarantine must not own ${term}`);
  }
});

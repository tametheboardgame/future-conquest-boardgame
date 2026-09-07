const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const main = fs.readFileSync('src/main.tsx', 'utf8');
const behaviour = fs.readFileSync('src/bg12k-secondary-drawers.ts', 'utf8');
const css = fs.readFileSync('src/bg12k-secondary-drawers.css', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const navigation = fs.readFileSync('src/components/CommandNavigation.tsx', 'utf8');
const startup = fs.readFileSync('src/components/StartupExperience.tsx', 'utf8');
const settings = fs.readFileSync('src/components/GlobalSettingsPanel.tsx', 'utf8');
const packageDoc = fs.readFileSync('docs/BG12K-SECONDARY-DRAWERS.md', 'utf8');
const capture = fs.readFileSync('scripts/capture-bg12k-secondary-drawers.mjs', 'utf8');
const workflow = fs.readFileSync('.github/workflows/bg12k-secondary-drawers.yml', 'utf8');

test('BG12K installs as a presentation package after the legacy quarantine', () => {
  assert.match(main, /import '\.\/bg12k-secondary-drawers\.css'/);
  assert.match(main, /import \{ installBg12kSecondaryDrawers \} from '\.\/bg12k-secondary-drawers'/);
  assert.match(main, /installBg12dLegacyPresentationQuarantine\(\);\s*installBg12kSecondaryDrawers\(\);/);
});

test('BG12K retains existing Forces and Rules & Save authority', () => {
  assert.match(navigation, /id: 'forces'[\s\S]*label: 'Forces'/);
  assert.match(navigation, /id: 'campaign'[\s\S]*label: 'Rules & Save'/);
  assert.match(app, /currentView === 'forces'/);
  assert.match(app, /<FormationRoster/);
  assert.match(app, /<ForceOrganisationPanel/);
  assert.match(app, /currentView === 'campaign'/);
  assert.match(app, /Manual Save/);
  assert.match(app, /Load Manual Save/);
  assert.match(app, /Load Autosave/);
  assert.match(packageDoc, /presentation-only/i);
});

test('BG12K preserves board context as an inert non-interactive underlay', () => {
  assert.match(behaviour, /SECONDARY_VIEWS = new Set\(\['forces', 'campaign'\]\)/);
  assert.match(behaviour, /\.command-app-shell \.command-stage-map/);
  assert.match(behaviour, /cloneMapStage/);
  assert.match(behaviour, /dataset\.bg12kMapUnderlay = 'true'/);
  assert.match(behaviour, /setAttribute\('aria-hidden', 'true'\)/);
  assert.match(behaviour, /setAttribute\('inert', ''\)/);
  assert.match(behaviour, /removeAttribute\('id'\)/);
  assert.match(css, /\.bg12e-board-zone > \.bg12k-map-underlay[\s\S]*pointer-events: none !important/);
  assert.match(css, /command-app-shell:has\(\.command-stage-forces\)[\s\S]*background: transparent !important/);
});

test('BG12K drawers are bounded, directional and internally scrollable', () => {
  assert.match(css, /command-stage-forces \.forces-view[\s\S]*position: fixed/);
  assert.match(css, /command-stage-forces \.forces-view \{\s*left: 54px/);
  assert.match(css, /command-stage-campaign \.campaign-view \{\s*right: calc\(var\(--bg12e-rail-width, 44px\) \+ 8px\)/);
  assert.match(css, /width: clamp\(292px, 31vw, 430px\)/);
  assert.match(css, /overflow: auto/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*width: min\(360px, calc\(100vw - 68px\)\)/);
  assert.match(css, /bottom: calc\(var\(--bg12e-rail-height, 48px\) \+ 8px\)/);
});

test('BG12K keeps the existing Settings architecture and prevents stacked aides', () => {
  assert.match(startup, /<GlobalSettingsPanel/);
  assert.match(startup, /className="global-settings-toggle"/);
  assert.match(settings, /role="dialog"/);
  assert.match(settings, /aria-labelledby="global-settings-title"/);
  assert.match(css, /startup-game-shell:not\(\.launcher-covered\) ~ \.global-settings-backdrop/);
  assert.match(css, /body:has\(\.command-stage-forces\) \.global-settings-toggle/);
  assert.match(css, /body:has\(\.command-stage-campaign\) \.global-settings-toggle/);
  assert.match(css, /body:has\(\.global-settings-panel\) \.command-navigation[\s\S]*pointer-events: none !important/);
  assert.match(packageDoc, /Only one secondary aide/i);
});

test('BG12K Escape handling closes Settings first and otherwise returns a secondary view to Board', () => {
  assert.match(behaviour, /event\.key !== 'Escape'/);
  assert.match(behaviour, /\.global-settings-panel \.settings-close/);
  assert.match(behaviour, /settingsClose\.click\(\)/);
  assert.match(behaviour, /data-command-view=.*\$\{view\}/);
  assert.match(behaviour, /requestAnimationFrame\(sync\)/);
});

test('BG12K does not take gameplay or settings persistence ownership', () => {
  assert.doesNotMatch(behaviour, /from ['"].*game\//);
  assert.doesNotMatch(behaviour, /newGame|endTurn|beginOperation|issueMove|saveGame|loadGame|dispatchBoardAction/);
  assert.doesNotMatch(behaviour, /localStorage|sessionStorage/);
  assert.match(packageDoc, /does not add or change combat, movement, logistics, save semantics/i);
  assert.match(packageDoc, /StartupExperience.*GlobalSettingsPanel.*remain authoritative for Settings/s);
});

test('BG12K browser gate covers desktop, laptop and compact drawer behaviour', () => {
  assert.match(capture, /1900, height: 829/);
  assert.match(capture, /1366, height: 768/);
  assert.match(capture, /640, height: 900/);
  assert.match(capture, /data-command-view=.*forces/);
  assert.match(capture, /data-command-view=.*campaign/);
  assert.match(capture, /bg12k-map-underlay/);
  assert.match(capture, /Open game settings/);
  assert.match(capture, /singleAideCount/);
  assert.match(capture, /horizontal overflow/);
});

test('BG12K workflow validates exact head, protected contracts, full regression, build and evidence', () => {
  assert.match(workflow, /BG12K_REF: \$\{\{ github\.event_name == 'pull_request'/);
  assert.match(workflow, /ref: \$\{\{ env\.BG12K_REF \}\}/);
  assert.match(workflow, /tests\/bg12k-secondary-drawers\.test\.cjs/);
  assert.match(workflow, /tests\/bg12j-coach-mark-onboarding\.test\.cjs/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /capture-bg12k-secondary-drawers\.mjs/);
  assert.match(workflow, /artifacts\/bg12k/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG1B presents the tabletop campaign status hierarchy without inventing board rules', () => {
  const shell = read('src/components/TabletopStatusShell.tsx');

  assert.match(shell, /FUTURE CONQUEST/);
  assert.match(shell, /THE CENTRAL FRONT/);
  assert.match(shell, /round: '1 \/ 8'/);
  assert.match(shell, /activeSeat: 'Command Seat 1'/);
  assert.match(shell, /activePlayer: 'Human'/);
  assert.match(shell, /commandActions: '—'/);
  assert.match(shell, /phase: 'Activation'/);
  assert.match(shell, /activation: 'Select a formation'/);
  assert.match(shell, /BG2\/BG3 will replace these preview values with authoritative board state/);
});

test('BG1B mounts before the legacy app and its CSS wins after the old shell styles', () => {
  const main = read('src/main.tsx');

  assert.match(main, /import \{ TabletopStatusShell \} from '\.\/components\/TabletopStatusShell'/);
  assert.ok(main.indexOf("./bg1-boardgame-shell.css") > main.indexOf("./r4-usability-hotfix.css"));
  assert.ok(main.indexOf('<TabletopStatusShell />') < main.indexOf('<App />'));
});

test('BG1B removes simulation KPIs from normal presentation but keeps transition playability', () => {
  const css = read('src/bg1-boardgame-shell.css');
  const app = read('src/App.tsx');

  assert.match(css, /\.command-app-shell > \.command-metrics\s*\{[\s\S]*display:\s*none !important/);
  assert.match(css, /\.command-app-shell > \.command-topbar > div:first-child[\s\S]*\.turn-block[\s\S]*display:\s*none/);
  assert.match(css, /\.command-app-shell > \.command-topbar \.global-resolve/);
  assert.match(app, /Resolve all orders · day \{state\.turn\}/);
});

test('BG1B leaves the protected map and renderer integration in App', () => {
  const shell = read('src/components/TabletopStatusShell.tsx');
  const app = read('src/App.tsx');

  assert.doesNotMatch(shell, /MapView|TerrainMapPrototype|maplibre|WebGL/);
  assert.match(app, /<TerrainMapPrototype/);
  assert.match(app, /<MapView/);
  assert.match(app, /loadTerrainMapModule/);
});

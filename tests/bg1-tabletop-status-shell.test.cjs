const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG2D preserves the tabletop hierarchy while binding status to authoritative board state', () => {
  const shell = read('src/components/TabletopStatusShell.tsx');

  assert.match(shell, /FUTURE CONQUEST/);
  assert.match(shell, /THE CENTRAL FRONT/);
  assert.match(shell, /useBoardGameState/);
  assert.match(shell, /projectBoardStatus\(state\)/);
  assert.match(shell, /status\.round/);
  assert.match(shell, /status\.activeSeat/);
  assert.match(shell, /status\.activePlayer/);
  assert.match(shell, /status\.commandActions/);
  assert.match(shell, /status\.phase/);
});

test('BG2D mounts one unconditional board-state provider around the BG12E layout and existing app', () => {
  const main = read('src/main.tsx');
  const layout = read('src/components/TabletopLayout.tsx');
  const provider = read('src/components/BoardGameStateProvider.tsx');

  assert.match(main, /import \{ BoardGameStateProvider \} from '\.\/components\/BoardGameStateProvider'/);
  assert.match(main, /<BoardGameStateProvider>[\s\S]*?<TabletopLayout>[\s\S]*?<App \/>[\s\S]*?<\/TabletopLayout>[\s\S]*?<\/BoardGameStateProvider>/);
  assert.match(layout, /<TabletopStatusShell \/>/);
  assert.doesNotMatch(provider, /\{state\s*&&\s*children\}|state\s*\?\s*children/);
  assert.match(provider, /useState<BoardGameState>\(initialiseBoardState\)/);
});

test('BG1B removes simulation KPIs from normal presentation but keeps transition playability', () => {
  const css = read('src/bg1-boardgame-shell.css');
  const app = read('src/App.tsx');

  assert.match(css, /\.command-app-shell > \.command-metrics\s*\{[\s\S]*display:\s*none !important/);
  assert.match(css, /\.command-app-shell > \.command-topbar > div:first-child[\s\S]*\.turn-block[\s\S]*display:\s*none/);
  assert.match(css, /\.command-app-shell > \.command-topbar \.global-resolve/);
  assert.match(app, /Resolve all orders · day \{state\.turn\}/);
});

test('BG2D leaves the protected map and renderer integration in App', () => {
  const shell = read('src/components/TabletopStatusShell.tsx');
  const provider = read('src/components/BoardGameStateProvider.tsx');
  const layout = read('src/components/TabletopLayout.tsx');
  const app = read('src/App.tsx');

  assert.doesNotMatch(shell, /MapView|TerrainMapPrototype|maplibre|WebGL/);
  assert.doesNotMatch(provider, /MapView|TerrainMapPrototype|maplibre|WebGL/);
  assert.doesNotMatch(layout, /MapView|TerrainMapPrototype|maplibre|WebGL/);
  assert.match(app, /<TerrainMapPrototype/);
  assert.match(app, /<MapView/);
  assert.match(app, /loadTerrainMapModule/);
});
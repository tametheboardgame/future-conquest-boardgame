const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('activation panel retains the board-game action hierarchy', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.match(panel, /Current Activation/);
  assert.match(panel, />Move<\/button>/);
  assert.match(panel, />Attack<\/button>/);
  assert.match(panel, />Pass Activation<\/button>/);
  assert.match(panel, /Recover/);
  assert.match(panel, /Engineer/);
  assert.match(panel, /Logistics/);
});

test('Move and Attack still delegate to retained App controls while Pass uses the board dispatcher', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.match(panel, /\.map-context-panel \[data-tutorial="move-action"\]/);
  assert.match(panel, /\.map-context-panel \[data-tutorial="attack-action"\]/);
  assert.match(panel, /firstEnabledAction/);
  assert.match(panel, /\.click\(\)/);
  assert.match(panel, /useBoardGameDispatch/);
  assert.match(panel, /applyBoardAction\(boardState, \{ type: 'pass-activation' \}\)/);
  assert.match(panel, /dispatchBoardAction\(\{ type: 'pass-activation' \}\)/);
  assert.doesNotMatch(panel, /Alternating-activation passing becomes authoritative in BG3/);
});

test('activation panel delegates board legality and does not touch renderer infrastructure', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.match(panel, /from ['"]\.\.\/game\/board-state['"]/);
  assert.doesNotMatch(panel, /MapView|TerrainMapPrototype|maplibre|WebGL|newGame|issueMove|beginOperation/);
  assert.match(panel, /does not calculate the turn result itself/);
  assert.match(panel, /protected map\/render lifecycle/);
});

test('activation panel remains mounted adjacent to the retained app under the board provider', () => {
  const main = read('src/main.tsx');

  assert.match(main, /BoardGameStateProvider/);
  assert.match(main, /TabletopStatusShell/);
  assert.match(main, /TabletopActivationPanel/);
  assert.match(main, /<TabletopStatusShell \/>\s*<App \/>\s*<TabletopActivationPanel \/>/);
  assert.match(main, /bg1-current-activation\.css/);
});

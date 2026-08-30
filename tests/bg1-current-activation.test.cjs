const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('activation panel retains the board-game action hierarchy as Move becomes map-driven and combat moves to its own panel', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.match(panel, /Current Activation/);
  assert.match(panel, /Move destinations/);
  assert.match(panel, /Move preview/);
  assert.match(panel, /Confirm Move/);
  assert.doesNotMatch(panel, />Move<\/button>/);
  assert.doesNotMatch(panel, />Attack<\/button>/);
  assert.match(panel, />Pass Activation<\/button>/);
  assert.match(panel, /Recover/);
  assert.match(panel, /Engineer/);
  assert.match(panel, /Logistics/);
});

test('Move and Pass use the authoritative board dispatcher without a temporary combat adapter', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.doesNotMatch(panel, /\.map-context-panel \[data-tutorial="move-action"\]/);
  assert.doesNotMatch(panel, /\.map-context-panel \[data-tutorial="attack-action"\]/);
  assert.match(panel, /getBoardMoveDestinations/);
  assert.match(panel, /type: 'move-piece'/);
  assert.match(panel, /destinationSpaceId: pendingDestinationSpaceId/);
  assert.match(panel, /useBoardGameDispatch/);
  assert.match(panel, /applyBoardAction\(boardState, \{ type: 'pass-activation' \}\)/);
  assert.match(panel, /dispatchBoardAction\(\{ type: 'pass-activation' \}\)/);
});

test('activation panel keeps board rules authoritative while using retained renderer hooks', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.match(panel, /from ['"]\.\.\/game\/board-state['"]/);
  assert.match(panel, /getBoardMoveDestinations\(boardState, pieceId\)/);
  assert.match(panel, /__r3TerrainMap/);
  assert.match(panel, /\.r3-terrain-task-group-marker\[data-group-id\]/);
  assert.match(panel, /\.task-group-marker/);
  assert.doesNotMatch(panel, /import .*MapView|import .*TerrainMapPrototype|new maplibregl\.Map|newGame|issueMove|beginOperation/);
  assert.match(panel, /data-bg-package="BG3E"/);
  assert.match(panel, /data-bg-movement="BG4C"/);
});

test('board action panels remain mounted adjacent to the retained app under the board provider', () => {
  const main = read('src/main.tsx');

  assert.match(main, /BoardGameStateProvider/);
  assert.match(main, /TabletopStatusShell/);
  assert.match(main, /TabletopCombatPanel/);
  assert.match(main, /TabletopActivationPanel/);
  assert.match(main, /<TabletopStatusShell \/>\s*<App \/>\s*<TabletopCombatPanel \/>\s*<TabletopActivationPanel \/>/);
  assert.match(main, /bg1-current-activation\.css/);
});

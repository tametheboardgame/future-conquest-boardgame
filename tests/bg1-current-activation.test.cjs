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

test('BG12H keeps board actions under the provider while normal layout ownership moves to the contextual formation surface', () => {
  const main = read('src/main.tsx');
  const layout = read('src/components/TabletopLayout.tsx');
  const interaction = read('src/components/TabletopFormationInteraction.tsx');

  assert.match(main, /<BoardGameStateProvider>[\s\S]*?<TabletopLayout>[\s\S]*?<App \/>[\s\S]*?<\/TabletopLayout>[\s\S]*?<\/BoardGameStateProvider>/);
  assert.match(layout, /<TabletopStatusShell \/>/);
  assert.match(layout, /data-surface="formation"[\s\S]*?hidden=\{activeSurface !== 'formation'\}[\s\S]*?<TabletopFormationInteraction \/>/);
  assert.match(layout, /activeSurface === 'cards'[\s\S]*?<TabletopCardHandPanel \/>/);
  assert.doesNotMatch(layout, /id: 'activation', label: 'Turn'/);
  assert.doesNotMatch(layout, /id: 'combat', label: 'Combat'/);
  assert.doesNotMatch(layout, /id: 'support', label: 'Support'/);
  assert.match(interaction, /useBoardGameDispatch/);
  assert.match(interaction, /getBoardMoveDestinations/);
  assert.match(interaction, /<TabletopCombatPanel \/>/);
  assert.match(main, /bg1-current-activation\.css/);
  assert.match(main, /bg12e-tabletop-layout\.css/);
});
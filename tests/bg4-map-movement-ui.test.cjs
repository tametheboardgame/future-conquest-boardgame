const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG4C selects retained player pieces directly from both map renderers', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');
  const terrainMarkers = read('src/presentation/r3-terrain-operational-markers-core.ts');

  assert.match(panel, /r3-terrain-task-group-marker\[data-group-id\]/);
  assert.match(panel, /\.task-group-marker/);
  assert.match(panel, /readMapPieceId\(target\)/);
  assert.match(panel, /selectBoardPiece\(pieceId\)/);
  assert.match(terrainMarkers, /element\.dataset\.groupId = group\.id/);
});

test('BG4C destination presentation comes from authoritative BG4B legality and rejection reasons', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.match(panel, /getBoardMoveDestinations\(boardState, selectedPieceId\)/);
  assert.match(panel, /destination\.legal/);
  assert.match(panel, /destination\.reason \?\? 'Unavailable'/);
  assert.match(panel, /blocked regions explain why/);
  assert.match(panel, /campaign-territories/);
  assert.match(panel, /bg4cLegal/);
  assert.match(panel, /bg4cBlocked/);
  assert.match(panel, /bg4cPreview/);
});

test('BG4C previews, confirms and cancels movement before dispatch', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.match(panel, /Move preview/);
  assert.match(panel, />Confirm Move</);
  assert.match(panel, />Cancel</);
  assert.match(panel, /type: 'move-piece'/);
  assert.match(panel, /pieceId: selectedPieceId/);
  assert.match(panel, /destinationSpaceId: pendingDestinationSpaceId/);
  assert.match(panel, /dispatchBoardAction\(\{/);
});

test('BG4C keeps legacy Move delegation removed after BG5 combat extraction', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.doesNotMatch(panel, /data-tutorial="move-action"/);
  assert.doesNotMatch(panel, /data-tutorial="attack-action"/);
  assert.match(panel, /data-bg-package="BG3E"/);
  assert.match(panel, /data-bg-movement="BG4C"/);
});

test('BG4C supplies selected, legal, blocked and preview visual contracts', () => {
  const css = read('src/bg4-map-movement.css');

  assert.match(css, /\.bg4c-board-selected/);
  assert.match(css, /\.bg4c-move-legal/);
  assert.match(css, /\.bg4c-move-blocked/);
  assert.match(css, /\.bg4c-move-preview/);
});

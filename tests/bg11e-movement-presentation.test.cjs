const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG11E movement polish preserves authoritative BG4 move preview and dispatch', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.match(panel, /getBoardMoveDestinations\(boardState, selectedPieceId\)/);
  assert.match(panel, /destination\.legal/);
  assert.match(panel, /destination\.reason/);
  assert.match(panel, /type: 'move-piece'/);
  assert.match(panel, /pieceId: selectedPieceId/);
  assert.match(panel, /destinationSpaceId: pendingDestinationSpaceId/);
});

test('BG11E movement state is visibly identified without relying on colour alone', () => {
  const css = read('src/bg4-map-movement.css');

  assert.match(css, /\.r3-terrain-task-group-marker\.bg4c-board-selected::after\s*\{[^}]*content:\s*'SELECTED'/s);
  assert.match(css, /button\.legal::after\s*\{[^}]*content:\s*'LEGAL'/s);
  assert.match(css, /button\.preview::after\s*\{[^}]*content:\s*'PREVIEW'/s);
  assert.match(css, /button\.blocked::after\s*\{[^}]*content:\s*'BLOCKED'/s);
  assert.match(css, /\.task-group-marker\.bg4c-board-selected \.marker-id\s*\{[^}]*text-decoration:\s*underline/s);
});

test('BG11E movement controls provide keyboard focus and touch-sized targets', () => {
  const css = read('src/bg4-map-movement.css');

  assert.match(css, /\.tabletop-move-destination-list button,[\s\S]*min-height:\s*44px/);
  assert.match(css, /\.tabletop-move-preview button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.tabletop-move-destination-list button:focus-visible/);
  assert.match(css, /\.tabletop-move-blocked-list button:focus-visible/);
  assert.match(css, /\.tabletop-move-preview button:focus-visible/);
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*min-height:\s*46px/);
});

test('BG11E leaves hardened physical miniature movement and reduced-motion ownership untouched', () => {
  const layer = read('src/presentation/r3-formation-miniatures-layer.ts');

  assert.match(layer, /interpolateFormationPresentation\(piece\.from, piece\.target, scaledElapsed\)/);
  assert.match(layer, /this\.reducedMotion \? piece\.target/);
  assert.match(layer, /if \(animating\) this\.map\.triggerRepaint\(\)/);
  assert.match(layer, /old\.from = old\.current; old\.target = target; old\.startedAt = performance\.now\(\)/);
});

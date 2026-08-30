const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG8 hand UI reads the authoritative saved hand and pile counts', () => {
  const panel = read('src/components/TabletopCardHandPanel.tsx');
  assert.match(panel, /state\.decks\.action\.handBySeat\[state\.activeSeat\]/);
  assert.match(panel, /state\.decks\.action\.draw\.length/);
  assert.match(panel, /state\.decks\.action\.discard\.length/);
  assert.match(panel, /getBoardActionCard\(cardId\)/);
});

test('BG8 hand UI previews and dispatches the same play-action-card action', () => {
  const panel = read('src/components/TabletopCardHandPanel.tsx');
  assert.match(panel, /type: 'play-action-card'/);
  assert.match(panel, /previewBoardAction\(state, playAction\)/);
  assert.match(panel, /dispatch\(playAction\)/);
  assert.match(panel, /getBoardMoveDestinations\(state, selectedPieceId\)/);
});

test('BG8 hand is a fixed overlay so it cannot push the map below the first viewport', () => {
  const css = read('src/components/tabletop-card-hand.css');
  const shell = read('src/components/TabletopStatusShell.tsx');
  assert.match(css, /\.tabletop-card-hand\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /z-index:\s*34/);
  assert.match(shell, /<TabletopCardHandPanel \/>/);
  assert.match(shell, /data-bg-cards="BG8"/);
});

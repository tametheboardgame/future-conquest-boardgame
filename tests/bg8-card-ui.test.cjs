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

test('BG12E reserves the strategic hand inside the tabletop rail without overlaying the map', () => {
  const cardCss = read('src/components/tabletop-card-hand.css');
  const layoutCss = read('src/bg12e-tabletop-layout.css');
  const layout = read('src/components/TabletopLayout.tsx');
  const panel = read('src/components/TabletopCardHandPanel.tsx');

  assert.match(cardCss, /\.tabletop-card-hand\s*\{[^}]*position:\s*fixed/s, 'pre-BG12E fallback geometry remains available');
  assert.match(layout, /activeSurface === 'cards'[\s\S]*?<TabletopCardHandPanel \/>/);
  assert.match(layoutCss, /\.bg12e-tabletop-rail \.tabletop-card-hand[\s\S]*?position:\s*relative !important/);
  assert.match(layoutCss, /\.bg12e-board-zone\s*\{[\s\S]*?grid-column:\s*1;/);
  assert.match(layoutCss, /\.bg12e-tabletop-rail\s*\{[\s\S]*?grid-column:\s*2;/);
  assert.match(panel, /data-bg-package="BG8"/);
});
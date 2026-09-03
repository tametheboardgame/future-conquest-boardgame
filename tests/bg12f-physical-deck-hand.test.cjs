const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG12F keeps the BG8 authoritative deck while presenting physical draw, discard and hand zones', () => {
  const panel = read('src/components/TabletopCardHandPanel.tsx');

  assert.match(panel, /data-bg-package="BG8"/);
  assert.match(panel, /data-bg-presentation="BG12F"/);
  assert.match(panel, /state\.decks\.action\.handBySeat\[state\.activeSeat\]/);
  assert.match(panel, /state\.decks\.action\.draw\.length/);
  assert.match(panel, /state\.decks\.action\.discard\.length/);
  assert.match(panel, /function CardBack/);
  assert.match(panel, /function DiscardStack/);
  assert.match(panel, /className="tabletop-card-piles"/);
  assert.match(panel, /className="tabletop-card-list" role="list"/);
});

test('BG12F uses playing-card geometry, a natural fan and selected-card lift', () => {
  const css = read('src/components/tabletop-card-hand.css');
  const panel = read('src/components/TabletopCardHandPanel.tsx');

  assert.match(css, /aspect-ratio:\s*2\.5 \/ 3\.5/);
  assert.match(css, /margin-left:\s*-47px/);
  assert.match(css, /transform:\s*translateY\(var\(--fan-drop/);
  assert.match(css, /\.tabletop-card-list > button\.selected:not\(:disabled\)[\s\S]*?translateY\(-9px\) rotate\(0deg\)/);
  assert.match(css, /\.tabletop-card-list > button:hover:not\(:disabled\),[\s\S]*?scale\(1\.025\)/);
  assert.match(panel, /--fan-rotate/);
  assert.match(panel, /--fan-drop/);
  assert.match(panel, /fanOffset/);
});

test('BG12F card faces expose reusable family, artwork, effect and state regions', () => {
  const panel = read('src/components/TabletopCardHandPanel.tsx');
  const css = read('src/components/tabletop-card-hand.css');

  assert.match(panel, /data-card-family=\{card\.family\}/);
  assert.match(panel, /data-card-effect=\{card\.effect\}/);
  assert.match(panel, /data-card-art-key=\{card\.id\}/);
  assert.match(panel, /className="tabletop-card-art"/);
  assert.match(panel, /className="tabletop-card-title"/);
  assert.match(panel, /className="tabletop-card-summary"/);
  assert.match(panel, /className="tabletop-card-state"/);
  assert.match(css, /\.tabletop-card-art/);
});

test('BG12F communicates playable and unavailable cards without relying on colour', () => {
  const panel = read('src/components/TabletopCardHandPanel.tsx');
  const css = read('src/components/tabletop-card-hand.css');

  assert.match(panel, /playable \? 'Playable' : 'Unavailable'/);
  assert.match(panel, /playable \? '✓' : '×'/);
  assert.match(panel, /className=\{\[[\s\S]*?playable \? 'playable' : 'unplayable'/);
  assert.match(css, /\.tabletop-card-list > button\.unplayable:not\(:disabled\)[\s\S]*?border-style:\s*dashed/);
  assert.match(css, /\.tabletop-card-list > button\.unplayable:not\(:disabled\) \.tabletop-card-state[\s\S]*?text-decoration:\s*line-through/);
  assert.match(css, /@media \(forced-colors: active\)/);
});

test('BG12F prefers direct formation and map targeting but retains accessible fallback controls', () => {
  const panel = read('src/components/TabletopCardHandPanel.tsx');

  assert.match(panel, /MAP_PIECE_SELECTOR/);
  assert.match(panel, /readMapPieceId/);
  assert.match(panel, /document\.addEventListener\('click', onBoardClick, true\)/);
  assert.match(panel, /map\.on\('click', TERRAIN_CLICK_LAYER_ID, onTerrainClick\)/);
  assert.match(panel, /map\.off\('click', TERRAIN_CLICK_LAYER_ID, onTerrainClick\)/);
  assert.match(panel, /className="tabletop-card-accessibility"/);
  assert.match(panel, /<summary>Target controls<\/summary>/);
  assert.match(panel, /aria-label="Card formation"/);
  assert.match(panel, /aria-label="Card destination"/);
  assert.doesNotMatch(panel, /new maplibregl\.Map|addLayer\(|removeLayer\(/);
});

test('BG12F animates card draw and play only as presentation, with reduced-motion fallback', () => {
  const panel = read('src/components/TabletopCardHandPanel.tsx');
  const css = read('src/components/tabletop-card-hand.css');

  assert.match(panel, /newlyDrawnCardId/);
  assert.match(panel, /playedCard/);
  assert.match(panel, /className="tabletop-card-play-ghost"/);
  assert.match(css, /@keyframes bg12f-card-draw/);
  assert.match(css, /@keyframes bg12f-card-play/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation:\s*none !important/);
});

test('BG12F still previews and dispatches only the authoritative play-action-card action', () => {
  const panel = read('src/components/TabletopCardHandPanel.tsx');

  assert.match(panel, /type: 'play-action-card'/);
  assert.match(panel, /previewBoardAction\(state,/);
  assert.match(panel, /const result = dispatch\(playAction\)/);
  assert.match(panel, /getBoardMoveDestinations/);
  assert.doesNotMatch(panel, /Math\.random|crypto\.getRandomValues|shuffle|drawActionCard|discard\.push/);
});

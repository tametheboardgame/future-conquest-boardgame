const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG11D card hand derives presentation from authoritative card metadata', () => {
  const panel = read('src/components/TabletopCardHandPanel.tsx');

  assert.match(panel, /BOARD_ACTION_HAND_LIMIT/);
  assert.match(panel, /CARD_FAMILY_PRESENTATION/);
  assert.match(panel, /CARD_EFFECT_LABELS/);
  assert.match(panel, /data-card-family=\{card\.family\}/);
  assert.match(panel, /data-card-effect=\{card\.effect\}/);
  assert.match(panel, /aria-pressed=\{card\.id === selectedCardId\}/);
  assert.match(panel, /data-bg-presentation="BG11D"/);
});

test('BG11D selected card explains its free-action relationship to ordinary legality', () => {
  const panel = read('src/components/TabletopCardHandPanel.tsx');

  assert.match(panel, /Uses ordinary \{selectedEffect\} legality/);
  assert.match(panel, /Command Action refunded after a successful play/);
  assert.match(panel, /Play \{selectedEffect\} · free action/);
  assert.match(panel, /previewBoardAction\(state, playAction\)/);
  assert.match(panel, /dispatch\(playAction\)/);
  assert.match(panel, /type: 'play-action-card'/);
});

test('BG11D card identity is not colour-only and preserves the fixed map overlay', () => {
  const panel = read('src/components/TabletopCardHandPanel.tsx');
  const css = read('src/components/tabletop-card-hand.css');

  assert.match(panel, /CMD/);
  assert.match(panel, /SPT/);
  assert.match(panel, /EVT/);
  assert.match(panel, /ESC/);
  assert.match(panel, /NAT/);
  assert.match(panel, /SCN/);
  assert.match(css, /\.tabletop-card-hand\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /button\[data-card-family="command"\]::before/);
  assert.match(css, /button\[data-card-family="scenario"\]::before/);
  assert.match(css, /:focus-visible/);
});

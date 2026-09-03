const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG5B combat panel previews authoritative rules and dispatches only attack-piece', () => {
  const panel = read('src/components/TabletopCombatPanel.tsx');

  assert.match(panel, /getBoardCombatPreview/);
  assert.match(panel, /getBoardCombatTargets/);
  assert.match(panel, /useBoardGameState/);
  assert.match(panel, /useBoardGameDispatch/);
  assert.match(panel, /type: 'attack-piece'/);
  assert.match(panel, /className="confirm(?: [^"]*)?" onClick=\{confirmAttack\}/);
  assert.match(panel, /Roll 2D6 · 1 Command Action/);
  assert.match(panel, /Possible outcomes/);
  assert.doesNotMatch(panel, /beginOperation|resolveDay|issueMove|Math\.random/);
});

test('BG5B runtime provider sends board actions through the unified dispatcher', () => {
  const provider = read('src/components/BoardGameStateProvider.tsx');
  const dispatcher = read('src/game/board-action-dispatcher.ts');

  assert.match(provider, /from ['"]\.\.\/game\/board-action-dispatcher['"]/);
  assert.match(dispatcher, /action\.type === 'attack-piece'/);
  assert.match(dispatcher, /attackBoardPiece/);
  assert.match(dispatcher, /applyCoreBoardAction/);
});

test('BG5B removes retained simulation attack controls from player presentation', () => {
  const css = read('src/bg5-dice-combat.css');
  const layout = read('src/components/TabletopLayout.tsx');

  assert.match(css, /\[data-tutorial="attack-action"\][\s\S]*display: none !important/);
  assert.match(css, /\.tabletop-activation-actions \.attack/);
  assert.match(layout, /activeSurface === 'combat'[\s\S]*?<TabletopCombatPanel \/>/);
});
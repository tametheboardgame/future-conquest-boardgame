const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');

test('BG2E feeds the renderer-only board snapshot to both retained map implementations', () => {
  assert.match(appSource, /const boardState = useBoardGameState\(\);/);
  assert.match(appSource, /projectBoardStateForRenderer\(boardState\)/);
  assert.match(appSource, /applyBoardProjectionToRendererState\(movementMapState, boardRenderProjection\)/);
  assert.equal((appSource.match(/state=\{renderedMapState\}/g) ?? []).length, 2);
});

test('BG2E leaves legacy command calculations on the legacy App state', () => {
  assert.match(appSource, /const groups = Object\.values\(state\.taskGroups\);/);
  assert.match(appSource, /const enemyContacts = getEnemyContacts\(state\);/);
  assert.doesNotMatch(appSource, /const groups = Object\.values\(renderedMapState\.taskGroups\);/);
  assert.doesNotMatch(appSource, /getEnemyContacts\(renderedMapState\)/);
});

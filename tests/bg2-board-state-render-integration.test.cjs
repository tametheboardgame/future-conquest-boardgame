const test = require('node:test');
const assert = require('node:assert/strict');

const { createInitialBoardState, deserializeBoardState, serializeBoardState } = require('../.test-dist/board-state.js');
const { projectBoardStateForRenderer } = require('../.test-dist/board-state-render-projection.js');
const { applyBoardProjectionToRendererState } = require('../.test-dist/board-state-render-integration.js');
const { newGame } = require('../.test-dist/engine.js');

function integrationFixture() {
  const legacy = newGame(20260826);
  const territoryIds = Object.keys(legacy.territories);
  const playerGroup = Object.values(legacy.taskGroups)[0];
  const enemyFormation = Object.values(legacy.enemyFormations)[0];

  assert.ok(playerGroup, 'legacy renderer fixture needs a friendly formation');
  assert.ok(enemyFormation, 'legacy renderer fixture needs an enemy formation');

  const playerDestination = territoryIds.find(id => id !== playerGroup.location);
  const enemyDestination = territoryIds.find(id => id !== enemyFormation.location && id !== playerDestination);
  assert.ok(playerDestination && enemyDestination, 'legacy renderer fixture needs multiple territories');

  const board = createInitialBoardState({ seed: 20260826 });
  board.spaces = {
    [playerDestination]: { id: playerDestination, control: 'seat-1' },
    [enemyDestination]: { id: enemyDestination, control: 'seat-2' },
    [playerGroup.location]: { id: playerGroup.location, control: null },
    'future-space': { id: 'future-space', control: 'seat-1' }
  };
  board.pieces = {
    [playerGroup.id]: {
      id: playerGroup.id,
      seatId: 'seat-1',
      spaceId: playerDestination,
      readiness: 4,
      damage: 1,
      supply: 'strained'
    },
    [enemyFormation.id]: {
      id: enemyFormation.id,
      seatId: 'seat-2',
      spaceId: enemyDestination,
      readiness: 3,
      damage: 2,
      supply: 'isolated'
    },
    'future-piece': {
      id: 'future-piece',
      seatId: 'seat-1',
      spaceId: 'future-space',
      readiness: 5,
      damage: 0,
      supply: 'supplied'
    }
  };

  return { legacy, board, playerGroup, enemyFormation, playerDestination, enemyDestination };
}

test('BG2E overlays authoritative ownership and matching piece placement without mutating legacy state', () => {
  const { legacy, board, playerGroup, enemyFormation, playerDestination, enemyDestination } = integrationFixture();
  const originalPlayerLocation = legacy.taskGroups[playerGroup.id].location;
  const originalEnemyLocation = legacy.enemyFormations[enemyFormation.id].location;
  const originalNeutralController = legacy.territories[originalPlayerLocation].controller;

  const rendered = applyBoardProjectionToRendererState(legacy, projectBoardStateForRenderer(board));

  assert.notEqual(rendered, legacy);
  assert.equal(rendered.territories[playerDestination].controller, 'player');
  assert.equal(rendered.territories[enemyDestination].controller, 'enemy');
  assert.equal(rendered.territories[originalPlayerLocation].controller, originalNeutralController, 'neutral board spaces preserve the retained renderer fallback colour');
  assert.equal(rendered.taskGroups[playerGroup.id].location, playerDestination);
  assert.equal(rendered.enemyFormations[enemyFormation.id].location, enemyDestination);
  assert.equal(rendered.taskGroups['future-piece'], undefined, 'BG2E does not invent synthetic legacy formations');

  assert.equal(legacy.taskGroups[playerGroup.id].location, originalPlayerLocation);
  assert.equal(legacy.enemyFormations[enemyFormation.id].location, originalEnemyLocation);
  assert.equal(legacy.territories[originalPlayerLocation].controller, originalNeutralController);
});

test('BG2E leaves the retained renderer state reference untouched while the authoritative board has no populated spaces or pieces', () => {
  const legacy = newGame(17);
  const emptyBoard = createInitialBoardState({ seed: 17 });

  const rendered = applyBoardProjectionToRendererState(legacy, projectBoardStateForRenderer(emptyBoard));

  assert.equal(rendered, legacy);
});

test('BG2E produces the same renderer snapshot after authoritative board save and reload', () => {
  const { legacy, board } = integrationFixture();
  const restored = deserializeBoardState(serializeBoardState(board));

  const beforeReload = applyBoardProjectionToRendererState(legacy, projectBoardStateForRenderer(board));
  const afterReload = applyBoardProjectionToRendererState(legacy, projectBoardStateForRenderer(restored));

  assert.deepEqual(afterReload, beforeReload);
});

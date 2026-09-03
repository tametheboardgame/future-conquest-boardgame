const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createInitialBoardState,
  deserializeBoardState,
  serializeBoardState
} = require('../.test-dist/board-state.js');
const { SLICE_IDS, TERRITORIES } = require('../.test-dist/data.js');

function entryFor(seed) {
  const normalised = (Math.trunc(seed) >>> 0) || 0x6d2b79f5;
  return SLICE_IDS[normalised % SLICE_IDS.length];
}

const EXPEDITION_TASK_GROUP_IDS = ['TG-1', 'TG-2', 'TG-3', 'TG-4', 'TG-5', 'TG-6', 'TG-7', 'TG-8'];

test('BG4A populates all retained Central Front spaces with authoritative adjacency', () => {
  const state = createInitialBoardState({ seed: 42 });
  assert.deepEqual(Object.keys(state.spaces), [...SLICE_IDS]);

  for (const id of SLICE_IDS) {
    assert.equal(state.spaces[id].id, id);
    assert.deepEqual(state.spaces[id].adjacentSpaceIds, TERRITORIES[id].neighbours);
    for (const neighbour of state.spaces[id].adjacentSpaceIds) {
      assert.ok(state.spaces[neighbour].adjacentSpaceIds.includes(id), `${id} -> ${neighbour} must be symmetric`);
    }
  }
});

test('BG4A mirrors the retained portal rule and creates the calibrated player task-group miniatures', () => {
  const seed = 1179992911;
  const state = createInitialBoardState({ seed });
  const entry = entryFor(seed);

  assert.equal(state.spaces[entry].control, 'seat-1');
  for (const id of EXPEDITION_TASK_GROUP_IDS) {
    assert.deepEqual(state.pieces[id], {
      id,
      seatId: 'seat-1',
      spaceId: entry,
      readiness: 100,
      damage: 0,
      supply: 'supplied'
    });
  }
});

test('BG4A creates one opposing EF identity in every non-entry space', () => {
  const state = createInitialBoardState({ seed: 1179992911 });
  const entry = entryFor(1179992911);
  const enemyPieces = Object.values(state.pieces).filter(piece => piece.id.startsWith('EF-'));

  assert.equal(enemyPieces.length, SLICE_IDS.length - 1);
  assert.deepEqual(
    new Set(enemyPieces.map(piece => piece.spaceId)),
    new Set(SLICE_IDS.filter(id => id !== entry))
  );
  assert.ok(enemyPieces.every(piece => piece.seatId === 'seat-2'));
  assert.ok(SLICE_IDS.filter(id => id !== entry).every(id => state.spaces[id].control === 'seat-2'));
});

test('BG4A assigns scenario pieces to the first two canonical participating seats', () => {
  const state = createInitialBoardState({
    seed: 91,
    participatingSeatIds: ['seat-5', 'seat-3', 'seat-1']
  });

  assert.equal(state.activeSeat, 'seat-1');
  assert.ok(EXPEDITION_TASK_GROUP_IDS.every(id => state.pieces[id].seatId === 'seat-1'));
  assert.ok(Object.values(state.pieces).filter(piece => piece.id.startsWith('EF-')).every(piece => piece.seatId === 'seat-3'));
});

test('BG4A populated board layout survives exact save and reload', () => {
  const state = createInitialBoardState({ seed: 7001 });
  const restored = deserializeBoardState(serializeBoardState(state));
  assert.deepEqual(restored.spaces, state.spaces);
  assert.deepEqual(restored.pieces, state.pieces);
});

test('BG4A rejects malformed adjacency and off-board piece locations during load', () => {
  const state = createInitialBoardState({ seed: 7002 });
  const brokenAdjacency = structuredClone(state);
  brokenAdjacency.spaces[SLICE_IDS[0]].adjacentSpaceIds.push('NOT-A-SPACE');
  assert.throws(() => deserializeBoardState(JSON.stringify(brokenAdjacency)), /Invalid Future Conquest board state metadata/);

  const brokenPiece = structuredClone(state);
  brokenPiece.pieces['TG-1'].spaceId = 'NOT-A-SPACE';
  assert.throws(() => deserializeBoardState(JSON.stringify(brokenPiece)), /Invalid Future Conquest board state metadata/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  applyBoardAction,
  createInitialBoardState,
  deserializeBoardState,
  nextBoardRandom,
  serializeBoardState
} = require('../.test-dist/board-state.js');
const { BOARD_ROUND_LIMIT, BOARD_STATE_VERSION, SEAT_IDS } = require('../.test-dist/board-state-types.js');

test('authoritative initial board state is deterministic and contains six permanent command seats', () => {
  const options = {
    seed: 424242,
    scenarioId: 'central-front',
    controllers: { 'seat-1': 'human', 'seat-4': 'human' }
  };
  const first = createInitialBoardState(options);
  const second = createInitialBoardState(options);

  assert.deepEqual(second, first);
  assert.equal(first.save.version, BOARD_STATE_VERSION);
  assert.equal(first.round, 1);
  assert.equal(first.roundLimit, BOARD_ROUND_LIMIT);
  assert.equal(first.phase, 'round-start');
  assert.equal(first.activeSeat, 'seat-1');
  assert.deepEqual(Object.keys(first.seats), [...SEAT_IDS]);
  assert.equal(first.seats['seat-1'].controller, 'human');
  assert.equal(first.seats['seat-2'].controller, 'computer');
  assert.equal(first.seats['seat-4'].controller, 'human');
  assert.equal(first.seats['seat-1'].commandActionsRemaining, 0);
  assert.equal(Object.keys(first.spaces).length, 15);
  assert.equal(Object.keys(first.pieces).length, 22);
});

test('authoritative random stream is reproducible and advances explicit RNG state', () => {
  const initial = createInitialBoardState({ seed: 99 });
  const first = nextBoardRandom(initial.rng);
  const second = nextBoardRandom(first.rng);

  const replayFirst = nextBoardRandom(createInitialBoardState({ seed: 99 }).rng);
  const replaySecond = nextBoardRandom(replayFirst.rng);

  assert.equal(first.value, replayFirst.value);
  assert.equal(second.value, replaySecond.value);
  assert.equal(first.rng.calls, 1);
  assert.equal(second.rng.calls, 2);
  assert.notEqual(first.rng.state, initial.rng.state);
});

test('authoritative save serialisation round-trips the exact populated state', () => {
  const state = createInitialBoardState({ seed: 777, controllers: { 'seat-1': 'human' } });
  const restored = deserializeBoardState(serializeBoardState(state));
  assert.deepEqual(restored, state);
});

test('authoritative save loading rejects asymmetric board adjacency', () => {
  const state = createInitialBoardState({ seed: 778, controllers: { 'seat-1': 'human' } });
  const space = Object.values(state.spaces).find(candidate => candidate.adjacentSpaceIds.length > 0);
  assert.ok(space, 'fixture needs a space with at least one adjacent space');
  const neighbourId = space.adjacentSpaceIds[0];
  state.spaces[neighbourId].adjacentSpaceIds = state.spaces[neighbourId].adjacentSpaceIds.filter(id => id !== space.id);

  assert.throws(
    () => deserializeBoardState(serializeBoardState(state)),
    /Invalid Future Conquest board state metadata/
  );
});

test('unsupported actions remain no-cost and no-mutation', () => {
  const state = createInitialBoardState({ seed: 123 });
  const before = serializeBoardState(state);
  const result = applyBoardAction(state, { type: 'move-piece', pieceId: 'not-yet-authoritative' });

  assert.equal(result.accepted, false);
  assert.equal(result.commandActionsSpent, 0);
  assert.equal(result.state, state);
  assert.equal(serializeBoardState(state), before);
});

test('authoritative state code never uses Math.random', () => {
  for (const file of ['src/game/board-state.ts', 'src/game/board-state-types.ts', 'src/game/board-scenario.ts']) {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    assert.doesNotMatch(source, /Math\.random/);
  }
});

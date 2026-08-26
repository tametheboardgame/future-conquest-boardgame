const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createInitialBoardState,
  deserializeBoardState,
  getParticipatingSeatIds,
  serializeBoardState
} = require('../.test-dist/board-state.js');
const {
  BOARD_STATE_VERSION,
  DEFAULT_PARTICIPATING_SEAT_IDS,
  SEAT_IDS
} = require('../.test-dist/board-state-types.js');

test('BG3A defaults to two participating command seats while retaining all six permanent seats', () => {
  const state = createInitialBoardState({
    seed: 20260826,
    controllers: { 'seat-1': 'human' }
  });

  assert.equal(state.save.version, BOARD_STATE_VERSION);
  assert.deepEqual(Object.keys(state.seats), [...SEAT_IDS]);
  assert.deepEqual(getParticipatingSeatIds(state), [...DEFAULT_PARTICIPATING_SEAT_IDS]);
  assert.equal(state.activeSeat, 'seat-1');
  assert.equal(state.seats['seat-1'].participating, true);
  assert.equal(state.seats['seat-2'].participating, true);
  assert.equal(state.seats['seat-3'].participating, false);
  assert.equal(state.seats['seat-6'].participating, false);
});

test('BG3A supports Human vs Computer, Human vs Human and Computer vs Computer controller configurations', () => {
  const humanVsComputer = createInitialBoardState({
    seed: 1,
    controllers: { 'seat-1': 'human', 'seat-2': 'computer' }
  });
  const humanVsHuman = createInitialBoardState({
    seed: 1,
    controllers: { 'seat-1': 'human', 'seat-2': 'human' }
  });
  const computerVsComputer = createInitialBoardState({ seed: 1 });

  assert.deepEqual(
    getParticipatingSeatIds(humanVsComputer).map(id => humanVsComputer.seats[id].controller),
    ['human', 'computer']
  );
  assert.deepEqual(
    getParticipatingSeatIds(humanVsHuman).map(id => humanVsHuman.seats[id].controller),
    ['human', 'human']
  );
  assert.deepEqual(
    getParticipatingSeatIds(computerVsComputer).map(id => computerVsComputer.seats[id].controller),
    ['computer', 'computer']
  );
});

test('BG3A can activate additional permanent seats without changing the six-seat identity model', () => {
  const state = createInitialBoardState({
    seed: 2,
    participatingSeatIds: ['seat-1', 'seat-3', 'seat-5'],
    controllers: { 'seat-1': 'human', 'seat-3': 'human', 'seat-5': 'computer' }
  });

  assert.deepEqual(getParticipatingSeatIds(state), ['seat-1', 'seat-3', 'seat-5']);
  assert.equal(state.seats['seat-2'].participating, false);
  assert.equal(state.seats['seat-4'].participating, false);
  assert.equal(state.seats['seat-6'].participating, false);
});

test('BG3A requires at least two unique participating command seats', () => {
  assert.throws(
    () => createInitialBoardState({ seed: 3, participatingSeatIds: ['seat-1'] }),
    /at least two participating command seats/
  );
  assert.throws(
    () => createInitialBoardState({ seed: 3, participatingSeatIds: ['seat-1', 'seat-1'] }),
    /at least two participating command seats/
  );
});

test('BG3A seat configuration survives deterministic save and reload', () => {
  const state = createInitialBoardState({
    seed: 4,
    participatingSeatIds: ['seat-2', 'seat-4'],
    controllers: { 'seat-2': 'human', 'seat-4': 'computer' }
  });
  const restored = deserializeBoardState(serializeBoardState(state));

  assert.deepEqual(restored, state);
  assert.deepEqual(getParticipatingSeatIds(restored), ['seat-2', 'seat-4']);
  assert.equal(restored.activeSeat, 'seat-2');
});

test('BG3A rejects malformed saved seat configuration rather than accepting an invalid active seat', () => {
  const state = createInitialBoardState({ seed: 5 });
  state.seats['seat-1'].participating = false;

  assert.throws(
    () => deserializeBoardState(serializeBoardState(state)),
    /Invalid Future Conquest board state metadata/
  );
});

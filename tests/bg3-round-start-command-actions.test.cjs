const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyBoardAction,
  createInitialBoardState,
  deserializeBoardState,
  serializeBoardState,
  startBoardRound
} = require('../.test-dist/board-state.js');
const {
  BOARD_COMMAND_ACTIONS_PER_ROUND,
  SEAT_IDS
} = require('../.test-dist/board-state-types.js');

test('BG3B starts a round by granting four Command Actions to participating seats', () => {
  const initial = createInitialBoardState({
    seed: 20260826,
    controllers: { 'seat-1': 'human', 'seat-2': 'computer' }
  });
  const before = serializeBoardState(initial);

  const result = applyBoardAction(initial, { type: 'start-round' });

  assert.equal(result.accepted, true);
  assert.equal(result.commandActionsSpent, 0);
  assert.notEqual(result.state, initial);
  assert.equal(result.state.phase, 'activation');
  assert.equal(result.state.round, 1);
  assert.equal(result.state.activeSeat, 'seat-1');
  assert.equal(result.state.seats['seat-1'].commandActionsRemaining, BOARD_COMMAND_ACTIONS_PER_ROUND);
  assert.equal(result.state.seats['seat-2'].commandActionsRemaining, BOARD_COMMAND_ACTIONS_PER_ROUND);
  assert.equal(result.state.seats['seat-3'].commandActionsRemaining, 0);
  assert.equal(result.state.seats['seat-6'].commandActionsRemaining, 0);
  assert.equal(serializeBoardState(initial), before);
});

test('BG3B grants the allowance only to the configured participating seats and uses canonical first seat', () => {
  const initial = createInitialBoardState({
    seed: 7,
    participatingSeatIds: ['seat-5', 'seat-2', 'seat-4']
  });

  const result = startBoardRound(initial);

  assert.equal(result.accepted, true);
  assert.equal(result.state.activeSeat, 'seat-2');
  for (const id of SEAT_IDS) {
    const expected = ['seat-2', 'seat-4', 'seat-5'].includes(id) ? BOARD_COMMAND_ACTIONS_PER_ROUND : 0;
    assert.equal(result.state.seats[id].commandActionsRemaining, expected, `${id} allowance`);
  }
});

test('BG3B rejects a duplicate round-start transition without mutation or Command Action cost', () => {
  const started = startBoardRound(createInitialBoardState({ seed: 8 })).state;
  const before = serializeBoardState(started);

  const result = applyBoardAction(started, { type: 'start-round' });

  assert.equal(result.accepted, false);
  assert.equal(result.commandActionsSpent, 0);
  assert.equal(result.state, started);
  assert.match(result.reason, /Cannot start round during activation phase/);
  assert.equal(serializeBoardState(started), before);
});

test('BG3B round-start state survives exact save and reload', () => {
  const started = startBoardRound(createInitialBoardState({
    seed: 9,
    participatingSeatIds: ['seat-1', 'seat-3'],
    controllers: { 'seat-1': 'human', 'seat-3': 'human' }
  })).state;

  const restored = deserializeBoardState(serializeBoardState(started));

  assert.deepEqual(restored, started);
  assert.equal(restored.phase, 'activation');
  assert.equal(restored.seats['seat-1'].commandActionsRemaining, BOARD_COMMAND_ACTIONS_PER_ROUND);
  assert.equal(restored.seats['seat-3'].commandActionsRemaining, BOARD_COMMAND_ACTIONS_PER_ROUND);
});

test('BG3B leaves unsupported board actions rejected and free', () => {
  const started = startBoardRound(createInitialBoardState({ seed: 10 })).state;
  const before = serializeBoardState(started);

  const result = applyBoardAction(started, { type: 'move-piece', pieceId: 'future-piece' });

  assert.equal(result.accepted, false);
  assert.equal(result.commandActionsSpent, 0);
  assert.equal(result.state, started);
  assert.equal(serializeBoardState(started), before);
});

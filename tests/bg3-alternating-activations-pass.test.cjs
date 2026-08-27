const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyBoardAction,
  createInitialBoardState,
  deserializeBoardState,
  getNextActivatingSeatId,
  passBoardActivation,
  serializeBoardState,
  startBoardRound
} = require('../.test-dist/board-state.js');
const { BOARD_COMMAND_ACTIONS_PER_ROUND } = require('../.test-dist/board-state-types.js');

function startedState(options = {}) {
  return startBoardRound(createInitialBoardState({ seed: 20260826, ...options })).state;
}

test('BG3C Pass Activation alternates between the two default participating seats without spending actions', () => {
  const started = startedState();
  const beforeSeat1 = started.seats['seat-1'].commandActionsRemaining;
  const beforeSeat2 = started.seats['seat-2'].commandActionsRemaining;

  const first = applyBoardAction(started, { type: 'pass-activation' });
  assert.equal(first.accepted, true);
  assert.equal(first.commandActionsSpent, 0);
  assert.equal(first.state.activeSeat, 'seat-2');
  assert.equal(first.state.seats['seat-1'].commandActionsRemaining, beforeSeat1);
  assert.equal(first.state.seats['seat-2'].commandActionsRemaining, beforeSeat2);

  const second = applyBoardAction(first.state, { type: 'pass-activation' });
  assert.equal(second.accepted, true);
  assert.equal(second.commandActionsSpent, 0);
  assert.equal(second.state.activeSeat, 'seat-1');
  assert.equal(second.state.seats['seat-1'].commandActionsRemaining, BOARD_COMMAND_ACTIONS_PER_ROUND);
  assert.equal(second.state.seats['seat-2'].commandActionsRemaining, BOARD_COMMAND_ACTIONS_PER_ROUND);
});

test('BG3C activation order skips non-participating and exhausted seats deterministically', () => {
  const state = startedState({ participatingSeatIds: ['seat-1', 'seat-3', 'seat-5'] });
  state.seats['seat-3'] = { ...state.seats['seat-3'], commandActionsRemaining: 0 };

  assert.equal(getNextActivatingSeatId(state), 'seat-5');

  const passed = passBoardActivation(state);
  assert.equal(passed.accepted, true);
  assert.equal(passed.state.activeSeat, 'seat-5');
  assert.equal(getNextActivatingSeatId(passed.state), 'seat-1');
});

test('BG3C next-seat search can return the current seat after a full circuit when every other seat is exhausted', () => {
  const state = startedState();
  state.seats['seat-2'] = { ...state.seats['seat-2'], commandActionsRemaining: 0 };

  assert.equal(getNextActivatingSeatId(state), 'seat-1');
});

test('BG3C Pass rejects when no other seat has a legal activation and leaves state untouched', () => {
  const state = startedState();
  state.seats['seat-2'] = { ...state.seats['seat-2'], commandActionsRemaining: 0 };
  const before = serializeBoardState(state);

  const result = applyBoardAction(state, { type: 'pass-activation' });

  assert.equal(result.accepted, false);
  assert.equal(result.commandActionsSpent, 0);
  assert.equal(result.state, state);
  assert.match(result.reason, /No other participating seat has a legal activation/);
  assert.equal(serializeBoardState(state), before);
});

test('BG3C Pass rejects outside activation phase and when the active seat is exhausted', () => {
  const roundStart = createInitialBoardState({ seed: 11 });
  const wrongPhase = applyBoardAction(roundStart, { type: 'pass-activation' });
  assert.equal(wrongPhase.accepted, false);
  assert.equal(wrongPhase.state, roundStart);
  assert.match(wrongPhase.reason, /Cannot pass activation during round-start phase/);

  const exhausted = startedState({ seed: 12 });
  exhausted.seats['seat-1'] = { ...exhausted.seats['seat-1'], commandActionsRemaining: 0 };
  const noActivation = applyBoardAction(exhausted, { type: 'pass-activation' });
  assert.equal(noActivation.accepted, false);
  assert.equal(noActivation.state, exhausted);
  assert.match(noActivation.reason, /has no legal activation to pass/);
});

test('BG3C active-seat progression survives exact save and reload', () => {
  const started = startedState({
    participatingSeatIds: ['seat-1', 'seat-4'],
    controllers: { 'seat-1': 'human', 'seat-4': 'human' }
  });
  const passed = passBoardActivation(started);
  assert.equal(passed.accepted, true);
  assert.equal(passed.state.activeSeat, 'seat-4');

  const restored = deserializeBoardState(serializeBoardState(passed.state));
  assert.deepEqual(restored, passed.state);
  assert.equal(restored.activeSeat, 'seat-4');
});

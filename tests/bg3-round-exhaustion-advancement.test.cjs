const test = require('node:test');
const assert = require('node:assert/strict');

const {
  advanceBoardRound,
  applyBoardAction,
  createInitialBoardState,
  deserializeBoardState,
  endBoardRound,
  isBoardRoundExhausted,
  serializeBoardState,
  startBoardRound
} = require('../.test-dist/board-state.js');
const { BOARD_COMMAND_ACTIONS_PER_ROUND, BOARD_ROUND_LIMIT } = require('../.test-dist/board-state-types.js');

function startedState(options = {}) {
  return startBoardRound(createInitialBoardState({ seed: 20260827, ...options })).state;
}

function exhaustParticipatingSeats(state) {
  for (const seat of Object.values(state.seats)) {
    if (seat.participating) seat.commandActionsRemaining = 0;
  }
  return state;
}

test('BG3D detects exhaustion only when every participating seat has no Command Actions', () => {
  const state = startedState({ participatingSeatIds: ['seat-1', 'seat-3', 'seat-5'] });
  assert.equal(isBoardRoundExhausted(state), false);

  state.seats['seat-1'].commandActionsRemaining = 0;
  state.seats['seat-3'].commandActionsRemaining = 0;
  assert.equal(isBoardRoundExhausted(state), false);

  state.seats['seat-5'].commandActionsRemaining = 0;
  assert.equal(isBoardRoundExhausted(state), true);
});

test('BG3D ends an exhausted activation phase without spending actions', () => {
  const state = exhaustParticipatingSeats(startedState());
  const result = applyBoardAction(state, { type: 'end-round' });

  assert.equal(result.accepted, true);
  assert.equal(result.commandActionsSpent, 0);
  assert.equal(result.state.phase, 'round-end');
  assert.equal(result.state.round, 1);
  assert.equal(result.state.activeSeat, state.activeSeat);
});

test('BG3D refuses to end a round while any participating seat can continue', () => {
  const state = startedState();
  state.seats['seat-1'].commandActionsRemaining = 0;
  const before = serializeBoardState(state);

  const result = endBoardRound(state);

  assert.equal(result.accepted, false);
  assert.equal(result.commandActionsSpent, 0);
  assert.equal(result.state, state);
  assert.match(result.reason, /still has Command Actions/);
  assert.equal(serializeBoardState(state), before);
});

test('BG3D advances round-end to the next canonical round-start with zeroed allowances', () => {
  const state = startedState({
    participatingSeatIds: ['seat-2', 'seat-4'],
    controllers: { 'seat-2': 'human', 'seat-4': 'human' }
  });
  exhaustParticipatingSeats(state);
  state.activeSeat = 'seat-4';

  const ended = endBoardRound(state);
  const advanced = applyBoardAction(ended.state, { type: 'advance-round' });

  assert.equal(advanced.accepted, true);
  assert.equal(advanced.commandActionsSpent, 0);
  assert.equal(advanced.state.round, 2);
  assert.equal(advanced.state.phase, 'round-start');
  assert.equal(advanced.state.activeSeat, 'seat-2');
  for (const seat of Object.values(advanced.state.seats)) {
    assert.equal(seat.commandActionsRemaining, 0);
  }

  const restarted = applyBoardAction(advanced.state, { type: 'start-round' });
  assert.equal(restarted.accepted, true);
  assert.equal(restarted.state.phase, 'activation');
  assert.equal(restarted.state.activeSeat, 'seat-2');
  assert.equal(restarted.state.seats['seat-2'].commandActionsRemaining, BOARD_COMMAND_ACTIONS_PER_ROUND);
  assert.equal(restarted.state.seats['seat-4'].commandActionsRemaining, BOARD_COMMAND_ACTIONS_PER_ROUND);
});

test('BG3D rejects advancement outside round-end without mutation', () => {
  const state = startedState();
  const before = serializeBoardState(state);

  const result = advanceBoardRound(state);

  assert.equal(result.accepted, false);
  assert.equal(result.state, state);
  assert.equal(result.commandActionsSpent, 0);
  assert.match(result.reason, /Cannot advance round during activation phase/);
  assert.equal(serializeBoardState(state), before);
});

test('BG3D preserves round-end and next-round states exactly across save/reload', () => {
  const state = exhaustParticipatingSeats(startedState({ participatingSeatIds: ['seat-1', 'seat-6'] }));
  const ended = endBoardRound(state);
  const restoredEnd = deserializeBoardState(serializeBoardState(ended.state));
  assert.deepEqual(restoredEnd, ended.state);

  const advanced = advanceBoardRound(restoredEnd);
  assert.equal(advanced.accepted, true);
  const restoredStart = deserializeBoardState(serializeBoardState(advanced.state));
  assert.deepEqual(restoredStart, advanced.state);
  assert.equal(restoredStart.round, 2);
  assert.equal(restoredStart.phase, 'round-start');
});

test('BG3D reaches round 8 deterministically and refuses a ninth round without inventing victory', () => {
  let state = createInitialBoardState({ seed: 8 });

  for (let expectedRound = 1; expectedRound <= BOARD_ROUND_LIMIT; expectedRound += 1) {
    assert.equal(state.round, expectedRound);
    assert.equal(state.phase, 'round-start');

    const started = startBoardRound(state);
    assert.equal(started.accepted, true);
    state = exhaustParticipatingSeats(started.state);

    const ended = endBoardRound(state);
    assert.equal(ended.accepted, true);
    state = ended.state;

    if (expectedRound < BOARD_ROUND_LIMIT) {
      const advanced = advanceBoardRound(state);
      assert.equal(advanced.accepted, true);
      state = advanced.state;
    }
  }

  assert.equal(state.round, BOARD_ROUND_LIMIT);
  assert.equal(state.phase, 'round-end');
  const terminal = applyBoardAction(state, { type: 'advance-round' });
  assert.equal(terminal.accepted, false);
  assert.equal(terminal.state, state);
  assert.equal(terminal.commandActionsSpent, 0);
  assert.match(terminal.reason, /campaign limit/);
  assert.match(terminal.reason, /BG10/);
});

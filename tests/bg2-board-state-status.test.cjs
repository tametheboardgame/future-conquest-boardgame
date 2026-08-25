const test = require('node:test');
const assert = require('node:assert/strict');

const { createInitialBoardState } = require('../.test-dist/board-state.js');
const { projectBoardStatus } = require('../.test-dist/board-state-status.js');

test('BG2D derives tabletop status from authoritative board state', () => {
  const state = createInitialBoardState({
    seed: 42,
    controllers: { 'seat-1': 'human', 'seat-3': 'human' }
  });
  state.round = 4;
  state.phase = 'activation';
  state.activeSeat = 'seat-3';
  state.seats['seat-3'].commandActionsRemaining = 2;

  assert.deepEqual(projectBoardStatus(state), {
    round: '4 / 8',
    activeSeat: 'Command Seat 3',
    activePlayer: 'Human',
    commandActions: '2',
    phase: 'Activation',
    activation: 'Select a formation'
  });
});

test('BG2D reports non-activation phases without inventing an activation', () => {
  const state = createInitialBoardState({ seed: 7 });
  state.round = 8;
  state.phase = 'round-end';
  state.activeSeat = 'seat-2';
  state.seats['seat-2'].commandActionsRemaining = 0;

  assert.deepEqual(projectBoardStatus(state), {
    round: '8 / 8',
    activeSeat: 'Command Seat 2',
    activePlayer: 'Computer',
    commandActions: '0',
    phase: 'Round End',
    activation: 'Round End'
  });
});

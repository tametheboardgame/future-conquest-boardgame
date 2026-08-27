const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  applyBoardAction,
  createInitialBoardState,
  endBoardRound,
  startBoardRound
} = require('../.test-dist/board-state.js');
const { chooseAutomaticBoardAction } = require('../.test-dist/board-turn-orchestration.js');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

function startedState(options = {}) {
  return startBoardRound(createInitialBoardState({ seed: 0x3345, ...options })).state;
}

test('BG3E automatically starts authoritative round-start states', () => {
  const state = createInitialBoardState({ seed: 1 });
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'start-round' });
});

test('BG3E basic computer yields through the same Pass dispatcher back to a human seat', () => {
  let state = startedState({ controllers: { 'seat-1': 'human', 'seat-2': 'computer' } });
  const humanPass = applyBoardAction(state, { type: 'pass-activation' });
  assert.equal(humanPass.accepted, true);
  state = humanPass.state;
  assert.equal(state.activeSeat, 'seat-2');

  const computerChoice = chooseAutomaticBoardAction(state);
  assert.deepEqual(computerChoice, { type: 'pass-activation' });
  const computerPass = applyBoardAction(state, computerChoice);
  assert.equal(computerPass.accepted, true);
  assert.equal(computerPass.state.activeSeat, 'seat-1');
  assert.equal(computerPass.commandActionsSpent, 0);
});

test('BG3E computer-v-computer does not create an infinite zero-cost Pass loop before paid actions exist', () => {
  const state = startedState({ controllers: { 'seat-1': 'computer', 'seat-2': 'computer' } });
  assert.equal(chooseAutomaticBoardAction(state), null);
});

test('BG3E automatic orchestration closes exhausted rounds and advances completed non-terminal rounds', () => {
  let state = startedState();
  state.seats['seat-1'].commandActionsRemaining = 0;
  state.seats['seat-2'].commandActionsRemaining = 0;
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'end-round' });

  const ended = endBoardRound(state);
  assert.equal(ended.accepted, true);
  assert.deepEqual(chooseAutomaticBoardAction(ended.state), { type: 'advance-round' });
});

test('BG3E stops automatic advancement at the round-eight boundary', () => {
  let state = startedState();
  state.round = state.roundLimit;
  state.seats['seat-1'].commandActionsRemaining = 0;
  state.seats['seat-2'].commandActionsRemaining = 0;
  state = endBoardRound(state).state;
  assert.equal(state.phase, 'round-end');
  assert.equal(chooseAutomaticBoardAction(state), null);
});

test('BG3E provider exposes authoritative dispatch and persists every accepted action', () => {
  const provider = read('src/components/BoardGameStateProvider.tsx');

  assert.match(provider, /applyBoardAction\(state, action\)/);
  assert.match(provider, /if \(!result\.accepted\) return result/);
  assert.match(provider, /writeBoardState\(storage, result\.state\)/);
  assert.match(provider, /setState\(result\.state\)/);
  assert.match(provider, /chooseAutomaticBoardAction\(state\)/);
  assert.match(provider, /dispatch\(automaticAction\)/);
  assert.match(provider, /export function useBoardGameDispatch/);
});

test('BG3E Pass control asks the authoritative dispatcher for legality and dispatches the same action', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.match(panel, /applyBoardAction\(boardState, \{ type: 'pass-activation' \}\)/);
  assert.match(panel, /const canPass = activeSeat\.controller === 'human' && passPreview\.accepted/);
  assert.match(panel, /dispatchBoardAction\(\{ type: 'pass-activation' \}\)/);
  assert.match(panel, /data-bg-package="BG3E"/);
});

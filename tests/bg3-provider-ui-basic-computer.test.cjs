const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  createInitialBoardState,
  endBoardRound,
  startBoardRound
} = require('../.test-dist/board-state.js');
const { applyBoardAction } = require('../.test-dist/board-action-dispatcher.js');
const { chooseAutomaticBoardAction } = require('../.test-dist/board-turn-orchestration.js');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

function startedState(options = {}) {
  return startBoardRound(createInitialBoardState({ seed: 0x3345, ...options })).state;
}

function withoutCombatTargets(state) {
  const attacker = Object.values(state.pieces)
    .filter(piece => piece.seatId === 'seat-1' && piece.spaceId)
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  assert.ok(attacker?.spaceId, 'fixture requires one surviving expedition formation');

  const attackerSpaceId = attacker.spaceId;
  state.pieces = Object.fromEntries(Object.entries(state.pieces).map(([id, piece]) => [
    id,
    id === attacker.id ? piece : { ...piece, spaceId: null }
  ]));
  state.spaces[attackerSpaceId] = {
    ...state.spaces[attackerSpaceId],
    control: 'seat-1',
    fortification: 3
  };
  for (const adjacentSpaceId of state.spaces[attackerSpaceId].adjacentSpaceIds) {
    state.spaces[adjacentSpaceId] = {
      ...state.spaces[adjacentSpaceId],
      control: 'seat-2'
    };
  }
  return state;
}

test('BG3E round-start orchestration yields to the current automatic pre-round action', () => {
  const state = createInitialBoardState({ seed: 1 });
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'resolve-escalation' });
});

test('BG3E computer can end unusable remaining actions through the shared dispatcher', () => {
  let state = startedState({ controllers: { 'seat-1': 'human', 'seat-2': 'computer' } });
  state = applyBoardAction(state, { type: 'pass-activation' }).state;
  state = withoutCombatTargets(state);
  assert.equal(state.activeSeat, 'seat-2');
  const computerChoice = chooseAutomaticBoardAction(state);
  assert.deepEqual(computerChoice, { type: 'end-seat-actions' });
  const ended = applyBoardAction(state, computerChoice);
  assert.equal(ended.accepted, true);
  assert.equal(ended.state.activeSeat, 'seat-1');
  assert.equal(ended.state.seats['seat-2'].commandActionsRemaining, 0);
  assert.equal(ended.commandActionsSpent, 0);
});

test('BG3E mixed computer chains end unusable actions until the next human', () => {
  let state = withoutCombatTargets(startedState({
    participatingSeatIds: ['seat-1', 'seat-2', 'seat-3'],
    controllers: { 'seat-1': 'computer', 'seat-2': 'computer', 'seat-3': 'human' }
  }));
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'end-seat-actions' });
  state = applyBoardAction(state, { type: 'end-seat-actions' }).state;
  assert.equal(state.activeSeat, 'seat-2');
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'end-seat-actions' });
  state = applyBoardAction(state, { type: 'end-seat-actions' }).state;
  assert.equal(state.activeSeat, 'seat-3');
  assert.equal(chooseAutomaticBoardAction(state), null);
});

test('BG3E computer-v-computer exits a no-action position without a zero-cost Pass loop', () => {
  let state = withoutCombatTargets(startedState({ controllers: { 'seat-1': 'computer', 'seat-2': 'computer' } }));
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'end-seat-actions' });
  state = applyBoardAction(state, { type: 'end-seat-actions' }).state;
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'end-seat-actions' });
  state = applyBoardAction(state, { type: 'end-seat-actions' }).state;
  assert.equal(state.seats['seat-1'].commandActionsRemaining, 0);
  assert.equal(state.seats['seat-2'].commandActionsRemaining, 0);
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'end-round' });
});

test('BG3E automatic orchestration closes exhausted rounds, scores objectives and advances completed non-terminal rounds', () => {
  let state = startedState();
  state.seats['seat-1'].commandActionsRemaining = 0;
  state.seats['seat-2'].commandActionsRemaining = 0;
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'end-round' });
  const ended = endBoardRound(state);
  assert.equal(ended.accepted, true);
  const scoreAction = chooseAutomaticBoardAction(ended.state);
  assert.deepEqual(scoreAction, { type: 'score-campaign-round' });
  const scored = applyBoardAction(ended.state, scoreAction);
  assert.equal(scored.accepted, true);
  assert.deepEqual(chooseAutomaticBoardAction(scored.state), { type: 'advance-round' });
});

test('BG3E resolves the campaign instead of advancing beyond the round-eight boundary', () => {
  let state = startedState();
  state.round = state.roundLimit;
  state.seats['seat-1'].commandActionsRemaining = 0;
  state.seats['seat-2'].commandActionsRemaining = 0;
  state = endBoardRound(state).state;
  assert.equal(state.phase, 'round-end');
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'score-campaign-round' });
  state = applyBoardAction(state, { type: 'score-campaign-round' }).state;
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'resolve-campaign' });
  state = applyBoardAction(state, { type: 'resolve-campaign' }).state;
  assert.equal(chooseAutomaticBoardAction(state), null);
});

test('BG3E provider exposes authoritative dispatch, persistence and save-preservation guards', () => {
  const provider = read('src/components/BoardGameStateProvider.tsx');
  assert.match(provider, /applyBoardAction\(state, action\)/);
  assert.match(provider, /if \(!result\.accepted\) return result/);
  assert.match(provider, /!preserveExistingBoardSave/);
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

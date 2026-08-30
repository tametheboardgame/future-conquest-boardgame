const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  chooseComputerBoardAction,
  enumerateComputerBoardActions
} = require('../.test-dist/board-computer-player.js');
const { applyBoardAction } = require('../.test-dist/board-action-dispatcher.js');
const {
  createInitialBoardState,
  serializeBoardState,
  startBoardRound
} = require('../.test-dist/board-state.js');
const { chooseAutomaticBoardAction } = require('../.test-dist/board-turn-orchestration.js');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

function startedComputerState(seed = 0x9009) {
  return startBoardRound(createInitialBoardState({
    seed,
    controllers: { 'seat-1': 'computer', 'seat-2': 'computer' }
  })).state;
}

function removeOpposingPieces(state) {
  state.pieces = Object.fromEntries(Object.entries(state.pieces).map(([id, piece]) => [
    id,
    piece.seatId === state.activeSeat ? piece : { ...piece, spaceId: null }
  ]));
  return state;
}

test('BG9 enumerates only dispatcher-legal computer actions without consuming RNG', () => {
  const state = startedComputerState();
  const before = serializeBoardState(state);
  const candidates = enumerateComputerBoardActions(state);

  assert.ok(candidates.length > 0);
  assert.ok(candidates.some(candidate => candidate.action.type === 'attack-piece'));
  assert.ok(candidates.some(candidate => candidate.action.type === 'engineer-position'));
  assert.ok(candidates.some(candidate => candidate.action.type === 'end-seat-actions'));

  for (const candidate of candidates) {
    const result = applyBoardAction(state, candidate.action);
    assert.equal(result.accepted, true, `${JSON.stringify(candidate.action)} should be dispatcher-legal`);
  }

  assert.equal(serializeBoardState(state), before);
});

test('BG9 chooses the same deterministic action from the same state and policy', () => {
  const state = startedComputerState(0x9010);
  const before = serializeBoardState(state);
  const first = chooseComputerBoardAction(state);
  const second = chooseComputerBoardAction(state);

  assert.ok(first);
  assert.deepEqual(second, first);
  assert.equal(serializeBoardState(state), before);
});

test('BG9 movement scoring advances a computer formation toward hostile territory when combat is unavailable', () => {
  const state = removeOpposingPieces(startedComputerState(0x9011));
  const piece = state.pieces['TG-1'];
  const origin = state.spaces[piece.spaceId];
  const destinationSpaceId = [...origin.adjacentSpaceIds].sort()[0];

  state.spaces[piece.spaceId] = { ...origin, fortification: 3 };
  state.spaces[destinationSpaceId] = {
    ...state.spaces[destinationSpaceId],
    control: state.activeSeat
  };

  const choice = chooseComputerBoardAction(state);
  assert.equal(choice.type, 'move-piece');
  assert.equal(typeof choice.pieceId, 'string');
  assert.equal(choice.destinationSpaceId, destinationSpaceId);
  assert.equal(applyBoardAction(state, choice).accepted, true);
});

test('BG9 values a legal free card effect above the equivalent paid recovery action', () => {
  const state = removeOpposingPieces(startedComputerState(0x9012));
  const piece = state.pieces['TG-1'];
  state.pieces['TG-1'] = { ...piece, damage: 1, readiness: 75 };
  state.spaces[piece.spaceId] = { ...state.spaces[piece.spaceId], fortification: 3 };
  state.decks.action.handBySeat[state.activeSeat] = ['action-03-field-repair-teams'];

  const candidates = enumerateComputerBoardActions(state);
  const paidRecover = candidates.find(candidate =>
    candidate.action.type === 'recover-piece' && candidate.action.pieceId === 'TG-1'
  );
  const cardRecover = candidates.find(candidate =>
    candidate.action.type === 'play-action-card' && candidate.action.cardId === 'action-03-field-repair-teams'
  );

  assert.ok(paidRecover);
  assert.ok(cardRecover);
  assert.ok(cardRecover.score > paidRecover.score);
  assert.deepEqual(chooseComputerBoardAction(state), cardRecover.action);
});

test('BG9 End Actions exhausts a computer seat instead of creating a zero-cost Pass loop', () => {
  let state = removeOpposingPieces(startedComputerState(0x9013));
  state.pieces = Object.fromEntries(Object.entries(state.pieces).map(([id, piece]) => [
    id,
    { ...piece, spaceId: null }
  ]));

  const firstChoice = chooseComputerBoardAction(state);
  assert.deepEqual(firstChoice, { type: 'end-seat-actions' });
  const first = applyBoardAction(state, firstChoice);
  assert.equal(first.accepted, true);
  assert.equal(first.state.seats['seat-1'].commandActionsRemaining, 0);
  assert.equal(first.state.activeSeat, 'seat-2');

  const secondChoice = chooseComputerBoardAction(first.state);
  assert.deepEqual(secondChoice, { type: 'end-seat-actions' });
  const second = applyBoardAction(first.state, secondChoice);
  assert.equal(second.accepted, true);
  assert.equal(second.state.seats['seat-2'].commandActionsRemaining, 0);
  assert.deepEqual(chooseAutomaticBoardAction(second.state), { type: 'end-round' });
});

test('BG9 computer-v-computer runs unattended through the complete eight-round rules boundary', () => {
  let state = createInitialBoardState({
    seed: 0x9014,
    controllers: { 'seat-1': 'computer', 'seat-2': 'computer' }
  });
  let steps = 0;

  while (steps < 1000) {
    const action = chooseAutomaticBoardAction(state);
    if (!action) break;
    const result = applyBoardAction(state, action);
    assert.equal(result.accepted, true, `automatic action rejected at step ${steps}: ${JSON.stringify(action)} — ${result.reason}`);
    state = result.state;
    steps += 1;
  }

  assert.ok(steps < 1000, 'computer-v-computer autoplay hit the safety limit');
  assert.equal(state.round, state.roundLimit);
  assert.equal(state.round, 8);
  assert.equal(state.phase, 'round-end');
  assert.equal(state.seats['seat-1'].commandActionsRemaining, 0);
  assert.equal(state.seats['seat-2'].commandActionsRemaining, 0);
  assert.equal(chooseAutomaticBoardAction(state), null);
});

test('BG9 policy stays deterministic and shares the ordinary rules dispatcher', () => {
  const policy = read('src/game/board-computer-player.ts');
  const orchestration = read('src/game/board-turn-orchestration.ts');
  const dispatcher = read('src/game/board-action-dispatcher.ts');

  assert.doesNotMatch(policy, /Math\.random/);
  assert.match(policy, /getBoardCombatTargets/);
  assert.match(policy, /getBoardMoveDestinations/);
  assert.match(policy, /applyBoardAction\(state, action\)/);
  assert.match(policy, /BoardComputerDifficulty/);
  assert.match(policy, /BoardComputerPersonality/);
  assert.match(orchestration, /chooseComputerBoardAction\(state\)/);
  assert.match(dispatcher, /endBoardSeatActions\(state\)/);
});

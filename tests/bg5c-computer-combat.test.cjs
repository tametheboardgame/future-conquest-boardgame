const test = require('node:test');
const assert = require('node:assert/strict');

const { applyBoardAction } = require('../.test-dist/board-action-dispatcher.js');
const { createInitialBoardState, startBoardRound } = require('../.test-dist/board-state.js');
const { chooseAutomaticBoardAction } = require('../.test-dist/board-turn-orchestration.js');

function computerCombatState(seed = 11264) {
  const state = startBoardRound(createInitialBoardState({
    seed,
    controllers: { 'seat-1': 'human', 'seat-2': 'computer' }
  })).state;
  state.activeSeat = 'seat-2';

  const attacker = Object.values(state.pieces)
    .filter(piece => piece.seatId === 'seat-2')
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  const defender = Object.values(state.pieces)
    .filter(piece => piece.seatId === 'seat-1')
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  assert.ok(attacker);
  assert.ok(defender?.spaceId);

  const attackerSpaceId = state.spaces[defender.spaceId].adjacentSpaceIds[0];
  assert.ok(attackerSpaceId);

  state.pieces = Object.fromEntries(Object.entries(state.pieces).map(([id, piece]) => {
    if (id === attacker.id) return [id, { ...piece, spaceId: attackerSpaceId }];
    if (id === defender.id) return [id, piece];
    if (piece.seatId === 'seat-1' || piece.seatId === 'seat-2') return [id, { ...piece, spaceId: null }];
    return [id, piece];
  }));

  return { state, attacker, defender };
}

function moveExpeditionOutOfContact(state, defender) {
  const computerPiece = Object.values(state.pieces).find(piece => piece.seatId === 'seat-2' && piece.spaceId);
  assert.ok(computerPiece?.spaceId);
  const blockedSpaceIds = new Set([
    computerPiece.spaceId,
    ...state.spaces[computerPiece.spaceId].adjacentSpaceIds
  ]);
  const safeSpaceId = Object.keys(state.spaces)
    .sort((a, b) => a.localeCompare(b))
    .find(spaceId => !blockedSpaceIds.has(spaceId));
  assert.ok(safeSpaceId, 'fixture requires one non-adjacent space for the surviving expedition formation');
  state.pieces[defender.id] = { ...state.pieces[defender.id], spaceId: safeSpaceId };
  return state;
}

test('BG5C computer activation chooses the canonical legal attack before other actions', () => {
  const { state, attacker, defender } = computerCombatState();

  const action = chooseAutomaticBoardAction(state);

  assert.deepEqual(action, {
    type: 'attack-piece',
    attackerPieceId: attacker.id,
    defenderPieceId: defender.id
  });
});

test('BG5C computer attack still resolves through the shared authoritative dispatcher', () => {
  const { state, attacker, defender } = computerCombatState();
  const action = chooseAutomaticBoardAction(state);
  assert.ok(action);

  const result = applyBoardAction(state, action);

  assert.equal(result.accepted, true);
  assert.equal(result.commandActionsSpent, 1);
  assert.equal(result.state.rng.calls, state.rng.calls + 1);
  assert.equal(result.state.seats['seat-2'].commandActionsRemaining, 3);
  assert.equal(result.state.combat.attackerPieceId, attacker.id);
  assert.equal(result.state.combat.defenderPieceId, defender.id);
  assert.equal(result.state.activeSeat, 'seat-1');
});

test('BG5C identical computer positions choose the same attack without consuming RNG', () => {
  const first = computerCombatState(2001).state;
  const second = computerCombatState(2001).state;

  const firstAction = chooseAutomaticBoardAction(first);
  const secondAction = chooseAutomaticBoardAction(second);

  assert.deepEqual(firstAction, secondAction);
  assert.equal(first.rng.calls, 0);
  assert.equal(second.rng.calls, 0);
});

test('BG5C no-attack fallback remains dispatcher-legal after BG9 expands computer actions', () => {
  const { state, defender } = computerCombatState();
  moveExpeditionOutOfContact(state, defender);

  const action = chooseAutomaticBoardAction(state);
  assert.ok(action);
  assert.notEqual(action.type, 'pass-activation');
  assert.equal(applyBoardAction(state, action).accepted, true);
});

test('BG5C computer cannot create a zero-cost Pass loop when nobody else can activate', () => {
  const { state, defender } = computerCombatState();
  moveExpeditionOutOfContact(state, defender);
  state.seats['seat-1'] = { ...state.seats['seat-1'], commandActionsRemaining: 0 };

  const action = chooseAutomaticBoardAction(state);
  assert.ok(action);
  assert.notEqual(action.type, 'pass-activation');

  const result = applyBoardAction(state, action);
  assert.equal(result.accepted, true);
  assert.ok(result.commandActionsSpent > 0 || action.type === 'end-seat-actions');
});
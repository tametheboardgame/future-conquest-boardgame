const test = require('node:test');
const assert = require('node:assert/strict');

const { applyBoardAction } = require('../.test-dist/board-action-dispatcher.js');
const {
  BOARD_COMBAT_ELIMINATION_DAMAGE,
  BOARD_COMBAT_RETREAT_THRESHOLD,
  getBoardCombatTargets
} = require('../.test-dist/board-combat.js');
const {
  createInitialBoardState,
  deserializeBoardState,
  serializeBoardState,
  startBoardRound
} = require('../.test-dist/board-state.js');

function startedState(seed = 14848) {
  return startBoardRound(createInitialBoardState({
    seed,
    controllers: { 'seat-1': 'human', 'seat-2': 'human' }
  })).state;
}

function adjacentEnemy(state, attackerPieceId = 'TG-1') {
  const attacker = state.pieces[attackerPieceId];
  assert.ok(attacker.spaceId);
  const targetSpaceId = state.spaces[attacker.spaceId].adjacentSpaceIds.find(spaceId =>
    Object.values(state.pieces).some(piece => piece.spaceId === spaceId && piece.seatId !== attacker.seatId)
  );
  assert.ok(targetSpaceId);
  const defender = Object.values(state.pieces).find(piece =>
    piece.spaceId === targetSpaceId && piece.seatId !== attacker.seatId
  );
  assert.ok(defender);
  return { attacker, defender, targetSpaceId };
}

test('BG5B dispatcher atomically resolves a previewed 2D6 attack for exactly one Command Action', () => {
  const state = startedState();
  const { defender } = adjacentEnemy(state);
  const beforeRngCalls = state.rng.calls;

  const result = applyBoardAction(state, {
    type: 'attack-piece',
    attackerPieceId: 'TG-1',
    defenderPieceId: defender.id
  });

  assert.equal(result.accepted, true);
  assert.equal(result.commandActionsSpent, 1);
  assert.equal(result.state.rng.calls, beforeRngCalls + 1);
  assert.equal(result.state.seats['seat-1'].commandActionsRemaining, 3);
  assert.equal(result.state.activeSeat, 'seat-2');
  assert.equal(result.state.combat.status, 'resolved');
  assert.deepEqual(result.state.combat.roll.dice, [6, 4]);
  assert.equal(result.state.combat.roll.die, 10);
});

test('BG5B dispatcher rejects malformed attacks without cost or mutation', () => {
  const state = startedState();
  const before = serializeBoardState(state);

  const result = applyBoardAction(state, { type: 'attack-piece', attackerPieceId: 'TG-1' });

  assert.equal(result.accepted, false);
  assert.equal(result.commandActionsSpent, 0);
  assert.equal(result.state, state);
  assert.match(result.reason, /requires string attackerPieceId and defenderPieceId/);
  assert.equal(serializeBoardState(state), before);
});

test('BG5B exposes only legal adjacent hostile pieces as combat targets', () => {
  const state = startedState();
  const targets = getBoardCombatTargets(state, 'TG-1');
  const attackerSpace = state.pieces['TG-1'].spaceId;

  assert.ok(targets.length > 0);
  assert.ok(targets.every(target => state.spaces[attackerSpace].adjacentSpaceIds.includes(target.targetSpaceId)));
  assert.ok(targets.every(target => state.pieces[target.defenderPieceId].seatId !== 'seat-1'));
  assert.deepEqual(targets.map(target => target.defenderPieceId), [...targets.map(target => target.defenderPieceId)].sort());
});

test('BG5B a second ordinary hit forces a surviving defender to retreat and captures a cleared space', () => {
  const state = startedState();
  const { defender, targetSpaceId } = adjacentEnemy(state);
  state.pieces[defender.id] = { ...defender, readiness: 75 };
  const originSpaceId = state.pieces['TG-1'].spaceId;

  const result = applyBoardAction(state, {
    type: 'attack-piece',
    attackerPieceId: 'TG-1',
    defenderPieceId: defender.id
  });

  assert.equal(result.state.combat.roll.outcome, 'hit');
  assert.equal(result.state.combat.consequence.critical, false);
  assert.equal(result.state.combat.consequence.defenderStatus, 'retreated');
  assert.equal(result.state.pieces[defender.id].readiness, BOARD_COMBAT_RETREAT_THRESHOLD);
  assert.equal(result.state.pieces[defender.id].damage, 1);
  assert.notEqual(result.state.pieces[defender.id].spaceId, targetSpaceId);
  assert.notEqual(result.state.pieces[defender.id].spaceId, originSpaceId);
  assert.equal(result.state.pieces['TG-1'].spaceId, targetSpaceId);
  assert.equal(result.state.spaces[targetSpaceId].control, 'seat-1');
  assert.equal(result.state.combat.consequence.attackerAdvanced, true);
  assert.equal(result.state.combat.consequence.controlChanged, true);
});

test('BG5B reaching three damage eliminates the defender and advances into the cleared space', () => {
  const state = startedState();
  const { defender, targetSpaceId } = adjacentEnemy(state);
  state.pieces[defender.id] = { ...defender, damage: BOARD_COMBAT_ELIMINATION_DAMAGE - 1 };

  const result = applyBoardAction(state, {
    type: 'attack-piece',
    attackerPieceId: 'TG-1',
    defenderPieceId: defender.id
  });

  assert.equal(result.state.combat.roll.outcome, 'hit');
  assert.equal(result.state.combat.consequence.critical, false);
  assert.equal(result.state.combat.consequence.defenderStatus, 'eliminated');
  assert.equal(result.state.pieces[defender.id].damage, BOARD_COMBAT_ELIMINATION_DAMAGE);
  assert.equal(result.state.pieces[defender.id].spaceId, null);
  assert.equal(result.state.pieces['TG-1'].spaceId, targetSpaceId);
  assert.equal(result.state.spaces[targetSpaceId].control, 'seat-1');
});

test('BG5B double six is a visible critical hit with doubled damage/readiness loss', () => {
  const state = startedState(15872);
  const { defender } = adjacentEnemy(state);

  const result = applyBoardAction(state, {
    type: 'attack-piece',
    attackerPieceId: 'TG-1',
    defenderPieceId: defender.id
  });

  assert.deepEqual(result.state.combat.roll.dice, [6, 6]);
  assert.equal(result.state.combat.roll.die, 12);
  assert.equal(result.state.combat.roll.outcome, 'hit');
  assert.equal(result.state.combat.consequence.critical, true);
  assert.equal(result.state.combat.consequence.damageInflicted, 2);
  assert.equal(result.state.combat.consequence.readinessLoss, 50);
  assert.equal(result.state.pieces[defender.id].damage, 2);
  assert.equal(result.state.pieces[defender.id].readiness, 50);
});

test('BG5B a defender with no legal retreat takes an additional loss and can be eliminated', () => {
  const state = startedState();
  const { defender, targetSpaceId } = adjacentEnemy(state);
  state.pieces[defender.id] = { ...defender, readiness: 75, damage: 1 };
  const attackerSeat = state.pieces['TG-1'].seatId;
  const originSpaceId = state.pieces['TG-1'].spaceId;

  for (const spaceId of state.spaces[targetSpaceId].adjacentSpaceIds) {
    if (spaceId === originSpaceId) continue;
    state.spaces[spaceId] = { ...state.spaces[spaceId], control: attackerSeat };
  }

  const result = applyBoardAction(state, {
    type: 'attack-piece',
    attackerPieceId: 'TG-1',
    defenderPieceId: defender.id
  });

  assert.equal(result.state.combat.roll.outcome, 'hit');
  assert.equal(result.state.combat.consequence.critical, false);
  assert.equal(result.state.combat.consequence.retreatSpaceId, null);
  assert.equal(result.state.combat.consequence.damageInflicted, 2);
  assert.equal(result.state.combat.consequence.readinessLoss, 50);
  assert.equal(result.state.combat.consequence.defenderStatus, 'eliminated');
  assert.equal(result.state.pieces[defender.id].spaceId, null);
});

test('BG5B misses leave piece tracks, position and control unchanged', () => {
  const state = startedState(20260828);
  const { defender, targetSpaceId } = adjacentEnemy(state);
  const defenderBefore = { ...defender };
  const controlBefore = state.spaces[targetSpaceId].control;

  const result = applyBoardAction(state, {
    type: 'attack-piece',
    attackerPieceId: 'TG-1',
    defenderPieceId: defender.id
  });

  assert.deepEqual(result.state.combat.roll.dice, [1, 4]);
  assert.equal(result.state.combat.roll.die, 5);
  assert.equal(result.state.combat.roll.outcome, 'miss');
  assert.deepEqual(result.state.pieces[defender.id], defenderBefore);
  assert.equal(result.state.spaces[targetSpaceId].control, controlBefore);
  assert.equal(result.state.combat.consequence.defenderStatus, 'held');
  assert.equal(result.state.combat.consequence.damageInflicted, 0);
});

test('BG5B resolved combat consequences survive exact save and reload', () => {
  const state = startedState();
  const { defender } = adjacentEnemy(state);
  state.pieces[defender.id] = { ...defender, readiness: 75 };

  const attacked = applyBoardAction(state, {
    type: 'attack-piece',
    attackerPieceId: 'TG-1',
    defenderPieceId: defender.id
  });
  assert.equal(attacked.accepted, true);

  const restored = deserializeBoardState(serializeBoardState(attacked.state));
  assert.deepEqual(restored, attacked.state);
  assert.deepEqual(restored.combat.roll.dice, [6, 4]);
  assert.equal(restored.combat.consequence.defenderStatus, 'retreated');
});
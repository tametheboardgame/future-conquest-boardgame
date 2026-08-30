const test = require('node:test');
const assert = require('node:assert/strict');

const { getBoardCombatPreview } = require('../.test-dist/board-combat.js');
const { applyBoardAction } = require('../.test-dist/board-action-dispatcher.js');
const {
  BOARD_FORTIFICATION_LIMIT,
  BOARD_RECOVERY_READINESS_GAIN
} = require('../.test-dist/board-support-actions.js');
const {
  createInitialBoardState,
  serializeBoardState,
  startBoardRound
} = require('../.test-dist/board-state.js');

function startedState() {
  return startBoardRound(createInitialBoardState({
    seed: 20260830,
    controllers: { 'seat-1': 'human', 'seat-2': 'human' }
  })).state;
}

function ownPiece(state, pieceId = 'TG-1') {
  const piece = state.pieces[pieceId];
  assert.ok(piece);
  assert.equal(piece.seatId, 'seat-1');
  assert.ok(piece.spaceId);
  return piece;
}

function adjacentEnemySetup(state, attackerId = 'TG-1') {
  const attacker = ownPiece(state, attackerId);
  const origin = state.spaces[attacker.spaceId];
  const targetSpaceId = origin.adjacentSpaceIds[0];
  assert.ok(targetSpaceId);
  const defender = Object.values(state.pieces).find(piece => piece.seatId === 'seat-2');
  assert.ok(defender);
  state.pieces = {
    ...state.pieces,
    [defender.id]: { ...defender, spaceId: targetSpaceId }
  };
  return { attackerId, defenderId: defender.id, targetSpaceId };
}

test('BG7 Recover repairs one damage, restores readiness and spends exactly one Command Action', () => {
  const state = startedState();
  const piece = ownPiece(state);
  state.pieces = {
    ...state.pieces,
    [piece.id]: { ...piece, damage: 2, readiness: 40 }
  };

  const result = applyBoardAction(state, { type: 'recover-piece', pieceId: piece.id });

  assert.equal(result.accepted, true);
  assert.equal(result.commandActionsSpent, 1);
  assert.equal(result.state.pieces[piece.id].damage, 1);
  assert.equal(result.state.pieces[piece.id].readiness, 40 + BOARD_RECOVERY_READINESS_GAIN);
  assert.equal(result.state.seats['seat-1'].commandActionsRemaining, 3);
  assert.equal(result.state.activeSeat, 'seat-2');
});

test('BG7 Recover caps readiness and rejects a pristine formation without cost or mutation', () => {
  const state = startedState();
  const piece = ownPiece(state);
  state.pieces = {
    ...state.pieces,
    [piece.id]: { ...piece, damage: 1, readiness: 90 }
  };

  const repaired = applyBoardAction(state, { type: 'recover-piece', pieceId: piece.id });
  assert.equal(repaired.accepted, true);
  assert.equal(repaired.state.pieces[piece.id].damage, 0);
  assert.equal(repaired.state.pieces[piece.id].readiness, 100);

  const pristine = startedState();
  const pristinePiece = ownPiece(pristine);
  pristine.pieces = {
    ...pristine.pieces,
    [pristinePiece.id]: { ...pristinePiece, damage: 0, readiness: 100 }
  };
  const before = serializeBoardState(pristine);
  const rejected = applyBoardAction(pristine, { type: 'recover-piece', pieceId: pristinePiece.id });

  assert.equal(rejected.accepted, false);
  assert.equal(rejected.commandActionsSpent, 0);
  assert.equal(rejected.state, pristine);
  assert.equal(serializeBoardState(pristine), before);
  assert.match(rejected.reason, /full readiness/);
});

test('BG7 Logistics improves supply one visible step and immediately improves the BG5 attack modifier', () => {
  const state = startedState();
  const { attackerId, defenderId } = adjacentEnemySetup(state);
  state.pieces = {
    ...state.pieces,
    [attackerId]: { ...state.pieces[attackerId], supply: 'isolated' }
  };

  const beforePreview = getBoardCombatPreview(state, attackerId, defenderId);
  assert.equal(beforePreview.legal, true);
  assert.equal(beforePreview.modifiers.supply, -2);

  const result = applyBoardAction(state, { type: 'logistics-piece', pieceId: attackerId });

  assert.equal(result.accepted, true);
  assert.equal(result.commandActionsSpent, 1);
  assert.equal(result.state.pieces[attackerId].supply, 'strained');

  const previewState = {
    ...result.state,
    activeSeat: 'seat-1',
    seats: {
      ...result.state.seats,
      'seat-1': { ...result.state.seats['seat-1'], commandActionsRemaining: 1 }
    }
  };
  const afterPreview = getBoardCombatPreview(previewState, attackerId, defenderId);
  assert.equal(afterPreview.legal, true);
  assert.equal(afterPreview.modifiers.supply, -1);
});

test('BG7 Logistics progresses strained to supplied and rejects already supplied formations', () => {
  const state = startedState();
  const piece = ownPiece(state);
  state.pieces = {
    ...state.pieces,
    [piece.id]: { ...piece, supply: 'strained' }
  };

  const improved = applyBoardAction(state, { type: 'logistics-piece', pieceId: piece.id });
  assert.equal(improved.accepted, true);
  assert.equal(improved.state.pieces[piece.id].supply, 'supplied');

  const supplied = startedState();
  const suppliedPiece = ownPiece(supplied);
  supplied.pieces = {
    ...supplied.pieces,
    [suppliedPiece.id]: { ...suppliedPiece, supply: 'supplied' }
  };
  const before = serializeBoardState(supplied);
  const rejected = applyBoardAction(supplied, { type: 'logistics-piece', pieceId: suppliedPiece.id });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.commandActionsSpent, 0);
  assert.equal(serializeBoardState(supplied), before);
  assert.match(rejected.reason, /already supplied/);
});

test('BG7 Engineer raises friendly fortification and immediately raises the BG5 defence target', () => {
  const state = startedState();
  const attacker = ownPiece(state);
  const spaceId = attacker.spaceId;
  state.spaces = {
    ...state.spaces,
    [spaceId]: { ...state.spaces[spaceId], control: 'seat-1', fortification: 0 }
  };

  const result = applyBoardAction(state, { type: 'engineer-position', pieceId: attacker.id });
  assert.equal(result.accepted, true);
  assert.equal(result.commandActionsSpent, 1);
  assert.equal(result.state.spaces[spaceId].fortification, 1);

  const combatState = startedState();
  const setup = adjacentEnemySetup(combatState);
  combatState.spaces = {
    ...combatState.spaces,
    [setup.targetSpaceId]: { ...combatState.spaces[setup.targetSpaceId], control: 'seat-2', fortification: 0 }
  };
  const unfortified = getBoardCombatPreview(combatState, setup.attackerId, setup.defenderId);
  assert.equal(unfortified.legal, true);

  combatState.spaces[setup.targetSpaceId] = {
    ...combatState.spaces[setup.targetSpaceId],
    fortification: 1
  };
  const fortified = getBoardCombatPreview(combatState, setup.attackerId, setup.defenderId);
  assert.equal(fortified.legal, true);
  assert.equal(fortified.modifiers.fortification, unfortified.modifiers.fortification + 1);
  assert.equal(fortified.target, unfortified.target + 1);
});

test('BG7 Engineer requires friendly control and respects the fortification cap without cost', () => {
  const hostile = startedState();
  const piece = ownPiece(hostile);
  const spaceId = piece.spaceId;
  hostile.spaces = {
    ...hostile.spaces,
    [spaceId]: { ...hostile.spaces[spaceId], control: null }
  };
  const hostileBefore = serializeBoardState(hostile);
  const wrongControl = applyBoardAction(hostile, { type: 'engineer-position', pieceId: piece.id });
  assert.equal(wrongControl.accepted, false);
  assert.equal(wrongControl.commandActionsSpent, 0);
  assert.equal(serializeBoardState(hostile), hostileBefore);
  assert.match(wrongControl.reason, /only Engineer a position controlled/);

  const capped = startedState();
  const cappedPiece = ownPiece(capped);
  capped.spaces = {
    ...capped.spaces,
    [cappedPiece.spaceId]: {
      ...capped.spaces[cappedPiece.spaceId],
      control: 'seat-1',
      fortification: BOARD_FORTIFICATION_LIMIT
    }
  };
  const cappedBefore = serializeBoardState(capped);
  const capResult = applyBoardAction(capped, { type: 'engineer-position', pieceId: cappedPiece.id });
  assert.equal(capResult.accepted, false);
  assert.equal(capResult.commandActionsSpent, 0);
  assert.equal(serializeBoardState(capped), cappedBefore);
  assert.match(capResult.reason, /already at fortification/);
});

test('BG7 support actions share activation, ownership and payload guardrails', () => {
  const roundStart = createInitialBoardState({ seed: 20260830 });
  const wrongPhase = applyBoardAction(roundStart, { type: 'recover-piece', pieceId: 'TG-1' });
  assert.equal(wrongPhase.accepted, false);
  assert.equal(wrongPhase.commandActionsSpent, 0);
  assert.match(wrongPhase.reason, /round-start phase/);

  const enemyPieceState = startedState();
  const enemyPiece = Object.values(enemyPieceState.pieces).find(piece => piece.seatId === 'seat-2');
  assert.ok(enemyPiece);
  const wrongOwner = applyBoardAction(enemyPieceState, { type: 'logistics-piece', pieceId: enemyPiece.id });
  assert.equal(wrongOwner.accepted, false);
  assert.match(wrongOwner.reason, /not active seat/);

  const exhausted = startedState();
  exhausted.seats['seat-1'] = { ...exhausted.seats['seat-1'], commandActionsRemaining: 0 };
  const noActions = applyBoardAction(exhausted, { type: 'engineer-position', pieceId: 'TG-1' });
  assert.equal(noActions.accepted, false);
  assert.match(noActions.reason, /no Command Actions remaining/);

  const malformed = applyBoardAction(startedState(), { type: 'recover-piece' });
  assert.equal(malformed.accepted, false);
  assert.equal(malformed.commandActionsSpent, 0);
  assert.match(malformed.reason, /requires a string pieceId/);
});

test('BG7 support actions do not consume RNG and persist through the existing board save format', () => {
  const state = startedState();
  const piece = ownPiece(state);
  state.pieces = {
    ...state.pieces,
    [piece.id]: { ...piece, damage: 1, readiness: 70 }
  };
  const rngBefore = { ...state.rng };

  const result = applyBoardAction(state, { type: 'recover-piece', pieceId: piece.id });
  assert.equal(result.accepted, true);
  assert.deepEqual(result.state.rng, rngBefore);

  const saved = JSON.parse(serializeBoardState(result.state));
  assert.equal(saved.pieces[piece.id].damage, 0);
  assert.equal(saved.pieces[piece.id].readiness, 95);
  assert.deepEqual(saved.rng, rngBefore);
});

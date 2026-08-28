const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyBoardAction,
  createInitialBoardState,
  deserializeBoardState,
  getBoardMoveDestinations,
  isBoardRoundExhausted,
  serializeBoardState,
  startBoardRound
} = require('../.test-dist/board-state.js');
const { chooseAutomaticBoardAction } = require('../.test-dist/board-turn-orchestration.js');

function startedState(options = {}) {
  return startBoardRound(createInitialBoardState({
    seed: 20260828,
    controllers: { 'seat-1': 'human', 'seat-2': 'human' },
    ...options
  })).state;
}

function originAndAdjacent(state, pieceId = 'TG-1') {
  const origin = state.pieces[pieceId].spaceId;
  assert.ok(origin);
  const adjacent = state.spaces[origin].adjacentSpaceIds[0];
  assert.ok(adjacent);
  return { origin, adjacent };
}

function clearHostileOccupants(state, spaceId) {
  state.pieces = Object.fromEntries(Object.entries(state.pieces).map(([id, piece]) => [
    id,
    piece.spaceId === spaceId && piece.seatId !== state.activeSeat
      ? { ...piece, spaceId: null }
      : piece
  ]));
}

function makeDestinationLegal(state, spaceId, control = null) {
  state.spaces = {
    ...state.spaces,
    [spaceId]: { ...state.spaces[spaceId], control }
  };
  clearHostileOccupants(state, spaceId);
}

test('BG4B move-piece spends exactly one Command Action, moves one adjacent space and advances activation', () => {
  const state = startedState();
  const { origin, adjacent } = originAndAdjacent(state);
  makeDestinationLegal(state, adjacent, null);
  const before = serializeBoardState(state);

  const result = applyBoardAction(state, {
    type: 'move-piece',
    pieceId: 'TG-1',
    destinationSpaceId: adjacent
  });

  assert.equal(result.accepted, true);
  assert.equal(result.commandActionsSpent, 1);
  assert.equal(result.state.pieces['TG-1'].spaceId, adjacent);
  assert.equal(result.state.seats['seat-1'].commandActionsRemaining, 3);
  assert.equal(result.state.activeSeat, 'seat-2');
  assert.equal(state.pieces['TG-1'].spaceId, origin);
  assert.equal(state.seats['seat-1'].commandActionsRemaining, 4);
  assert.equal(serializeBoardState(state), before);
});

test('BG4B permits friendly destinations, including friendly stacking', () => {
  const state = startedState();
  const { adjacent } = originAndAdjacent(state);
  makeDestinationLegal(state, adjacent, 'seat-1');
  state.pieces['TG-2'] = { ...state.pieces['TG-2'], spaceId: adjacent };

  const result = applyBoardAction(state, {
    type: 'move-piece',
    pieceId: 'TG-1',
    destinationSpaceId: adjacent
  });

  assert.equal(result.accepted, true);
  assert.equal(result.state.pieces['TG-1'].spaceId, adjacent);
  assert.equal(result.state.pieces['TG-2'].spaceId, adjacent);
});

test('BG4B rejects hostile control without mutation or Command Action cost', () => {
  const state = startedState();
  const { adjacent } = originAndAdjacent(state);
  const before = serializeBoardState(state);

  const result = applyBoardAction(state, {
    type: 'move-piece',
    pieceId: 'TG-1',
    destinationSpaceId: adjacent
  });

  assert.equal(result.accepted, false);
  assert.equal(result.commandActionsSpent, 0);
  assert.equal(result.state, state);
  assert.match(result.reason, /controlled by hostile seat/);
  assert.equal(serializeBoardState(state), before);
});

test('BG4B rejects a hostile occupant even when destination control is neutral', () => {
  const state = startedState();
  const { adjacent } = originAndAdjacent(state);
  state.spaces[adjacent] = { ...state.spaces[adjacent], control: null };
  const hostilePiece = Object.values(state.pieces).find(piece =>
    piece.spaceId === adjacent && piece.seatId !== state.activeSeat
  );
  assert.ok(hostilePiece);
  const before = serializeBoardState(state);

  const result = applyBoardAction(state, {
    type: 'move-piece',
    pieceId: 'TG-1',
    destinationSpaceId: adjacent
  });

  assert.equal(result.accepted, false);
  assert.equal(result.commandActionsSpent, 0);
  assert.equal(result.state, state);
  assert.match(result.reason, /blocked by hostile piece/);
  assert.equal(serializeBoardState(state), before);
});

test('BG4B rejects non-adjacent movement without cost', () => {
  const state = startedState();
  const { origin } = originAndAdjacent(state);
  const nonAdjacent = Object.keys(state.spaces).find(id =>
    id !== origin && !state.spaces[origin].adjacentSpaceIds.includes(id)
  );
  assert.ok(nonAdjacent);
  makeDestinationLegal(state, nonAdjacent, null);
  const before = serializeBoardState(state);

  const result = applyBoardAction(state, {
    type: 'move-piece',
    pieceId: 'TG-1',
    destinationSpaceId: nonAdjacent
  });

  assert.equal(result.accepted, false);
  assert.equal(result.commandActionsSpent, 0);
  assert.equal(result.state, state);
  assert.match(result.reason, /not adjacent/);
  assert.equal(serializeBoardState(state), before);
});

test('BG4B requires activation phase, active-seat ownership and remaining Command Actions', () => {
  const roundStart = createInitialBoardState({ seed: 20260828 });
  const roundStartDestination = roundStart.spaces[roundStart.pieces['TG-1'].spaceId].adjacentSpaceIds[0];
  const wrongPhase = applyBoardAction(roundStart, {
    type: 'move-piece',
    pieceId: 'TG-1',
    destinationSpaceId: roundStartDestination
  });
  assert.equal(wrongPhase.accepted, false);
  assert.match(wrongPhase.reason, /round-start phase/);

  const enemyTurn = startedState();
  enemyTurn.activeSeat = 'seat-2';
  const { adjacent: enemyDestination } = originAndAdjacent(enemyTurn, 'TG-1');
  makeDestinationLegal(enemyTurn, enemyDestination, null);
  const wrongOwner = applyBoardAction(enemyTurn, {
    type: 'move-piece',
    pieceId: 'TG-1',
    destinationSpaceId: enemyDestination
  });
  assert.equal(wrongOwner.accepted, false);
  assert.equal(wrongOwner.commandActionsSpent, 0);
  assert.match(wrongOwner.reason, /not active seat/);

  const exhausted = startedState();
  exhausted.seats['seat-1'] = { ...exhausted.seats['seat-1'], commandActionsRemaining: 0 };
  const { adjacent: exhaustedDestination } = originAndAdjacent(exhausted);
  makeDestinationLegal(exhausted, exhaustedDestination, null);
  const noActions = applyBoardAction(exhausted, {
    type: 'move-piece',
    pieceId: 'TG-1',
    destinationSpaceId: exhaustedDestination
  });
  assert.equal(noActions.accepted, false);
  assert.equal(noActions.commandActionsSpent, 0);
  assert.match(noActions.reason, /no Command Actions remaining/);
});

test('BG4B dispatcher rejects malformed move-piece payloads without mutation', () => {
  const state = startedState();
  const before = serializeBoardState(state);

  const result = applyBoardAction(state, { type: 'move-piece', pieceId: 'TG-1' });

  assert.equal(result.accepted, false);
  assert.equal(result.commandActionsSpent, 0);
  assert.equal(result.state, state);
  assert.match(result.reason, /requires string pieceId and destinationSpaceId/);
  assert.equal(serializeBoardState(state), before);
});

test('BG4B enumerates legal destinations and explicit rejection reasons from authoritative rules', () => {
  const state = startedState();
  const { origin, adjacent } = originAndAdjacent(state);
  makeDestinationLegal(state, adjacent, null);
  const nonAdjacent = Object.keys(state.spaces).find(id =>
    id !== origin && !state.spaces[origin].adjacentSpaceIds.includes(id)
  );
  assert.ok(nonAdjacent);

  const evaluations = getBoardMoveDestinations(state, 'TG-1');
  assert.equal(evaluations.length, Object.keys(state.spaces).length);

  const legal = evaluations.find(item => item.spaceId === adjacent);
  assert.deepEqual(legal, { spaceId: adjacent, legal: true, reason: null });

  const current = evaluations.find(item => item.spaceId === origin);
  assert.equal(current.legal, false);
  assert.match(current.reason, /already occupies/);

  const distant = evaluations.find(item => item.spaceId === nonAdjacent);
  assert.equal(distant.legal, false);
  assert.match(distant.reason, /not adjacent/);
});

test('BG4B paid movement uses BG3 progression when other seats are exhausted', () => {
  const state = startedState();
  const { adjacent } = originAndAdjacent(state);
  makeDestinationLegal(state, adjacent, null);
  state.seats['seat-1'] = { ...state.seats['seat-1'], commandActionsRemaining: 2 };
  state.seats['seat-2'] = { ...state.seats['seat-2'], commandActionsRemaining: 0 };

  const result = applyBoardAction(state, {
    type: 'move-piece',
    pieceId: 'TG-1',
    destinationSpaceId: adjacent
  });

  assert.equal(result.accepted, true);
  assert.equal(result.state.seats['seat-1'].commandActionsRemaining, 1);
  assert.equal(result.state.activeSeat, 'seat-1');
  assert.equal(isBoardRoundExhausted(result.state), false);
});

test('BG4B final paid action exposes round exhaustion to existing BG3 automatic orchestration', () => {
  const state = startedState();
  const { adjacent } = originAndAdjacent(state);
  makeDestinationLegal(state, adjacent, null);
  state.seats['seat-1'] = { ...state.seats['seat-1'], commandActionsRemaining: 1 };
  state.seats['seat-2'] = { ...state.seats['seat-2'], commandActionsRemaining: 0 };

  const moved = applyBoardAction(state, {
    type: 'move-piece',
    pieceId: 'TG-1',
    destinationSpaceId: adjacent
  });

  assert.equal(moved.accepted, true);
  assert.equal(moved.state.seats['seat-1'].commandActionsRemaining, 0);
  assert.equal(isBoardRoundExhausted(moved.state), true);

  const automatic = chooseAutomaticBoardAction(moved.state);
  assert.deepEqual(automatic, { type: 'end-round' });
  const ended = applyBoardAction(moved.state, automatic);
  assert.equal(ended.accepted, true);
  assert.equal(ended.state.phase, 'round-end');
});

test('BG4B moved board positions survive exact save and reload', () => {
  const state = startedState();
  const { adjacent } = originAndAdjacent(state);
  makeDestinationLegal(state, adjacent, 'seat-1');

  const moved = applyBoardAction(state, {
    type: 'move-piece',
    pieceId: 'TG-1',
    destinationSpaceId: adjacent
  });
  assert.equal(moved.accepted, true);

  const restored = deserializeBoardState(serializeBoardState(moved.state));
  assert.deepEqual(restored, moved.state);
  assert.equal(restored.pieces['TG-1'].spaceId, adjacent);
  assert.equal(restored.activeSeat, 'seat-2');
});

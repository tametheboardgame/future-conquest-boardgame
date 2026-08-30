const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BOARD_ACTION_CARDS,
  BOARD_ACTION_HAND_LIMIT,
  getBoardActionCard,
  initialiseBoardActionDeck,
  prepareBoardActionCardsForRound
} = require('../.test-dist/board-action-cards.js');
const { applyBoardAction } = require('../.test-dist/board-action-dispatcher.js');
const {
  advanceBoardRound,
  createInitialBoardState,
  endBoardRound,
  startBoardRound
} = require('../.test-dist/board-state.js');
const {
  BOARD_STATE_SAVE_KEY,
  inspectStoredBoardState,
  writeBoardState
} = require('../.test-dist/board-state-persistence.js');
const { chooseAutomaticBoardAction } = require('../.test-dist/board-turn-orchestration.js');

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem(key) {
      return key === BOARD_STATE_SAVE_KEY ? value : null;
    },
    setItem(key, next) {
      if (key === BOARD_STATE_SAVE_KEY) value = next;
    },
    removeItem(key) {
      if (key === BOARD_STATE_SAVE_KEY) value = null;
    }
  };
}

function resolvePreRound(state) {
  const escalation = applyBoardAction(state, { type: 'resolve-escalation' });
  assert.equal(escalation.accepted, true);
  const cards = applyBoardAction(escalation.state, { type: 'prepare-action-cards' });
  assert.equal(cards.accepted, true);
  return cards.state;
}

function activationState(seed = 0x8801) {
  const prepared = resolvePreRound(createInitialBoardState({ seed }));
  const started = startBoardRound(prepared);
  assert.equal(started.accepted, true);
  return started.state;
}

function giveCard(state, cardId) {
  return {
    ...state,
    decks: {
      ...state.decks,
      action: {
        ...state.decks.action,
        handBySeat: {
          ...state.decks.action.handBySeat,
          [state.activeSeat]: [cardId]
        }
      }
    }
  };
}

test('BG8 represents all six roadmap card families in one compact saved action deck', () => {
  assert.equal(BOARD_ACTION_CARDS.length, 12);
  assert.deepEqual([...new Set(BOARD_ACTION_CARDS.map(card => card.family))].sort(), [
    'command',
    'escalation',
    'event',
    'national-response',
    'scenario',
    'support'
  ]);
  assert.ok(BOARD_ACTION_CARDS.every(card => [
    'move-piece',
    'recover-piece',
    'engineer-position',
    'logistics-piece'
  ].includes(card.effect)));
});

test('BG8 identical seeds produce identical action deck order, hands and RNG state', () => {
  const first = resolvePreRound(createInitialBoardState({ seed: 0x8802 }));
  const second = resolvePreRound(createInitialBoardState({ seed: 0x8802 }));

  assert.deepEqual(first.decks.action, second.decks.action);
  assert.deepEqual(first.rng, second.rng);
  assert.equal(first.decks.action.handBySeat['seat-1'].length, 2);
  assert.equal(first.decks.action.handBySeat['seat-2'].length, 2);
  assert.equal(first.decks.action.draw.length, 8);
  assert.equal(first.actionCardsPreparedRound, 1);
});

test('BG8 different seeds materially vary the action deck while keeping the same card set', () => {
  const first = initialiseBoardActionDeck(createInitialBoardState({ seed: 0x8803 }));
  const second = initialiseBoardActionDeck(createInitialBoardState({ seed: 0x9917 }));

  assert.notDeepEqual(first.decks.action.draw, second.decks.action.draw);
  assert.deepEqual([...first.decks.action.draw].sort(), [...second.decks.action.draw].sort());
});

test('BG8 orchestration prepares cards after escalation and before round start', () => {
  const state = createInitialBoardState({ seed: 0x8804 });
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'resolve-escalation' });

  const escalation = applyBoardAction(state, { type: 'resolve-escalation' });
  assert.equal(escalation.accepted, true);
  assert.deepEqual(chooseAutomaticBoardAction(escalation.state), { type: 'prepare-action-cards' });

  const cards = applyBoardAction(escalation.state, { type: 'prepare-action-cards' });
  assert.equal(cards.accepted, true);
  assert.deepEqual(chooseAutomaticBoardAction(cards.state), { type: 'start-round' });
});

test('BG8 later rounds draw one card per participating seat and respect the three-card hand limit', () => {
  let state = resolvePreRound(createInitialBoardState({ seed: 0x8805 }));
  state = startBoardRound(state).state;
  state.seats['seat-1'].commandActionsRemaining = 0;
  state.seats['seat-2'].commandActionsRemaining = 0;
  state = endBoardRound(state).state;
  state = advanceBoardRound(state).state;
  state = applyBoardAction(state, { type: 'resolve-escalation' }).state;
  state = prepareBoardActionCardsForRound(state).state;

  assert.equal(state.round, 2);
  assert.equal(state.decks.action.handBySeat['seat-1'].length, 3);
  assert.equal(state.decks.action.handBySeat['seat-2'].length, 3);
  assert.equal(state.actionCardsPreparedRound, 2);

  state = startBoardRound(state).state;
  state.seats['seat-1'].commandActionsRemaining = 0;
  state.seats['seat-2'].commandActionsRemaining = 0;
  state = endBoardRound(state).state;
  state = advanceBoardRound(state).state;
  state = applyBoardAction(state, { type: 'resolve-escalation' }).state;
  state = prepareBoardActionCardsForRound(state).state;

  assert.equal(state.round, 3);
  assert.equal(state.decks.action.handBySeat['seat-1'].length, BOARD_ACTION_HAND_LIMIT);
  assert.equal(state.decks.action.handBySeat['seat-2'].length, BOARD_ACTION_HAND_LIMIT);
});

test('BG8 reshuffles the saved discard pile deterministically when the draw pile is empty', () => {
  let state = createInitialBoardState({ seed: 0x8806 });
  state = { ...state, round: 2 };
  state = applyBoardAction(state, { type: 'resolve-escalation' }).state;
  state = {
    ...state,
    actionCardsPreparedRound: 1,
    decks: {
      ...state.decks,
      action: {
        ...state.decks.action,
        draw: [],
        discard: ['action-01-rapid-redeployment', 'action-03-field-repair-teams'],
        handBySeat: {
          ...state.decks.action.handBySeat,
          'seat-1': ['action-04-emergency-supply-column', 'action-06-road-repair-detachment'],
          'seat-2': ['action-09-national-reserve-priority', 'action-10-civil-engineering-corps']
        }
      }
    }
  };
  const callsBefore = state.rng.calls;

  const prepared = prepareBoardActionCardsForRound(state);
  assert.equal(prepared.accepted, true);
  assert.equal(prepared.state.decks.action.handBySeat['seat-1'].length, 3);
  assert.equal(prepared.state.decks.action.handBySeat['seat-2'].length, 3);
  assert.equal(prepared.state.decks.action.discard.length, 0);
  assert.ok(prepared.state.rng.calls > callsBefore);
});

test('BG8 Recover card uses the authoritative support effect for free and retains activation', () => {
  let state = activationState(0x8807);
  state.pieces['TG-1'] = { ...state.pieces['TG-1'], readiness: 55, damage: 2 };
  state = giveCard(state, 'action-03-field-repair-teams');
  const actionsBefore = state.seats['seat-1'].commandActionsRemaining;

  const result = applyBoardAction(state, {
    type: 'play-action-card',
    cardId: 'action-03-field-repair-teams',
    pieceId: 'TG-1'
  });

  assert.equal(result.accepted, true);
  assert.equal(result.commandActionsSpent, 0);
  assert.equal(result.state.activeSeat, 'seat-1');
  assert.equal(result.state.seats['seat-1'].commandActionsRemaining, actionsBefore);
  assert.equal(result.state.pieces['TG-1'].readiness, 80);
  assert.equal(result.state.pieces['TG-1'].damage, 1);
  assert.deepEqual(result.state.decks.action.handBySeat['seat-1'], []);
  assert.equal(result.state.decks.action.discard.at(-1), 'action-03-field-repair-teams');
});

test('BG8 Logistics and Engineer cards feed the same state consumed by BG5 combat', () => {
  let logisticsState = activationState(0x8808);
  logisticsState.pieces['TG-1'] = { ...logisticsState.pieces['TG-1'], supply: 'isolated' };
  logisticsState = giveCard(logisticsState, 'action-04-emergency-supply-column');
  const logistics = applyBoardAction(logisticsState, {
    type: 'play-action-card',
    cardId: 'action-04-emergency-supply-column',
    pieceId: 'TG-1'
  });
  assert.equal(logistics.accepted, true);
  assert.equal(logistics.state.pieces['TG-1'].supply, 'strained');

  let engineerState = activationState(0x8809);
  const spaceId = engineerState.pieces['TG-1'].spaceId;
  engineerState = giveCard(engineerState, 'action-06-road-repair-detachment');
  const engineer = applyBoardAction(engineerState, {
    type: 'play-action-card',
    cardId: 'action-06-road-repair-detachment',
    pieceId: 'TG-1'
  });
  assert.equal(engineer.accepted, true);
  assert.equal(engineer.state.spaces[spaceId].fortification, 1);
});

test('BG8 movement cards obey ordinary movement legality while supplying the free-action exception', () => {
  let state = activationState(0x8810);
  const piece = state.pieces['TG-1'];
  const destinationSpaceId = state.spaces[piece.spaceId].adjacentSpaceIds[0];
  state.spaces[destinationSpaceId] = { ...state.spaces[destinationSpaceId], control: 'seat-1' };
  state.pieces = Object.fromEntries(Object.entries(state.pieces).map(([id, candidate]) => [
    id,
    candidate.spaceId === destinationSpaceId && candidate.seatId !== 'seat-1'
      ? { ...candidate, spaceId: null }
      : candidate
  ]));
  state = giveCard(state, 'action-01-rapid-redeployment');
  const actionsBefore = state.seats['seat-1'].commandActionsRemaining;

  const result = applyBoardAction(state, {
    type: 'play-action-card',
    cardId: 'action-01-rapid-redeployment',
    pieceId: 'TG-1',
    destinationSpaceId
  });

  assert.equal(result.accepted, true);
  assert.equal(result.state.pieces['TG-1'].spaceId, destinationSpaceId);
  assert.equal(result.state.seats['seat-1'].commandActionsRemaining, actionsBefore);
  assert.equal(result.state.activeSeat, 'seat-1');
});

test('BG8 rejected or no-op card effects do not consume the card, action or state', () => {
  let state = activationState(0x8811);
  state = giveCard(state, 'action-03-field-repair-teams');

  const result = applyBoardAction(state, {
    type: 'play-action-card',
    cardId: 'action-03-field-repair-teams',
    pieceId: 'TG-1'
  });

  assert.equal(result.accepted, false);
  assert.equal(result.commandActionsSpent, 0);
  assert.strictEqual(result.state, state);
  assert.deepEqual(state.decks.action.handBySeat['seat-1'], ['action-03-field-repair-teams']);
  assert.equal(state.decks.action.discard.includes('action-03-field-repair-teams'), false);
});

test('BG8 action deck, hands, discard and prepared-round marker survive save/load', () => {
  let state = activationState(0x8812);
  state.pieces['TG-1'] = { ...state.pieces['TG-1'], readiness: 50, damage: 1 };
  state = giveCard(state, 'action-03-field-repair-teams');
  state = applyBoardAction(state, {
    type: 'play-action-card',
    cardId: 'action-03-field-repair-teams',
    pieceId: 'TG-1'
  }).state;

  const storage = memoryStorage();
  assert.equal(writeBoardState(storage, state).ok, true);
  const inspected = inspectStoredBoardState(storage);
  assert.equal(inspected.ok, true);
  assert.deepEqual(inspected.state.decks.action, state.decks.action);
  assert.equal(inspected.state.actionCardsPreparedRound, state.actionCardsPreparedRound);
});

test('BG8 lazily gives a current opening hand to later-round pre-card v3 saves without retroactive draws', () => {
  let legacy = {
    ...createInitialBoardState({ seed: 0x8813 }),
    round: 4,
    phase: 'round-start'
  };
  legacy = applyBoardAction(legacy, { type: 'resolve-escalation' }).state;

  const prepared = prepareBoardActionCardsForRound(legacy);
  assert.equal(prepared.accepted, true);
  assert.equal(prepared.state.actionCardsPreparedRound, 4);
  assert.equal(prepared.state.decks.action.handBySeat['seat-1'].length, 2);
  assert.equal(prepared.state.decks.action.handBySeat['seat-2'].length, 2);
  assert.equal(prepared.state.decks.action.draw.length, 8);
  assert.ok(prepared.state.decks.action.handBySeat['seat-1'].every(id => getBoardActionCard(id)));
});

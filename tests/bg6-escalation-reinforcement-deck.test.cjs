const test = require('node:test');
const assert = require('node:assert/strict');

const { applyBoardAction } = require('../.test-dist/board-action-dispatcher.js');
const {
  BOARD_ESCALATION_DECK_PROTOTYPES,
  SELECTED_BOARD_ESCALATION_DECK_STRUCTURE,
  getBoardEscalationCard,
  initialiseBoardEscalationDeck,
  resolveBoardEscalation
} = require('../.test-dist/board-escalation.js');
const { createInitialBoardState } = require('../.test-dist/board-state.js');
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

function defenderPieceCount(state) {
  return Object.values(state.pieces).filter(piece => piece.seatId === 'seat-2').length;
}

test('BG6 records both deck prototypes and selects the lower-state combined structure', () => {
  assert.deepEqual(BOARD_ESCALATION_DECK_PROTOTYPES.map(prototype => prototype.structure), [
    'combined',
    'split'
  ]);

  const combined = BOARD_ESCALATION_DECK_PROTOTYPES.find(prototype => prototype.structure === 'combined');
  const split = BOARD_ESCALATION_DECK_PROTOTYPES.find(prototype => prototype.structure === 'split');

  assert.equal(SELECTED_BOARD_ESCALATION_DECK_STRUCTURE, 'combined');
  assert.equal(combined.deckCount, 1);
  assert.equal(combined.drawsPerRound, 1);
  assert.equal(split.deckCount, 2);
  assert.equal(split.drawsPerRound, 2);
  assert.ok(combined.persistedDrawPiles < split.persistedDrawPiles);
  assert.ok(combined.resolutionStepsPerRound < split.resolutionStepsPerRound);
});

test('BG6 identical seeds produce identical staged deck order and authoritative RNG state', () => {
  const first = initialiseBoardEscalationDeck(createInitialBoardState({ seed: 11264 }));
  const second = initialiseBoardEscalationDeck(createInitialBoardState({ seed: 11264 }));

  assert.deepEqual(first.decks.escalation, second.decks.escalation);
  assert.deepEqual(first.rng, second.rng);
  assert.equal(first.decks.escalation.draw.length, 8);
  assert.equal(first.rng.calls, 4);
});

test('BG6 different seeds materially vary deck order while retaining the same pressure curve', () => {
  const first = initialiseBoardEscalationDeck(createInitialBoardState({ seed: 11264 }));
  const second = initialiseBoardEscalationDeck(createInitialBoardState({ seed: 100 }));

  assert.notDeepEqual(first.decks.escalation.draw, second.decks.escalation.draw);

  for (const deck of [first.decks.escalation.draw, second.decks.escalation.draw]) {
    assert.deepEqual(deck.map(cardId => getBoardEscalationCard(cardId).pressureBand), [1, 1, 2, 2, 3, 3, 4, 4]);
  }
});

test('BG6 orchestration still resolves escalation before later pre-round systems and round start', () => {
  const state = createInitialBoardState({ seed: 11264 });

  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'resolve-escalation' });

  const escalation = applyBoardAction(state, { type: 'resolve-escalation' });
  assert.equal(escalation.accepted, true);
  assert.equal(escalation.commandActionsSpent, 0);
  assert.deepEqual(chooseAutomaticBoardAction(escalation.state), { type: 'prepare-action-cards' });

  const cards = applyBoardAction(escalation.state, { type: 'prepare-action-cards' });
  assert.equal(cards.accepted, true);
  assert.deepEqual(chooseAutomaticBoardAction(cards.state), { type: 'start-round' });

  const started = applyBoardAction(cards.state, { type: 'start-round' });
  assert.equal(started.accepted, true);
  assert.equal(started.state.phase, 'activation');
  assert.equal(started.state.seats['seat-1'].commandActionsRemaining, 4);
});

test('BG6 escalation adds defender reinforcements to authoritative controlled spaces', () => {
  const state = createInitialBoardState({ seed: 11264 });
  const before = defenderPieceCount(state);
  const result = resolveBoardEscalation(state);

  assert.equal(result.accepted, true);
  assert.equal(result.commandActionsSpent, 0);
  assert.equal(defenderPieceCount(result.state), before + 1);
  assert.equal(result.state.decks.escalation.discard.length, 1);

  const reinforcement = result.state.pieces['RF-01-01'];
  assert.ok(reinforcement);
  assert.equal(reinforcement.seatId, 'seat-2');
  assert.equal(result.state.spaces[reinforcement.spaceId].control, 'seat-2');
});

test('BG6 pressure rises across the eight-round campaign without late low-pressure draws', () => {
  let state = createInitialBoardState({ seed: 11264 });
  const pressure = [];

  for (let round = 1; round <= 8; round += 1) {
    state = { ...state, round, phase: 'round-start' };
    const result = resolveBoardEscalation(state);
    assert.equal(result.accepted, true);
    const cardId = result.state.decks.escalation.discard.at(-1);
    pressure.push(getBoardEscalationCard(cardId).pressureBand);
    state = result.state;
  }

  assert.deepEqual(pressure, [1, 1, 2, 2, 3, 3, 4, 4]);
  for (let index = 1; index < pressure.length; index += 1) {
    assert.ok(pressure[index] >= pressure[index - 1]);
  }
});

test('BG6 escalation deck, reinforcement state and RNG survive the browser save/load boundary', () => {
  const resolved = resolveBoardEscalation(createInitialBoardState({ seed: 11264 }));
  assert.equal(resolved.accepted, true);

  const storage = memoryStorage();
  assert.equal(writeBoardState(storage, resolved.state).ok, true);
  const inspected = inspectStoredBoardState(storage);

  assert.equal(inspected.ok, true);
  assert.deepEqual(inspected.state.decks.escalation, resolved.state.decks.escalation);
  assert.deepEqual(inspected.state.rng, resolved.state.rng);
  assert.deepEqual(inspected.state.pieces['RF-01-01'], resolved.state.pieces['RF-01-01']);
});

test('BG6 migrates later-round pre-deck saves without retroactively adding old reinforcements', () => {
  const legacy = {
    ...createInitialBoardState({ seed: 11264 }),
    round: 4,
    phase: 'round-start'
  };
  const before = defenderPieceCount(legacy);

  const result = resolveBoardEscalation(legacy);

  assert.equal(result.accepted, true);
  assert.equal(result.state.decks.escalation.discard.length, 4);
  assert.equal(defenderPieceCount(result.state), before + 1);
  const currentCard = getBoardEscalationCard(result.state.decks.escalation.discard.at(-1));
  assert.equal(currentCard.pressureBand, 2);
});

test('BG6 cannot resolve the same round twice or during activation', () => {
  const first = resolveBoardEscalation(createInitialBoardState({ seed: 11264 }));
  assert.equal(first.accepted, true);

  const duplicate = resolveBoardEscalation(first.state);
  assert.equal(duplicate.accepted, false);
  assert.match(duplicate.reason, /already resolved/i);

  const wrongPhase = resolveBoardEscalation({ ...first.state, phase: 'activation' });
  assert.equal(wrongPhase.accepted, false);
  assert.match(wrongPhase.reason, /activation phase/i);
});

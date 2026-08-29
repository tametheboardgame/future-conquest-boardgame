const test = require('node:test');
const assert = require('node:assert/strict');

const { applyBoardAction } = require('../.test-dist/board-action-dispatcher.js');
const { getBoardCombatTargets } = require('../.test-dist/board-combat.js');
const { createInitialBoardState, startBoardRound } = require('../.test-dist/board-state.js');
const {
  BOARD_STATE_SAVE_KEY,
  inspectStoredBoardState,
  writeBoardState
} = require('../.test-dist/board-state-persistence.js');

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
    },
    read() {
      return value;
    }
  };
}

function resolvedCombatState() {
  const state = startBoardRound(createInitialBoardState({ seed: 11264 })).state;
  const attackers = Object.values(state.pieces)
    .filter(piece => piece.seatId === state.activeSeat)
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const attacker of attackers) {
    const target = getBoardCombatTargets(state, attacker.id)[0];
    if (!target) continue;
    const result = applyBoardAction(state, {
      type: 'attack-piece',
      attackerPieceId: attacker.id,
      defenderPieceId: target.defenderPieceId
    });
    assert.equal(result.accepted, true);
    assert.equal(result.state.combat?.status, 'resolved');
    return result.state;
  }

  assert.fail('Expected the starting Central Front position to contain a legal combat target.');
}

test('BG5D resolved combat survives the authoritative browser save/load boundary', () => {
  const state = resolvedCombatState();
  const storage = memoryStorage();

  assert.equal(writeBoardState(storage, state).ok, true);
  const inspected = inspectStoredBoardState(storage);

  assert.equal(inspected.ok, true);
  assert.deepEqual(inspected.state.combat, state.combat);
  assert.equal(inspected.state.rng.calls, state.rng.calls);
});

test('BG5D v3 saves created before BG5 remain compatible when combat is absent', () => {
  const state = createInitialBoardState({ seed: 41 });
  assert.equal(state.combat, undefined);
  const storage = memoryStorage();

  writeBoardState(storage, state);
  const inspected = inspectStoredBoardState(storage);

  assert.equal(inspected.ok, true);
  assert.equal(inspected.state.combat, undefined);
});

test('BG5D rejects malformed persisted combat instead of trusting it as authoritative state', () => {
  const state = resolvedCombatState();
  const storage = memoryStorage();
  writeBoardState(storage, state);

  const corrupt = JSON.parse(storage.read());
  corrupt.combat.dieSides = 12;
  const corruptedStorage = memoryStorage(JSON.stringify(corrupt));

  assert.deepEqual(inspectStoredBoardState(corruptedStorage), {
    ok: false,
    code: 'corrupt',
    message: 'The board-game save is corrupted and could not be loaded.'
  });
});

test('BG5D rejects combat records that reference missing board pieces', () => {
  const state = resolvedCombatState();
  const storage = memoryStorage();
  writeBoardState(storage, state);

  const corrupt = JSON.parse(storage.read());
  corrupt.combat.defenderPieceId = 'missing-piece';

  assert.equal(inspectStoredBoardState(memoryStorage(JSON.stringify(corrupt))).code, 'corrupt');
});

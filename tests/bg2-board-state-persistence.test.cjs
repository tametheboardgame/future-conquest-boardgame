const test = require('node:test');
const assert = require('node:assert/strict');

const { createInitialBoardState } = require('../.test-dist/board-state.js');
const {
  BOARD_STATE_SAVE_KEY,
  clearBoardState,
  inspectStoredBoardState,
  writeBoardState
} = require('../.test-dist/board-state-persistence.js');

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

test('BG2B saves and restores the exact authoritative board state independently', () => {
  const storage = new MemoryStorage({
    'future-conquest-slice-v0.14': '{"legacy":"untouched"}'
  });
  const state = createInitialBoardState({
    seed: 20260825,
    controllers: { 'seat-1': 'human', 'seat-2': 'human' }
  });

  const written = writeBoardState(storage, state);
  assert.equal(written.ok, true);
  assert.match(BOARD_STATE_SAVE_KEY, /^future-conquest-board-state-v\d+$/);

  const inspected = inspectStoredBoardState(storage);
  assert.equal(inspected.ok, true);
  assert.deepEqual(inspected.state, state);
  assert.equal(storage.getItem('future-conquest-slice-v0.14'), '{"legacy":"untouched"}');
});

test('BG2B reports missing, corrupt and unsupported board saves without touching legacy saves', () => {
  const storage = new MemoryStorage({
    'future-conquest-slice-v0.14': '{"legacy":"still-here"}'
  });

  assert.deepEqual(inspectStoredBoardState(storage), {
    ok: false,
    code: 'missing',
    message: 'No board-game state has been saved in this browser.'
  });

  storage.setItem(BOARD_STATE_SAVE_KEY, '');
  assert.equal(inspectStoredBoardState(storage).code, 'corrupt');

  storage.setItem(BOARD_STATE_SAVE_KEY, '{bad json');
  assert.equal(inspectStoredBoardState(storage).code, 'corrupt');

  const unsupported = createInitialBoardState({ seed: 7 });
  unsupported.save.version = 999;
  storage.setItem(BOARD_STATE_SAVE_KEY, JSON.stringify(unsupported));
  assert.equal(inspectStoredBoardState(storage).code, 'unsupported');
  assert.equal(storage.getItem('future-conquest-slice-v0.14'), '{"legacy":"still-here"}');
});

test('BG2B clear removes only the authoritative board-game slot', () => {
  const storage = new MemoryStorage({
    [BOARD_STATE_SAVE_KEY]: JSON.stringify(createInitialBoardState({ seed: 88 })),
    'future-conquest-slice-v0.14': 'legacy-save'
  });

  assert.equal(clearBoardState(storage), true);
  assert.equal(storage.getItem(BOARD_STATE_SAVE_KEY), null);
  assert.equal(storage.getItem('future-conquest-slice-v0.14'), 'legacy-save');
});

test('BG2B handles unavailable storage without throwing', () => {
  const unavailable = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); }
  };
  const state = createInitialBoardState({ seed: 99 });

  assert.equal(inspectStoredBoardState(unavailable).code, 'storage-unavailable');
  assert.equal(writeBoardState(unavailable, state).code, 'storage-unavailable');
  assert.equal(clearBoardState(unavailable), false);
});

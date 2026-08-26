const test = require('node:test');
const assert = require('node:assert/strict');

const { createInitialBoardState } = require('../.test-dist/board-state.js');
const {
  BOARD_STATE_SAVE_KEY,
  inspectStoredBoardState,
  writeBoardState
} = require('../.test-dist/board-state-persistence.js');
const { BOARD_STATE_VERSION } = require('../.test-dist/board-state-types.js');

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

test('BG3A uses a new board-save slot and leaves the BG2 v1 slot untouched', () => {
  const previousKey = 'future-conquest-board-state-v1';
  const previousValue = '{"preserved":"bg2"}';
  const storage = new MemoryStorage({ [previousKey]: previousValue });

  assert.equal(BOARD_STATE_VERSION, 2);
  assert.equal(BOARD_STATE_SAVE_KEY, 'future-conquest-board-state-v2');
  assert.equal(inspectStoredBoardState(storage).code, 'missing');

  const state = createInitialBoardState({ seed: 6, controllers: { 'seat-1': 'human' } });
  assert.equal(writeBoardState(storage, state).ok, true);
  assert.equal(storage.getItem(previousKey), previousValue);
  assert.ok(storage.getItem(BOARD_STATE_SAVE_KEY));
});

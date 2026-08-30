const test = require('node:test');
const assert = require('node:assert/strict');

const { applyBoardAction } = require('../.test-dist/board-action-dispatcher.js');
const { createInitialBoardState, startBoardRound } = require('../.test-dist/board-state.js');

function preparedActivation(seed) {
  let state = createInitialBoardState({ seed });
  state = applyBoardAction(state, { type: 'resolve-escalation' }).state;
  state = applyBoardAction(state, { type: 'prepare-action-cards' }).state;
  return startBoardRound(state).state;
}

test('BG8 cannot prepare cards before escalation or prepare the same round twice', () => {
  const initial = createInitialBoardState({ seed: 0x8820 });
  const tooEarly = applyBoardAction(initial, { type: 'prepare-action-cards' });
  assert.equal(tooEarly.accepted, false);
  assert.strictEqual(tooEarly.state, initial);
  assert.match(tooEarly.reason, /escalation/i);

  const escalated = applyBoardAction(initial, { type: 'resolve-escalation' }).state;
  const first = applyBoardAction(escalated, { type: 'prepare-action-cards' });
  assert.equal(first.accepted, true);
  const duplicate = applyBoardAction(first.state, { type: 'prepare-action-cards' });
  assert.equal(duplicate.accepted, false);
  assert.strictEqual(duplicate.state, first.state);
  assert.match(duplicate.reason, /already prepared/i);
});

test('BG8 cards cannot bypass ordinary target ownership rules', () => {
  let state = preparedActivation(0x8821);
  const enemy = Object.values(state.pieces).find(piece => piece.seatId === 'seat-2' && piece.spaceId);
  assert.ok(enemy);
  state.pieces[enemy.id] = { ...enemy, readiness: 50, damage: 1 };
  state = {
    ...state,
    decks: {
      ...state.decks,
      action: {
        ...state.decks.action,
        handBySeat: {
          ...state.decks.action.handBySeat,
          'seat-1': ['action-03-field-repair-teams']
        }
      }
    }
  };

  const result = applyBoardAction(state, {
    type: 'play-action-card',
    cardId: 'action-03-field-repair-teams',
    pieceId: enemy.id
  });

  assert.equal(result.accepted, false);
  assert.equal(result.commandActionsSpent, 0);
  assert.strictEqual(result.state, state);
  assert.deepEqual(result.state.decks.action.handBySeat['seat-1'], ['action-03-field-repair-teams']);
  assert.match(result.reason, /owned by seat-2/i);
});

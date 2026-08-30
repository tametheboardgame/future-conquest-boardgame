const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { applyBoardAction } = require('../.test-dist/board-action-dispatcher.js');
const { createInitialBoardState, startBoardRound } = require('../.test-dist/board-state.js');
const { chooseAutomaticBoardAction } = require('../.test-dist/board-turn-orchestration.js');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG8 immediately migrates a pre-card v3 save resumed during activation', () => {
  let state = createInitialBoardState({ seed: 0x8830 });
  state = applyBoardAction(state, { type: 'resolve-escalation' }).state;
  state = startBoardRound(state).state;
  const activeSeatBefore = state.activeSeat;
  const actionsBefore = state.seats[activeSeatBefore].commandActionsRemaining;

  assert.equal(state.actionCardsPreparedRound, undefined);
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'prepare-action-cards' });

  const migrated = applyBoardAction(state, { type: 'prepare-action-cards' });
  assert.equal(migrated.accepted, true);
  assert.equal(migrated.commandActionsSpent, 0);
  assert.equal(migrated.state.phase, 'activation');
  assert.equal(migrated.state.activeSeat, activeSeatBefore);
  assert.equal(migrated.state.seats[activeSeatBefore].commandActionsRemaining, actionsBefore);
  assert.equal(migrated.state.actionCardsPreparedRound, state.round);
  assert.equal(migrated.state.decks.action.handBySeat['seat-1'].length, 2);
  assert.equal(migrated.state.decks.action.handBySeat['seat-2'].length, 2);
});

test('BG8 Cards navigation is live and focuses the mounted strategic hand', () => {
  const navigation = read('src/components/CommandNavigation.tsx');
  const panel = read('src/components/TabletopCardHandPanel.tsx');

  assert.doesNotMatch(navigation, /Cards become playable in BG8/);
  assert.match(navigation, /aria-controls="tabletop-card-hand"/);
  assert.match(navigation, /document\.getElementById\('tabletop-card-hand'\)\?\.focus\(\)/);
  assert.match(panel, /id="tabletop-card-hand"/);
  assert.match(panel, /tabIndex=\{-1\}/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createInitialBoardState } = require('../.test-dist/board-state.js');
const { BOARD_COMMAND_ACTIONS_PER_ROUND } = require('../.test-dist/board-state-types.js');
const { SLICE_IDS } = require('../.test-dist/data.js');
const { runBoardPlaytestMatrix } = require('../.test-dist/board-playtest-simulation.js');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const TASK_GROUP_IDS = ['TG-1', 'TG-2', 'TG-3', 'TG-4', 'TG-5', 'TG-6'];

test('BG12B expands only the Expedition opening formation pool', () => {
  const state = createInitialBoardState({ seed: 1179992911 });
  const expedition = Object.values(state.pieces).filter(piece => piece.seatId === 'seat-1');
  const defenders = Object.values(state.pieces).filter(piece => piece.seatId === 'seat-2' && piece.id.startsWith('EF-'));

  assert.deepEqual(expedition.map(piece => piece.id).sort(), TASK_GROUP_IDS);
  assert.equal(new Set(expedition.map(piece => piece.spaceId)).size, 1);
  assert.equal(defenders.length, SLICE_IDS.length - 1);
  assert.equal(new Set(defenders.map(piece => piece.spaceId)).size, SLICE_IDS.length - 1);
});

test('BG12B does not increase the Command Action economy', () => {
  const state = createInitialBoardState({ seed: 0x12b });
  assert.equal(BOARD_COMMAND_ACTIONS_PER_ROUND, 4);
  assert.equal(state.seats['seat-1'].commandActionsRemaining, 0);
  assert.equal(state.seats['seat-2'].commandActionsRemaining, 0);
});

test('BG12B leaves combat and escalation rule constants untouched', () => {
  const scenario = read('src/game/board-scenario.ts');
  const combat = read('src/game/board-combat.ts');
  const escalation = read('src/game/board-escalation.ts');

  assert.match(scenario, /'TG-5', 'TG-6'/);
  assert.match(combat, /BOARD_COMBAT_BASE_TARGET = 11/);
  assert.match(combat, /BOARD_COMBAT_ELIMINATION_DAMAGE = 3/);
  assert.match(escalation, /REINFORCEMENT_COUNT_BY_ROUND = \[1, 1, 1, 1, 2, 2, 2, 2\]/);
});

test('BG12B opening calibration remains mechanically complete across deterministic campaigns', () => {
  const report = runBoardPlaytestMatrix({ runs: 12, seedOffset: 0x12b0, maxSteps: 1000 });
  assert.equal(report.integrityGate, 'pass');
  assert.equal(report.resolvedCampaigns, 12);
  assert.equal(report.rejectedCampaigns, 0);
  assert.equal(report.safetyLimitCampaigns, 0);
});

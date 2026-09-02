const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  CENTRAL_FRONT_CAMPAIGN_OBJECTIVES,
  CENTRAL_FRONT_BREAKTHROUGH_TARGET,
  getBoardCampaignState,
  getBoardCampaignObjectiveCount,
  projectBoardCampaignStatus
} = require('../.test-dist/board-campaign.js');
const { applyBoardAction } = require('../.test-dist/board-action-dispatcher.js');
const {
  createInitialBoardState,
  deserializeBoardState,
  serializeBoardState
} = require('../.test-dist/board-state.js');
const { chooseAutomaticBoardAction } = require('../.test-dist/board-turn-orchestration.js');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

function setObjectiveControl(state, seatId, count) {
  const objectiveIds = CENTRAL_FRONT_CAMPAIGN_OBJECTIVES.map(objective => objective.spaceId);
  objectiveIds.forEach((spaceId, index) => {
    state.spaces[spaceId] = {
      ...state.spaces[spaceId],
      control: index < count ? seatId : state.campaign?.defenderSeatId ?? 'seat-2'
    };
  });
  return state;
}

function makeRoundEndState(round = 1) {
  const state = createInitialBoardState({
    seed: 0x1010,
    controllers: { 'seat-1': 'computer', 'seat-2': 'computer' }
  });
  state.round = round;
  state.phase = 'round-end';
  state.activeSeat = 'seat-1';
  for (const seat of Object.values(state.seats)) seat.commandActionsRemaining = 0;
  return state;
}

test('BG10 locks the Central Front strategic objectives to Paris, Brussels and Rhine-Ruhr', () => {
  assert.deepEqual(
    CENTRAL_FRONT_CAMPAIGN_OBJECTIVES.map(objective => [objective.spaceId, objective.label]),
    [['FR-02', 'Paris'], ['BE-01', 'Brussels'], ['DE-02', 'Rhine-Ruhr']]
  );

  const state = createInitialBoardState({ seed: 0x1011 });
  const campaign = getBoardCampaignState(state);
  const presentation = projectBoardCampaignStatus(state);
  assert.equal(campaign.attackerSeatId, 'seat-1');
  assert.equal(campaign.defenderSeatId, 'seat-2');
  assert.equal(presentation.breakthroughTarget, CENTRAL_FRONT_BREAKTHROUGH_TARGET);
  assert.match(presentation.objectiveSummary, /Paris:/);
  assert.match(presentation.objectiveSummary, /Brussels:/);
  assert.match(presentation.objectiveSummary, /Rhine-Ruhr:/);
});

test('BG10 scores one breakthrough point per objective held at round end exactly once', () => {
  const state = makeRoundEndState(3);
  setObjectiveControl(state, 'seat-1', 2);
  const before = serializeBoardState(state);

  const scored = applyBoardAction(state, { type: 'score-campaign-round' });
  assert.equal(scored.accepted, true);
  assert.equal(scored.commandActionsSpent, 0);
  assert.equal(scored.state.campaign.breakthroughPoints, 2);
  assert.equal(scored.state.campaign.scoredThroughRound, 3);
  assert.equal(getBoardCampaignObjectiveCount(scored.state, 'seat-1'), 2);
  assert.equal(serializeBoardState(state), before);

  const duplicate = applyBoardAction(scored.state, { type: 'score-campaign-round' });
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.commandActionsSpent, 0);
  assert.equal(duplicate.state, scored.state);
});

test('BG10 resolves immediate expedition victory when all three objectives are controlled', () => {
  const state = createInitialBoardState({ seed: 0x1012 });
  setObjectiveControl(state, 'seat-1', 3);

  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'resolve-campaign' });
  const resolved = applyBoardAction(state, { type: 'resolve-campaign' });
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.state.campaign.outcome, 'attacker-victory');
  assert.equal(resolved.state.campaign.resolvedRound, 1);
  assert.match(resolved.reason, /strategic breakthrough/i);
  assert.equal(chooseAutomaticBoardAction(resolved.state), null);
});

test('BG10 blocks ordinary actions while a sudden campaign result is pending', () => {
  const state = createInitialBoardState({ seed: 0x1017 });
  setObjectiveControl(state, 'seat-1', 3);
  const before = serializeBoardState(state);

  const rejected = applyBoardAction(state, { type: 'start-round' });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.commandActionsSpent, 0);
  assert.equal(rejected.state, state);
  assert.match(rejected.reason, /sudden resolution/i);
  assert.equal(serializeBoardState(state), before);

  const resolved = applyBoardAction(state, { type: 'resolve-campaign' });
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.state.campaign.outcome, 'attacker-victory');
});

test('BG10 resolves immediate defender victory when the expedition has been eliminated', () => {
  const state = createInitialBoardState({ seed: 0x1013 });
  state.pieces = Object.fromEntries(Object.entries(state.pieces).map(([id, piece]) => [
    id,
    piece.seatId === 'seat-1' ? { ...piece, spaceId: null } : piece
  ]));

  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'resolve-campaign' });
  const resolved = applyBoardAction(state, { type: 'resolve-campaign' });
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.state.campaign.outcome, 'defender-victory');
  assert.match(resolved.reason, /eliminated/i);
});

test('BG10 final round awards expedition victory for two held objectives', () => {
  let state = makeRoundEndState(8);
  setObjectiveControl(state, 'seat-1', 2);

  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'score-campaign-round' });
  state = applyBoardAction(state, { type: 'score-campaign-round' }).state;
  assert.deepEqual(chooseAutomaticBoardAction(state), { type: 'resolve-campaign' });

  const resolved = applyBoardAction(state, { type: 'resolve-campaign' });
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.state.campaign.outcome, 'attacker-victory');
  assert.match(resolved.reason, /holds 2 of 3 strategic objectives/i);
});

test('BG10 sustained breakthrough can win at round eight while one objective remains held', () => {
  let state = makeRoundEndState(8);
  state.campaign = {
    attackerSeatId: 'seat-1',
    defenderSeatId: 'seat-2',
    breakthroughPoints: CENTRAL_FRONT_BREAKTHROUGH_TARGET - 1,
    scoredThroughRound: 7,
    outcome: 'in-progress',
    resolvedRound: null,
    reason: null
  };
  setObjectiveControl(state, 'seat-1', 1);

  state = applyBoardAction(state, { type: 'score-campaign-round' }).state;
  assert.equal(state.campaign.breakthroughPoints, CENTRAL_FRONT_BREAKTHROUGH_TARGET);
  const resolved = applyBoardAction(state, { type: 'resolve-campaign' });
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.state.campaign.outcome, 'attacker-victory');
  assert.match(resolved.reason, /sustained pressure/i);
});

test('BG10 defenders win at round eight when breakthrough conditions are denied', () => {
  let state = makeRoundEndState(8);
  setObjectiveControl(state, 'seat-1', 1);

  state = applyBoardAction(state, { type: 'score-campaign-round' }).state;
  const resolved = applyBoardAction(state, { type: 'resolve-campaign' });
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.state.campaign.outcome, 'defender-victory');
  assert.match(resolved.reason, /prevented a decisive breakthrough/i);
});

test('BG10 terminal campaign state blocks every further ordinary board action', () => {
  const state = createInitialBoardState({ seed: 0x1014 });
  setObjectiveControl(state, 'seat-1', 3);
  const resolved = applyBoardAction(state, { type: 'resolve-campaign' }).state;
  const before = serializeBoardState(resolved);

  const rejected = applyBoardAction(resolved, { type: 'start-round' });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.commandActionsSpent, 0);
  assert.equal(rejected.state, resolved);
  assert.equal(serializeBoardState(resolved), before);
});

test('BG10 campaign state survives save/load and pre-BG10 v3 saves migrate lazily', () => {
  let state = makeRoundEndState(4);
  setObjectiveControl(state, 'seat-1', 2);
  state = applyBoardAction(state, { type: 'score-campaign-round' }).state;

  const loaded = deserializeBoardState(serializeBoardState(state));
  assert.deepEqual(loaded.campaign, state.campaign);
  assert.equal(projectBoardCampaignStatus(loaded).shortLabel, '2/3 · 2/10 BP');

  const legacy = createInitialBoardState({ seed: 0x1015 });
  legacy.round = 4;
  delete legacy.campaign;
  const migrated = getBoardCampaignState(deserializeBoardState(serializeBoardState(legacy)));
  assert.equal(migrated.breakthroughPoints, 0);
  assert.equal(migrated.scoredThroughRound, 3);
});

test('BG10 rejects malformed persisted campaign payloads while accepting an absent legacy payload', () => {
  const state = createInitialBoardState({ seed: 0x1018 });
  const legacy = JSON.parse(serializeBoardState(state));
  delete legacy.campaign;
  assert.doesNotThrow(() => deserializeBoardState(JSON.stringify(legacy)));

  const malformed = JSON.parse(serializeBoardState(state));
  malformed.campaign = { outcome: 'attacker-victory' };
  assert.throws(() => deserializeBoardState(JSON.stringify(malformed)), /Invalid Future Conquest board state metadata/);

  const inconsistent = JSON.parse(serializeBoardState(state));
  inconsistent.campaign = {
    attackerSeatId: 'seat-1',
    defenderSeatId: 'seat-2',
    breakthroughPoints: 1,
    scoredThroughRound: 1,
    outcome: 'attacker-victory',
    resolvedRound: null,
    reason: null
  };
  assert.throws(() => deserializeBoardState(JSON.stringify(inconsistent)), /Invalid Future Conquest board state metadata/);
});

test('BG10 computer-v-computer autoplay resolves to a terminal campaign result', () => {
  let state = createInitialBoardState({
    seed: 0x1016,
    controllers: { 'seat-1': 'computer', 'seat-2': 'computer' }
  });
  let steps = 0;

  while (steps < 1200) {
    const action = chooseAutomaticBoardAction(state);
    if (!action) break;
    const result = applyBoardAction(state, action);
    assert.equal(result.accepted, true, `automatic action rejected at step ${steps}: ${JSON.stringify(action)} — ${result.reason}`);
    state = result.state;
    steps += 1;
  }

  assert.ok(steps < 1200, 'BG10 autoplay hit the safety limit');
  assert.ok(state.campaign);
  assert.notEqual(state.campaign.outcome, 'in-progress');
  assert.ok(['attacker-victory', 'defender-victory'].includes(state.campaign.outcome));
  assert.equal(chooseAutomaticBoardAction(state), null);
});

test('BG10 UI exposes objective score and terminal result from authoritative campaign projection', () => {
  const campaign = read('src/game/board-campaign.ts');
  const orchestration = read('src/game/board-turn-orchestration.ts');
  const dispatcher = read('src/game/board-action-dispatcher.ts');
  const ai = read('src/game/board-computer-player.ts');
  const shell = read('src/components/TabletopStatusShell.tsx');
  const css = read('src/bg10-campaign-status.css');

  assert.match(campaign, /CENTRAL_FRONT_CAMPAIGN_OBJECTIVES/);
  assert.match(campaign, /scoreBoardCampaignRound/);
  assert.match(campaign, /resolveBoardCampaign/);
  assert.match(orchestration, /score-campaign-round/);
  assert.match(orchestration, /resolve-campaign/);
  assert.match(dispatcher, /isBoardCampaignResolved/);
  assert.match(ai, /distanceToNearestUncontrolledObjective/);
  assert.match(shell, /data-bg-campaign="BG10"/);
  assert.match(shell, /campaign\.shortLabel/);
  assert.match(shell, /data-campaign-outcome/);
  assert.match(css, /tabletop-campaign-result/);
  assert.doesNotMatch(campaign, /Math\.random/);
});

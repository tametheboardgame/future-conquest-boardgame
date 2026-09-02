const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  simulateBoardPlaytestCampaign,
  runBoardPlaytestMatrix,
  renderBoardPlaytestMatrixMarkdown
} = require('../.test-dist/board-playtest-simulation.js');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG12A repeats the same production-rules board campaign deterministically', () => {
  const first = simulateBoardPlaytestCampaign(0x9014, 1000);
  const second = simulateBoardPlaytestCampaign(0x9014, 1000);

  assert.deepEqual(second, first);
  assert.ok(first.outcome === 'attacker-victory' || first.outcome === 'defender-victory');
  assert.ok(first.resolvedRound >= 1 && first.resolvedRound <= 8);
  assert.ok(first.steps > 0 && first.steps < 1000);
  assert.equal(first.resolutionKind === 'sudden' || first.resolutionKind === 'final-round', true);
  assert.ok((first.actionCounts['resolve-escalation'] ?? 0) > 0);
  assert.ok((first.actionCounts['start-round'] ?? 0) > 0);
  assert.ok((first.actionCounts['resolve-campaign'] ?? 0) === 1);
});

test('BG12A matrix is a mechanical integrity gate across a deterministic multi-seed sample', () => {
  const report = runBoardPlaytestMatrix({ runs: 12, seedOffset: 0x1200, maxSteps: 1000 });

  assert.equal(report.campaigns, 12);
  assert.equal(report.integrityGate, 'pass');
  assert.equal(report.resolvedCampaigns, 12);
  assert.equal(report.unresolvedCampaigns, 0);
  assert.equal(report.rejectedCampaigns, 0);
  assert.equal(report.safetyLimitCampaigns, 0);
  assert.equal(report.attackerWins + report.defenderWins, 12);
  assert.equal(report.attackerWinRate + report.defenderWinRate, 1);
  assert.ok(report.medianResolutionRound >= 1 && report.medianResolutionRound <= 8);
  assert.ok(report.averageSteps > 0);
});

test('BG12A reports balance signals without converting them into alternative game rules', () => {
  const report = runBoardPlaytestMatrix({ runs: 12, seedOffset: 0x1210, maxSteps: 1000 });
  const markdown = renderBoardPlaytestMatrixMarkdown(report);

  assert.match(markdown, /Future Conquest board playtest matrix/);
  assert.match(markdown, /Integrity gate:/);
  assert.match(markdown, /Balance signal:/);
  assert.match(markdown, /Action mix/);
  assert.match(markdown, /Campaigns/);
  assert.ok(['attacker-dominant', 'defender-dominant', 'mixed'].includes(report.balanceSignal));
});

test('BG12A runner stays on the converted board-game orchestration and dispatcher', () => {
  const simulation = read('src/game/board-playtest-simulation.ts');
  const runner = read('scripts/simulate-board-playtest-matrix.mjs');

  assert.match(simulation, /chooseAutomaticBoardAction\(state\)/);
  assert.match(simulation, /applyBoardAction\(state, action\)/);
  assert.match(simulation, /createInitialBoardState\(\{/);
  assert.match(simulation, /controllers: \{ 'seat-1': 'computer', 'seat-2': 'computer' \}/);
  assert.doesNotMatch(simulation, /from '\.\/engine'/);
  assert.doesNotMatch(simulation, /Math\.random/);
  assert.match(runner, /board-playtest-matrix\.json/);
  assert.match(runner, /report\.integrityGate !== 'pass'/);
});

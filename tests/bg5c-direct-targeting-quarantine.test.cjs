const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG5C combat panel accepts retained enemy-contact clicks only through authoritative target previews', () => {
  const panel = read('src/components/TabletopCombatPanel.tsx');

  assert.match(panel, /r3-terrain-enemy-contact\[data-territory-id\]/);
  assert.match(panel, /readEnemyContactSpaceId/);
  assert.match(panel, /getBoardCombatTargets\(boardState, attackerPieceId\)/);
  assert.match(panel, /candidate\.targetSpaceId === enemySpaceId/);
  assert.match(panel, /setDefenderPieceId\(directTarget\.defenderPieceId\)/);
  assert.match(panel, /stable piece order/);
  assert.match(panel, /data-bg-combat="BG5C"/);
  assert.doesNotMatch(panel, /Math\.random|beginOperation|resolveDay/);
});

test('BG5C actively disables retained simulation attack controls even if legacy UI rerenders', () => {
  const panel = read('src/components/TabletopCombatPanel.tsx');

  assert.match(panel, /LEGACY_ATTACK_SELECTOR = '\[data-tutorial="attack-action"\]'/);
  assert.match(panel, /element\.disabled = true/);
  assert.match(panel, /bg5LegacyCombatQuarantined/);
  assert.match(panel, /new MutationObserver\(quarantineLegacySimulationAttackControls\)/);
  assert.match(panel, /attributeFilter: \['disabled'\]/);
});

test('BG5C automatic turn policy still considers authoritative combat without restoring zero-cost Pass', () => {
  const orchestration = read('src/game/board-turn-orchestration.ts');
  const policy = read('src/game/board-computer-player.ts');

  assert.match(orchestration, /chooseComputerBoardAction\(state\)/);
  assert.match(policy, /getBoardCombatTargets/);
  assert.match(policy, /type: 'attack-piece'/);
  assert.doesNotMatch(policy, /addValidatedCandidate\(state, actions, \{ type: 'pass-activation' \}\)/);
  assert.doesNotMatch(orchestration, /Math\.random/);
  assert.doesNotMatch(policy, /Math\.random/);
});

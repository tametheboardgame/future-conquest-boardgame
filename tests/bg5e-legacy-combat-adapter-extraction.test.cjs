const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG5E activation panel no longer adapts the retained simulation Attack control', () => {
  const activation = read('src/components/TabletopActivationPanel.tsx');

  assert.doesNotMatch(activation, /attack-action/);
  assert.doesNotMatch(activation, /invokeLegacyAttack/);
  assert.doesNotMatch(activation, /canAttack/);
  assert.doesNotMatch(activation, /className="attack"/);
  assert.match(activation, /type: 'move-piece'/);
  assert.match(activation, /type: 'pass-activation'/);
});

test('BG5E keeps combat authority in the board-combat path and board dispatcher', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');

  assert.match(combat, /from '\.\.\/game\/board-combat'/);
  assert.match(combat, /getBoardCombatPreview/);
  assert.match(combat, /getBoardCombatTargets/);
  assert.match(combat, /dispatchBoardAction\(\{/);
  assert.match(combat, /type: 'attack-piece'/);
  assert.doesNotMatch(combat, /beginOperation|resolveDay|Math\.random/);
});

test('BG5E retains defence in depth against any simulation Attack control rerender', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');

  assert.match(combat, /LEGACY_ATTACK_SELECTOR = '\[data-tutorial="attack-action"\]'/);
  assert.match(combat, /element\.disabled = true/);
  assert.match(combat, /bg5LegacyCombatQuarantined/);
  assert.match(combat, /new MutationObserver\(quarantineLegacySimulationAttackControls\)/);
});

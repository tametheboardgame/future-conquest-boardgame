const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG12G-R preserves authoritative seeded combat and sends only stored 2D6 values to presentation', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const renderer = read('src/components/Bg12gIntegratedDiceRenderer.tsx');

  assert.match(combat, /dispatchBoardAction\(\{\s*type: 'attack-piece'/s);
  assert.match(combat, /boardState\.combat\?\.status === 'resolved'/);
  assert.match(combat, /const authoritativeDice = result\?\.dice/);
  assert.match(combat, /<Bg12gIntegratedDiceRenderer\s+dice=\{authoritativeDice\}/s);
  assert.match(combat, /data-bg-dice-model="BG12G-R-2D6"/);
  assert.doesNotMatch(combat, /Math\.random|crypto\.getRandomValues|nextBoardRandom|shuffle/);
  assert.doesNotMatch(renderer, /BoardGameState|dispatchBoardAction|attack-piece|Math\.random|crypto\.getRandomValues|MapLibre|maplibre/);
});

test('BG12G-R2C replaces the rejected CSS pseudo-cubes with two accepted true-3D D6 meshes', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const renderer = read('src/components/Bg12gIntegratedDiceRenderer.tsx');
  const css = read('src/bg12g-dice-tray.css');

  assert.match(combat, /data-bg-dice-renderer="BG12G-R2C-THREE"/);
  assert.match(renderer, /new THREE\.WebGLRenderer/);
  assert.match(renderer, /makeD6\(theme, 'BG12G-R2C integrated left D6'\)/);
  assert.match(renderer, /makeD6\(theme, 'BG12G-R2C integrated right D6'\)/);
  assert.match(renderer, /dataset\.bg12gIntegratedDiceRenderer = 'three'/);
  assert.match(renderer, /data-die-count="2"/);
  assert.doesNotMatch(combat, /function PhysicalD6|function PhysicalDicePair|D6_SETTLE_ROTATIONS/);
  assert.doesNotMatch(css, /bg12g-d6-cube|bg12g-d6-face-front|bg12g-d6-throw-a|transform-style:\s*preserve-3d/);
});

test('BG12G-R2C uses the approved shared throw/bounce/settle motion and reveals consequences only after settle', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const renderer = read('src/components/Bg12gIntegratedDiceRenderer.tsx');
  const motion = read('src/components/bg12gDiceMotion.ts');

  assert.match(renderer, /createDieMotion\('left', left\)/);
  assert.match(renderer, /createDieMotion\('right', right\)/);
  assert.match(renderer, /applyDiceMotionPose/);
  assert.match(motion, /durationMs: 1580/);
  assert.match(motion, /durationMs: 1660/);
  assert.match(motion, /position: \[-1\.82, 0\.02, 0\.1\]/);
  assert.match(motion, /position: \[1\.94, 0\.02, 0\.08\]/);
  assert.match(combat, /onSettled=\{settleAuthoritativeRoll\}/);
  assert.match(combat, /const resultRevealed = Boolean/);
  assert.match(combat, /\{resultRevealed && <>/);
  assert.doesNotMatch(combat, /FULL_ROLL_DURATION_MS|rollTimerRef/);
});

test('BG12G-R2C binds settle evidence to the exact rendered pair and verifies it against current authority', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const renderer = read('src/components/Bg12gIntegratedDiceRenderer.tsx');

  assert.match(renderer, /onSettled\?: \(dice: DicePair, total: number\) => void/);
  assert.match(renderer, /const settledDice: DicePair = \[left, right\]/);
  assert.match(renderer, /settledCallbackRef\.current\?\.\(settledDice, total\)/);
  assert.match(combat, /const settleAuthoritativeRoll = \(settledDice: \[number, number\], settledTotal: number\)/);
  assert.match(combat, /result\.dice\[0\] === settledDice\[0\]/);
  assert.match(combat, /result\.dice\[1\] === settledDice\[1\]/);
  assert.match(combat, /result\.die === settledTotal/);
  assert.match(combat, /if \(!matchesAuthority\) return/);
});

test('BG12G-R2C preserves dice-clatter start/settled hooks without duplicate result dispatch', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');

  assert.match(combat, /future-conquest:dice-clatter/);
  assert.match(combat, /diceType: '2d6'/);
  assert.match(combat, /fireDiceClatterHook\('start'\)/);
  assert.match(combat, /fireDiceClatterHook\('settled', settledDice, settledTotal\)/);
  assert.match(combat, /if \(!rollRequestedRef\.current \|\| !latestCombatKey \|\| !result\?\.dice\) return/);
  assert.match(combat, /rollRequestedRef\.current = false;\s*setRevealedCombatKey/s);
  assert.equal((combat.match(/type: 'attack-piece'/g) || []).length, 1);
});

test('BG12G-R2D provides reduced motion, screen-reader output, forced-colour semantics and a renderer failure fallback', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const renderer = read('src/components/Bg12gIntegratedDiceRenderer.tsx');
  const motion = read('src/components/bg12gDiceMotion.ts');
  const css = read('src/bg12g-dice-tray.css');

  assert.match(renderer, /prefers-reduced-motion: reduce/);
  assert.match(renderer, /BG12G_REDUCED_ROLL_DURATION_MS/);
  assert.match(motion, /BG12G_REDUCED_ROLL_DURATION_MS = 120/);
  assert.match(renderer, /bg12g-force-dice-fallback/);
  assert.match(renderer, /data-bg12g-dice-fallback="true"/);
  assert.match(renderer, /forceContextLoss/);
  assert.match(combat, /bg12g-dice-sr-only/);
  assert.match(combat, /aria-live="polite"/);
  assert.match(combat, /3D dice renderer unavailable\. Combat resolved normally/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('BG12G-R2E exposes bounded renderer lifecycle instrumentation for repeated rail mount/unmount evidence', () => {
  const renderer = read('src/components/Bg12gIntegratedDiceRenderer.tsx');

  assert.match(renderer, /__bg12gDiceRendererLifecycle/);
  assert.match(renderer, /markRendererCreated\(\)/);
  assert.match(renderer, /markRendererDisposed\(\)/);
  assert.match(renderer, /lifecycle\.active = Math\.max\(0, lifecycle\.active - 1\)/);
  assert.match(renderer, /data-die-count="2"/);
});

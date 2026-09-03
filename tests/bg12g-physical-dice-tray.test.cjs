const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG12G preserves authoritative seeded combat and only animates its stored D20 result', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');

  assert.match(combat, /dispatchBoardAction\(\{\s*type: 'attack-piece'/s);
  assert.match(combat, /boardState\.combat\?\.status === 'resolved'/);
  assert.match(combat, /value=\{result\.die\}/);
  assert.match(combat, /data-authoritative-result=\{value \?\? undefined\}/);
  assert.doesNotMatch(combat, /Math\.random|crypto\.getRandomValues|nextBoardRandom|shuffle/);
  assert.doesNotMatch(combat, /MapLibre|maplibre|WebGL|THREE|three/);
});

test('BG12G renders a physical D20 and dice tray with twenty faceted faces', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const css = read('src/bg12g-dice-tray.css');

  assert.match(combat, /data-bg-physical-dice="BG12G"/);
  assert.match(combat, /const D20_FACES = Array\.from\(\{ length: 20 \}/);
  assert.match(combat, /function PhysicalD20/);
  assert.match(combat, /className="bg12g-tray"/);
  assert.match(combat, /bg12g-d20-facet-/);
  assert.match(combat, /bg12g-d20-final-face/);
  assert.match(css, /perspective:\s*520px/);
  assert.match(css, /transform-style:\s*preserve-3d/);
  assert.match(css, /clip-path:\s*polygon/);
  assert.match(css, /\.bg12g-d20-facet-20/);
});

test('BG12G physically tumbles, bounces and settles on the authoritative face', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const css = read('src/bg12g-dice-tray.css');

  assert.match(combat, /rollPhase === 'rolling'/);
  assert.match(combat, /setRollPhase\('rolling'\)/);
  assert.match(combat, /setRollPhase\('settled'\)/);
  assert.match(combat, /d20SettleStyle\(value\)/);
  assert.match(css, /@keyframes bg12g-d20-tumble/);
  assert.match(css, /@keyframes bg12g-d20-shadow-bounce/);
  assert.match(css, /rotateX\(var\(--d20-settle-x\)\)/);
  assert.match(css, /rotateY\(var\(--d20-settle-y\)\)/);
  assert.match(css, /translate3d\([^)]*-38px/);
});

test('BG12G delays consequences until the visual roll settles and keeps the equation explicit', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');

  assert.match(combat, /const resultRevealed = Boolean/);
  assert.match(combat, /\{resultRevealed && <>/);
  assert.match(combat, /result\.attackTotal/);
  assert.match(combat, /result\.target/);
  assert.match(combat, /★ CRITICAL HIT/);
  assert.match(combat, /✓ HIT/);
  assert.match(combat, /× MISS/);
  assert.match(combat, /Damage \+\{consequence\.damageInflicted\}/);
  assert.match(combat, /Readiness -\{consequence\.readinessLoss\}/);
});

test('BG12G exposes dice-clatter hooks and a fast reduced-motion reveal', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const css = read('src/bg12g-dice-tray.css');

  assert.match(combat, /future-conquest:dice-clatter/);
  assert.match(combat, /fireDiceClatterHook\('start'\)/);
  assert.match(combat, /fireDiceClatterHook\('settled', result\.die\)/);
  assert.match(combat, /prefers-reduced-motion: reduce/);
  assert.match(combat, /REDUCED_ROLL_DURATION_MS = 120/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation:\s*none !important/);
  assert.match(css, /@media \(forced-colors: active\)/);
});

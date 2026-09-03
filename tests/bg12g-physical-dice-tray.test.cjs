const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG12G-R preserves authoritative seeded combat and only animates its stored 2D6 result', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');

  assert.match(combat, /dispatchBoardAction\(\{\s*type: 'attack-piece'/s);
  assert.match(combat, /boardState\.combat\?\.status === 'resolved'/);
  assert.match(combat, /result\.dice/);
  assert.match(combat, /data-bg-dice-model="BG12G-R-2D6"/);
  assert.doesNotMatch(combat, /Math\.random|crypto\.getRandomValues|nextBoardRandom|shuffle/);
  assert.doesNotMatch(combat, /MapLibre|maplibre|WebGL|THREE|three/);
});

test('BG12G-R renders two physical cubic D6s with conventional faces', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const css = read('src/bg12g-dice-tray.css');

  assert.match(combat, /const D6_FACE_VALUES = \[1, 2, 3, 4, 5, 6\]/);
  assert.match(combat, /function PhysicalD6/);
  assert.match(combat, /function PhysicalDicePair/);
  assert.match(combat, /className="bg12g-tray"/);
  assert.match(css, /\.bg12g-d6-face/);
  assert.match(css, /translateZ/);
  assert.match(css, /rotateX/);
  assert.match(css, /rotateY/);
  assert.match(css, /transform-style:\s*preserve-3d/);
});

test('BG12G-R gives the two dice independent three-axis throw, tumble, bounce and settle motion', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const css = read('src/bg12g-dice-tray.css');

  assert.match(combat, /rollPhase === 'rolling'/);
  assert.match(combat, /setRollPhase\('rolling'\)/);
  assert.match(combat, /setRollPhase\('settled'\)/);
  assert.match(css, /@keyframes bg12g-d6-throw-a/);
  assert.match(css, /@keyframes bg12g-d6-throw-b/);
  assert.match(css, /@keyframes bg12g-d6-tumble-a/);
  assert.match(css, /@keyframes bg12g-d6-tumble-b/);
  assert.match(css, /translate3d/);
});

test('BG12G-R delays consequences until the visual roll settles and keeps the equation explicit', () => {
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

test('BG12G-R exposes 2D6 dice-clatter hooks and accessible reduced-motion feedback', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const css = read('src/bg12g-dice-tray.css');

  assert.match(combat, /future-conquest:dice-clatter/);
  assert.match(combat, /diceType: '2d6'/);
  assert.match(combat, /fireDiceClatterHook\('start'/);
  assert.match(combat, /fireDiceClatterHook\('settled'/);
  assert.match(combat, /Two D6 rolled/);
  assert.match(combat, /REDUCED_ROLL_DURATION_MS = 120/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation:\s*none !important/);
  assert.match(css, /@media \(forced-colors: active\)/);
});

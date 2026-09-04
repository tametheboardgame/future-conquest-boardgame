const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG12G-R2B is an isolated opt-in two-D6 Three.js motion route', () => {
  const main = read('src/main.tsx');
  const prototype = read('src/components/Bg12gR2bDiceMotionPrototype.tsx');

  assert.match(main, /query\.get\('bg12g-r2b'\) === '1'/);
  assert.match(main, /import\('\.\/components\/Bg12gR2bDiceMotionPrototype'\)/);
  assert.match(prototype, /makeD6\(theme, 'BG12G-R2B left D6'\)/);
  assert.match(prototype, /makeD6\(theme, 'BG12G-R2B right D6'\)/);
  assert.doesNotMatch(prototype, /BoardGameStateProvider|dispatchBoardAction|attack-piece|board-combat|MapLibre|maplibre/);
});

test('BG12G-R2B motion is scripted theatre with bounce beats and no result RNG', () => {
  const prototype = read('src/components/Bg12gR2bDiceMotionPrototype.tsx');

  assert.match(prototype, /const LEFT_MOTION/);
  assert.match(prototype, /const RIGHT_MOTION/);
  assert.match(prototype, /durationMs: 1580/);
  assert.match(prototype, /durationMs: 1660/);
  assert.match(prototype, /position: \[-1\.82, 0\.02, 0\.1\]/);
  assert.match(prototype, /position: \[-1\.58, 0\.64, 0\.02\]/);
  assert.match(prototype, /position: \[1\.94, 0\.02, 0\.08\]/);
  assert.match(prototype, /position: \[1\.67, 0\.56, 0\.13\]/);
  assert.match(prototype, /slerpQuaternions/);
  assert.doesNotMatch(prototype, /Math\.random|crypto\.getRandomValues/);
});

test('BG12G-R2B converges explicitly to predetermined final faces', () => {
  const prototype = read('src/components/Bg12gR2bDiceMotionPrototype.tsx');
  const geometry = read('src/components/bg12gDiceGeometry.ts');

  assert.match(prototype, /getFaceUpQuaternion\(motion\.finalFace, motion\.finalTwist\)/);
  assert.match(prototype, /die\.quaternion\.copy\(finalQuaternion\)/);
  assert.match(prototype, /finalFace: left/);
  assert.match(prototype, /finalFace: right/);
  assert.match(geometry, /export function getFaceUpQuaternion/);
});

test('BG12G-R2B stops its animation loop when both dice settle and disposes its renderer', () => {
  const prototype = read('src/components/Bg12gR2bDiceMotionPrototype.tsx');

  assert.match(prototype, /if \(leftSettled && rightSettled\)/);
  assert.match(prototype, /setMotionState\('settled'\)/);
  assert.match(prototype, /return;\n        }\n        animationFrame = window\.requestAnimationFrame\(animate\)/);
  assert.match(prototype, /window\.cancelAnimationFrame\(animationFrame\)/);
  assert.match(prototype, /disposeThreeScene\(scene\)/);
  assert.match(prototype, /renderer\.dispose\(\)/);
  assert.match(prototype, /renderer\.forceContextLoss\(\)/);
});

test('BG12G-R2B exposes review state and deterministic motion evidence events', () => {
  const prototype = read('src/components/Bg12gR2bDiceMotionPrototype.tsx');

  assert.match(prototype, /data-motion-state=\{motionState\}/);
  assert.match(prototype, /data-left-face=\{left\}/);
  assert.match(prototype, /data-right-face=\{right\}/);
  assert.match(prototype, /data-total=\{total\}/);
  assert.match(prototype, /future-conquest:bg12g-r2b-motion/);
  assert.match(prototype, /phase: 'start'/);
  assert.match(prototype, /phase: 'settled'/);
});

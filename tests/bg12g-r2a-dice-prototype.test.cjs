const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG12G-R2A is an isolated opt-in Three.js prototype, not part of normal board rendering', () => {
  const main = read('src/main.tsx');
  const prototype = read('src/components/Bg12gR2aDicePrototype.tsx');

  assert.match(main, /query\.get\('bg12g-r2a'\) === '1'/);
  assert.match(main, /import\('\.\/components\/Bg12gR2aDicePrototype'\)/);
  assert.match(prototype, /from 'three'/);
  assert.match(prototype, /RoundedBoxGeometry/);
  assert.doesNotMatch(prototype, /BoardGameStateProvider|dispatchBoardAction|attack-piece|board-combat|MapLibre|maplibre/);
});

test('BG12G-R2A builds one bevelled solid D6 with conventional pips on all six faces', () => {
  const prototype = read('src/components/Bg12gR2aDicePrototype.tsx');

  assert.match(prototype, /const D6_VALUES = \[1, 2, 3, 4, 5, 6\]/);
  assert.match(prototype, /new RoundedBoxGeometry\(2, 2, 2, 8, 0\.18\)/);
  assert.match(prototype, /const PIP_LAYOUT/);
  assert.match(prototype, /for \(const face of D6_VALUES\) addFacePips/);
  assert.match(prototype, /FACE_NORMALS\[face\]/);
  assert.match(prototype, /orientFaceUp/);
});

test('BG12G-R2A uses real lighting, a tray floor and contact shadows without motion or RNG', () => {
  const prototype = read('src/components/Bg12gR2aDicePrototype.tsx');

  assert.match(prototype, /PlaneGeometry/);
  assert.match(prototype, /receiveShadow = true/);
  assert.match(prototype, /castShadow = true/);
  assert.match(prototype, /PCFSoftShadowMap/);
  assert.match(prototype, /HemisphereLight/);
  assert.match(prototype, /DirectionalLight/);
  assert.doesNotMatch(prototype, /Math\.random|crypto\.getRandomValues|setInterval|setTimeout/);
});

test('BG12G-R2A owns and disposes its isolated renderer lifecycle', () => {
  const prototype = read('src/components/Bg12gR2aDicePrototype.tsx');

  assert.match(prototype, /new THREE\.WebGLRenderer/);
  assert.match(prototype, /ResizeObserver/);
  assert.match(prototype, /disposeScene\(scene\)/);
  assert.match(prototype, /renderer\.dispose\(\)/);
  assert.match(prototype, /renderer\.forceContextLoss\(\)/);
});

test('BG12G-R2A capture script requires all six static upward-face screenshots', () => {
  const capture = read('scripts/capture-bg12g-r2a-static.mjs');

  assert.match(capture, /for \(let face = 1; face <= 6; face \+= 1\)/);
  assert.match(capture, /canvas\[data-bg12g-r2a-renderer="three"\]/);
  assert.match(capture, /prototype\.screenshot/);
  assert.match(capture, /expected six static D6 captures/);
  assert.match(capture, /evidence\.json/);
});

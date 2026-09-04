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
  assert.match(prototype, /new RoundedBoxGeometry\(2, 2, 2, theme\.edge\.bevelSegments, theme\.edge\.bevelRadius\)/);
  assert.match(prototype, /const PIP_LAYOUT/);
  assert.match(prototype, /for \(const face of D6_VALUES\) addFaceMarks/);
  assert.match(prototype, /FACE_NORMALS\[face\]/);
  assert.match(prototype, /orientFaceUp/);
});

test('BG12G-R2A.5 makes cosmetic dice appearance typed and configurable while retaining the accepted default', () => {
  const prototype = read('src/components/Bg12gR2aDicePrototype.tsx');
  const theme = read('src/components/bg12gDiceTheme.ts');

  assert.match(theme, /export interface DiceTheme/);
  assert.match(theme, /export const DEFAULT_DICE_THEME/);
  assert.match(theme, /id: 'r2a-accepted'/);
  assert.match(theme, /colour: 0xe9dfc9/);
  assert.match(theme, /colour: 0x171317/);
  assert.match(theme, /bevelRadius: 0\.18/);
  assert.match(theme, /bevelSegments: 8/);
  assert.match(theme, /roughness: 0\.38/);
  assert.match(theme, /metalness: 0\.02/);
  assert.match(theme, /backgroundColour: 0x171014/);
  assert.match(theme, /floorColour: 0x3a2020/);

  assert.match(prototype, /theme = DEFAULT_DICE_THEME/);
  assert.match(prototype, /normaliseDiceTheme\(theme\)/);
  assert.match(prototype, /makeMaterial\(theme\.body\)/);
  assert.match(prototype, /makeMaterial\(theme\.pips\)/);
  assert.match(prototype, /safeTheme\.tray\.backgroundColour/);
  assert.match(prototype, /safeTheme\.tray\.floorColour/);
});

test('BG12G-R2A.5 constrains cosmetic geometry/material inputs and provides a pip-style extension point', () => {
  const prototype = read('src/components/Bg12gR2aDicePrototype.tsx');
  const theme = read('src/components/bg12gDiceTheme.ts');

  assert.match(theme, /normaliseDiceTheme/);
  assert.match(theme, /bevelRadius: clamp/);
  assert.match(theme, /bevelSegments: Math\.round\(clamp/);
  assert.match(theme, /emissiveIntensity: clamp/);
  assert.match(theme, /styleId: string/);
  assert.match(prototype, /const PIP_STYLE_RENDERERS: Record<string, PipStyleRenderer>/);
  assert.match(prototype, /PIP_STYLE_RENDERERS\[theme\.styleId\]/);
  assert.doesNotMatch(theme, /BoardGameState|dispatchBoardAction|Math\.random|crypto\.getRandomValues/);
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

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG12G-R2E exact-head workflow validates integrated production combat before evidence upload', () => {
  const workflow = read('.github/workflows/bg12g-r2e-integrated-dice.yml');

  assert.match(workflow, /BG12G_R2E_REF: \$\{\{ github\.event_name == 'pull_request' && github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(workflow, /ref: \$\{\{ env\.BG12G_R2E_REF \}\}/);
  assert.match(workflow, /Run full regression suite/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /Build exact production game/);
  assert.match(workflow, /capture-bg12g-r2e-integrated\.mjs/);
  assert.match(workflow, /bg12g-r2e-integrated-\$\{\{ env\.BG12G_R2E_REF \}\}/);
});

test('BG12G-R2E browser evidence follows BG12H contextual Attack rather than the retired Combat rail', () => {
  const capture = read('scripts/capture-bg12g-r2e-integrated.mjs');

  assert.match(capture, /bg12h-formation-interaction/);
  assert.match(capture, /bg12h-action-row/);
  assert.match(capture, /bg12h-contextual-combat/);
  assert.match(capture, /selectContextualAttacker/);
  assert.match(capture, /stressContextualRendererLifecycle/);
  assert.doesNotMatch(capture, /getByRole\('button', \{ name: 'Combat', exact: true \}\)/,
    'R2E must not restore or depend on the retired permanent Combat tab');
});

test('BG12G-R2E browser evidence proves exactly two authoritative dice and one start/settled event pair', () => {
  const capture = read('scripts/capture-bg12g-r2e-integrated.mjs');

  assert.match(capture, /data-die-count/);
  assert.match(capture, /expected exactly two integrated D6s/);
  assert.match(capture, /values\.total === values\.left \+ values\.right/);
  assert.match(capture, /starts\.length === 1/);
  assert.match(capture, /settled\.length === 1/);
  assert.match(capture, /settled\[0\]\.dice\[0\] === dice\.left/);
  assert.match(capture, /settled\[0\]\.total === dice\.total/);
});

test('BG12G-R2E stresses renderer lifecycle and then proves MapLibre remains interactive', () => {
  const capture = read('scripts/capture-bg12g-r2e-integrated.mjs');

  assert.match(capture, /__bg12gDiceRendererLifecycle/);
  assert.match(capture, /for \(let index = 0; index < 4; index \+= 1\)/);
  assert.match(capture, /lifecycleFinal\.created === lifecycleFinal\.disposed/);
  assert.match(capture, /lifecycleFinal\.peak <= 2/);
  assert.match(capture, /\.maplibregl-canvas/);
  assert.match(capture, /pointerEvents !== 'none'/);
  assert.match(capture, /page\.mouse\.wheel/);
  assert.match(capture, /page\.mouse\.down\(\)/);
  assert.match(capture, /page\.mouse\.up\(\)/);
});

test('BG12G-R2E ignores only the known MapLibre tile feature-state warning while retaining all other browser errors', () => {
  const capture = read('scripts/capture-bg12g-r2e-integrated.mjs');

  assert.match(capture, /function isKnownTerrainTileStateWarning\(error\)/);
  assert.match(capture, /const undefinedFeatureId = \/Cannot read properties of undefined/);
  assert.match(capture, /if \(!undefinedFeatureId\) return false/);
  assert.match(capture, /const taggedTerrainWarning = \/R3 terrain source warning:/);
  assert.match(capture, /const mapLibreTileStateStack = \/TerrainMapPrototype-/);
  assert.match(capture, /setFeatureState\|initializeTileState\|_tileLoaded\|_loadTile/);
  assert.match(capture, /return taggedTerrainWarning \|\| mapLibreTileStateStack/);
  assert.match(capture, /&& !isKnownTerrainTileStateWarning\(error\)/);
  assert.match(capture, /knownTerrainTileStateWarnings: knownTerrainWarnings\.length/);
  assert.match(capture, /page\.on\('pageerror', error => errors\.push\(serialisePageError\(error\)\)\)/);
});

test('BG12G-R2E exercises reduced motion and forced WebGL fallback without changing authoritative results', () => {
  const capture = read('scripts/capture-bg12g-r2e-integrated.mjs');

  assert.match(capture, /reducedMotion: 'reduce'/);
  assert.match(capture, /settledMs < 800/);
  assert.match(capture, /bg12g-force-dice-fallback=1/);
  assert.match(capture, /data-bg12g-dice-fallback="true"/);
  assert.match(capture, /dice\.renderer === 'fallback'/);
  assert.match(capture, /copy\.includes\(`\$\{dice\.left\} \+ \$\{dice\.right\} = \$\{dice\.total\}`\)/);
});

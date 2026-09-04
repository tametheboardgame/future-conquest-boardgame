const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG11C 2D6 preview derives its chance from the authoritative combat helper', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');

  assert.match(combat, /getBoardCombatPreview/);
  assert.match(combat, /getBoardCombatHitChance\(preview\.target, preview\.attackModifier\)/);
  assert.match(combat, /chance\.minimumDiceTotal/);
  assert.match(combat, /chance\.percent/);
  assert.match(combat, /Need \{chance\.minimumDiceTotal\}\+ on 2D6/);
  assert.match(combat, /Roll 2D6 · 1 Command Action/);
});

test('BG11C resolved roll shows the authoritative equation and consequences', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');

  assert.match(combat, /result\.dice/);
  assert.match(combat, /result\.die/);
  assert.match(combat, /result\.attackTotal/);
  assert.match(combat, /result\.target/);
  assert.match(combat, /latestCombat\?\.modifiers\.supply/);
  assert.match(combat, /★ CRITICAL HIT/);
  assert.match(combat, /✓ HIT/);
  assert.match(combat, /× MISS/);
  assert.match(combat, /Damage \+\{consequence\.damageInflicted\}/);
  assert.match(combat, /Readiness -\{consequence\.readinessLoss\}/);
  assert.match(combat, /aria-live="polite"/);
});

test('BG11C remains presentation-only and does not introduce a second RNG path', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const renderer = read('src/components/Bg12gIntegratedDiceRenderer.tsx');
  const css = read('src/bg12g-dice-tray.css');

  assert.match(combat, /dispatchBoardAction\(\{\s*type: 'attack-piece'/s);
  assert.doesNotMatch(combat, /Math\.random|crypto\.getRandomValues|nextBoardRandom/);
  assert.doesNotMatch(combat, /MapLibre|maplibre|TerrainMapPrototype|setFeatureState|addLayer/);
  assert.match(combat, /data-bg-dice-presentation="BG11C"/);
  assert.match(combat, /data-bg-dice-model="BG12G-R-2D6"/);
  assert.match(combat, /Bg12gIntegratedDiceRenderer/);
  assert.match(renderer, /makeD6/);
  assert.doesNotMatch(renderer, /Math\.random|crypto\.getRandomValues|nextBoardRandom|dispatchBoardAction|attack-piece/);
  assert.match(css, /bg12g-integrated-dice/);
  assert.doesNotMatch(css, /bg12g-d6-face|transform-style:\s*preserve-3d/);
});

test('BG11C dice feedback remains accessible without motion or colour', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const css = read('src/bg12g-dice-tray.css');

  assert.match(combat, /★ CRITICAL HIT/);
  assert.match(combat, /✓ HIT/);
  assert.match(combat, /× MISS/);
  assert.match(combat, /Two D6 rolled/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation:\s*none !important/);
  assert.match(css, /forced-colors: active/);
});
